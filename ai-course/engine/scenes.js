'use strict';
// Библиотека типов сцен. Каждая сцена: draw(ctx, T, S, K); S — данные сцены, K — помощник по времени/битам.
module.exports = function (C) {
  const { T: TH, clamp, lerp, E, txt, block, wrap, tw, gcard, pill, badge, glow, bar, curve, circle, line, rr, rg, lg, light, dark, mix, mixHex, rgba, softShadow, rng, W, H } = C;
  const { icon } = require('./icons'); const { Cam, Scene3D, floorGrid } = require('./g3'); const { drawMascot, sparkle } = require('./mascot');
  const col = n => TH[n] || n || TH.orange;
  const S = {};
  const idx = a => (Array.isArray(a) ? a[0] : a);
  const wsplit = (ctx, s, w, size, wt) => wrap(ctx, s, w, size, wt);

  // ============ HERO: заставка с большим персонажем ============
  S.hero = (ctx, T, sc, K) => {
    const dk = !!sc.dark, lt = K.lt, cx = 1470, cy = 560, orb = sc.orbit || ['chat', 'brain', 'code', 'bolt', 'gear', 'book'];
    const ink = dk ? '#FFF7EE' : TH.ink, sub = dk ? '#C9BFD9' : TH.muted;
    // орбита из значков (задняя половина)
    const draw = back => orb.forEach((n, i) => {
      const a = T * 0.55 + i * Math.PI * 2 / orb.length, dep = Math.sin(a); if ((dep < 0) !== back) return;
      const s = 0.72 + 0.28 * (dep * 0.5 + 0.5), x = cx + Math.cos(a) * 370, y = cy + 40 + dep * 150, p = E.back(clamp((lt - 0.4 - i * 0.12) / 0.6));
      const colr = [TH.blue, TH.teal, TH.violet, TH.yellow, TH.pink, TH.green][i % 6];
      ctx.save(); ctx.globalAlpha *= clamp(p) * (back ? 0.7 : 1); badge(ctx, x, y, 54 * s * p, colr); icon(ctx, n, x, y, 30 * s * p); ctx.restore();
    });
    glow(ctx, cx, cy, 520, TH.orange, 0.28 + 0.06 * Math.sin(T * 1.5));
    draw(true);
    const pm = E.back(clamp((lt - 0.1) / 0.9));
    drawMascot(ctx, cx, cy + 20 + (1 - pm) * 120, 220 * (0.5 + 0.5 * pm), { t: T, mouth: K.mouth, mood: sc.mood || 'excited', wave: lt < 3 ? clamp(1.2 - lt / 3) : 0, look: [-0.4, 0.1], glow: 0.5 });
    draw(false);
    const a1 = E.out(clamp((lt - 0.2) / 0.6)), a2 = E.back(clamp((lt - 0.45) / 0.8)), a3 = E.out(clamp((lt - 1.1) / 0.8));
    if (sc.kicker) { pill(ctx, sc.kicker, 110, 250, { fill: [light(TH.orange, 0.2), TH.orange], size: 30, alpha: a1 }); }
    const lines = Array.isArray(sc.heading) ? sc.heading : [sc.heading || sc.title];
    lines.forEach((l, i) => { ctx.save(); ctx.translate(0, (1 - clamp(a2)) * 40 + i * 0); txt(ctx, l, 110, 400 + i * 118, { size: sc.size || 100, w: 900, color: i === (sc.accentLine ?? -1) ? TH.orange : ink, alpha: clamp(a2 * 1.4), shadow: false }); ctx.restore(); });
    if (sc.sub) block(ctx, sc.sub, 110, 400 + lines.length * 118 + 20, 900, { size: 38, w: 500, color: sub, lh: 52, alpha: a3 });
  };
  S.hero.noHeader = true; S.hero.ownMascot = true;

  // ============ CARDS: карточки с иконками ============
  S.cards = (ctx, T, sc, K) => {
    const items = sc.items, n = items.length, cols = sc.cols || (n <= 3 ? n : (n === 4 ? 2 : 3)), rows = Math.ceil(n / cols);
    const gap = 34, x0 = 110, cw = (1700 - gap * (cols - 1)) / cols, top = sc.top || 280, availH = 590, ch = Math.min(sc.ch || 470, (availH - gap * (rows - 1)) / rows), horiz = ch < 300;
    items.forEach((it, i) => {
      const a = it.at === undefined ? i : it.at, p = K.p(a, 0.7); if (p <= 0.001) return;
      const c = col(it.color || ['orange', 'teal', 'violet', 'blue', 'pink', 'green'][i % 6]), cx = x0 + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (ch + gap);
      const cur = K.beat === idx(a); const sc_ = 0.82 + 0.18 * p;
      ctx.save(); ctx.translate(cx + cw / 2, cy + ch / 2 + (1 - clamp(p)) * 36 + Math.sin(T * 1.2 + i * 1.3) * 3); ctx.scale(sc_, sc_); ctx.globalAlpha *= clamp(p * 1.6);
      gcard(ctx, -cw / 2, -ch / 2, cw, ch, { fill: ['#FFFFFF', '#FBF6EC'], r: 30, border: cur ? c : 'rgba(0,0,0,0.04)', shadowAlpha: cur ? 0.32 : 0.2 });
      if (cur) { ctx.globalAlpha *= 0.5; gcard(ctx, -cw / 2, -ch / 2, cw, ch, { fill: rgba(c, 0.06), r: 30, shadow: false, gloss: false }); ctx.globalAlpha /= 0.5; }
      if (horiz) {
        badge(ctx, -cw / 2 + 74, 0, 46, c); icon(ctx, it.icon || 'star', -cw / 2 + 74, 0, 26);
        txt(ctx, it.h, -cw / 2 + 150, -ch * 0.16, { size: 40, w: 800, color: TH.ink }); block(ctx, it.t || '', -cw / 2 + 150, ch * 0.03, cw - 180, { size: 29, color: TH.muted, lh: 37 });
      } else {
        badge(ctx, -cw / 2 + 84, -ch / 2 + 92, 54, c); icon(ctx, it.icon || 'star', -cw / 2 + 84, -ch / 2 + 92, 31);
        const th = block(ctx, it.h, -cw / 2 + 40, -ch / 2 + 200, cw - 80, { size: 38, w: 800, color: TH.ink, lh: 46 }); block(ctx, it.t || '', -cw / 2 + 40, -ch / 2 + 200 + th + 14, cw - 80, { size: 28, color: TH.muted, lh: 37 });
      }
      ctx.restore();
    });
  };

  // ============ RINGS: вложенные круги («матрёшка») ============
  S.rings = (ctx, T, sc, K) => {
    const rings = sc.rings, n = rings.length, cx = 600, cy = 585, R0 = 335, step = (R0 * 0.76) / (n - 1 || 1);
    for (let i = 0; i < n; i++) {
      const r = rings[i], a = r.at === undefined ? i : r.at, p = K.p(a, 0.9), rad = (R0 - i * step) * clamp(p, 0, 1.08); if (p <= 0.001) continue;
      const c = col(r.color), cur = K.beat === idx(a);
      ctx.save(); ctx.globalAlpha *= clamp(p * 2);
      softShadow(ctx, cx - rad, cy - rad + 8, rad * 2, rad * 2, rad, { alpha: 0.22, blur: 40, dy: 22 });
      circle(ctx, cx, cy, rad, rg(ctx, cx - rad * 0.3, cy - rad * 0.4, rad * 0.05, cx, cy, rad * 1.02, [[0, light(c, 0.4)], [0.6, c], [1, dark(c, 0.2)]]));
      ctx.beginPath(); ctx.ellipse(cx - rad * 0.25, cy - rad * 0.72, rad * 0.4, rad * 0.1, -0.3, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
      if (cur) circle(ctx, cx, cy, rad, null, 'rgba(255,255,255,0.9)', 6);
      const nextRad = i === n - 1 ? 0 : (R0 - (i + 1) * step) * clamp(p, 0, 1.08), ly = i === n - 1 ? cy : cy - (rad + nextRad) / 2;
      txt(ctx, r.label, cx, ly + 11, { size: i === n - 1 ? 40 : 32, w: 800, color: '#fff', align: 'center', shadow: true });
      ctx.restore();
    }
    // правая панель описания активного кольца
    let bi = -1; rings.forEach((rg_, i) => { if (K.on(rg_.at === undefined ? i : rg_.at)) bi = i; }); if (bi < 0) return; const r = rings[bi], a = r.at === undefined ? bi : r.at, p = K.p(a, 0.7, E.out);
    const c = col(r.color), px = 1040;
    ctx.save(); ctx.globalAlpha *= clamp(p * 1.4); ctx.translate((1 - p) * 40, 0);
    gcard(ctx, px, 300, 770, 540, { fill: ['#FFFFFF', '#FBF6EC'], r: 34 }); card_accent(ctx, px, 300, c);
    txt(ctx, r.label, px + 50, 392, { size: 56, w: 900, color: c });
    block(ctx, r.sub || '', px + 50, 446, 670, { size: 34, w: 500, color: TH.ink2, lh: 46 });
    let cxp = px + 50, cyp = 690; (r.chips || []).forEach((ch, k) => { const w = tw(ctx, ch, 26, 700) + 40; if (cxp + w > px + 730) { cxp = px + 50; cyp += 66; } const q = E.back(clamp((T - K.t0(a) - 1.2 - k * 0.55) / 0.5)); if (q > 0) pill(ctx, ch, cxp, cyp, { fill: [light(c, 0.15), c], size: 26, h: 52, alpha: clamp(q), padX: 20 }); cxp += w + 14; });
    ctx.restore();
  };
  function card_accent(ctx, x, y, c) { ctx.save(); rr(ctx, x, y, 770, 16, 8); ctx.fillStyle = c; ctx.fill(); ctx.restore(); }

  // ============ ROAD3D: 3D-дорога по вехам ============
  S.road3d = (ctx, T, sc, K) => {
    const stops = sc.stops, zs = stops.map((s, i) => i * 11), road = z => [Math.sin(z * 0.19) * 3.2, 0, z];
    let ci = -1; stops.forEach((s, i) => { if (K.on(s.at === undefined ? i : s.at)) ci = i; });
    const tsC = ci >= 0 ? K.t0(stops[ci].at === undefined ? ci : stops[ci].at) : 0;
    const zPrev = ci > 0 ? zs[ci - 1] : zs[0] - 7, zCur = ci >= 0 ? zs[ci] : zs[0] - 7;
    const fz = lerp(zPrev, zCur, ci >= 0 ? E.io(clamp((T - tsC) / 2.0)) : 0);
    const rc = road(fz), cam = new Cam({ yaw: -0.3 + Math.sin(T * 0.2) * 0.05, pitch: 0.34, dist: 15.5, f: 1500, cx: 880, cy: 640, tx: rc[0], ty: 0.9, tz: fz + 4.5 });
    glow(ctx, 960, 330, 760, TH.violet, 0.3); glow(ctx, 960, 360, 340, TH.orange, 0.18);
    // земля и дорога
    const zA = fz - 9, zB = fz + 56;
    ctx.save();
    for (let z = zB; z > zA; z -= 0.9) {
      const a = road(z), b = road(z - 0.9), hw = 2.1;
      const p1 = cam.prj([a[0] - hw, 0, a[2]]), p2 = cam.prj([a[0] + hw, 0, a[2]]), p3 = cam.prj([b[0] + hw, 0, b[2]]), p4 = cam.prj([b[0] - hw, 0, b[2]]);
      const fade = clamp(1.25 - (z - fz) / 60, 0, 1);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath(); ctx.fillStyle = `rgba(52,42,74,${0.95 * fade})`; ctx.fill();
      ctx.lineWidth = Math.max(1.5, p1.k * 0.05); ctx.strokeStyle = rgba(TH.orange, 0.85 * fade); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p4.x, p4.y); ctx.moveTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.stroke();
      if (Math.floor(z / 0.9) % 3 === 0) { const c1 = cam.prj([a[0], 0, a[2]]), c2 = cam.prj([b[0], 0, b[2]]); ctx.lineWidth = Math.max(2, c1.k * 0.06); ctx.strokeStyle = `rgba(255,245,230,${0.8 * fade})`; ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke(); }
    }
    ctx.restore();
    // боковая сетка
    ctx.save(); ctx.lineWidth = 1.2;
    for (let z = Math.ceil(zA / 3) * 3; z < zB; z += 3) { const r0 = road(z); for (const side of [-1, 1]) { const a = cam.prj([r0[0] + side * 4.4, 0, z]), b = cam.prj([r0[0] + side * 18, 0, z]); ctx.strokeStyle = rgba(TH.violet, 0.28 * clamp(1.2 - (z - fz) / 50, 0, 1)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    ctx.restore();
    // вывески (от дальних к ближним)
    const bills = stops.map((s, i) => ({ s, i, z: zs[i] })).sort((a, b) => b.z - a.z);
    bills.forEach(({ s, i, z }) => {
      const a = s.at === undefined ? i : s.at, p = K.p(a, 0.8); if (p <= 0.001) return; const side = 1, r0 = road(z), c = col(s.color);
      const behind = fz - z, vis = clamp(1 - (behind - 3.5) / 4) * clamp(p * 2); if (vis <= 0.01) return;
      const sx = r0[0] + side * (4.8 + (i % 2) * 1.1), base = cam.prj([sx, 0, z]), ctr = cam.prj([sx, 3.6, z]), top = cam.prj([sx, 2.5, z]);
      const k = ctr.k, h = 2.1 * k, w = 3.9 * k, sc_ = 0.7 + 0.3 * clamp(p); if (w < 90) return;
      ctx.save(); ctx.globalAlpha *= vis;
      line(ctx, base.x, base.y, top.x, top.y, rgba('#CFC4E6', 0.9), Math.max(4, k * 0.1));
      circle(ctx, base.x, base.y, Math.max(5, k * 0.14), rgba(c, 0.9)); glow(ctx, base.x, base.y, k * 0.9, c, 0.5);
      ctx.translate(ctr.x, ctr.y - (1 - clamp(p)) * 40); ctx.scale(sc_, sc_);
      glow(ctx, 0, 0, w * 0.75, c, 0.2);
      gcard(ctx, -w / 2, -h / 2, w, h, { fill: ['#FFFFFF', '#F6EFE2'], r: h * 0.14, shadowAlpha: 0.4 });
      ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, h * 0.14); ctx.clip(); ctx.fillStyle = c; ctx.fillRect(-w / 2, -h / 2, w, h * 0.13); ctx.restore();
      badge(ctx, -w / 2 + h * 0.3, -h * 0.13, h * 0.17, c); icon(ctx, s.icon || 'star', -w / 2 + h * 0.3, -h * 0.13, h * 0.095);
      txt(ctx, s.year, -w / 2 + h * 0.55, -h * 0.13, { size: h * 0.25, w: 900, color: c, base: 'middle' });
      const fit = (t, sz, wt) => Math.min(sz, sz * (w - h * 0.26) / Math.max(1, tw(ctx, t, sz, wt)));
      txt(ctx, s.label, -w / 2 + h * 0.13, h * 0.17, { size: fit(s.label, h * 0.15, 800), w: 800, color: TH.ink, base: 'middle' });
      txt(ctx, s.sub || '', -w / 2 + h * 0.13, h * 0.33, { size: fit(s.sub || ' ', h * 0.098, 500), w: 500, color: TH.muted, base: 'middle' });
      ctx.restore();
    });
    // «курсор» времени
    const cur = cam.prj([rc[0], 0.55, fz]); glow(ctx, cur.x, cur.y, 150, TH.orange, 0.9); circle(ctx, cur.x, cur.y, 16, rg(ctx, cur.x - 5, cur.y - 5, 1, cur.x, cur.y, 18, [[0, '#fff'], [1, TH.orangeL]]));
  };
  S.road3d.dark = true;

  // ============ FLOW: схема из узлов и стрелок ============
  S.flow = (ctx, T, sc, K) => {
    (sc.edges || []).forEach(e => {
      const A = sc.nodes.find(n => n.id === e.a), B = sc.nodes.find(n => n.id === e.b), a = e.at === undefined ? 0 : e.at, p = clamp((T - K.t0(a)) / 0.9); if (p <= 0.003) return;
      const pa = anchor(A, B), pb = anchor(B, A);
      curve(ctx, pa, pb, { bend: e.bend || 0, color: col(e.color || 'ink2'), lw: e.w || 6, p: E.out(p), flow: e.flow === false ? null : T, dash: e.dash });
      if (e.label && p > 0.9) txt(ctx, e.label, (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 - 18 - (e.bend || 0) * 0.5, { size: 26, w: 700, color: TH.muted, align: 'center', alpha: clamp((p - 0.9) * 10) });
    });
    sc.nodes.forEach((n, i) => {
      const a = n.at === undefined ? i : n.at, p = K.p(a, 0.7); if (p <= 0.001) return; const c = col(n.color), w = n.w || 300, h = n.h || 150, cur = K.beat === idx(a);
      ctx.save(); ctx.translate(n.x, n.y + (1 - clamp(p)) * 26 + Math.sin(T * 1.4 + i) * 2.5); const s_ = 0.8 + 0.2 * p; ctx.scale(s_, s_); ctx.globalAlpha *= clamp(p * 1.6);
      if (cur) glow(ctx, 0, 0, w * 0.8, c, 0.35);
      gcard(ctx, -w / 2, -h / 2, w, h, { fill: n.dark ? [TH.ink2, TH.ink] : ['#FFFFFF', '#FBF6EC'], r: 28, border: cur ? c : 'rgba(0,0,0,0.04)' });
      const tc = n.dark ? '#FFF6EC' : TH.ink, mc = n.dark ? '#C9BFD9' : TH.muted;
      if (n.icon) { badge(ctx, -w / 2 + 70, 0, 46, c); icon(ctx, n.icon, -w / 2 + 70, 0, 27); txt(ctx, n.h1, -w / 2 + 134, n.sub ? -24 : 0, { size: Math.min(n.size || 38, 38 * (w - 150) / Math.max(1, tw(ctx, n.h1, 38, 800))), w: 800, color: tc, base: 'middle' }); if (n.sub) block(ctx, n.sub, -w / 2 + 134, 20, w - 154, { size: 26, color: mc, lh: 31 }); }
      else { txt(ctx, n.h1, 0, n.sub ? -22 : 0, { size: n.size || 38, w: 800, color: tc, align: 'center', base: 'middle' }); if (n.sub) block(ctx, n.sub, -w / 2 + 20, 24, w - 40, { size: 26, color: mc, lh: 31, align: 'center' }); }
      ctx.restore();
    });
  };
  function anchor(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, w = (A.w || 300) / 2 + 12, h = (A.h || 150) / 2 + 12;
    if (Math.abs(dx) * h > Math.abs(dy) * w) return [A.x + Math.sign(dx) * w, A.y + dy * (w / Math.abs(dx)) * 0.0]; return [A.x + dx * (h / Math.abs(dy)) * 0.0, A.y + Math.sign(dy) * h];
  }

  // ============ COMPARE: «плохо / хорошо» ============
  S.compare = (ctx, T, sc, K) => {
    [['left', 110, TH.red, 'cross'], ['right', 980, TH.green, 'check']].forEach(([side, x, c0, ic0], si) => {
      const d = sc[side], c = d.color ? col(d.color) : c0, ic = d.icon || ic0, p = K.p(d.at === undefined ? si : d.at, 0.7); if (p <= 0.001) return; const cur = K.beat === idx(d.at === undefined ? si : d.at);
      ctx.save(); ctx.translate(0, (1 - clamp(p)) * 30); ctx.globalAlpha *= clamp(p * 1.5);
      gcard(ctx, x, 270, 830, 530, { fill: ['#FFFFFF', '#FBF6EC'], r: 34, border: cur ? c : 'rgba(0,0,0,0.04)' });
      rr(ctx, x, 270, 830, 16, 8); ctx.fillStyle = c; ctx.fill();
      badge(ctx, x + 70, 360, 40, c); icon(ctx, ic, x + 70, 360, 22); txt(ctx, d.h, x + 130, 362, { size: 40, w: 900, color: c, base: 'middle' });
      (d.items || []).forEach((it, k) => { const q = E.out(clamp((T - K.t0(it.at === undefined ? [d.at ?? si, 1.2 + k * 1.2] : it.at)) / 0.5)); if (q <= 0) return; ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - q) * 20, 0); circle(ctx, x + 56, 450 + k * 104 + 3, 9, c); block(ctx, it.t || it, x + 84, 462 + k * 104, 700, { size: 33, w: 600, color: TH.ink2, lh: 40 }); ctx.restore(); });
      ctx.restore();
    });
  };

  // ============ LIST: строки-шпаргалка ============
  S.list = (ctx, T, sc, K) => {
    const items = sc.items, n = items.length, rh = Math.min(122, 640 / n - 16);
    items.forEach((it, i) => {
      const a = it.at === undefined ? i : it.at, p = K.p(a, 0.65); if (p <= 0.001) return; const c = col(it.color || ['orange', 'teal', 'violet', 'blue', 'pink', 'green', 'yellow'][i % 7]), cur = K.beat === idx(a), y = 275 + i * (rh + 14);
      ctx.save(); ctx.translate((1 - clamp(p)) * 60, 0); ctx.globalAlpha *= clamp(p * 1.6);
      gcard(ctx, 110, y, 1500, rh, { fill: cur ? ['#FFFFFF', '#FFF4E6'] : ['#FFFFFF', '#FBF6EC'], r: 28, border: cur ? c : 'rgba(0,0,0,0.04)', shadowAlpha: cur ? 0.3 : 0.16 });
      badge(ctx, 110 + 62, y + rh / 2, rh * 0.36, c); txt(ctx, String(i + 1), 172, y + rh / 2 + 2, { size: rh * 0.38, w: 900, color: '#fff', align: 'center', base: 'middle' });
      txt(ctx, it.h, 240, y + rh / 2 - (it.t ? 14 : 0), { size: 38, w: 800, color: TH.ink, base: 'middle' }); if (it.t) txt(ctx, it.t, 240, y + rh / 2 + 22, { size: 25, w: 500, color: TH.muted, base: 'middle' });
      ctx.restore();
    });
  };

  // ============ BIGTEXT: ключевая фраза ============
  S.bigtext = (ctx, T, sc, K) => {
    const lines = sc.lines; let y = (sc.y || 400) - 60, prev = 0; glow(ctx, 900, 540, 640, col(sc.accent || 'orange'), 0.14);
    lines.forEach((l, i) => {
      const a = l.at === undefined ? i : l.at, p = K.p(a, 0.8), size = l.size || 92; y += 0.26 * prev + 0.88 * size + (i ? (l.gap || 14) : 0); prev = size; const yy = y;
      if (p <= 0.001) return;
      ctx.save(); ctx.translate(0, (1 - clamp(p)) * 40); ctx.globalAlpha *= clamp(p * 1.6);
      if (l.chip) pill(ctx, l.t, 110, yy - size * 0.75, { fill: [light(col(l.color || 'orange'), 0.2), col(l.color || 'orange')], size: size * 0.5, h: size * 0.9 });
      else txt(ctx, l.t, 110, yy, { size, w: 900, color: l.color ? col(l.color) : TH.ink });
      ctx.restore();
    });
  };

  // ============ TERMINAL ============
  S.terminal = (ctx, T, sc, K) => {
    const lines = sc.lines, x = 110, y = 270, w = sc.w || 1500, h = sc.h || 600, fs = sc.fs || 29, lh = fs * 1.5;
    const p = E.back(clamp(K.lt / 0.8)); ctx.save(); ctx.globalAlpha *= clamp(p * 2); ctx.translate(0, (1 - clamp(p)) * 30);
    gcard(ctx, x, y, w, h, { fill: ['#2A2236', '#1C1726'], r: 26, gloss: false, shadowAlpha: 0.35 });
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => circle(ctx, x + 36 + i * 30, y + 32, 10, c)); txt(ctx, sc.titlebar || 'terminal', x + w / 2, y + 33, { size: 22, w: 600, color: '#8E84A3', align: 'center', base: 'middle' });
    let row = 0;
    lines.forEach((l, i) => {
      const a = l.at === undefined ? 0 : l.at, t0 = K.t0(a) + (l.off || 0); if (T < t0) { row += (l.gap || 1); return; }
      const dur = l.k === 'cmd' || l.k === 'user' ? Math.max(0.6, (l.t.length) * 0.045) : 0.35, q = clamp((T - t0) / dur), shown = (l.k === 'cmd' || l.k === 'user') ? l.t.slice(0, Math.ceil(l.t.length * q)) : l.t;
      const colr = { cmd: '#FFF6EC', user: '#FFF6EC', out: '#B8AECB', dim: '#7C7290', claude: '#FFB28A', ok: '#6FE3A3', err: '#FF8A80', tool: '#8FB8FF' }[l.k || 'out'];
      const yy = y + 84 + row * lh, pre = l.k === 'cmd' ? '$ ' : l.k === 'user' ? '> ' : l.k === 'claude' ? '● ' : l.k === 'tool' ? '⏺ ' : '';
      if (pre) txt(ctx, pre, x + 36, yy, { size: fs, w: 700, color: l.k === 'claude' ? TH.orange : l.k === 'tool' ? '#8FB8FF' : '#6FE3A3', fam: 'mono' });
      const px = x + 36 + (pre ? tw(ctx, pre, fs, 700, 'mono') : 0);
      block(ctx, shown, px, yy, w - 100 - (px - x), { size: fs, w: 500, color: colr, fam: 'mono', lh, alpha: clamp(q * 3) });
      if ((l.k === 'cmd' || l.k === 'user') && q < 1) { ctx.fillStyle = '#FFB28A'; ctx.fillRect(px + tw(ctx, shown, fs, 500, 'mono') + 3, yy - fs * 0.82, fs * 0.55, fs * 1.05); }
      row += (l.gap || Math.max(1, wrap(ctx, l.t, w - 100 - (px - x), fs, 500, 'mono').length));
    });
    ctx.restore();
  };

  // ============ CODE: файл с подсветкой строк ============
  S.code = (ctx, T, sc, K) => {
    const lines = sc.code.split('\n'), x = 110, y = 265, w = sc.noteW ? 1700 - sc.noteW - 30 : 1500, fs = sc.fs || 28, lh = fs * 1.55, h = Math.min(640, lines.length * lh + 120);
    const p = E.back(clamp(K.lt / 0.8)); ctx.save(); ctx.globalAlpha *= clamp(p * 2); ctx.translate(0, (1 - clamp(p)) * 30);
    gcard(ctx, x, y, w, h, { fill: ['#2A2236', '#1C1726'], r: 26, gloss: false, shadowAlpha: 0.35 });
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => circle(ctx, x + 36 + i * 30, y + 32, 10, c)); txt(ctx, sc.file || 'file', x + w / 2, y + 33, { size: 22, w: 600, color: '#8E84A3', align: 'center', base: 'middle' });
    // подсветка по битам
    const hl = (sc.hl || []).filter(hh => K.on(hh.at)); const act = hl.length ? hl[hl.length - 1] : null;
    lines.forEach((l, i) => {
      const yy = y + 92 + i * lh; const on = act && i >= act.from - 1 && i <= act.to - 1;
      if (on) { ctx.fillStyle = 'rgba(255,170,120,0.16)'; ctx.fillRect(x + 12, yy - fs * 0.95, w - 24, lh); ctx.fillStyle = TH.orange; ctx.fillRect(x + 12, yy - fs * 0.95, 5, lh); }
      txt(ctx, String(i + 1), x + 56, yy, { size: fs * 0.8, w: 500, color: '#6B617E', align: 'right', fam: 'mono' });
      let cx = x + 84, parts = tokenize(l); parts.forEach(([s, k]) => { const c2 = { key: '#FFB28A', str: '#8EE3B0', com: '#7C7290', num: '#8FB8FF', pun: '#C9BFD9', txt: '#FFF6EC', hd: '#FFB28A' }[k]; txt(ctx, s, cx, yy, { size: fs, w: k === 'hd' ? 700 : 500, color: c2, fam: 'mono', alpha: act && !on ? 0.5 : 1 }); cx += tw(ctx, s, fs, k === 'hd' ? 700 : 500, 'mono'); });
    });
    ctx.restore();
    if (sc.noteW && act && act.note) { const q = E.out(clamp((T - K.t0(act.at)) / 0.5)); ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - q) * 30, 0); gcard(ctx, x + w + 30, y, sc.noteW, 400, { fill: ['#FFFFFF', '#FBF6EC'], r: 30 }); rr(ctx, x + w + 30, y, sc.noteW, 14, 7); ctx.fillStyle = TH.orange; ctx.fill(); txt(ctx, act.h || 'Что здесь', x + w + 60, y + 66, { size: 36, w: 800, color: TH.orange }); block(ctx, act.note, x + w + 60, y + 118, sc.noteW - 60, { size: 29, color: TH.ink2, lh: 39 }); ctx.restore(); }
  };
  function tokenize(l) {
    if (/^\s*(#|\/\/)/.test(l) && !/^\s*#{1,6}\s/.test(l)) return [[l, 'com']];
    if (/^\s*#{1,6}\s/.test(l)) return [[l, 'hd']];
    const out = []; const re = /("[^"]*"|'[^']*'|\b\d+\b|[{}\[\](),:=]|[A-Za-z_\-\.\/]+|\s+|.)/g; let m;
    while ((m = re.exec(l))) { const s = m[0]; let k = 'txt'; if (/^["']/.test(s)) k = 'str'; else if (/^\d+$/.test(s)) k = 'num'; else if (/^[{}\[\](),:=]$/.test(s)) k = 'pun'; else if (/^(---|name|description|allowed-tools|model|hooks|command|type|matcher|permissions|allow|ask|deny|env|mcpServers|args|mcp|servers|url)$/.test(s)) k = 'key'; out.push([s, k]); }
    return out;
  }

  // ============ TABLE ============
  S.table = (ctx, T, sc, K) => {
    const head = sc.head, rows = sc.rows, n = head.length, x0 = 110, colW = sc.colW || (1700 / n), rh = Math.min(92, Math.floor(560 / (rows.length + 1)) - 8), y0 = 270;
    const ph = K.p(0, 0.6, E.out); ctx.save(); ctx.globalAlpha *= clamp(ph * 1.5);
    gcard(ctx, x0, y0, 1700, rh, { fill: [TH.ink2, TH.ink], r: 24, shadowAlpha: 0.25 });
    head.forEach((h, i) => txt(ctx, h, x0 + 36 + i * colW, y0 + rh / 2, { size: 30, w: 800, color: '#FFF6EC', base: 'middle' })); ctx.restore();
    rows.forEach((r, k) => {
      const a = r.at === undefined ? k : r.at, p = K.p(a, 0.6); if (p <= 0.001) return; const y = y0 + (k + 1) * (rh + 10), cur = K.beat === idx(a);
      ctx.save(); ctx.translate((1 - clamp(p)) * 40, 0); ctx.globalAlpha *= clamp(p * 1.6);
      gcard(ctx, x0, y, 1700, rh, { fill: cur ? ['#FFFFFF', '#FFF4E6'] : ['#FFFFFF', '#FBF6EC'], r: 24, border: cur ? TH.orange : 'rgba(0,0,0,0.04)', shadowAlpha: 0.14 });
      r.c.forEach((c, i) => { if (i === 0) { badge(ctx, x0 + 56, y + rh / 2, 26, col(r.color || 'orange')); txt(ctx, c, x0 + 100, y + rh / 2, { size: 30, w: 800, color: TH.ink, base: 'middle' }); } else block(ctx, c, x0 + 36 + i * colW, y + rh / 2 - (wrap(ctx, c, colW - 60, 27, 500).length > 1 ? 14 : -9), colW - 60, { size: 27, w: 600, color: TH.ink2, lh: 32 }); });
      ctx.restore();
    });
  };

  return Object.assign(S, require('./scenes3d')(C, { col, idx }));
};
