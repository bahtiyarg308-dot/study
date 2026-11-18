'use strict';
// Оригинальный оранжевый талисман курса (мягкая «звёздочка» с лицом). Рисуется кодом, выражения и синхронизация рта.
const { T, clamp, lerp, E, rg, lg, rgba, light, dark, circle, glow, mixHex } = require('./core');

const MOODS = {
  happy:   { brow: [0.0, 0.0, 0.0],   smile: 1.0, eye: 1.0, blush: 0.5, mouth: 0.0 },
  excited: { brow: [-0.15, 0.15, -6], smile: 1.4, eye: 1.12, blush: 0.8, mouth: 0.0 },
  think:   { brow: [0.35, -0.1, -4],  smile: 0.1, eye: 0.9, blush: 0.25, mouth: 0.0 },
  wow:     { brow: [0.0, 0.0, -14],   smile: -0.2, eye: 1.25, blush: 0.4, mouth: 0.35 },
  sad:     { brow: [0.5, -0.5, 2],    smile: -0.8, eye: 0.95, blush: 0.2, mouth: 0.0 },
  smug:    { brow: [0.25, 0.1, 0],    smile: 1.2, eye: 0.75, blush: 0.5, mouth: 0.0 },
  focus:   { brow: [-0.3, 0.3, 2],    smile: 0.3, eye: 0.85, blush: 0.2, mouth: 0.0 },
};
const MCACHE = {};
function lerpMood(a, b, k) {
  return { brow: a.brow.map((v, i) => lerp(v, b.brow[i], k)), smile: lerp(a.smile, b.smile, k), eye: lerp(a.eye, b.eye, k), blush: lerp(a.blush, b.blush, k), mouth: lerp(a.mouth, b.mouth, k) };
}
function blinkAt(t) { let b = 0; const p1 = t % 3.4, p2 = (t + 1.3) % 5.9; if (p1 < 0.16) b = Math.max(b, Math.sin(p1 / 0.16 * Math.PI)); if (p2 < 0.14) b = Math.max(b, Math.sin(p2 / 0.14 * Math.PI)); return b; }

// st: {t, mouth 0..1, mood, mood2, moodK, look:[x,y], wave 0..1, point 0..1 (правая рука вверх-в сторону), squash, rot, glow, hop}
function drawMascot(ctx, x, y, R, st = {}) {
  const t = st.t || 0, mouth = clamp(st.mouth || 0), sq = st.squash || 0, hop = st.hop || 0;
  const m = st.mood2 ? lerpMood(MOODS[st.mood || 'happy'], MOODS[st.mood2], st.moodK || 0) : MOODS[st.mood || 'happy'];
  const bob = Math.sin(t * 2.3) * R * 0.035 - hop, br = 1 + Math.sin(t * 2.3 - 0.6) * 0.012;
  const sx = (1 + sq * 0.12) * br, sy = (1 - sq * 0.12) / br;
  const blink = blinkAt(t);
  const look = st.look || [Math.sin(t * 0.7) * 0.5, Math.cos(t * 0.5) * 0.25];
  ctx.save(); ctx.translate(x, y + bob); if (st.rot) ctx.rotate(st.rot);
  // тень на полу
  ctx.save(); ctx.translate(0, R * 1.32 - bob + hop * 0.2); ctx.scale(1, 0.18); const shs = 1 - hop / (R * 2.5);
  circle(ctx, 0, 0, R * 0.95 * shs, rg(ctx, 0, 0, 0, 0, 0, R * 0.95 * shs, [[0, 'rgba(40,20,10,0.32)'], [1, 'rgba(40,20,10,0)']])); ctx.restore();
  if (st.glow) glow(ctx, 0, 0, R * 2.2, T.orange, 0.6 * st.glow);
  ctx.scale(sx, sy);
  // ножки
  [-1, 1].forEach(s => { ctx.save(); ctx.translate(s * R * 0.3, R * 1.02); ctx.rotate(s * 0.12); ctx.beginPath(); ctx.ellipse(0, 0, R * 0.17, R * 0.12, 0, 0, 7); ctx.fillStyle = rg(ctx, -R * 0.04, -R * 0.04, 0, 0, 0, R * 0.2, [[0, '#F29B76'], [1, '#B84F32']]); ctx.fill(); ctx.restore(); });
  // ручки
  const arm = (s, ang, lift) => {
    ctx.save(); ctx.translate(s * R * 0.9, R * 0.14); ctx.scale(s, 1); ctx.rotate(0.55 + ang - (lift || 0) * 1.5);
    ctx.beginPath(); ctx.roundRect(-R * 0.1, -R * 0.075, R * 0.44, R * 0.15, R * 0.075); ctx.fillStyle = lg(ctx, 0, -R * 0.075, 0, R * 0.075, [[0, '#F8A47E'], [1, '#DB6C45']]); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.35, 0, R * 0.125, 0, 7); ctx.fillStyle = rg(ctx, R * 0.31, -R * 0.04, 0, R * 0.35, 0, R * 0.15, [[0, '#FFC4A3'], [1, '#E5794F']]); ctx.fill(); ctx.restore();
  };
  const wv = st.wave ? Math.sin(t * 9) * 0.35 * st.wave : 0;
  arm(-1, 0.25 + Math.sin(t * 2.3) * 0.04, 0);
  arm(1, 0.25 + wv, Math.max(st.wave || 0, st.point || 0) * 0.95);
  // тело: мягкая звёздочка
  const N = 10, A = 0.085, ph = Math.sin(t * 0.8) * 0.06;
  ctx.beginPath(); for (let i = 0; i <= 120; i++) { const th = i / 120 * Math.PI * 2, r = R * (1 + A * Math.cos(N * th + ph) ); const px = Math.cos(th) * r, py = Math.sin(th) * r * 0.97; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath();
  ctx.fillStyle = rg(ctx, -R * 0.38, -R * 0.45, R * 0.08, 0, 0, R * 1.12, [[0, '#FFD9BF'], [0.3, '#FBA77F'], [0.68, '#EC7B50'], [1, '#D8613A']]); ctx.fill();
  // контровой свет по краю и тёплая тень снизу
  ctx.save(); ctx.clip(); ctx.fillStyle = rg(ctx, 0, R * 0.62, R * 0.2, 0, R * 0.75, R * 0.95, [[0, 'rgba(150,50,20,0)'], [1, 'rgba(150,50,20,0.20)']]); ctx.fillRect(-R * 1.3, -R * 1.3, R * 2.6, R * 2.6); ctx.restore();
  // блик
  ctx.beginPath(); ctx.ellipse(-R * 0.4, -R * 0.6, R * 0.32, R * 0.15, -0.55, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
  // румянец
  [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(s * R * 0.5, R * 0.2, R * 0.14, R * 0.085, 0, 0, 7); ctx.fillStyle = `rgba(255,105,110,${0.42 * m.blush})`; ctx.fill(); });
  // глаза
  const eo = clamp(m.eye * (1 - blink * 0.95), 0.04, 1.3);
  [-1, 1].forEach(s => {
    const ex = s * R * 0.3, ey = -R * 0.06;
    ctx.save(); ctx.translate(ex, ey);
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.185, R * 0.245 * eo, 0, 0, 7); ctx.fillStyle = '#FFFDFB'; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, R * 0.185, R * 0.245 * eo, 0, 0, 7); ctx.clip();
    const px = look[0] * R * 0.06, py = look[1] * R * 0.07;
    circle(ctx, px, py, R * 0.125, rg(ctx, px, py, 0, px, py, R * 0.13, [[0, '#4A2A22'], [0.7, '#2A1713'], [1, '#1B0E0B']]));
    circle(ctx, px - R * 0.04, py - R * 0.045, R * 0.04 * Math.min(1, eo + 0.2), '#fff'); circle(ctx, px + R * 0.04, py + R * 0.05, R * 0.018, 'rgba(255,255,255,0.8)');
    ctx.restore(); ctx.restore();
    // бровь
    ctx.save(); ctx.translate(ex, ey - R * 0.3 + m.brow[2] * R * 0.006); ctx.rotate((s < 0 ? m.brow[0] : m.brow[1]) * s * -1 * 0.9);
    ctx.lineWidth = R * 0.042; ctx.lineCap = 'round'; ctx.strokeStyle = '#8F3B22'; ctx.beginPath(); ctx.moveTo(-R * 0.13, 0); ctx.quadraticCurveTo(0, -R * 0.045, R * 0.13, 0); ctx.stroke(); ctx.restore();
  });
  // рот
  const my = R * 0.3, op = clamp(Math.max(mouth, m.mouth));
  if (op > 0.06) {
    const w = R * (0.17 + op * 0.05), h = R * (0.03 + op * 0.2);
    ctx.beginPath(); ctx.moveTo(-w, my); ctx.quadraticCurveTo(0, my - h * 0.35 + m.smile * R * 0.02, w, my); ctx.quadraticCurveTo(0, my + h * 1.5 + m.smile * R * 0.03, -w, my); ctx.closePath();
    ctx.fillStyle = '#6E241D'; ctx.fill(); ctx.save(); ctx.clip();
    ctx.beginPath(); ctx.ellipse(0, my + h * 1.15, w * 0.62, h * 0.55, 0, 0, 7); ctx.fillStyle = '#E8736B'; ctx.fill(); ctx.restore();
  } else {
    ctx.lineWidth = R * 0.04; ctx.lineCap = 'round'; ctx.strokeStyle = '#7A2E22'; ctx.beginPath(); ctx.moveTo(-R * 0.17, my); ctx.quadraticCurveTo(0, my + m.smile * R * 0.13, R * 0.17, my); ctx.stroke();
  }
  ctx.restore();
  // искры восторга
  if (m === MOODS.excited || st.sparks) for (let i = 0; i < 5; i++) { const a = t * 1.6 + i * 1.26, d = R * (1.35 + 0.15 * Math.sin(t * 3 + i)), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8 - R * 0.1; sparkle(ctx, px, py, R * 0.1 * (0.6 + 0.4 * Math.sin(t * 5 + i)), '#FFD15C'); }
}
function sparkle(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * 0.28 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
}
module.exports = { drawMascot, sparkle, MOODS };
