'use strict';
// Ядро движка мультфильма: тема, шрифты, анимационные функции, карточки с мягкими тенями, фоны, свечение.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const IN = '/usr/share/fonts/opentype/inter/', JB = '/usr/share/fonts/truetype/jetbrains-mono/';
for (const f of ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black']) GlobalFonts.registerFromPath(IN + `Inter-${f}.otf`, 'Inter');
for (const f of ['Regular', 'Medium', 'Bold']) GlobalFonts.registerFromPath(JB + `JetBrainsMono-${f}.ttf`, 'JetBrains Mono');

const W = 1920, H = 1080;
const T = {
  cream: '#F7F2E8', cream2: '#EFE6D5', ink: '#211C27', ink2: '#3B3446', muted: '#6F6679', line: '#DCD2BF',
  orange: '#E5794F', orangeD: '#C45A36', orangeL: '#F8B28F', peach: '#FCDCC8',
  teal: '#27B3A3', blue: '#4C8DFF', violet: '#8A6CFF', pink: '#FF6FA5', yellow: '#FFC443', green: '#3CC585', red: '#F0554D',
  night: '#15121D', night2: '#241C36', night3: '#322749',
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  out: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: t => (t === 0 || t === 1) ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  bounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
};
function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- цвета ----------
const HEXC = {};
function hex(h) {
  if (HEXC[h]) return HEXC[h];
  if (h[0] !== '#') return (HEXC[h] = [128, 128, 128]);
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return (HEXC[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
}
function mix(a, b, t) { const A = hex(a), B = hex(b); t = clamp(t); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
function mixHex(a, b, t) { const A = hex(a), B = hex(b); t = clamp(t); const c = [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], t)).toString(16).padStart(2, '0')); return '#' + c.join(''); }
const rgba = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const light = (h, t = 0.35) => mixHex(h, '#ffffff', t), dark = (h, t = 0.3) => mixHex(h, '#000000', t);

// ---------- градиенты ----------
function lg(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function rg(ctx, x0, y0, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }

// ---------- текст ----------
function font(size, w = 500, fam) { return `${w} ${size}px ${fam === 'mono' ? '"JetBrains Mono"' : 'Inter'}`; }
function txt(ctx, s, x, y, o = {}) {
  const { size = 36, w = 500, color = T.ink, align = 'left', base = 'alphabetic', alpha = 1, fam, shadow } = o;
  if (alpha <= 0.002) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font(size, w, fam); ctx.textAlign = align; ctx.textBaseline = base;
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillText(s, x + 2, y + 3); }
  ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
}
function wrap(ctx, s, maxW, size, w = 500, fam) {
  ctx.font = font(size, w, fam); const out = []; let cur = '';
  for (const word of s.split(' ')) { const t = cur ? cur + ' ' + word : word; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = word; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function block(ctx, s, x, y, maxW, o = {}) {
  const { size = 36, w = 500, lh = size * 1.3, align = 'left', fam } = o; const lines = wrap(ctx, s, maxW, size, w, fam);
  lines.forEach((l, i) => txt(ctx, l, align === 'center' ? x + maxW / 2 : align === 'right' ? x + maxW : x, y + i * lh, o)); return lines.length * lh;
}
function tw(ctx, s, size, w = 500, fam) { ctx.font = font(size, w, fam); return ctx.measureText(s).width; }

// ---------- фигуры ----------
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function circle(ctx, x, y, r, fill, stroke, lw = 2) { if (!(r > 0.01)) return; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); } }
function line(ctx, x1, y1, x2, y2, color = T.ink, lw = 3, dash = null) { ctx.save(); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = lw; ctx.strokeStyle = color; if (dash) ctx.setLineDash(dash); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); }

// кэш мягких теней: рисуется один раз спрайтом, затем drawImage
const SH = new Map();
function shadowSprite(w, h, r, blur) {
  const k = `${Math.round(w)}|${Math.round(h)}|${r}|${blur}`; if (SH.has(k)) return SH.get(k);
  const pad = blur * 2.2, cv = createCanvas(Math.ceil(w + pad * 2), Math.ceil(h + pad * 2)), c = cv.getContext('2d');
  c.shadowColor = 'rgba(0,0,0,1)'; c.shadowBlur = blur; c.shadowOffsetX = cv.width + 10; c.fillStyle = '#000';
  c.beginPath(); c.roundRect(pad - cv.width - 10, pad, w, h, r); c.fill();
  const s = { cv, pad }; SH.set(k, s); return s;
}
function softShadow(ctx, x, y, w, h, r = 20, o = {}) {
  if (!(w > 2 && h > 2)) return;
  const { blur = 30, alpha = 0.22, dy = 14, color } = o; const s = shadowSprite(w, h, r, blur);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(s.cv, x - s.pad, y - s.pad + dy); ctx.restore();
}
// «глянцевая» карточка
function gcard(ctx, x, y, w, h, o = {}) {
  if (!(w > 2 && h > 2)) return;
  const { fill = '#ffffff', r = 26, alpha = 1, shadow = true, border = null, gloss = true, shadowAlpha = 0.2 } = o;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow) softShadow(ctx, x, y, w, h, r, { alpha: shadowAlpha, blur: Math.min(46, 14 + h * 0.12) });
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = Array.isArray(fill) ? lg(ctx, 0, y, 0, y + h, [[0, fill[0]], [1, fill[1]]]) : fill; ctx.fill();
  if (gloss) { ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = lg(ctx, 0, y, 0, y + h * 0.5, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(x, y, w, h * 0.5); ctx.restore(); }
  if (border) { rr(ctx, x, y, w, h, r); ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke(); }
  ctx.restore();
}
function pill(ctx, s, x, y, o = {}) {
  const { size = 30, fill = T.ink, color = '#fff', w: fw = 700, padX = 24, h = size + 26, alpha = 1, align = 'left', icon } = o;
  const w = tw(ctx, s, size, fw) + padX * 2; const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  gcard(ctx, x0, y, w, h, { fill: Array.isArray(fill) ? fill : [light(fill, 0.18), fill], r: h / 2, alpha, shadowAlpha: 0.18 });
  txt(ctx, s, x0 + padX, y + h / 2 + 1, { size, w: fw, color, base: 'middle', alpha }); return w;
}
function badge(ctx, cx, cy, r, color, alpha = 1) {
  if (!(r > 0.5)) return;
  ctx.save(); ctx.globalAlpha *= alpha; softShadow(ctx, cx - r, cy - r, r * 2, r * 2, r, { alpha: 0.25, blur: r * 0.5, dy: r * 0.25 });
  circle(ctx, cx, cy, r, rg(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05, [[0, light(color, 0.45)], [0.55, color], [1, dark(color, 0.22)]]));
  ctx.beginPath(); ctx.ellipse(cx - r * 0.2, cy - r * 0.55, r * 0.45, r * 0.22, -0.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill(); ctx.restore();
}
function glow(ctx, x, y, r, color, a = 0.8) {
  if (!(r > 0.5)) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a;
  circle(ctx, x, y, r, rg(ctx, x, y, 0, x, y, r, [[0, rgba(color, 0.9)], [0.35, rgba(color, 0.35)], [1, rgba(color, 0)]])); ctx.restore();
}
function bar(ctx, x, y, w, h, p, color, o = {}) {
  gcard(ctx, x, y, w, h, { fill: o.bg || 'rgba(60,50,80,0.14)', r: h / 2, shadow: false, gloss: false });
  if (p > 0.003) gcard(ctx, x, y, Math.max(h, w * clamp(p)), h, { fill: [light(color, 0.25), color], r: h / 2, shadow: false });
}
// изогнутая стрелка с бегущими точками; progress 0..1 — рисование, flow — время для движения
function curve(ctx, a, b, o = {}) {
  const { bend = 0, color = T.ink2, lw = 6, p = 1, head = true, flow = null, dash = null, alpha = 1 } = o;
  if (p <= 0.003 || alpha <= 0.003) return;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const c = [mx - dy / L * bend, my + dx / L * bend];
  const pt = t => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); const n = 40; for (let i = 1; i <= n * p; i++) { const q = pt(i / n); ctx.lineTo(q[0], q[1]); } ctx.stroke(); ctx.restore();
  if (head && p > 0.97) { const q = pt(1), q2 = pt(0.94), ang = Math.atan2(q[1] - q2[1], q[0] - q2[0]), hs = lw * 3.2; ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(q[0] + Math.cos(ang) * 2, q[1] + Math.sin(ang) * 2); ctx.lineTo(q[0] - hs * Math.cos(ang - 0.5), q[1] - hs * Math.sin(ang - 0.5)); ctx.lineTo(q[0] - hs * Math.cos(ang + 0.5), q[1] - hs * Math.sin(ang + 0.5)); ctx.closePath(); ctx.fill(); ctx.restore(); }
  if (flow !== null && p > 0.97) for (let k = 0; k < 3; k++) { const t = ((flow * 0.5) + k / 3) % 1, q = pt(t); glow(ctx, q[0], q[1], lw * 3.4, color, 0.8 * alpha); circle(ctx, q[0], q[1], lw * 0.75, light(color, 0.55)); }
  return pt;
}

// ---------- фоны ----------
const BG = {};
function bgBase(kind) {
  if (BG[kind]) return BG[kind];
  const cv = createCanvas(W, H), c = cv.getContext('2d');
  if (kind === 'light') { c.fillStyle = lg(c, 0, 0, W * 0.3, H, [[0, '#FBF7EE'], [1, '#F0E7D6']]); c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(120,100,80,0.07)'; for (let y = 30; y < H; y += 44) for (let x = 30; x < W; x += 44) { c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); } }
  else { c.fillStyle = lg(c, 0, 0, W * 0.4, H, [[0, '#1B1528'], [0.6, '#17121F'], [1, '#0F0C16']]); c.fillRect(0, 0, W, H); }
  return (BG[kind] = cv);
}
const STARS = (() => { const r = rng(3), a = []; for (let i = 0; i < 140; i++) a.push([r() * W, r() * H, 0.6 + r() * 1.8, r() * 6.28, 0.3 + r() * 0.7]); return a; })();
function drawBg(ctx, kind, t) {
  ctx.drawImage(bgBase(kind), 0, 0);
  if (kind === 'light') {
    glow(ctx, 260 + Math.sin(t * 0.25) * 90, 220 + Math.cos(t * 0.21) * 50, 560, T.orangeL, 0.28);
    glow(ctx, 1640 + Math.cos(t * 0.2) * 100, 840 + Math.sin(t * 0.27) * 60, 620, '#7FD6CB', 0.22);
    glow(ctx, 1000 + Math.sin(t * 0.17) * 160, 120, 520, '#FFD98A', 0.16);
  } else {
    glow(ctx, 1500 + Math.sin(t * 0.2) * 120, 260, 700, T.violet, 0.16);
    glow(ctx, 380 + Math.cos(t * 0.18) * 100, 880, 640, T.orange, 0.12);
    ctx.save(); STARS.forEach(s => { const a = s[4] * (0.55 + 0.45 * Math.sin(t * 1.2 + s[3])); ctx.fillStyle = `rgba(255,240,230,${a * 0.65})`; ctx.beginPath(); ctx.arc(s[0], (s[1] + t * 4 * s[2]) % H, s[2] * 0.9, 0, 7); ctx.fill(); }); ctx.restore();
  }
}

module.exports = { createCanvas, W, H, T, clamp, lerp, E, rng, hex, mix, mixHex, rgba, light, dark, lg, rg, font, txt, wrap, block, tw, rr, circle, line, softShadow, gcard, pill, badge, glow, bar, curve, drawBg };
