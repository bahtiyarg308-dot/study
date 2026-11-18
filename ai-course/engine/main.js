'use strict';
// Рендер эпизода.
//   node main.js still <timeline.json> <t> <out.png>
//   node main.js range <timeline.json> <fps> <f0> <f1> <out.mp4>
const fs = require('fs');
const { spawn } = require('child_process');
const C = require('./core');
const { createCanvas, W, H, T: TH, clamp, lerp, E, txt, gcard, tw, wrap, glow, circle, drawBg, rg, lg, rr } = C;
const { drawMascot } = require('./mascot');

const LEAD = 0.35;                                  // картинка опережает речь
const tl = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const SCENES = require('./scenes')(C);
const NOCAP = new Set(['cheat', 'quiz', 'recap']);   // текст уже на экране
const total = tl.total, env = tl.env || [];

const scenes = tl.scenes.map((sc, i) => ({ ...sc, i, draw: SCENES[sc.type] }));
const allSents = scenes.flatMap(s => s.beats.flatMap(b => b.sents.map(x => ({ ...x }))));

function makeK(S, T) {
  const bs = i => (S.beats[i] ? S.beats[i].start : S.end), be = i => (S.beats[i] ? S.beats[i].end : S.end);
  let beat = -1; S.beats.forEach((b, i) => { if (T >= b.start) beat = i; });
  const t0 = a => { const [i, off] = Array.isArray(a) ? a : [a, 0]; return bs(i) + off; };
  return {
    T, beat, lt: T - S.start, bs, be, t0,
    p: (a, dur = 0.6, e = E.back) => e(clamp((T - t0(a)) / dur)),
    on: (a) => T >= t0(a),
    prog: (i, off = 0, end = 0) => clamp((T - bs(i) - off) / Math.max(0.01, be(i) - bs(i) - off - end)),
    sent: (i, k) => (S.beats[i] && S.beats[i].sents[k] ? S.beats[i].sents[k].start : be(i)),
  };
}
function sceneAt(T) { let k = 0; for (let i = 0; i < scenes.length; i++) if (T >= scenes[i].start) k = i; return scenes[k]; }

// ---------- шапка ----------
function drawHeader(ctx, S, T, dark) {
  if (S.noHeader || (S.draw && S.draw.noHeader)) return;
  const lt = T - S.start, a = E.out(clamp((lt + 0.1) / 0.6)), b = E.back(clamp((lt - 0.05) / 0.7));
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - clamp(b)) * 18);
  const w = tw(ctx, S.label.toUpperCase(), 24, 800) + 56;
  gcard(ctx, 110, 62, w, 46, { fill: [C.light(TH.orange, 0.2), TH.orange], r: 23, shadowAlpha: 0.2 });
  circle(ctx, 134, 85, 6, '#fff');
  txt(ctx, S.label.toUpperCase(), 152, 86, { size: 24, w: 800, color: '#fff', base: 'middle' });
  txt(ctx, S.title, 110, 172, { size: 64, w: 800, color: dark ? '#FFF7EE' : TH.ink });
  ctx.restore();
  txt(ctx, `${S.i + 1}/${scenes.length}`, W - 110, 85, { size: 26, w: 700, color: dark ? '#9C93AE' : TH.muted, align: 'right', base: 'middle', alpha: a });
}

// ---------- талисман ----------
function drawMascotOverlay(ctx, S, T, t) {
  if (S.mascot === 'none' || (S.draw && S.draw.ownMascot)) return;
  const K0 = makeK(S, T); const bi = Math.max(0, K0.beat), B = S.beats[bi] || {}, Bp = S.beats[bi - 1] || {};
  const mood = B.mood || S.mood || 'happy', prev = (bi > 0 ? (Bp.mood || S.mood || 'happy') : mood);
  const f = Math.floor(t * 30), mouth = clamp((env[f] || 0) * 1.15 - 0.04);
  const bs = B.start || S.start, k = E.out(clamp((T - bs) / 0.45)), hop = Math.sin(Math.PI * clamp((T - bs) / 0.5)) * 14 * (bi > 0 || K0.lt > 1 ? 1 : 0.5);
  const lt = T - S.start, appear = E.back(clamp((lt + 0.05) / 0.7));
  const R = 76 * (0.6 + 0.4 * appear);
  ctx.save(); ctx.globalAlpha *= clamp(appear * 1.6);
  drawMascot(ctx, 1738, 912 + (1 - appear) * 60, R, { t, mouth, mood: prev, mood2: mood, moodK: k, hop, look: [-0.55 + 0.3 * Math.sin(t * 0.6), 0.05], wave: lt < 2.2 ? clamp(1 - lt / 2.2) : 0 });
  ctx.restore();
}

// ---------- субтитры ----------
function drawCaption(ctx, t, S, dark) {
  if (NOCAP.has(S.type)) return;
  let cur = null; for (const s of allSents) { if (t >= s.start - 0.05 && t < s.end + 0.3) { cur = s; break; } } if (!cur) return;
  const a = clamp((t - cur.start + 0.05) / 0.15) * clamp((cur.end + 0.3 - t) / 0.2);
  let size = 36, lines = wrap(ctx, cur.text, 1360, size, 600); if (lines.length > 2) { size = 32; lines = wrap(ctx, cur.text, 1400, size, 600); }
  const lh = size * 1.32, h = lines.length * lh + 28; let w = 0; lines.forEach(l => { w = Math.max(w, tw(ctx, l, size, 600)); }); w += 60;
  const cx = 840, x = cx - w / 2, y = 1048 - h - 4;
  gcard(ctx, x, y, w, h, { fill: ['rgba(34,28,46,0.9)', 'rgba(24,19,34,0.92)'], r: 22, alpha: a, shadowAlpha: 0.3, gloss: false });
  lines.forEach((l, i) => txt(ctx, l, cx, y + 14 + size * 0.98 + i * lh, { size, w: 600, color: '#FFF6EC', align: 'center', alpha: a }));
}

function drawProgress(ctx, t, dark) {
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.10)' : 'rgba(40,30,50,0.10)'; ctx.fillRect(0, H - 7, W, 7);
  ctx.fillStyle = lg(ctx, 0, 0, W, 0, [[0, TH.orangeL], [1, TH.orange]]); ctx.fillRect(0, H - 7, W * clamp(t / total), 7);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(40,30,50,0.35)'; scenes.forEach(s => { if (s.i > 0) ctx.fillRect(W * (s.start / total) - 1, H - 7, 2, 7); });
}

// ---------- ирис-переход из талисмана ----------
function drawIris(ctx, open) {
  if (open >= 0.999) return; const cx = 1738, cy = 912, r = open * 2200;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2, true);
  ctx.fillStyle = rg(ctx, cx, cy, 0, cx, cy, 2200, [[0, '#F59A72'], [0.5, TH.orange], [1, '#D2603B']]); ctx.fill('evenodd');
  if (r > 4) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,225,200,0.75)'; ctx.stroke(); }
  ctx.restore();
}

function frame(ctx, t) {
  const T = t + LEAD, S = sceneAt(T), K = makeK(S, T), dark = !!S.dark; K.mouth = clamp((env[Math.floor(t * 30)] || 0) * 1.15 - 0.04); K.t = t;
  drawBg(ctx, dark ? 'dark' : 'light', t);
  ctx.save(); const z = 1 + 0.01 * clamp(K.lt / 25); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  if (S.draw) S.draw(ctx, T, S, K); ctx.restore();
  drawHeader(ctx, S, T, dark);
  drawMascotOverlay(ctx, S, T, t);
  drawCaption(ctx, t, S, dark);
  drawProgress(ctx, t, dark);
  // переходы
  const nxt = scenes[S.i + 1], endT = S.end;
  let open = 1;
  if (S.i > 0) open = Math.min(open, E.io(clamp((T - S.start + 0.02) / 0.6)));
  if (nxt || true) open = Math.min(open, 1 - E.io(clamp((T - (endT - 0.55)) / 0.55)));
  if (S.i === 0) { const f = clamp(T / 0.8); ctx.save(); ctx.globalAlpha = 1 - f; ctx.fillStyle = '#15121D'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  drawIris(ctx, open);
}

if (process.argv[2] === 'still') {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d'); frame(ctx, parseFloat(process.argv[4])); fs.writeFileSync(process.argv[5], cv.toBuffer('image/png'));
} else if (process.argv[2] === 'range') {
  const fps = parseInt(process.argv[4]), f0 = parseInt(process.argv[5]), f1 = parseInt(process.argv[6]), out = process.argv[7];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  (async () => {
    for (let f = f0; f < f1; f++) {
      ctx.clearRect(0, 0, W, H); frame(ctx, f / fps);
      if (!ff.stdin.write(cv.data())) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 600 === 0) process.stderr.write(`  [${out.split('/').pop()}] ${f - f0}/${f1 - f0}\n`);
    }
    ff.stdin.end();
  })();
}
