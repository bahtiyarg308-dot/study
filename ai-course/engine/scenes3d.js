'use strict';
// 3D- и «научные» сцены: подгонка линии, 3D-ландшафт ошибки (градиентный спуск), переобучение.
module.exports = function (C, H) {
  const { col, idx } = H;
  const { T: TH, clamp, lerp, E, txt, block, tw, gcard, pill, badge, glow, bar, curve, circle, line, rr, rg, lg, light, dark, mix, mixHex, rgba, softShadow, rng } = C;
  const { icon } = require('./icons'); const { Cam, Scene3D, floorGrid } = require('./g3');
  const S = {};

  // ---------- общие данные (одни и те же для 2D- и 3D-сцен) ----------
  const DATA = (() => { const r = rng(11), xs = [], ys = [], g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(6.2832 * r());
    for (let i = 0; i < 14; i++) { const x = -4.5 + 9 * (i + 0.5 * r()) / 13.5; xs.push(x); ys.push(0.62 * x + 4.2 + g() * 0.75); } return { xs, ys, n: xs.length }; })();
  const mse = (w, b) => { let s = 0; for (let i = 0; i < DATA.n; i++) { const e = w * DATA.xs[i] + b - DATA.ys[i]; s += e * e; } return s / DATA.n; };
  const grad = (w, b) => { let gw = 0, gb = 0; for (let i = 0; i < DATA.n; i++) { const e = w * DATA.xs[i] + b - DATA.ys[i]; gw += 2 * e * DATA.xs[i]; gb += 2 * e; } return [gw / DATA.n, gb / DATA.n]; };
  const W0 = -0.45, B0 = 1.0;
  function descend(lr, steps, w = W0, b = B0) { const p = [[w, b, mse(w, b)]]; for (let i = 0; i < steps; i++) { const [gw, gb] = grad(w, b); w -= lr * gw; b -= lr * gb; const L = mse(w, b); p.push([w, b, L]); if (!(L < 1e6)) break; } return p; }
  const BEST = (() => { const p = descend(0.05, 400); return p[p.length - 1]; })();

  // ============ FIT2D: подгоняем линию под точки ============
  S.fit2d = (ctx, T, sc, K) => {
    const x0 = 120, y0 = 270, w = 980, h = 560, X = x => x0 + (x + 5.5) / 11 * w, Y = y => y0 + h - (y - 0) / 9 * h;
    gcard(ctx, x0, y0, w, h, { fill: ['#FFFFFF', '#FBF6EC'], r: 30 });
    ctx.save(); rr(ctx, x0, y0, w, h, 30); ctx.clip();
    ctx.strokeStyle = 'rgba(80,60,100,0.08)'; ctx.lineWidth = 2; for (let i = 1; i < 11; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * w / 11, y0); ctx.lineTo(x0 + i * w / 11, y0 + h); ctx.stroke(); } for (let j = 1; j < 9; j++) { ctx.beginPath(); ctx.moveTo(x0, y0 + j * h / 9); ctx.lineTo(x0 + w, y0 + j * h / 9); ctx.stroke(); }
    // параметры по времени
    const optA = sc.at_opt, dur = Math.min(K.be(optA) - K.bs(optA) - 1, 14);
    const prog = K.on(optA) ? clamp((T - K.bs(optA) - 0.8) / dur) : 0, path = descend(0.05, 90), fi = prog * (path.length - 1), i0 = Math.floor(fi), i1 = Math.min(path.length - 1, i0 + 1), fr = fi - i0;
    const w_ = lerp(path[i0][0], path[i1][0], fr), b_ = lerp(path[i0][1], path[i1][1], fr), L = mse(w_, b_);
    // ошибки (отрезки)
    const pe = K.p(sc.at_err, 0.8, E.out);
    if (pe > 0) for (let i = 0; i < DATA.n; i++) { const px = X(DATA.xs[i]), yp = w_ * DATA.xs[i] + b_, y1 = Y(DATA.ys[i]), y2 = Y(yp); ctx.strokeStyle = rgba(TH.red, 0.75 * clamp(pe * 1.4)); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(px, y1); ctx.lineTo(px, lerp(y1, y2, pe)); ctx.stroke(); }
    // линия
    const pl = K.p(sc.at_line, 0.9, E.out);
    if (pl > 0) { const xa = -5.5, xb = lerp(-5.5, 5.5, pl); ctx.lineCap = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = TH.violet; ctx.shadowColor = rgba(TH.violet, 0.5); ctx.shadowBlur = 16; ctx.beginPath(); ctx.moveTo(X(xa), Y(w_ * xa + b_)); ctx.lineTo(X(xb), Y(w_ * xb + b_)); ctx.stroke(); ctx.shadowBlur = 0; }
    // точки
    for (let i = 0; i < DATA.n; i++) { const p = E.back(clamp((T - K.bs(sc.at_pts) - 0.5 - i * 0.28) / 0.5)); if (p > 0) { const px = X(DATA.xs[i]), py = Y(DATA.ys[i]); ctx.save(); glow(ctx, px, py, 34 * p, TH.orange, 0.4); circle(ctx, px, py, 14 * p, rg(ctx, px - 4, py - 5, 1, px, py, 15, [[0, '#FFD1B3'], [0.5, TH.orange], [1, TH.orangeD]])); ctx.restore(); } }
    ctx.restore();
    txt(ctx, 'x (вход)', x0 + w - 20, y0 + h - 14, { size: 26, w: 700, color: TH.muted, align: 'right' }); txt(ctx, 'y (ответ)', x0 + 22, y0 + 40, { size: 26, w: 700, color: TH.muted });
    // правая панель
    const R = 1160, a1 = K.p(sc.at_line, 0.7, E.out), a2 = K.p(sc.at_err, 0.7, E.out);
    ctx.save(); ctx.globalAlpha *= clamp(a1 * 1.5); gcard(ctx, R, 270, 650, 220, { fill: ['#FFFFFF', '#FBF6EC'], r: 28 });
    txt(ctx, 'Модель', R + 36, 322, { size: 28, w: 800, color: TH.muted }); txt(ctx, 'y = w · x + b', R + 36, 392, { size: 54, w: 900, color: TH.violet, fam: 'mono' });
    txt(ctx, `w = ${w_.toFixed(2)}`, R + 36, 450, { size: 36, w: 800, color: TH.ink, fam: 'mono' }); txt(ctx, `b = ${b_.toFixed(2)}`, R + 300, 450, { size: 36, w: 800, color: TH.ink, fam: 'mono' }); ctx.restore();
    ctx.save(); ctx.globalAlpha *= clamp(a2 * 1.5); gcard(ctx, R, 510, 650, 320, { fill: ['#FFFFFF', '#FBF6EC'], r: 28 });
    txt(ctx, 'Ошибка (loss)', R + 36, 562, { size: 28, w: 800, color: TH.muted }); txt(ctx, L.toFixed(2), R + 36, 640, { size: 76, w: 900, color: mix(TH.green, TH.red, clamp(L / 12)), fam: 'mono' });
    bar(ctx, R + 36, 668, 578, 22, 1 - clamp(L / 12), TH.green);
    // спарклайн ошибки
    const sx = R + 36, sy = 800, sw = 578, sh = 90; txt(ctx, 'ошибка по шагам', sx, 722, { size: 22, w: 600, color: TH.muted });
    ctx.strokeStyle = TH.orange; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath(); const nmax = Math.max(1, Math.floor(fi)); for (let i = 0; i <= nmax; i++) { const px = sx + sw * (i / 90), py = sy - sh * clamp(path[i][2] / path[0][2]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    ctx.restore();
  };

  // ============ LOSS3D: ландшафт ошибки и катящийся шарик ============
  const GRID = 34, WR = [-0.7, 1.9], BR = [-0.5, 8.2], LCAP = 30;
  const mapP = (w, b, L) => [(w - 0.6) / 1.3 * 3.6, 4.6 * (1 - Math.exp(-Math.min(L, 400) / 16)), (b - 4.2) / 4.35 * 3.6];
  const SURF = (() => { const v = []; for (let i = 0; i <= GRID; i++) { const row = []; for (let j = 0; j <= GRID; j++) { const w = lerp(WR[0], WR[1], i / GRID), b = lerp(BR[0], BR[1], j / GRID); row.push({ w, b, L: mse(w, b) }); } v.push(row); } return v; })();
  const heatCol = t => t < 0.33 ? mixHex(TH.teal, TH.blue, t / 0.33) : t < 0.66 ? mixHex(TH.blue, TH.violet, (t - 0.33) / 0.33) : mixHex(TH.violet, TH.orange, (t - 0.66) / 0.34);
  S.loss3d = (ctx, T, sc, K) => {
    const camsP = sc.cams || [{ at: 0, yaw: 0.7, pitch: 0.55, dist: 15 }];
    let ci = 0; camsP.forEach((c, i) => { if (K.on(c.at)) ci = i; }); const cur = camsP[ci], prv = camsP[Math.max(0, ci - 1)], k = ci === 0 ? 1 : E.io(clamp((T - K.bs(cur.at)) / 2.2));
    const cam = new Cam({ yaw: lerp(prv.yaw, cur.yaw, k) + Math.sin(T * 0.18) * 0.07, pitch: lerp(prv.pitch, cur.pitch, k), dist: lerp(prv.dist, cur.dist, k), f: 1500, cx: 760, cy: 640, ty: 1.2 });
    const sc3 = new Scene3D(cam), grow = E.out(clamp((T - K.bs(sc.at_surf || 0) - 0.3) / 2.6));
    glow(ctx, 760, 700, 800, TH.violet, 0.16);
    floorGrid(ctx, cam, 0, 7, 1, TH.violet, 0.35);
    // поверхность
    const P = (i, j) => { const s = SURF[i][j], m = mapP(s.w, s.b, s.L); return [m[0], m[1] * grow, m[2]]; };
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); const lv = (SURF[i][j].L + SURF[i + 1][j + 1].L) / 2 / LCAP;
      const nx = (b[1] - a[1]), nz = (d[1] - a[1]), nn = Math.hypot(nx, 1, nz), shade = clamp(0.62 + 0.55 * ((-nx * -0.4 + 1 * 0.8 + -nz * -0.4) / nn) , 0.35, 1.15);
      const base = heatCol(clamp(Math.pow(lv, 0.6))); sc3.poly([a, b, c, d], shade > 1 ? mixHex(base, '#ffffff', shade - 1) : mixHex(base, '#120C1E', 1 - shade), { stroke: 'rgba(255,255,255,0.10)', lw: 1 });
    }
    // подписи осей
    sc3.label([0, 0, 5.2], 'w — число 1', { size: 28, color: '#E9DFFF', bg: 'rgba(60,45,90,0.7)' }); sc3.label([5.6, 0, 0], 'b — число 2', { size: 28, color: '#E9DFFF', bg: 'rgba(60,45,90,0.7)' });
    // пути шариков
    const runs = sc.runs || []; let hud = null;
    runs.forEach((r, ri) => {
      if (!K.on(r.at)) return; const path = descend(r.lr, r.steps || 60), dur = Math.min(K.be(r.at) - K.bs(r.at) - 0.5, r.dur || 9), pr = clamp((T - K.bs(r.at) - 0.6) / dur), fi = pr * (path.length - 1), i0 = Math.floor(fi), fr = fi - i0, c = col(r.color || 'orange'), active = !(runs[ri + 1] && K.on(runs[ri + 1].at));
      const pt = j => { const q = path[j]; const m = mapP(q[0], q[1], q[2]); return [clamp(m[0], -6, 6), m[1] * grow + 0.12, clamp(m[2], -6, 6)]; };
      for (let j = 0; j < Math.min(i0, path.length - 1); j++) sc3.line(pt(j), pt(j + 1), rgba(c, active ? 0.95 : 0.35), active ? 5 : 3, { bias: -1.6 });
      const q0 = path[i0], q1 = path[Math.min(path.length - 1, i0 + 1)], w = lerp(q0[0], q1[0], fr), b = lerp(q0[1], q1[1], fr), L = lerp(q0[2], q1[2], fr), m = mapP(w, b, L);
      const bp = [clamp(m[0], -6, 6), m[1] * grow + 0.28, clamp(m[2], -6, 6)];
      if (active) { sc3.glow(bp, 1.3, c, 0.8); sc3.shadow(bp, 0.4, 0, 0.4); sc3.sphere(bp, 0.42, c, { glowA: 0.7, bias: -1 }); hud = { r, L, step: Math.round(fi), div: !(L < LCAP * 3) }; }
      else sc3.sphere(bp, 0.18, c, { alpha: 0.7 });
    });
    sc3.flush(ctx);
    txt(ctx, '↑ высота = ошибка', 110, 300, { size: 30, w: 800, color: '#FFD9BF', alpha: grow });
    // правая панель (HUD)
    const R = 1380, ap = clamp(K.beat >= (sc.at_hud ?? 0) ? 1 : 0);
    if (hud) { const q = E.out(clamp((T - K.bs(hud.r.at)) / 0.6)); ctx.save(); ctx.globalAlpha *= q; gcard(ctx, R, 270, 430, 330, { fill: ['#2C2340', '#201833'], r: 28, gloss: false, shadowAlpha: 0.4 });
      txt(ctx, hud.r.label, R + 30, 326, { size: 30, w: 800, color: col(hud.r.color || 'orange') }); txt(ctx, `шаг ${hud.step}`, R + 30, 380, { size: 28, w: 600, color: '#B9AED0', fam: 'mono' });
      txt(ctx, hud.div ? 'ВЗРЫВ' : hud.L.toFixed(2), R + 30, 470, { size: 70, w: 900, color: hud.div ? TH.red : mix(TH.green, TH.orange, clamp(hud.L / 14)), fam: 'mono' }); txt(ctx, 'ошибка', R + 30, 510, { size: 24, w: 600, color: '#B9AED0' });
      txt(ctx, `шаг обучения = ${hud.r.lr}`, R + 30, 568, { size: 26, w: 700, color: '#FFE7D6', fam: 'mono' }); ctx.restore(); }
  };
  S.loss3d.dark = true;

  // ============ OVERFIT2D: недообучение / норма / переобучение ============
  const OFD = (() => { const r = rng(5), g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(6.2832 * r()), f = x => 3.4 + 1.9 * Math.sin(0.62 * x + 0.3); const tr = [], te = [];
    for (let i = 0; i < 10; i++) { const x = 0.4 + i * 1.02 + (r() - 0.5) * 0.3; tr.push([x, f(x) + g() * 0.8]); } for (let i = 0; i < 10; i++) { const x = 0.25 + i * 1.05 + (r() - 0.5) * 0.2; te.push([x, f(x) + g() * 0.8]); } return { tr, te, f }; })();
  function polyfit(pts, deg) {
    const n = deg + 1, A = Array.from({ length: n }, () => new Array(n + 1).fill(0)); const nx = x => (x - 5) / 5;
    pts.forEach(([x, y]) => { const t = nx(x), pw = [1]; for (let k = 1; k < 2 * n; k++) pw.push(pw[k - 1] * t); for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += pw[i + j]; A[i][n] += pw[i] * y; } });
    for (let i = 0; i < n; i++) A[i][i] += 1e-9;
    for (let i = 0; i < n; i++) { let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r; [A[i], A[m]] = [A[m], A[i]]; for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c]; } }
    const co = A.map((row, i) => row[n] / row[i]); return x => { const t = nx(x); let s = 0, pw = 1; for (let i = 0; i < n; i++) { s += co[i] * pw; pw *= t; } return s; };
  }
  const OFM = [{ deg: 1, name: 'Слишком простая', c: TH.blue }, { deg: 4, name: 'В самый раз', c: TH.green }, { deg: 9, name: 'Слишком сложная', c: TH.red }].map(m => { const f = polyfit(OFD.tr, m.deg), rm = pts => Math.sqrt(pts.reduce((s, p) => s + Math.pow(f(p[0]) - p[1], 2), 0) / pts.length); return { ...m, f, etr: rm(OFD.tr), ete: rm(OFD.te) }; });
  S.overfit2d = (ctx, T, sc, K) => {
    const x0 = 120, y0 = 270, w = 980, h = 560, X = x => x0 + x / 10.5 * w, Y = y => y0 + h - (y + 1) / 9.5 * h;
    gcard(ctx, x0, y0, w, h, { fill: ['#FFFFFF', '#FBF6EC'], r: 30 }); ctx.save(); rr(ctx, x0, y0, w, h, 30); ctx.clip();
    // истинная закономерность
    const pT = K.p(sc.at_truth, 1.2, E.out); if (pT > 0) { ctx.strokeStyle = 'rgba(80,60,100,0.28)'; ctx.setLineDash([12, 10]); ctx.lineWidth = 5; ctx.beginPath(); for (let i = 0; i <= 100 * pT; i++) { const x = i / 100 * 10.5; i ? ctx.lineTo(X(x), Y(OFD.f(x))) : ctx.moveTo(X(x), Y(OFD.f(x))); } ctx.stroke(); ctx.setLineDash([]); }
    // модели
    OFM.forEach((m, k) => { const a = sc['at_m' + k], p = K.p(a, 1.4, E.out); if (p <= 0) return; const showAll = K.on(sc.at_test), vis = (K.beat === idx(a) || showAll) ? 1 : 0.0; ctx.save(); ctx.globalAlpha *= vis * clamp(p * 1.5); ctx.lineWidth = 8; ctx.strokeStyle = m.c; ctx.lineJoin = 'round'; ctx.shadowColor = rgba(m.c, 0.5); ctx.shadowBlur = 14; ctx.beginPath();
      for (let i = 0; i <= 160 * p; i++) { const x = i / 160 * 10.5, y = clamp(m.f(x), -1.2, 9.3); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); } ctx.stroke(); ctx.restore(); });
    // точки обучения и теста
    OFD.tr.forEach(([x, y], i) => { const p = E.back(clamp((T - K.bs(sc.at_pts) - 0.4 - i * 0.22) / 0.5)); if (p > 0) { circle(ctx, X(x), Y(y), 12 * p, rg(ctx, X(x) - 3, Y(y) - 4, 1, X(x), Y(y), 13, [[0, '#FFD1B3'], [0.5, TH.orange], [1, TH.orangeD]])); } });
    OFD.te.forEach(([x, y], i) => { const p = E.back(clamp((T - K.t0(sc.at_test) - 0.3 - i * 0.2) / 0.5)); if (p > 0) { circle(ctx, X(x), Y(y), 12 * p, '#FFFFFF', TH.violet, 5); } });
    ctx.restore();
    // легенда
    const lg_ = (x, y, fill, stroke, t, a) => { circle(ctx, x, y, 11, fill, stroke, 4); txt(ctx, t, x + 24, y + 1, { size: 26, w: 700, color: TH.ink2, base: 'middle', alpha: a }); };
    lg_(x0 + 40, y0 + h + 34, TH.orange, null, 'обучающие данные', 1); if (K.on(sc.at_test)) lg_(x0 + 420, y0 + h + 34, '#fff', TH.violet, 'новые (тестовые) данные', 1);
    // правая панель: ошибки
    const R = 1160; const show = OFM.map((m, k) => K.on(sc['at_m' + k]));
    if (K.on(sc.at_err)) OFM.forEach((m, k) => { const p = K.p([sc.at_err, 0.3 + k * 0.9], 0.7, E.out), y = 270 + k * 190; ctx.save(); ctx.globalAlpha *= clamp(p * 1.5); gcard(ctx, R, y, 650, 170, { fill: ['#FFFFFF', '#FBF6EC'], r: 26 }); card_bar(ctx, R, y, m.c);
      txt(ctx, m.name, R + 36, y + 50, { size: 34, w: 800, color: m.c }); txt(ctx, 'ошибка на обучающих', R + 36, y + 94, { size: 24, w: 600, color: TH.muted }); txt(ctx, 'ошибка на новых', R + 36, y + 138, { size: 24, w: 600, color: TH.muted });
      const mx_ = Math.max(...OFM.map(q => Math.max(q.etr, q.ete))); bar(ctx, R + 340, y + 78, 280, 20, p * clamp(m.etr / mx_), TH.orange); bar(ctx, R + 340, y + 122, 280, 20, p * clamp(m.ete / mx_), TH.violet); ctx.restore(); });
  };
  function card_bar(ctx, x, y, c) { ctx.save(); rr(ctx, x, y, 14, 170, 7); ctx.fillStyle = c; ctx.fill(); ctx.restore(); }


  // ============ NEURON: искусственный нейрон с настоящими числами ============
  S.neuron = (ctx, T, sc, K) => {
    const X = [0.9, 0.3, 0.6], Wt = [0.7, -0.5, 0.4], Bias = 0.1, prods = X.map((x, i) => x * Wt[i]), sum = prods.reduce((a, b) => a + b, 0) + Bias, out = Math.max(0, sum);
    const IN = [[230, 400], [230, 585], [230, 770]], SG = [870, 585], ACT = [1260, 585], OUT = [1660, 585];
    const pIn = i => E.back(clamp((T - K.bs(sc.at_in) - 0.4 - i * 0.35) / 0.6)), pW = clamp((T - K.bs(sc.at_w) - 0.3) / 0.9), pS = clamp((T - K.bs(sc.at_sum) - 0.3) / 1.4), pA = clamp((T - K.bs(sc.at_act) - 0.2) / 1.2), pO = E.back(clamp((T - K.bs(sc.at_out) - 0.2) / 0.8));
    IN.forEach((p, i) => { const q = E.out(pW) * (pIn(i) > 0 ? 1 : 0); if (q <= 0) return; const w = Wt[i], c = w >= 0 ? TH.teal : TH.pink, a = [p[0] + 64, p[1]], bb = [SG[0] - 96, SG[1] + (i - 1) * 30];
      curve(ctx, a, bb, { color: c, lw: 5 + Math.abs(w) * 14, p: q, head: false, flow: pS > 0.99 ? T : null, alpha: 0.95 });
      const at = t => [lerp(a[0], bb[0], t), lerp(a[1], bb[1], t)];
      if (q > 0.8) { const m = at(0.3); pill(ctx, `w${'₁₂₃'[i]} = ${w.toFixed(1)}`, m[0] - 62, m[1] - 62, { fill: c, size: 26, h: 46, alpha: clamp((q - 0.8) * 5) }); }
      if (pS > 0.05) { const m = at(0.64), pp = E.out(clamp(pS * 2 - i * 0.3)); pill(ctx, prods[i].toFixed(2), m[0] - 36, m[1] + 12, { fill: '#FFFFFF', color: c, size: 27, h: 44, alpha: pp, padX: 14 }); } });
    IN.forEach((p, i) => { const q = pIn(i); if (q <= 0) return; badge(ctx, p[0], p[1], 62 * q, TH.blue); txt(ctx, X[i].toFixed(1), p[0], p[1] + 2, { size: 40, w: 900, color: '#fff', align: 'center', base: 'middle', alpha: clamp(q) }); txt(ctx, `x${'₁₂₃'[i]}`, p[0] - 88, p[1], { size: 38, w: 800, color: TH.ink2, align: 'right', base: 'middle', alpha: clamp(q) }); });
    txt(ctx, 'входы', 230, 300, { size: 32, w: 800, color: TH.blue, align: 'center', alpha: clamp(pIn(0)) });
    const aS = E.back(clamp((T - K.bs(sc.at_sum)) / 0.8)); if (K.on(sc.at_w)) { const r = 96 * Math.max(0.5, aS > 0 ? 1 : 0.7); badge(ctx, SG[0], SG[1], r, TH.violet); txt(ctx, 'Σ', SG[0], SG[1] - 14, { size: 76, w: 900, color: '#fff', align: 'center', base: 'middle' }); if (pS > 0.1) txt(ctx, (sum * clamp(pS * 1.2)).toFixed(2), SG[0], SG[1] + 44, { size: 34, w: 800, color: '#fff', align: 'center', fam: 'mono', base: 'middle' }); }
    if (pS > 0.4) txt(ctx, '0.63 − 0.15 + 0.24 + 0.1 = 0.82', SG[0], 760, { size: 34, w: 800, color: TH.ink2, align: 'center', fam: 'mono', alpha: E.out(clamp((pS - 0.4) / 0.4)) });
    if (pS > 0.55) { const q = E.back(clamp((pS - 0.55) / 0.4)); pill(ctx, `+ смещение b = ${Bias.toFixed(1)}`, SG[0], 430, { fill: TH.yellow, color: TH.ink, size: 28, h: 52, align: 'center', alpha: clamp(q) }); }
    if (pA > 0) { const q = E.out(clamp(pA * 2)); ctx.save(); ctx.globalAlpha *= q; curve(ctx, [SG[0] + 100, SG[1]], [ACT[0] - 128, ACT[1]], { color: TH.ink2, lw: 6, p: 1, flow: T });
      gcard(ctx, ACT[0] - 120, ACT[1] - 120, 240, 240, { fill: ['#FFFFFF', '#FBF6EC'], r: 28 }); txt(ctx, 'активация', ACT[0], ACT[1] - 142, { size: 30, w: 800, color: TH.orange, align: 'center' });
      const px = ACT[0] - 88, py = ACT[1] + 82, pw = 176, ph = 150; line(ctx, px, py, px + pw, py, TH.muted, 3); line(ctx, px + pw * 0.4, py + 10, px + pw * 0.4, py - ph, TH.muted, 3);
      ctx.strokeStyle = TH.orange; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw * 0.4, py); ctx.lineTo(px + pw, py - ph * 0.85); ctx.stroke();
      const xv = clamp(sum * pA, 0, 1), dx = px + pw * 0.4 + pw * 0.6 * (xv / 1.1), dy = py - ph * 0.85 * (xv / 1.1); glow(ctx, dx, dy, 34, TH.orange, 0.9); circle(ctx, dx, dy, 10, '#fff', TH.orange, 4); ctx.restore(); }
    if (pO > 0) { curve(ctx, [ACT[0] + 128, ACT[1]], [OUT[0] - 86, OUT[1]], { color: TH.ink2, lw: 6, p: 1, flow: T }); badge(ctx, OUT[0], OUT[1], 80 * pO, TH.green); txt(ctx, out.toFixed(2), OUT[0], OUT[1] + 2, { size: 48, w: 900, color: '#fff', align: 'center', base: 'middle', alpha: clamp(pO), fam: 'mono' }); txt(ctx, 'выход', OUT[0], 470, { size: 32, w: 800, color: TH.green, align: 'center', alpha: clamp(pO) }); }
    const pf = K.p(sc.at_out, 4.0, E.out); if (pf > 0) pill(ctx, 'умножили → сложили → пропустили через функцию', 960, 840, { fill: [TH.ink2, TH.ink], size: 34, h: 70, align: 'center', alpha: pf });
  };

  // ============ PLOTS: функции активации ============
  const ACTS = { relu: { f: x => Math.max(0, x), x: [-3, 3], y: [-0.8, 3.2], name: 'ReLU', d: 'Если число меньше нуля — ноль, иначе оставляем как есть. Самая популярная.', c: TH.orange },
                 sigmoid: { f: x => 1 / (1 + Math.exp(-x)), x: [-6, 6], y: [-0.15, 1.15], name: 'Сигмоида', d: 'Плавно сжимает любое число в диапазон от нуля до единицы.', c: TH.blue },
                 tanh: { f: x => Math.tanh(x), x: [-3, 3], y: [-1.3, 1.3], name: 'Тангенс', d: 'Похожа на сигмоиду, но выдаёт числа от минус единицы до единицы.', c: TH.violet },
                 line: { f: x => 0.6 * x + 0.2, x: [-3, 3], y: [-2.5, 2.5], name: 'Без активации', d: 'Сколько слоёв ни ставь — получится всё та же прямая.', c: TH.red } };
  S.plots = (ctx, T, sc, K) => {
    const items = sc.items, n = items.length, gap = 30, cw = (1700 - gap * (n - 1)) / n, ch = 540;
    items.forEach((it, i) => {
      const a = ACTS[it.fn], p = K.p(it.at === undefined ? i : it.at, 0.7), x = 110 + i * (cw + gap), y = 270; if (p <= 0.001) return; const cur = K.beat === idx(it.at === undefined ? i : it.at);
      ctx.save(); ctx.translate(0, (1 - clamp(p)) * 30); ctx.globalAlpha *= clamp(p * 1.5); gcard(ctx, x, y, cw, ch, { fill: ['#FFFFFF', '#FBF6EC'], r: 30, border: cur ? a.c : 'rgba(0,0,0,0.04)' });
      txt(ctx, it.name || a.name, x + 32, y + 62, { size: 38, w: 900, color: a.c });
      const px = x + 32, py = y + 100, pw = cw - 64, ph = 250, X = v => px + (v - a.x[0]) / (a.x[1] - a.x[0]) * pw, Y = v => py + ph - (v - a.y[0]) / (a.y[1] - a.y[0]) * ph;
      ctx.save(); rr(ctx, px, py, pw, ph, 14); ctx.clip(); ctx.fillStyle = 'rgba(60,45,80,0.04)'; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = 'rgba(60,45,80,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), py); ctx.lineTo(X(0), py + ph); ctx.moveTo(px, Y(0)); ctx.lineTo(px + pw, Y(0)); ctx.stroke();
      const dr = clamp((T - K.t0(it.at === undefined ? i : it.at) - 0.5) / 1.4); ctx.strokeStyle = a.c; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); for (let k = 0; k <= 120 * dr; k++) { const xv = a.x[0] + (a.x[1] - a.x[0]) * k / 120; k ? ctx.lineTo(X(xv), Y(a.f(xv))) : ctx.moveTo(X(xv), Y(a.f(xv))); } ctx.stroke(); ctx.restore();
      block(ctx, it.d || a.d, x + 32, y + 400, cw - 64, { size: 28, color: TH.ink2, lh: 36 }); ctx.restore(); });
  };

  // ============ NET3D: нейросеть в 3D, прямой и обратный проход ============
  const LAYERS = [4, 6, 6, 3], LX = [-5.4, -1.8, 1.8, 5.4];
  const NET = (() => { const r = rng(21), pos = LAYERS.map((n, l) => Array.from({ length: n }, (_, i) => [LX[l], (i - (n - 1) / 2) * 1.05, ((i % 2) - 0.5) * 1.7 + (l % 2 ? 0.25 : -0.25)])), ed = []; for (let l = 0; l < 3; l++) for (let i = 0; i < LAYERS[l]; i++) for (let j = 0; j < LAYERS[l + 1]; j++) ed.push({ l, i, j, w: r() * 2 - 1 }); return { pos, ed }; })();
  S.net3d = (ctx, T, sc, K) => {
    const cam = new Cam({ yaw: 0.5 + Math.sin(T * 0.22) * 0.28, pitch: 0.24, dist: 15.0, f: 1450, cx: 790, cy: 540, ty: 0 }), s3 = new Scene3D(cam);
    glow(ctx, 770, 540, 700, TH.violet, 0.14); floorGrid(ctx, cam, -3.3, 9, 1.5, TH.violet, 0.3);
    const layerOn = l => K.on([sc.at_in, sc.at_hid, sc.at_hid, sc.at_out][l] === undefined ? 0 : [sc.at_in, sc.at_hid, sc.at_hid, sc.at_out][l]);
    const layerP = l => { const a = [sc.at_in, sc.at_hid, sc.at_hid, sc.at_out][l], off = l === 2 ? 0.8 : 0; return E.back(clamp((T - K.bs(a) - 0.3 - off) / 0.7)); };
    const fwd = K.on(sc.at_fwd) ? clamp((T - K.bs(sc.at_fwd) - 0.4) / Math.min(8, K.be(sc.at_fwd) - K.bs(sc.at_fwd) - 1)) : 0, bwd = K.on(sc.at_bwd) ? clamp((T - K.bs(sc.at_bwd) - 0.4) / Math.min(9, K.be(sc.at_bwd) - K.bs(sc.at_bwd) - 1)) : 0;
    const upd = K.on(sc.at_upd) ? clamp((T - K.bs(sc.at_upd)) / 2.5) : 0, flash = Math.sin(Math.PI * clamp(upd * 1.6));
    // рёбра
    NET.ed.forEach((e, k) => { if (layerP(e.l) < 0.5 || layerP(e.l + 1) < 0.5) return; const a = NET.pos[e.l][e.i], b = NET.pos[e.l + 1][e.j]; const pw = e.w + (upd > 0 ? (e.w > 0 ? 0.35 : -0.35) * upd * ((k % 3) - 1) : 0), c = pw >= 0 ? '#6FB6FF' : '#FF8FB0', al = 0.12 + 0.32 * Math.abs(pw) + flash * 0.4; s3.line(a, b, rgba(c, Math.min(0.85, al)), 1.4 + Math.abs(pw) * 2.6, { bias: 2 }); });
    // нейроны
    NET.pos.forEach((L_, l) => L_.forEach((p, i) => { const q = layerP(l); if (q <= 0.01) return; const act = fwd > 0 ? clamp(fwd * 3.4 - l, 0, 1) : 0, fade = fwd > 0 ? 1 : 0, lit = act * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + l))), back = bwd > 0 ? clamp((1 - bwd) * 3.4 - (2 - l) + 0.0, 0, 1) * clamp(bwd * 3.4 - (3 - l) + 0.0 + 1, 0, 1) : 0;
      const bw = bwd > 0 ? clamp(bwd * 3.6 - (3 - l), 0, 1) : 0, base = [TH.blue, TH.violet, TH.violet, TH.green][l]; let c = mixHex(base, '#FFE9B8', lit * 0.75); if (bw > 0 && bw < 1) c = mixHex(c, '#FF5A5A', 0.85); if (K.on(sc.at_err) && l === 3 && i === 0 && !(bwd > 0)) c = mixHex(c, '#FF5A5A', 0.8);
      s3.shadow(p, 0.3 * q, -3.2, 0.25); s3.sphere(p, 0.36 * q, c, { glowA: lit * 0.8 + (bw > 0 && bw < 1 ? 0.7 : 0) }); }));
    // сигналы вперёд / ошибка назад
    if (fwd > 0 && fwd < 1) NET.ed.forEach((e, k) => { if ((k % 2) !== 0) return; const s = clamp(fwd * 3.4 - e.l, 0, 1); if (s <= 0 || s >= 1) return; const a = NET.pos[e.l][e.i], b = NET.pos[e.l + 1][e.j]; s3.glow([lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)], 0.42, '#FFD27A', 0.9); });
    if (bwd > 0 && bwd < 1) NET.ed.forEach((e, k) => { if ((k % 2) !== 0) return; const s = clamp(bwd * 3.6 - (2 - e.l), 0, 1); if (s <= 0 || s >= 1) return; const a = NET.pos[e.l + 1][e.j], b = NET.pos[e.l][e.i]; s3.glow([lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)], 0.46, '#FF6A6A', 0.95); });
    s3.flush(ctx);
    // подписи слоёв
    [['Вход', 0, sc.at_in], ['Скрытые слои', 1.5, sc.at_hid], ['Выход', 3, sc.at_out]].forEach(([t, l, a], k) => { const q = clamp(K.p(a, 0.8, E.out)); if (q <= 0) return; const pr = cam.prj(k === 1 ? [0, -3.3, 2.2] : [LX[l], -3.3, 2.2]); txt(ctx, t, pr.x, pr.y + 26, { size: 30, w: 800, color: '#E9DFFF', align: 'center', alpha: q }); });
    // правая панель: ответ сети
    const R = 1400; const probs0 = [0.78, 0.17, 0.05], probs1 = [0.30, 0.66, 0.04], names = ['кошка', 'собака', 'птица'];
    const showA = K.on(sc.at_res) ? E.out(clamp((T - K.bs(sc.at_res)) / 0.8)) : 0;
    if (showA > 0) { const mixp = clamp(upd * 1.1), pr = probs0.map((v, i) => lerp(v, probs1[i], mixp)); ctx.save(); ctx.globalAlpha *= showA; gcard(ctx, R, 290, 420, 400, { fill: ['#2C2340', '#201833'], r: 28, gloss: false, shadowAlpha: 0.4 });
      txt(ctx, 'Ответ сети', R + 30, 346, { size: 30, w: 800, color: '#FFE7D6' });
      names.forEach((nm, i) => { const y = 400 + i * 86, tgt = K.on(sc.at_err) && i === 1; txt(ctx, nm, R + 30, y + 14, { size: 28, w: 700, color: tgt ? '#FFD27A' : '#E9DFFF' }); bar(ctx, R + 30, y + 26, 360, 22, clamp(pr[i] * showA), tgt ? TH.yellow : (i === 0 ? TH.orange : TH.blue), { bg: 'rgba(255,255,255,0.12)' }); txt(ctx, `${Math.round(pr[i] * 100)}%`, R + 392, y + 14, { size: 26, w: 800, color: '#E9DFFF', align: 'right', fam: 'mono' }); });
      if (K.on(sc.at_err)) txt(ctx, 'на фото — собака!', R + 30, 678, { size: 28, w: 800, color: TH.yellow, alpha: E.out(clamp((T - K.bs(sc.at_err)) / 0.6)) }); ctx.restore(); }
    if (K.on(sc.at_bwd)) pill(ctx, bwd < 1 ? 'ошибка идёт назад' : (upd > 0 ? 'веса подправлены' : 'каждый вес получает подсказку'), R, 730, { fill: [mixHex(TH.red, '#fff', 0.1), TH.red], size: 28, h: 56, alpha: E.out(clamp((T - K.bs(sc.at_bwd)) / 0.6)) });
  };
  S.net3d.dark = true;

  // ============ FEATURES: что выучивают слои ============
  S.features = (ctx, T, sc, K) => {
    const tiles = [['Слой 1', 'края и линии', TH.blue], ['Слой 2', 'части: уши, глаза', TH.violet], ['Слой 3', 'целые объекты', TH.orange], ['Выход', 'ответ сети', TH.green]];
    const cw = 380, gap = 60, y = 300, ch = 470;
    tiles.forEach((t, i) => {
      const p = K.p(sc.at ? sc.at[i] : i + 1, 0.7), x = 110 + i * (cw + gap); if (p <= 0.001) return; const c = t[2], cur = K.beat === (sc.at ? sc.at[i] : i + 1);
      if (i > 0) curve(ctx, [x - gap + 6, y + ch / 2], [x - 6, y + ch / 2], { color: TH.ink2, lw: 6, p: clamp(p * 1.4), flow: T });
      ctx.save(); ctx.translate(x + cw / 2, y + ch / 2 + (1 - clamp(p)) * 30); const s_ = 0.85 + 0.15 * p; ctx.scale(s_, s_); ctx.globalAlpha *= clamp(p * 1.6);
      gcard(ctx, -cw / 2, -ch / 2, cw, ch, { fill: ['#FFFFFF', '#FBF6EC'], r: 30, border: cur ? c : 'rgba(0,0,0,0.04)' }); txt(ctx, t[0], -cw / 2 + 30, -ch / 2 + 56, { size: 34, w: 900, color: c }); txt(ctx, t[1], -cw / 2 + 30, -ch / 2 + 98, { size: 28, w: 600, color: TH.muted });
      ctx.save(); ctx.translate(0, 40); ctx.lineCap = 'round';
      if (i === 0) { ctx.strokeStyle = c; ctx.lineWidth = 9; [[-110, 60, -40, -70], [-30, 70, 40, -60], [30, 70, 100, -40], [-100, 0, 20, 10], [20, -40, 110, -10]].forEach(([a, b, c2, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); }); }
      if (i === 1) { circle(ctx, -60, 0, 34, '#fff', c, 9); circle(ctx, -60, 0, 14, c); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(40, 60); ctx.lineTo(80, -70); ctx.lineTo(120, 60); ctx.closePath(); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 7; [-14, 0, 14].forEach(o => { ctx.beginPath(); ctx.moveTo(-100, 70 + o); ctx.lineTo(-10, 80 + o * 0.4); ctx.stroke(); }); }
      if (i === 2) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 10, 82, 0, 7); ctx.fill(); [[-1, 1]].forEach(() => {}); [-1, 1].forEach(sx => { ctx.beginPath(); ctx.moveTo(sx * 28, -62); ctx.lineTo(sx * 88, -122); ctx.lineTo(sx * 90, -30); ctx.closePath(); ctx.fill(); }); [-1, 1].forEach(sx => { circle(ctx, sx * 30, 0, 14, '#fff'); circle(ctx, sx * 30, 2, 7, TH.ink); }); circle(ctx, 0, 30, 8, '#FFC6C0'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; [-1, 1].forEach(sx => [-6, 8].forEach(o => { ctx.beginPath(); ctx.moveTo(sx * 40, 32 + o); ctx.lineTo(sx * 96, 28 + o * 2.2); ctx.stroke(); })); }
      if (i === 3) { badge(ctx, 0, -20, 66, c); icon(ctx, 'check', 0, -20, 36); txt(ctx, 'кошка', 0, 110, { size: 44, w: 900, color: c, align: 'center' }); txt(ctx, '97%', 0, 154, { size: 34, w: 800, color: TH.muted, align: 'center', fam: 'mono' }); }
      ctx.restore(); ctx.restore(); });
  };

  // ============ CORES: процессор против видеокарты ============
  S.cores = (ctx, T, sc, K) => {
    const pc = K.p(sc.at_cpu, 0.7), pg = K.p(sc.at_gpu, 0.7), r = rng(9);
    if (pc > 0) { ctx.save(); ctx.globalAlpha *= clamp(pc * 1.5); ctx.translate(0, (1 - clamp(pc)) * 30); gcard(ctx, 110, 270, 640, 520, { fill: ['#FFFFFF', '#FBF6EC'], r: 32 }); txt(ctx, 'Процессор (CPU)', 150, 336, { size: 40, w: 900, color: TH.blue }); txt(ctx, 'несколько сильных ядер', 150, 380, { size: 28, w: 600, color: TH.muted });
      for (let i = 0; i < 4; i++) { const cx = 190 + (i % 2) * 260, cy = 450 + Math.floor(i / 2) * 160, busy = 0.5 + 0.5 * Math.sin(T * 3 + i * 1.4); gcard(ctx, cx, cy, 220, 130, { fill: [mixHex(TH.blue, '#fff', 0.25 + 0.2 * (1 - busy)), TH.blue], r: 22, shadowAlpha: 0.2 }); icon(ctx, 'brain', cx + 110, cy + 65, 38, '#fff'); } ctx.restore(); }
    if (pg > 0) { ctx.save(); ctx.globalAlpha *= clamp(pg * 1.5); ctx.translate(0, (1 - clamp(pg)) * 30); gcard(ctx, 810, 270, 1000, 520, { fill: ['#FFFFFF', '#FBF6EC'], r: 32 }); txt(ctx, 'Видеокарта (GPU)', 850, 336, { size: 40, w: 900, color: TH.orange }); txt(ctx, 'тысячи простых ядер, работающих одновременно', 850, 380, { size: 28, w: 600, color: TH.muted });
      const cols = 24, rows = 8, cs = 34, gx = 850, gy = 420; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const busy = 0.5 + 0.5 * Math.sin(T * 4 + (i * 0.7 + j * 1.3) + r() * 6); rr(ctx, gx + i * (cs + 4), gy + j * (cs + 4), cs, cs, 8); ctx.fillStyle = mix(TH.orangeL, TH.orange, busy); ctx.fill(); } ctx.restore(); }
  };


  // ============ TOKENS: текст -> токены -> номера ============
  S.tokens = (ctx, T, sc, K) => {
    const toks = sc.tokens, size = 46, padX = 18, gap = 10, maxW = 1500, x0 = 110, y0 = sc.y || 330, lineH = 112;
    // раскладка
    const lay = []; let cx = x0, cy = y0; toks.forEach((t, i) => { const w = tw(ctx, t.t, size, 700) + padX * 2; if (cx + w > x0 + maxW) { cx = x0; cy += lineH; } lay.push({ x: cx, y: cy, w }); cx += w + gap; });
    const split = K.p(sc.at_split, 0.5, E.out), showIds = K.on(sc.at_ids), types = K.on(sc.at_types);
    // исходный текст до разрезания
    const plainA = 1 - clamp(split * 3); if (plainA > 0.01) block(ctx, sc.text, x0, y0 + 50, maxW, { size: 56, w: 700, color: TH.ink, lh: 76, alpha: plainA });
    toks.forEach((t, i) => {
      const p = E.back(clamp((T - K.bs(sc.at_split) - 0.3 - i * 0.12) / 0.5)); if (p <= 0.001) return; const L = lay[i];
      const col_ = !types ? TH.orange : (t.k === 'p' ? TH.pink : (t.k === 'w' ? TH.blue : TH.violet));
      ctx.save(); ctx.translate(L.x + L.w / 2, L.y + 40 + (1 - clamp(p)) * 24); ctx.scale(0.8 + 0.2 * p, 0.8 + 0.2 * p); ctx.globalAlpha *= clamp(p * 1.6);
      gcard(ctx, -L.w / 2, -40, L.w, 80, { fill: [light(col_, 0.25), col_], r: 22, shadowAlpha: 0.2 }); txt(ctx, t.t, 0, 3, { size, w: 700, color: '#fff', align: 'center', base: 'middle' });
      if (showIds) { const q = E.out(clamp((T - K.t0(sc.at_ids) - 0.4 - i * 0.12) / 0.5)); ctx.globalAlpha *= q; txt(ctx, String(t.id), 0, 72, { size: 28, w: 800, color: TH.ink2, align: 'center', fam: 'mono' }); }
      ctx.restore(); });
    if (types) [['целое слово', TH.blue], ['часть слова', TH.violet], ['знак препинания', TH.pink]].forEach(([n, c], i) => pill(ctx, n, 110 + i * 330, 520, { fill: [light(c, 0.2), c], size: 28, alpha: E.out(clamp((T - K.t0(sc.at_types) - i * 0.3) / 0.5)) }));
    if (K.on(sc.at_cost)) { const q = E.back(clamp((T - K.t0(sc.at_cost)) / 0.7)); ctx.save(); ctx.globalAlpha *= clamp(q); gcard(ctx, 110, 640, 820, 160, { fill: [TH.ink2, TH.ink], r: 28 }); txt(ctx, 'В токенах измеряется:', 146, 694, { size: 32, w: 700, color: '#C9BFD9' }); ['цена', 'контекст', 'скорость'].forEach((n, i) => pill(ctx, n, 146 + i * 250, 722, { fill: [TH.orangeL, TH.orange], size: 28, h: 52 })); ctx.restore(); }
  };

  // ============ EMBED3D: пространство смыслов ============
  const EMB = (() => {
    const r = rng(33), rnd = () => (r() - 0.5) * 2.0, groups = [
      { id: 'animals', name: 'животные', c: TH.orange, ctr: [-4.8, 1.0, 1.6], w: ['кошка', 'собака', 'лев', 'волк', 'кот', 'мышь', 'лошадь', 'тигр'] },
      { id: 'food', name: 'еда', c: TH.green, ctr: [4.6, 0.4, 2.4], w: ['яблоко', 'хлеб', 'сыр', 'суп', 'пицца', 'груша', 'молоко'] },
      { id: 'cities', name: 'города', c: TH.blue, ctr: [-4.4, -1.6, -3.4], w: ['Москва', 'Париж', 'Берлин', 'Рим', 'Токио', 'Лондон'] },
      { id: 'tech', name: 'программирование', c: TH.violet, ctr: [4.6, -1.2, -3.2], w: ['код', 'сервер', 'алгоритм', 'данные', 'баг', 'сеть', 'функция'] }];
    const pts = []; groups.forEach(g => g.w.forEach((w, i) => pts.push({ w, g: g.id, c: g.c, p: [g.ctr[0] + rnd() * 1.6, g.ctr[1] + rnd() * 1.3, g.ctr[2] + rnd() * 1.6] })));
    const roy = { man: [-0.7, 1.7, 0.2], woman: [0.5, 0.5, 1.0], d: [0.3, 1.5, -0.3] }; roy.king = roy.man.map((v, i) => v + roy.d[i]); roy.queen = roy.woman.map((v, i) => v + roy.d[i]);
    [['мужчина', roy.man], ['женщина', roy.woman], ['король', roy.king], ['королева', roy.queen]].forEach(([w, p]) => pts.push({ w, g: 'roy', c: TH.pink, p }));
    return { pts, groups, roy };
  })();
  S.embed3d = (ctx, T, sc, K) => {
    const focus = K.on(sc.at_vec), fk = focus ? E.io(clamp((T - K.bs(sc.at_vec)) / 2.2)) : 0;
    const cam = new Cam({ yaw: 0.5 + T * 0.1 + fk * 0.3, pitch: lerp(0.3, 0.22, fk), dist: lerp(15.6, 8.8, fk), f: 1500, cx: 900, cy: lerp(540, 650, fk), tx: fk * 0.0, ty: fk * 1.9, tz: 0 }), s3 = new Scene3D(cam);
    glow(ctx, 880, 560, 800, TH.violet, 0.12); floorGrid(ctx, cam, -3.2, 9, 1.5, TH.violet, 0.28);
    const pa = i => E.back(clamp((T - K.bs(sc.at_pts) - 0.4 - i * 0.06) / 0.6)), clusters = K.on(sc.at_clusters), nn = K.on(sc.at_nn);
    EMB.pts.forEach((p, i) => {
      const a = pa(i); if (a <= 0.01) return; if (p.g === 'roy' && !K.on(sc.at_roy)) return;
      const dimmed = focus && p.g !== 'roy' ? 0.18 : 1, col2 = clusters ? p.c : '#D9CFF0';
      s3.shadow(p.p, 0.3 * a, -3.2, 0.2 * dimmed); s3.sphere(p.p, 0.26 * a, col2, { alpha: dimmed, glowA: p.g === 'roy' && focus ? 0.8 : 0.0 });
      if (dimmed > 0.5 || p.g === 'roy') s3.label([p.p[0], p.p[1] + 0.55, p.p[2]], p.w, { size: p.g === 'roy' ? 30 : 26, color: '#fff', bg: p.g === 'roy' ? rgba(TH.pink, 0.85) : 'rgba(40,30,60,0.55)', fixed: false, alpha: dimmed });
    });
    // ореолы кластеров
    if (clusters && !focus) EMB.groups.forEach(g => { const q = E.out(clamp((T - K.bs(sc.at_clusters) - 0.3) / 1.2)); s3.glow(g.ctr, 2.9, g.c, 0.28 * q); s3.label([g.ctr[0], g.ctr[1] + 1.9, g.ctr[2]], g.name, { size: 30, color: '#fff', bg: rgba(g.c, 0.9), fixed: false, alpha: q, bias: -2 }); });
    // ближайшие соседи для «кошка»
    if (nn && !focus) { const c = EMB.pts.find(p => p.w === 'кошка'), near = EMB.pts.filter(p => p.g === 'animals' && p.w !== 'кошка').slice(0, 3), far = EMB.pts.find(p => p.w === 'сервер'); const q = E.out(clamp((T - K.bs(sc.at_nn) - 0.3) / 1.0));
      s3.glow(c.p, 1.1, '#FFE08A', 0.9 * q); near.forEach(n => s3.line(c.p, n.p, rgba('#FFE08A', 0.95 * q), 4, { bias: -1 })); s3.line(c.p, far.p, rgba('#FF9AA8', 0.8 * q), 3, { bias: -1 });
      const m = far.p.map((v, i) => (v + c.p[i]) / 2); s3.label(m, 'далеко', { size: 24, color: '#fff', bg: rgba('#FF6A7A', 0.85), fixed: false, alpha: q }); const m2 = near[0].p.map((v, i) => (v + c.p[i]) / 2); s3.label([m2[0], m2[1] + 0.3, m2[2]], 'близко', { size: 24, color: '#222', bg: rgba('#FFE08A', 0.95), fixed: false, alpha: q }); }
    // векторная арифметика
    if (focus) { const q = E.out(clamp((T - K.bs(sc.at_vec) - 1.2) / 1.4)), R = EMB.roy, arrow = (a, b, c, k, dash) => { const e = a.map((v, i) => lerp(v, b[i], k)); s3.line(a, e, c, 6, { bias: -1.5 }); if (k > 0.97) s3.sphere(b, 0.12, c, {}); };
      arrow(R.man, R.king, '#FFD27A', q); const q2 = E.out(clamp((T - K.bs(sc.at_vec) - 3.2) / 1.4)); arrow(R.woman, R.queen, '#FFD27A', q2);
      if (q2 > 0.9) { const m = R.king.map((v, i) => (v + R.queen[i]) / 2); s3.label([m[0] + 2.6, m[1] - 0.2, m[2]], 'одно и то же направление', { size: 26, color: '#222', bg: 'rgba(255,226,150,0.95)', fixed: false }); } }
    s3.flush(ctx);
    // формула
    if (focus) { const q = E.out(clamp((T - K.bs(sc.at_vec) - 5) / 0.8)); if (q > 0) { ctx.save(); ctx.globalAlpha *= q; gcard(ctx, 1280, 300, 540, 200, { fill: ['#2C2340', '#201833'], r: 28, gloss: false }); txt(ctx, 'король − мужчина', 1310, 366, { size: 34, w: 800, color: '#FFE7D6' }); txt(ctx, '+ женщина', 1310, 416, { size: 34, w: 800, color: '#FFE7D6' }); txt(ctx, '≈ королева', 1310, 470, { size: 40, w: 900, color: TH.pink }); ctx.restore(); } }
    if (!focus && K.on(sc.at_pts)) { const q = E.out(clamp((T - K.bs(sc.at_pts) - 1) / 0.8)); pill(ctx, 'каждое слово — точка', 1400, 300, { fill: [TH.ink2, TH.ink], size: 30, alpha: q }); }
  };
  S.embed3d.dark = true;


  // ============ GEN: предсказание следующего токена, температура ============
  S.gen = (ctx, T, sc, K) => {
    const steps = sc.steps; let si = -1; steps.forEach((st, i) => { if (K.on(st.at)) si = i; });
    const tempOn = K.on(sc.at_temp), tp = tempOn ? clamp((T - K.bs(sc.at_temp) - (sc.temp_delay || 9.5)) / 8) : 0, Tm = tempOn ? lerp(0.15, 1.9, E.io(tp)) : 1.0;
    // текст слева
    gcard(ctx, 110, 280, 800, 330, { fill: ['#FFFFFF', '#FBF6EC'], r: 30 }); txt(ctx, 'Текст', 146, 334, { size: 28, w: 800, color: TH.muted });
    let line_ = sc.prompt, shown = [sc.prompt];
    steps.forEach((st, i) => { if (K.on([st.at, 4.2]) && i <= si) shown.push(st.cands[st.pick][0]); });
    const full = shown.reduce((a, t, i) => i === 0 ? t : a + (/^[,.;:]$/.test(t) ? '' : ' ') + t, ''); block(ctx, full, 146, 400, 730, { size: 46, w: 700, color: TH.ink, lh: 62 });
    const lastTok = shown.length > 1 ? shown[shown.length - 1] : null; if (lastTok) { const q = E.back(clamp((T - K.t0([steps[shown.length - 2].at, 4.2])) / 0.5)); }
    pill(ctx, 'добавили токен → считаем заново', 146, 540, { fill: [TH.ink2, TH.ink], size: 26, h: 50, alpha: K.on(steps[1].at) ? E.out(clamp((T - K.bs(steps[1].at) - 0.5) / 0.6)) : 0 });
    // распределение справа
    if (si >= 0) { const st = steps[si], q = E.out(clamp((T - K.bs(st.at) - 0.2) / 0.7)); ctx.save(); ctx.globalAlpha *= q; gcard(ctx, 960, 280, 850, 560, { fill: ['#2C2340', '#201833'], r: 30, gloss: false, shadowAlpha: 0.35 });
      txt(ctx, 'Что дальше? Вероятности токенов', 996, 334, { size: 30, w: 800, color: '#FFE7D6' });
      const raw = st.cands.map(c => Math.pow(c[1], 1 / Tm)), sum = raw.reduce((a, b) => a + b, 0), pr = raw.map(v => v / sum), picking = K.on([st.at, 3.6]);
      st.cands.forEach((c, i) => { const y = 380 + i * 66, win = picking && i === st.pick; txt(ctx, c[0], 1000, y + 28, { size: 32, w: 800, color: win ? '#FFD27A' : '#E9DFFF', fam: 'mono', base: 'middle' }); bar(ctx, 1190, y + 10, 480, 36, pr[i] * q, win ? TH.yellow : (i === 0 ? TH.orange : TH.blue), { bg: 'rgba(255,255,255,0.1)' }); txt(ctx, `${Math.round(pr[i] * 100)}%`, 1790, y + 28, { size: 28, w: 800, color: '#E9DFFF', align: 'right', fam: 'mono', base: 'middle' }); });
      ctx.restore(); }
    // температура
    if (tempOn || K.on(sc.at_temp, -1)) { const q = E.out(clamp((T - K.bs(sc.at_temp) + 0.5) / 0.8)); ctx.save(); ctx.globalAlpha *= q; gcard(ctx, 110, 640, 800, 200, { fill: ['#FFFFFF', '#FBF6EC'], r: 28 }); txt(ctx, 'Температура', 146, 692, { size: 30, w: 800, color: TH.orange });
      const sx = 160, sw = 700, sy = 770; rr(ctx, sx, sy - 8, sw, 16, 8); ctx.fillStyle = 'rgba(60,45,80,0.15)'; ctx.fill(); rr(ctx, sx, sy - 8, sw * clamp((Tm - 0.1) / 1.9), 16, 8); ctx.fillStyle = mix(TH.blue, TH.orange, clamp((Tm - 0.1) / 1.9)); ctx.fill(); const kx = sx + sw * clamp((Tm - 0.1) / 1.9); circle(ctx, kx, sy, 20, '#fff', TH.orange, 6);
      txt(ctx, 'надёжно', sx, sy + 48, { size: 26, w: 700, color: TH.blue }); txt(ctx, 'креативно', sx + sw, sy + 48, { size: 26, w: 700, color: TH.orange, align: 'right' }); txt(ctx, Tm.toFixed(1), 884, 692, { size: 34, w: 900, color: TH.ink, align: 'right', fam: 'mono' }); ctx.restore(); }
  };

  // ============ ATTN: внимание между словами ============
  S.attn = (ctx, T, sc, K) => {
    const toks = sc.tokens, n = toks.length, size = 40, padX = 16, gap = 14, y = 600; const widths = toks.map(t => tw(ctx, t, size, 700) + padX * 2), total = widths.reduce((a, b) => a + b, 0) + gap * (n - 1); let x = 960 - total / 2 - 20; const pos = toks.map((t, i) => { const p = { x: x + widths[i] / 2, w: widths[i] }; x += widths[i] + gap; return p; });
    // дуги
    let head = null; const heads = sc.heads; if (K.on(sc.at_focus)) { if (K.on(sc.at_heads)) { const hi = Math.floor((T - K.bs(sc.at_heads) - 0.6) / 4.2); head = heads[((hi % heads.length) + heads.length) % heads.length]; } else head = heads[0]; }
    const pf = K.on(sc.at_focus) ? E.out(clamp((T - K.bs(sc.at_focus) - 0.3) / 1.0)) : 0, from = sc.from;
    if (head && pf > 0) { const k = (T * 0.0); head.w.forEach((w, j) => { if (j === from || w < 0.02) return; const a = pos[from].x, b = pos[j].x, mid = (a + b) / 2, hgt = 80 + Math.abs(a - b) * 0.32; ctx.save(); ctx.strokeStyle = rgba(head.c || TH.orange, 0.25 + 0.7 * w); ctx.lineWidth = 3 + w * 26; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a, y - 44); ctx.quadraticCurveTo(mid, y - 44 - hgt * 1.6, b, y - 44); ctx.globalAlpha *= pf; ctx.stroke(); ctx.restore();
        if (w > 0.1) { pill(ctx, `${Math.round(w * 100)}%`, mid - 34, y - 44 - hgt * 0.8 - 26, { fill: head.c || TH.orange, size: 26, h: 44, alpha: pf, padX: 14 }); } }); }
    // слова
    toks.forEach((t, i) => { const p = E.back(clamp((T - K.bs(0) - 0.4 - i * 0.12) / 0.5)); if (p <= 0.001) return; const isF = i === from && K.on(sc.at_focus), hot = head && head.w[i] > 0.3 && i !== from; const c = isF ? TH.violet : (hot ? TH.orange : TH.ink2); const mixed = K.on(sc.at_mix) && !K.on(sc.at_heads) && i === from;
      ctx.save(); ctx.translate(pos[i].x, y + (1 - clamp(p)) * 20); ctx.globalAlpha *= clamp(p * 1.6); if (isF || hot) glow(ctx, 0, 0, pos[i].w * 0.8, c, 0.35);
      gcard(ctx, -pos[i].w / 2, -36, pos[i].w, 72, { fill: [light(c, isF || hot ? 0.2 : 0.0), c], r: 20, shadowAlpha: 0.2 }); txt(ctx, t, 0, 3, { size, w: 700, color: '#fff', align: 'center', base: 'middle' }); ctx.restore();
      if (mixed) { const q = E.back(clamp((T - K.bs(sc.at_mix) - 0.5) / 0.6)); pill(ctx, 'теперь «знает» про кошку', pos[i].x, y + 64, { fill: [light(TH.green, 0.2), TH.green], size: 26, h: 46, align: 'center', alpha: clamp(q) }); } });
    if (K.on(sc.at_focus) && !K.on(sc.at_heads)) txt(ctx, 'головa 1', 0, 0, { size: 1, alpha: 0 });
    if (head && K.on(sc.at_heads)) pill(ctx, head.name, 960, 300, { fill: [light(head.c, 0.2), head.c], size: 32, h: 58, align: 'center' });
    // Q K V
    if (K.on(sc.at_qkv) && !K.on(sc.at_heads)) { const items = [['Запрос (Q)', 'что я ищу?', TH.violet, 'search'], ['Ключ (K)', 'что я предлагаю?', TH.orange, 'key'], ['Значение (V)', 'сама информация', TH.green, 'doc']];
      items.forEach(([h, t, c, ic], i) => { const q = E.back(clamp((T - K.bs(sc.at_qkv) - 0.4 - i * 1.4) / 0.6)); if (q <= 0) return; ctx.save(); ctx.translate(0, (1 - clamp(q)) * 24); ctx.globalAlpha *= clamp(q * 1.5); gcard(ctx, 110 + i * 500, 730, 470, 130, { fill: ['#FFFFFF', '#FBF6EC'], r: 26 }); badge(ctx, 110 + i * 500 + 64, 795, 40, c); icon(ctx, ic, 110 + i * 500 + 64, 795, 23); txt(ctx, h, 110 + i * 500 + 124, 782, { size: 36, w: 800, color: c }); txt(ctx, t, 110 + i * 500 + 124, 826, { size: 28, w: 600, color: TH.muted }); ctx.restore(); }); }
  };

  // ============ STACK3D: трансформер как стопка блоков ============
  S.stack3d = (ctx, T, sc, K) => {
    const NB = 5, cam = new Cam({ yaw: 0.65 + Math.sin(T * 0.2) * 0.25, pitch: 0.24, dist: 17.5, f: 1450, cx: 700, cy: 590, ty: 2.5 }), s3 = new Scene3D(cam);
    glow(ctx, 700, 560, 700, TH.violet, 0.14); floorGrid(ctx, cam, 0, 8, 1.5, TH.violet, 0.3);
    const buildP = K.on(0) ? clamp((T - K.bs(0) - 0.4) / 4.0) : 0, hiP = K.on(sc.at_parts) ? E.out(clamp((T - K.bs(sc.at_parts)) / 0.8)) : 0, flow = K.on(sc.at_flow) ? clamp((T - K.bs(sc.at_flow) - 0.5) / Math.min(8, K.be(sc.at_flow) - K.bs(sc.at_flow) - 1)) : 0;
    for (let b = 0; b < NB; b++) {
      const a = E.back(clamp(buildP * NB - b)); if (a <= 0.01) continue; const y0 = b * 1.1 + 0.3 + (1 - clamp(a)) * 3;
      s3.box([0, y0, 0], [4.4, 0.5, 3.0], mixHex(TH.violet, '#ffffff', hiP > 0 && (Math.floor(T / 2.0) % 2 === 0) ? 0.35 : 0), { a: clamp(a), edge: 'rgba(255,255,255,0.35)' });
      s3.box([0, y0 + 0.46, 0], [4.4, 0.34, 3.0], mixHex(TH.orange, '#ffffff', hiP > 0 && (Math.floor(T / 2.0) % 2 === 1) ? 0.3 : 0), { a: clamp(a), edge: 'rgba(255,255,255,0.35)' });
      if (b === 0 && hiP > 0) { s3.label([2.7, y0 + 0.05, 1.7], 'внимание', { size: 30, color: '#fff', bg: rgba(TH.violet, 0.95), fixed: true, alpha: hiP, bias: -5 }); s3.label([2.7, y0 + 0.75, 1.7], 'мини-нейросеть', { size: 30, color: '#fff', bg: rgba(TH.orange, 0.95), fixed: true, alpha: hiP, bias: -5 }); }
    }
    const NT = 5; for (let i = 0; i < NT; i++) { const topY = NB * 1.1 + 0.9, fy = flow > 0 ? lerp(-0.6, topY, clamp(flow * 1.15 - i * 0.04)) : -0.6, px = (i - (NT - 1) / 2) * 0.85, c = flow > 0 && fy > 0.3 ? mixHex(TH.blue, TH.yellow, clamp(fy / topY)) : TH.blue; if (buildP > 0.5) { s3.glow([px, fy, 2.0], 0.7, c, 0.7); s3.sphere([px, fy, 2.0], 0.28, c, { glowA: 0.6, bias: -3 }); } }
    s3.flush(ctx);
    // правая колонка пояснений
    const R = 1330, cards = [['Выход', 'вероятности следующего токена', TH.yellow, sc.at_flow, 300], ['× N блоков', 'в больших моделях их десятки', TH.violet, 0, 470], ['Вход', 'эмбеддинги токенов + позиция слов', TH.blue, sc.at_flow, 640]];
    cards.forEach(([h, t, c, at, y], i) => { const q = at === 0 ? E.out(clamp((T - K.bs(0) - 4) / 0.8)) : E.out(clamp((T - K.bs(at) - (i === 0 ? 5.5 : 0.5)) / 0.7)); if (q <= 0) return; ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - q) * 30, 0); gcard(ctx, R, y, 480, 130, { fill: ['#2C2340', '#201833'], r: 26, gloss: false, shadowAlpha: 0.35 }); rr(ctx, R, y, 12, 130, 6); ctx.fillStyle = c; ctx.fill(); txt(ctx, h, R + 36, y + 54, { size: 36, w: 900, color: c }); txt(ctx, t, R + 36, y + 96, { size: 25, w: 600, color: '#C9BFD9' }); ctx.restore(); });
    if (K.on(sc.at_loop)) { const q = E.out(clamp((T - K.bs(sc.at_loop)) / 0.8)); pill(ctx, 'снова через всю стопку', 1330, 800, { fill: [TH.orangeL, TH.orange], size: 28, alpha: q }); }
  };
  S.stack3d.dark = true;


  // ============ SCALING: законы масштабирования ============
  S.scaling = (ctx, T, sc, K) => {
    const x0 = 160, y0 = 280, w = 1180, h = 540; gcard(ctx, x0, y0, w, h, { fill: ['#FFFFFF', '#FBF6EC'], r: 32 });
    const X = t => x0 + 90 + t * (w - 190), yy = t => 0.1 + 0.74 * Math.pow(t, 0.9), Y = f => y0 + 70 + f * (h - 170);
    line(ctx, x0 + 70, y0 + h - 60, x0 + w - 30, y0 + h - 60, TH.muted, 4); line(ctx, x0 + 70, y0 + h - 60, x0 + 70, y0 + 40, TH.muted, 4);
    txt(ctx, 'вычисления, данные, размер модели  →', x0 + w - 30, y0 + h - 18, { size: 26, w: 700, color: TH.muted, align: 'right' }); txt(ctx, 'ошибка', x0 + 92, y0 + 66, { size: 28, w: 800, color: TH.muted });
    const pr = K.on(sc.at_line) ? E.io(clamp((T - K.bs(sc.at_line) - 0.5) / 3.0)) : 0;
    if (pr > 0) { ctx.save(); ctx.strokeStyle = TH.violet; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.shadowColor = rgba(TH.violet, 0.4); ctx.shadowBlur = 14; ctx.beginPath(); for (let i = 0; i <= 80 * pr; i++) { const t = i / 80; i ? ctx.lineTo(X(t), Y(yy(t))) : ctx.moveTo(X(t), Y(yy(t))); } ctx.stroke(); ctx.restore(); }
    const ms = [[0.07, 'грамматика', TH.blue], [0.33, 'перевод', TH.teal], [0.6, 'написание кода', TH.orange], [0.86, 'пошаговые рассуждения', TH.pink]];
    ms.forEach(([t, name, c], i) => { const at = [sc.at_skills, 0.6 + i * 1.6], q = K.on(at) ? E.back(clamp((T - K.t0(at)) / 0.6)) : 0; if (q <= 0) return; const px = X(t), py = Y(yy(t)); glow(ctx, px, py, 40 * q, c, 0.5); circle(ctx, px, py, 16 * q, c, '#fff', 4);
      const wd = tw(ctx, name, 26, 700) + 40, lx = Math.min(px - wd / 2, x0 + w - wd - 24); pill(ctx, name, Math.max(x0 + 90, lx), py + 30 + (i % 2) * 6, { fill: [light(c, 0.2), c], size: 26, h: 48, alpha: clamp(q), padX: 20 }); });
    if (K.on(sc.at_line)) { const q = E.out(clamp((T - K.bs(sc.at_line) - 1) / 0.8)); ctx.save(); ctx.globalAlpha *= q; gcard(ctx, 1400, 280, 410, 250, { fill: [TH.ink2, TH.ink], r: 28, gloss: false }); txt(ctx, 'Законы масштабирования', 1432, 334, { size: 26, w: 800, color: TH.orangeL }); block(ctx, 'Больше модель, данных и вычислений — ошибка падает предсказуемо.', 1432, 384, 350, { size: 28, color: '#E9DFFF', lh: 38 }); ctx.restore(); }
    if (K.on(sc.at_other)) { const q = E.out(clamp((T - K.bs(sc.at_other)) / 0.8)); ctx.save(); ctx.globalAlpha *= q; gcard(ctx, 1400, 570, 410, 250, { fill: ['#FFFFFF', '#FBF6EC'], r: 28 }); txt(ctx, 'Не только размер', 1432, 626, { size: 30, w: 800, color: TH.green }); ['качество данных', 'способы обучения', 'вычисления при ответе'].forEach((t, i) => { circle(ctx, 1442, 676 + i * 44, 7, TH.green); txt(ctx, t, 1462, 684 + i * 44, { size: 27, w: 600, color: TH.ink2 }); }); ctx.restore(); }
  };


  // ============ AGENT3D: агент в цикле «подумать → инструмент → результат» ============
  S.agent3d = (ctx, T, sc, K) => {
    const tools = sc.tools, n = tools.length, cam = new Cam({ yaw: 0.25 + T * 0.1, pitch: 0.5, dist: 14.6, f: 1450, cx: 820, cy: 560, ty: 0.3 }), s3 = new Scene3D(cam);
    glow(ctx, 820, 580, 760, TH.violet, 0.14); floorGrid(ctx, cam, -1.6, 9, 1.5, TH.violet, 0.28);
    const loopT = K.on(sc.at_loop) ? T - K.bs(sc.at_loop) - 0.5 : -1, PER = 4.6, cyc = loopT >= 0 ? Math.floor(loopT / PER) : -1, ph = loopT >= 0 ? (loopT % PER) / PER : 0, act = cyc >= 0 ? cyc % n : -1, done = K.on(sc.at_done);
    const pos = i => { const a = T * 0.22 + i * Math.PI * 2 / n; return [Math.cos(a) * 4.2, Math.sin(T * 0.6 + i) * 0.25 - 0.2, Math.sin(a) * 3.0]; };
    // ядро (модель)
    const pulse = ph < 0.14 && cyc >= 0 ? 1 + 0.12 * Math.sin(ph / 0.14 * Math.PI) : 1, cc = done ? TH.green : TH.orange;
    s3.shadow([0, 0, 0], 1.3, -1.6, 0.35); s3.glow([0, 0, 0], 3.0 * pulse, cc, 0.5); s3.sphere([0, 0, 0], 1.15 * pulse, cc, { glowA: 0.7 });
    const q0 = cam.prj([0, 1.9, 0]); s3.label([0, 1.9, 0], done ? 'готово!' : 'Модель', { size: 34, color: '#fff', bg: rgba(cc, 0.92), fixed: true, bias: -4 });
    const proj = [];
    tools.forEach((t, i) => { const p = E.back(clamp((T - K.bs(sc.at_tools) - 0.4 - i * 0.9) / 0.6)); if (p <= 0.01) return; const ps = pos(i), c = col(t.color), on = i === act && ph >= 0.15 && ph < 0.9;
      s3.shadow(ps, 0.5 * p, -1.6, 0.25); s3.sphere(ps, 0.62 * p, c, { glowA: on ? 0.9 : 0.15, bias: 0 }); s3.label([ps[0], ps[1] - 1.05, ps[2]], t.name, { size: 26, color: '#fff', bg: 'rgba(40,30,60,0.7)', fixed: false, alpha: p }); proj.push([i, ps, p]); });
    // лучи запроса и результата
    if (act >= 0 && !done) { const ps = pos(act), seg = (a, b, f, c) => s3.glow([lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)], 0.55, c, 0.95);
      if (ph >= 0.15 && ph < 0.45) { const f = (ph - 0.15) / 0.3; s3.line([0, 0, 0], ps, rgba(TH.orange, 0.5), 4, { bias: -2 }); seg([0, 0, 0], ps, f, '#FFB27A'); }
      if (ph >= 0.6 && ph < 0.9) { const f = (ph - 0.6) / 0.3; s3.line(ps, [0, 0, 0], rgba(TH.teal, 0.5), 4, { bias: -2 }); seg(ps, [0, 0, 0], f, '#6FE3D0'); } }
    s3.flush(ctx);
    proj.forEach(([i, ps, p]) => { const q = cam.prj(ps); icon(ctx, tools[i].icon, q.x, q.y, 0.34 * q.k * p, '#fff'); });
    // задача и фазы цикла
    const ta = E.out(clamp((T - K.bs(0) - 0.6) / 0.8)); if (sc.task) { ctx.save(); ctx.globalAlpha *= ta; gcard(ctx, 110, 270, 700, 110, { fill: [TH.ink2, TH.ink], r: 26, gloss: false }); txt(ctx, 'Задача', 144, 312, { size: 24, w: 800, color: TH.orangeL }); txt(ctx, sc.task, 144, 352, { size: 32, w: 700, color: '#FFF6EC' }); ctx.restore(); }
    if (K.on(sc.at_loop)) { const names = ['1  Подумать', '2  Вызвать инструмент', '3  Увидеть результат'], act2 = ph < 0.15 ? 0 : (ph < 0.55 ? 1 : 2);
      names.forEach((nm, i) => { const on = !done && cyc >= 0 && i === act2; pill(ctx, nm, 1340, 330 + i * 84, { fill: on ? [light(TH.orange, 0.2), TH.orange] : ['#3B3050', '#322842'], size: 30, h: 62, color: on ? '#fff' : '#A99CC4', alpha: E.out(clamp((T - K.bs(sc.at_loop) - i * 0.3) / 0.6)) }); });
      if (!done) txt(ctx, '↻ повторять, пока задача не решена', 1340, 612, { size: 26, w: 700, color: '#C9BFD9', alpha: 0.9 }); }
    if (done) { const q = E.back(clamp((T - K.bs(sc.at_done)) / 0.7)); pill(ctx, 'задача решена', 1340, 330, { fill: [light(TH.green, 0.2), TH.green], size: 36, h: 76, alpha: clamp(q) }); }
  };
  S.agent3d.dark = true;


  // ============ CTXBAR: как заполняется окно контекста (цифры из документации Claude Code) ============
  S.ctxbar = (ctx, T, sc, K) => {
    const CAP = 25000, X0 = 130, W_ = 1660, Y0 = 400, H_ = 150;
    const SEG = [
      { id: 'A', n: 'Системный промпт и окружение', v: 4480, c: TH.blue, at: sc.at_start, off: 0.4 }, { id: 'B', n: 'Автопамять', v: 680, c: TH.violet, at: sc.at_start, off: 1.4 },
      { id: 'C', n: 'CLAUDE.md', v: 2120, c: TH.orange, at: sc.at_start, off: 2.4 }, { id: 'D', n: 'Имена MCP и навыки', v: 570, c: TH.teal, at: sc.at_start, off: 3.4 },
      { id: 'E', n: 'Прочитанные файлы', v: 6900, c: '#5E97C8', at: sc.at_work, off: 0.6 }, { id: 'F', n: 'Команды, правки, рассуждения', v: 4890, c: TH.pink, at: sc.at_work, off: 4.0 },
      { id: 'G', n: 'Следующие запросы', v: 2585 - 620, c: TH.yellow, at: sc.at_work, off: 7.5 }, { id: 'K', n: 'Навык', v: 620, c: TH.green, at: sc.at_work, off: 8.5 }];
    const comp = K.on(sc.at_compact) ? E.io(clamp((T - K.bs(sc.at_compact) - 1.0) / 2.5)) : 0;
    let x = X0, total = 0; const parts = [];
    SEG.forEach(sg => { let g = K.on([sg.at, sg.off]) ? E.out(clamp((T - K.t0([sg.at, sg.off])) / 1.0)) : 0; if (sg.id === 'F' || sg.id === 'G') g *= 1 - comp; if (g <= 0.003) return; const val = sg.v * g, w = val / CAP * W_; parts.push({ sg, x, w, val }); x += w; total += val; });
    const sum = comp > 0.003 ? 1725 * comp : 0; if (sum > 0) { const w = sum / CAP * W_; parts.push({ sg: { id: 'S', n: 'Краткая выжимка', c: TH.yellow }, x, w, val: sum }); x += w; total += sum; }
    gcard(ctx, X0 - 20, Y0 - 20, W_ + 40, H_ + 40, { fill: ['#FFFFFF', '#FBF6EC'], r: 30 });
    ctx.save(); rr(ctx, X0, Y0, W_, H_, 22); ctx.clip(); ctx.fillStyle = 'rgba(60,45,80,0.08)'; ctx.fillRect(X0, Y0, W_, H_);
    parts.forEach(p => { ctx.fillStyle = lg(ctx, 0, Y0, 0, Y0 + H_, [[0, light(p.sg.c, 0.25)], [1, p.sg.c]]); ctx.fillRect(p.x, Y0, Math.max(0, p.w - 2), H_); }); ctx.restore();
    // подписи
    txt(ctx, 'окно контекста (условный размер)', X0, Y0 - 38, { size: 26, w: 700, color: TH.muted }); txt(ctx, 'лимит', X0 + W_, Y0 - 38, { size: 26, w: 700, color: TH.red, align: 'right' });
    const big = Math.round(total); txt(ctx, `${big.toLocaleString('ru-RU')} токенов`, X0, Y0 + H_ + 110, { size: 72, w: 900, color: comp > 0.5 ? TH.green : TH.ink, align: 'left', fam: 'mono' });
    // легенда
    const seen = []; parts.forEach(p => { if (!seen.find(q => q.sg.id === p.sg.id)) seen.push(p); });
    seen.forEach((p, i) => { const cx = X0 + (i % 3) * 560, cy = Y0 + H_ + 215 + Math.floor(i / 3) * 50; circle(ctx, cx + 12, cy - 8, 11, p.sg.c); txt(ctx, p.sg.n, cx + 34, cy, { size: 26, w: 700, color: TH.ink2 }); });
    // подагент
    if (K.on(sc.at_sub)) { const q = E.back(clamp((T - K.bs(sc.at_sub) - 0.3) / 0.7)); ctx.save(); ctx.globalAlpha *= clamp(q); gcard(ctx, 1010, 580, 780, 140, { fill: [TH.ink2, TH.ink], r: 26, gloss: false }); txt(ctx, 'Подагент читает 9 890 токенов в своём окне,', 1040, 638, { size: 30, w: 700, color: '#FFF6EC' }); txt(ctx, 'а к тебе возвращается выжимка в 420 токенов.', 1040, 684, { size: 30, w: 700, color: TH.orangeL }); ctx.restore(); }
    if (K.on(sc.at_compact)) pill(ctx, '/compact: диалог → выжимка', 130, 250, { fill: [light(TH.green, 0.2), TH.green], size: 30, alpha: E.out(clamp((T - K.bs(sc.at_compact)) / 0.6)) });
  };

  return S;
};
