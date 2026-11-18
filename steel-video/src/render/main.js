'use strict';
// Рендер видео. Режимы:
//   node main.js still <timeline.json> <t_сек> <out.png>        — один кадр (для проверки)
//   node main.js range <timeline.json> <fps> <f0> <f1> <out.mp4> — диапазон кадров -> mp4 (без звука)
const fs = require('fs');
const { spawn } = require('child_process');
const L = require('./lib');
const { createCanvas, W, H, C, clamp, E, txt, card, wrap, tw, rr } = L;

const LEAD = 0.35;                       // картинка опережает речь на 0.35 с
const mode = process.argv[2];
const tl = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const SCENES = Object.assign({}, require('./scenes1')(L), require('./scenes2')(L));
const NOCAP = new Set(['qa', 'cheat', 'plan']);   // там текст уже на экране

// --- подготовка сцен ---
const scenes = tl.scenes.map((sc, i) => {
  const b = {}, sents = {};
  sc.beats.forEach(be => { b[be.cue] = { s: be.start, e: be.end }; sents[be.cue] = be.sents; });
  return { ...sc, i, b, sents, texts: Object.fromEntries(sc.beats.map(be => [be.cue, be.text])), draw: SCENES[sc.id] };
});
const allSents = scenes.flatMap(s => s.beats.flatMap(b => b.sents.map(x => ({ ...x, scene: s.id }))));
const total = tl.total;

function makeK(S, T) {
  return {
    T,
    a: (cue, off = 0, dur = 0.8, e = E.out) => e(clamp((T - (S.b[cue].s + off)) / dur)),
    s: cue => S.b[cue].s, e: cue => S.b[cue].e, d: cue => S.b[cue].e - S.b[cue].s,
    on: (cue, off = 0) => T >= S.b[cue].s + off,
    // прогресс вдоль всего бита
    prog: (cue, off = 0, end = 0) => clamp((T - S.b[cue].s - off) / Math.max(0.01, S.b[cue].e - S.b[cue].s - off - end)),
    sent: (cue, i) => (S.sents[cue][i] ? S.sents[cue][i].start : S.b[cue].e),
    // «в окне» [cue1.start, cue2.start) с плавным появлением/исчезновением
    win: (c1, c2, fi = 0.45, fo = 0.4) => {
      const s = S.b[c1].s, e = c2 ? S.b[c2].s : S.end;
      return clamp((T - s) / fi) * clamp((e - T) / fo);
    },
    // когда beat ещё не начался -> 0, после начала -> 1 (плавно)
    show: (cue, off = 0, dur = 0.5) => E.out(clamp((T - S.b[cue].s - off) / dur)),
  };
}

function sceneAt(T) {
  let k = 0;
  for (let i = 0; i < scenes.length; i++) if (T >= scenes[i].start) k = i;
  return scenes[k];
}

function drawHeader(ctx, S, T) {
  if (S.noHeader || (S.draw && S.draw.noHeader)) return;
  const lt = T - S.start, a = E.out(clamp((lt + 0.2) / 0.6));
  const dark = S.dark;
  txt(ctx, S.label, 110, 92, { size: 30, weight: 'bold', color: dark ? C.orangeL : C.orange, alpha: a });
  ctx.save(); ctx.translate(0, (1 - a) * 14);
  txt(ctx, S.title, 110, 168, { size: 66, weight: 'bold', color: dark ? C.cream : C.ink, alpha: a });
  ctx.restore();
  txt(ctx, `${S.i + 1} / ${scenes.length} · ${S.chapter}`, W - 110, 92, { size: 26, color: dark ? '#8A94A8' : C.muted, align: 'right', alpha: a });
}

function drawCaption(ctx, t, S) {
  if (NOCAP.has(S.id)) return;
  let cur = null;
  for (const s of allSents) { if (t >= s.start - 0.05 && t < s.end + 0.30) { cur = s; break; } }
  if (!cur) return;
  const a = clamp((t - cur.start + 0.05) / 0.15) * clamp((cur.end + 0.30 - t) / 0.2);
  let size = 40, lines = wrap(ctx, cur.text, 1560, size, 'normal');
  if (lines.length > 2) { size = 36; lines = wrap(ctx, cur.text, 1620, size, 'normal'); }
  const lh = size * 1.3, h = lines.length * lh + 30;
  let w = 0; lines.forEach(l => { w = Math.max(w, tw(ctx, l, size, 'normal')); });
  w += 64; const x = (W - w) / 2, y = 1052 - h - 8;
  card(ctx, x, y, w, h, { fill: S.dark ? 'rgba(10,14,24,0.82)' : 'rgba(27,34,48,0.90)', r: 22, alpha: a });
  lines.forEach((l, i) => txt(ctx, l, W / 2, y + 15 + size * 0.98 + i * lh, { size, color: '#F4F1EB', align: 'center', alpha: a }));
}

function drawProgress(ctx, t, S) {
  const dark = S.dark;
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(27,34,48,0.10)'; ctx.fillRect(0, H - 8, W, 8);
  ctx.fillStyle = C.orange; ctx.fillRect(0, H - 8, W * clamp(t / total), 8);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(27,34,48,0.35)';
  scenes.forEach(s => { if (s.i > 0) ctx.fillRect(W * (s.start / total) - 1, H - 8, 2, 8); });
}

function frame(ctx, t) {
  const T = t + LEAD;
  const S = sceneAt(T);
  ctx.fillStyle = S.dark ? C.navy : C.cream; ctx.fillRect(0, 0, W, H);
  const K = makeK(S, T);
  ctx.save();
  const fi = E.out(clamp((T - S.start + 0.1) / 0.55));
  ctx.globalAlpha = S.i === 0 ? 1 : fi;
  if (S.draw) S.draw(ctx, T, S, K);
  drawHeader(ctx, S, T);
  ctx.restore();
  // переход к следующей сцене: заливка цветом фона следующей
  const nxt = scenes[S.i + 1];
  const endT = nxt ? nxt.start : total;
  const fo = clamp((T - (endT - 0.5)) / 0.5);
  if (fo > 0) { ctx.fillStyle = (nxt ? (nxt.dark ? C.navy : C.cream) : C.navy); ctx.globalAlpha = fo; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  // вход в самую первую сцену
  if (S.i === 0 && T < 0.8) { ctx.fillStyle = C.navy; ctx.globalAlpha = 1 - clamp(T / 0.8); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawCaption(ctx, t, S);
  drawProgress(ctx, t, S);
}

if (mode === 'still') {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  frame(ctx, parseFloat(process.argv[4]));
  fs.writeFileSync(process.argv[5], cv.toBuffer('image/png'));
} else if (mode === 'range') {
  const fps = parseInt(process.argv[4]), f0 = parseInt(process.argv[5]), f1 = parseInt(process.argv[6]), out = process.argv[7];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  (async () => {
    for (let f = f0; f < f1; f++) {
      ctx.clearRect(0, 0, W, H); frame(ctx, f / fps);
      const buf = cv.data();   // RGBA
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 300 === 0) process.stderr.write(`  [${out.split('/').pop()}] ${f - f0}/${f1 - f0}\n`);
    }
    ff.stdin.end();
  })();
}
