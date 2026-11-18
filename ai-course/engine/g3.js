'use strict';
// Мини-движок 3D поверх canvas: перспективная камера, шары с бликами, кубы с освещением, поверхности, линии, свечение.
const { T, clamp, lerp, rg, lg, rgba, light, dark, mixHex, hex, circle, glow, font } = require('./core');

class Cam {
  constructor(o = {}) { Object.assign(this, { yaw: 0.6, pitch: 0.35, dist: 12, f: 1500, cx: 960, cy: 540, tx: 0, ty: 0, tz: 0 }, o); }
  prj(p) {
    const x = p[0] - this.tx, y = p[1] - this.ty, z = p[2] - this.tz, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const y1 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp, d = this.dist + z2, k = this.f / Math.max(0.2, d);
    return { x: this.cx + x1 * k, y: this.cy - y1 * k, k, d };
  }
}
const LIGHT = (() => { const l = [-0.45, 0.8, -0.4], n = Math.hypot(...l); return l.map(v => v / n); })();

class Scene3D {
  constructor(cam) { this.cam = cam; this.items = []; this.back = []; }
  sphere(p, r, color, o = {}) { const q = this.cam.prj(p); this.items.push({ d: q.d + (o.bias || 0), kind: 'sphere', q, r: r * q.k, color, ...o }); }
  line(a, b, color, w = 2, o = {}) { const qa = this.cam.prj(a), qb = this.cam.prj(b); this.items.push({ d: (qa.d + qb.d) / 2 + (o.bias || 0), kind: 'line', qa, qb, color, w, ...o }); }
  poly(pts, fill, o = {}) { const qs = pts.map(p => this.cam.prj(p)); this.items.push({ d: qs.reduce((s, q) => s + q.d, 0) / qs.length, kind: 'poly', qs, fill, ...o }); }
  glow(p, r, color, a = 0.8) { const q = this.cam.prj(p); this.items.push({ d: q.d - 0.01, kind: 'glow', q, r: r * q.k, color, a }); }
  label(p, text, o = {}) { const q = this.cam.prj(p); this.items.push({ d: q.d - 0.02 + (o.bias || 0), kind: 'label', q, text, ...o }); }
  shadow(p, r, floorY, a = 0.25) { const q = this.cam.prj([p[0], floorY, p[2]]); this.back.push({ d: q.d, kind: 'shadow', q, r: r * q.k, a }); }
  box(c, s, color, o = {}) {
    const [cx, cy, cz] = c, [sx, sy, sz] = s.map(v => v / 2), V = [];
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) V.push([cx + dx * sx, cy + dy * sy, cz + dz * sz]);
    // индексы: 0:(-,-,-) 1:(-,-,+) 2:(-,+,-) 3:(-,+,+) 4:(+,-,-) 5:(+,-,+) 6:(+,+,-) 7:(+,+,+)
    const F = [[[4, 5, 7, 6], [1, 0, 0]], [[0, 2, 3, 1], [-1, 0, 0]], [[2, 6, 7, 3], [0, 1, 0]], [[0, 1, 5, 4], [0, -1, 0]], [[1, 3, 7, 5], [0, 0, 1]], [[0, 4, 6, 2], [0, 0, -1]]];
    const Q = V.map(v => this.cam.prj(v)), faces = [];
    F.forEach(([idx, n]) => {
      const pts = idx.map(i => Q[i]); let area = 0; for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4]; area += a.x * b.y - b.x * a.y; }
      if (area > 0) return; // нелицевая грань
      const lam = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      faces.push({ pts, shade: 0.42 + 0.58 * lam, d: pts.reduce((s, q) => s + q.d, 0) / 4 });
    });
    const d = Q.reduce((s, q) => s + q.d, 0) / 8; this.items.push({ d, kind: 'box', faces, color, a: o.a === undefined ? 1 : o.a, edge: o.edge });
  }
  flush(ctx) {
    this.back.forEach(b => { ctx.save(); ctx.translate(b.q.x, b.q.y); ctx.scale(1, 0.32); circle(ctx, 0, 0, b.r * 1.15, rg(ctx, 0, 0, 0, 0, 0, b.r * 1.15, [[0, `rgba(0,0,0,${b.a})`], [1, 'rgba(0,0,0,0)']])); ctx.restore(); });
    this.items.sort((a, b) => b.d - a.d);
    for (const it of this.items) {
      const al = it.alpha === undefined ? 1 : it.alpha; if (al <= 0.01) continue;
      ctx.save(); ctx.globalAlpha *= al;
      if (it.kind === 'sphere') {
        const { q, r, color } = it; if (it.glowA) glow(ctx, q.x, q.y, r * 2.6, color, it.glowA);
        circle(ctx, q.x, q.y, r, rg(ctx, q.x - r * 0.38, q.y - r * 0.42, r * 0.05, q.x, q.y, r * 1.05, [[0, light(color, 0.75)], [0.3, light(color, 0.2)], [0.75, color], [1, dark(color, 0.38)]]));
        ctx.beginPath(); ctx.ellipse(q.x - r * 0.3, q.y - r * 0.5, r * 0.3, r * 0.15, -0.5, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
        if (it.ring) circle(ctx, q.x, q.y, r, null, it.ring, Math.max(2, r * 0.12));
      } else if (it.kind === 'line') {
        ctx.lineCap = 'round'; ctx.strokeStyle = it.color; ctx.lineWidth = it.wk ? it.wk * it.qa.k : it.w; ctx.beginPath(); ctx.moveTo(it.qa.x, it.qa.y); ctx.lineTo(it.qb.x, it.qb.y); ctx.stroke();
      } else if (it.kind === 'poly') {
        ctx.beginPath(); it.qs.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fillStyle = it.fill; ctx.fill(); if (it.stroke) { ctx.lineWidth = it.lw || 1; ctx.strokeStyle = it.stroke; ctx.stroke(); }
      } else if (it.kind === 'glow') glow(ctx, it.q.x, it.q.y, it.r, it.color, it.a);
      else if (it.kind === 'label') {
        const s = it.size * (it.fixed ? 1 : clamp(it.q.k / 110, 0.75, 1.5)); ctx.font = font(s, it.w || 700, it.fam); ctx.textAlign = it.align || 'center'; ctx.textBaseline = 'middle';
        if (it.bg) { const w = ctx.measureText(it.text).width + s * 0.9; ctx.fillStyle = it.bg; ctx.beginPath(); ctx.roundRect(it.q.x - w / 2, it.q.y - s * 0.78, w, s * 1.56, s * 0.78); ctx.fill(); }
        ctx.fillStyle = it.color || '#fff'; ctx.fillText(it.text, it.q.x, it.q.y + 1);
      } else if (it.kind === 'box') {
        it.faces.sort((a, b) => b.d - a.d); ctx.globalAlpha *= it.a;
        it.faces.forEach(f => { ctx.beginPath(); f.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fillStyle = f.shade > 0.7 ? mixHex(it.color, '#ffffff', (f.shade - 0.7) * 1.2) : mixHex(it.color, '#000000', (0.7 - f.shade) * 0.9); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = it.edge || 'rgba(255,255,255,0.25)'; ctx.stroke(); });
      }
      ctx.restore();
    }
  }
}
// сетка-пол с затуханием
function floorGrid(ctx, cam, y, half, step, color, a = 0.5) {
  ctx.save(); ctx.lineWidth = 1.5;
  for (let i = -half; i <= half; i += step) {
    [[[i, y, -half], [i, y, half]], [[-half, y, i], [half, y, i]]].forEach(([p, q]) => {
      const A = cam.prj(p), B = cam.prj(q), fade = clamp(1.25 - Math.hypot(i, 0) / (half * 1.1), 0.12, 1);
      ctx.strokeStyle = rgba(color, a * fade); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    });
  }
  ctx.restore();
}
module.exports = { Cam, Scene3D, floorGrid };
