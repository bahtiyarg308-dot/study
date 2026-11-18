'use strict';
// Вспомогательная библиотека отрисовки: цвета, шрифты, анимационные функции, микроструктуры.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const FD = '/usr/share/fonts/truetype/crosextra/';
for (const f of ['Regular', 'Bold', 'Italic', 'BoldItalic']) GlobalFonts.registerFromPath(FD + `Carlito-${f}.ttf`, 'Carlito');

const W = 1920, H = 1080;
// Палитра = палитра презентации
const C = {
  cream: '#F4F1EB', card: '#E7E2D9', panel: '#FBFAF7', ink: '#1B2230', muted: '#5B6575', navy: '#1E2432', navy2: '#2B3446',
  orange: '#C0501A', orangeL: '#EE8A45', blue: '#336B91', blueL: '#9DC3E6', gold: '#C99A2E', goldL: '#EBD79A',
  red: '#BC3F1A', redL: '#E9B8A6', iron: '#D5D9E0', ironS: '#9AA3B3', hot: '#E4572E', line: '#C9C3B7', green: '#2E7D5B',
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  back: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function mix(a, b, t) {
  const A = hex(a), B = hex(b); t = clamp(t);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
function rgba(h, a) { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// ---------- текст ----------
function font(size, weight) { return `${weight === 'bold' ? 'bold ' : weight === 'italic' ? 'italic ' : weight === 'bi' ? 'bold italic ' : ''}${size}px Carlito`; }
function txt(ctx, s, x, y, o = {}) {
  const { size = 36, weight = 'normal', color = C.ink, align = 'left', base = 'alphabetic', alpha = 1 } = o;
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.font = font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y); ctx.restore();
}
function wrap(ctx, s, maxW, size, weight) {
  ctx.font = font(size, weight);
  const words = s.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function block(ctx, s, x, y, maxW, o = {}) {
  const { size = 36, weight = 'normal', lh = size * 1.28, align = 'left' } = o;
  const lines = wrap(ctx, s, maxW, size, weight);
  lines.forEach((l, i) => txt(ctx, l, align === 'center' ? x + maxW / 2 : x, y + i * lh, { ...o, align }));
  return lines.length * lh;
}
function tw(ctx, s, size, weight) { ctx.font = font(size, weight); return ctx.measureText(s).width; }

// ---------- фигуры ----------
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function card(ctx, x, y, w, h, o = {}) {
  const { fill = C.card, r = 22, alpha = 1, stroke = null, shadow = false } = o;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow) { ctx.shadowColor = 'rgba(20,25,40,0.22)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10; }
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.shadowColor = 'transparent'; ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}
function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, color = C.ink, lw = 3, dash = null) {
  ctx.save(); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineWidth = lw; ctx.strokeStyle = color; if (dash) ctx.setLineDash(dash); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
}
function arrow(ctx, x1, y1, x2, y2, color = C.ink, lw = 4, head = 16) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  line(ctx, x1, y1, x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6, color, lw);
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); ctx.restore();
}
function pill(ctx, s, x, y, o = {}) { // подпись-«таблетка»; x,y — левый верхний
  const { size = 30, fill = C.navy, color = C.cream, weight = 'bold', padX = 22, h = size + 22, alpha = 1, align = 'left' } = o;
  const w = tw(ctx, s, size, weight) + padX * 2;
  const x0 = align === 'center' ? x - w / 2 : x;
  card(ctx, x0, y, w, h, { fill, r: h / 2, alpha });
  txt(ctx, s, x0 + padX, y + h / 2, { size, weight, color, base: 'middle', alpha });
  return w;
}
function bar(ctx, x, y, w, h, p, color, o = {}) { // горизонтальная шкала
  card(ctx, x, y, w, h, { fill: o.bg || 'rgba(120,120,130,0.22)', r: h / 2 });
  if (p > 0.001) card(ctx, x, y, Math.max(h, w * clamp(p)), h, { fill: color, r: h / 2 });
}

// ---------- микроструктуры (схема как на слайде 4) ----------
// kind: 'aus' | 'pearl' | 'bain' | 'mart'; p — ход превращения 0..1; tt — время (для теплового дрожания)
const CARBON_START = (() => {
  const r = rng(7), pts = []; const used = new Set();
  while (pts.length < 14) {
    const gx = 1 + Math.floor(r() * 7), gy = Math.floor(r() * 6);   // щель между атомами (по горизонтали)
    const k = gx + ',' + gy; if (used.has(k)) continue; used.add(k);
    pts.push([gx, gy + 0.5]);
  }
  return pts;
})();
const PEARL_BANDS = [2, 4];
const BAIN_CL = [[1.5, 1], [5.6, 1], [3.5, 2], [1.4, 3], [6.3, 3], [3.5, 4], [5.5, 5]];
function carbonTarget(kind, i) {
  if (kind === 'pearl') { const b = i % 2, k = Math.floor(i / 2); return [0.7 + k * 1.1, PEARL_BANDS[b]]; }
  if (kind === 'bain') { const c = BAIN_CL[Math.floor(i / 2)]; return [c[0] + (i % 2 ? 0.32 : -0.32), c[1]]; }
  return CARBON_START[i];
}
function micro(ctx, x, y, kind, p, tt, o = {}) {
  const sc = o.scale || 1, sp = 56 * sc, cols = 8, rows = 6, pw = cols * sp, ph = rows * sp;
  const jit = o.jitter === undefined ? 1 : o.jitter;
  const col = { aus: C.iron, pearl: '#C8CFDB', bain: C.goldL, mart: C.redL }[kind];
  const colS = { aus: C.ironS, pearl: '#8C98AD', bain: '#BFA34F', mart: '#C98C76' }[kind];
  card(ctx, x, y, pw, ph, { fill: C.panel, r: 16 * sc, stroke: 'rgba(0,0,0,0.06)' });
  ctx.save(); rr(ctx, x, y, pw, ph, 16 * sc); ctx.clip();
  const pe = E.io(clamp(p));
  const dots = (o.dots || CARBON_START).map((s, i) => {
    const t = o.dots ? s : carbonTarget(kind === 'aus' ? 'mart' : kind, i);
    const hx = lerp(s[0], t[0], pe), hy = lerp(s[1], t[1], pe);
    const moving = pe > 0 && pe < 1 ? Math.sin(pe * Math.PI) : 0;
    const wob = jit * (kind === 'aus' || p < 1 ? 1 : 0);
    const dx = Math.sin(tt * 3.1 + i * 1.7) * 0.05 * wob + Math.sin(tt * 7 + i) * 0.04 * moving;
    const dy = Math.cos(tt * 2.7 + i * 2.3) * 0.05 * wob + Math.cos(tt * 6 + i) * 0.04 * moving;
    return [hx + dx, hy + dy];
  });
  // полосы / кусочки карбидов
  if (kind === 'pearl') PEARL_BANDS.forEach(by => {
    const w = pe * 7.9 * sp; card(ctx, x + 0.1 * sp, y + by * sp - 0.15 * sp, Math.max(0, w), 0.3 * sp, { fill: C.blueL, r: 0.15 * sp, alpha: clamp(pe * 1.6) });
  });
  if (kind === 'bain') BAIN_CL.forEach(c => {
    card(ctx, x + (c[0] - 0.55) * sp, y + c[1] * sp - 0.15 * sp, 1.1 * sp, 0.3 * sp, { fill: C.blueL, r: 0.15 * sp, alpha: clamp(pe * 1.6) });
  });
  // атомы железа
  const shear = o.shear || 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let ax = (i + 0.5) * sp, ay = (j + 0.5) * sp;
    if (shear) ax += (j - 2.5) * 0.13 * sp * shear;
    if (kind === 'mart') {
      let dx = 0, dy = 0;
      for (let k = 0; k < dots.length; k++) {
        const ddx = ax / sp - dots[k][0], ddy = ay / sp - dots[k][1]; const d = Math.hypot(ddx, ddy);
        if (d < 1.15 && d > 0.01) { const f = (1 - d / 1.15) * 0.26 * sp * pe; dx += ddx / d * f; dy += ddy / d * f; }
      }
      ax += dx; ay += dy;
    }
    const thermal = kind === 'aus' ? 1 : (1 - pe) * 0.6;
    ax += Math.sin(tt * 2.2 + i * 1.3 + j * 0.7) * 1.8 * sc * thermal * jit; ay += Math.cos(tt * 2.5 + i * 0.9 + j * 1.1) * 1.8 * sc * thermal * jit;
    circle(ctx, x + ax, y + ay, 20 * sc, mix(C.iron, col, pe), mix(C.ironS, colS, pe), 1.5);
  }
  // углерод
  dots.forEach(d => circle(ctx, x + d[0] * sp, y + d[1] * sp, 6.5 * sc, C.ink));
  ctx.restore();
  return { w: pw, h: ph };
}

// ---------- сплайн для кривых диаграммы ----------
function catmull(pts, n = 14) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(pts[pts.length - 1]); return out;
}
function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function pathAt(pts, f) { // точка и индекс на доле f длины
  const L = pathLen(pts) * clamp(f); let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= L) { const r = d ? (L - acc) / d : 0; return { x: lerp(pts[i - 1][0], pts[i][0], r), y: lerp(pts[i - 1][1], pts[i][1], r), i }; }
    acc += d;
  }
  const l = pts[pts.length - 1]; return { x: l[0], y: l[1], i: pts.length - 1 };
}
function strokePath(ctx, pts, f, color, lw, dash) {
  const end = pathAt(pts, f); ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < end.i; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineTo(end.x, end.y); ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash); ctx.stroke(); ctx.restore(); return end;
}

module.exports = { CARBON_START, createCanvas, W, H, C, clamp, lerp, E, rng, mix, rgba, txt, wrap, block, tw, rr, card, circle, line, arrow, pill, bar, micro, catmull, pathLen, pathAt, strokePath, font };
