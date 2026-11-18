'use strict';
// Сцены 8–15: сравнение, С-диаграмма, легирование, закалка/отпуск, шпаргалка, план доклада, вопросы, финал
module.exports = function (L) {
  const { C, clamp, lerp, E, rng, mix, rgba, txt, block, tw, card, circle, line, arrow, pill, bar, micro, rr, wrap, catmull, strokePath, pathAt } = L;
  const S = {};
  const win = (ctx, K, c1, c2, fn, fi = 0.5, fo = 0.4) => { const a = K.win(c1, c2, fi, fo); if (a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 14); fn(a); ctx.restore(); } };
  const gauge = (ctx, x, y, w, label, v, col, a = 1, note) => {
    ctx.save(); ctx.globalAlpha *= a; txt(ctx, label, x, y, { size: 30, weight: 'bold' });
    if (note) txt(ctx, note, x + w, y, { size: 26, color: C.muted, align: 'right' });
    bar(ctx, x, y + 12, w, 22, v * E.out(clamp((a - 0.2) / 0.8)), col); ctx.restore();
  };

  // ============================== СРАВНЕНИЕ ==============================
  S.compare = (ctx, T, sc, K) => {
    const cols = [
      { cue: 'p', kind: 'pearl', name: 'Перлит', col: C.blue, v: ['медленно', 'в пластинках', 'мягче'], h: 0.25, ductile: 0.9 },
      { cue: 'b', kind: 'bain', name: 'Бейнит', col: C.gold, v: ['средняя скорость', 'мелкие карбиды', 'прочный и вязкий'], h: 0.6, ductile: 0.65 },
      { cue: 'm', kind: 'mart', name: 'Мартенсит', col: C.red, v: ['очень быстро', 'застрял в решётке', 'твёрдый и хрупкий'], h: 0.97, ductile: 0.12 },
    ];
    const cw = 540, gap = 40, y0 = 262, ch = 524;
    const aR = K.show('rule', 0, 0.7);
    const aArrow = K.show('arrow', 0.3, 1.2) * (1 - aR);
    cols.forEach((c, i) => {
      const x = 110 + i * (cw + gap), a = K.show(c.cue, 0, 0.7); if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 26);
      card(ctx, x, y0, cw, ch, { fill: C.card, r: 24 }); card(ctx, x, y0, cw, 16, { fill: c.col, r: 8 });
      txt(ctx, c.name, x + 28, y0 + 84, { size: 50, weight: 'bold', color: c.col });
      micro(ctx, x + cw - 28 - 206, y0 + 34, c.kind, 1, T, { scale: 0.46, jitter: 0.5 });
      [['охлаждение', c.v[0]], ['углерод', c.v[1]], ['сталь', c.v[2]]].forEach(([k, v], r) => {
        txt(ctx, k, x + 28, y0 + 246 + r * 56, { size: 26, color: C.muted }); txt(ctx, v, x + 190, y0 + 246 + r * 56, { size: 36, weight: 'bold' });
      });
      gauge(ctx, x + 28, y0 + 418, cw - 56, 'твёрдость', c.h, c.col, a); gauge(ctx, x + 28, y0 + 476, cw - 56, 'вязкость', c.ductile, C.green, a);
      ctx.restore();
    });
    // стрелка скорости
    const ay = 846; ctx.save(); ctx.globalAlpha *= aArrow;
    arrow(ctx, 110, ay, 110 + 1700 * clamp(aArrow * 1.0), ay, C.orange, 8, 30);
    txt(ctx, 'скорость охлаждения растёт', 110, ay - 20, { size: 36, weight: 'bold', color: C.orange }); ctx.restore();
    if (aR > 0) pill(ctx, 'Чем быстрее охлаждаем — тем твёрже сталь, но тем она хрупче', 960, 810, { fill: C.orange, size: 44, h: 84, align: 'center', alpha: aR });
  };

  // ============================== С-ДИАГРАММА ==============================
  const X0 = 190, X1 = 1130, YT = 290, YB = 800;
  const mx = lt => X0 + (lt + 1) / 5 * (X1 - X0), my = Tt => YB - Tt / 900 * (YB - YT);
  const CURVE = [[3.4, 725], [2.4, 708], [1.5, 675], [0.8, 625], [0.3, 575], [0.0, 540], [0.1, 490], [0.45, 435], [0.9, 385], [1.3, 345], [1.7, 305], [2.0, 275]];
  const MS = 300;
  const P = {
    slow: [[-0.8, 850], [0.4, 835], [1.3, 780], [2.0, 730], [2.6, 690], [3.4, 600], [3.9, 520]],
    mid: [[-0.8, 850], [-0.5, 730], [-0.3, 610], [-0.12, 525], [0.12, 478], [0.6, 420], [1.1, 360], [1.8, 280], [3.0, 130]],
    fast: [[-0.8, 850], [-0.62, 700], [-0.5, 560], [-0.38, 430], [-0.25, 310], [-0.1, 200], [0.3, 90], [1.5, 30]],
    crit: [[-0.8, 850], [-0.55, 720], [-0.3, 610], [-0.05, 548], [0.05, 500], [0.12, 430], [0.2, 340], [0.4, 200], [1.2, 60]],
    oil: [[-0.8, 850], [-0.4, 720], [-0.05, 580], [0.35, 490], [0.7, 420], [1.1, 340], [1.6, 260], [2.4, 140]],
  };
  const scr = (pts, dx = 0) => catmull(pts, 14).map(p => [mx(p[0] + dx), my(p[1])]);
  function segCross(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? [a[0] + t * r[0], a[1] + t * r[1], t] : null;
  }
  function cum(path) { const c = [0]; for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])); return c; }
  function firstCross(path, curve) {
    const c = cum(path);
    for (let i = 1; i < path.length; i++) for (let j = 1; j < curve.length; j++) {
      const x = segCross(path[i - 1], path[i], curve[j - 1], curve[j]);
      if (x) return { x: x[0], y: x[1], f: (c[i - 1] + x[2] * (c[i] - c[i - 1])) / c[c.length - 1] };
    }
    return null;
  }
  const PATHS = {}; Object.keys(P).forEach(k => PATHS[k] = scr(P[k]));
  const CURVE_S = scr(CURVE);

  function axes(ctx, a, K) {
    ctx.save(); ctx.globalAlpha *= a;
    line(ctx, X0, YB, X1 + 20, YB, C.ink, 4); line(ctx, X0, YB, X0, YT - 20, C.ink, 4);
    for (let v = 0; v <= 800; v += 200) { line(ctx, X0 - 10, my(v), X0, my(v), C.ink, 3); txt(ctx, String(v), X0 - 18, my(v), { size: 26, color: C.muted, align: 'right', base: 'middle' }); }
    txt(ctx, 'температура, °C', X0 - 60, YT - 40, { size: 28, weight: 'bold' });
    [[0, '1 с'], [1.78, '1 мин'], [3.56, '1 ч']].forEach(([lt, s]) => { line(ctx, mx(lt), YB, mx(lt), YB + 10, C.ink, 3); txt(ctx, s, mx(lt), YB + 40, { size: 26, color: C.muted, align: 'center' }); });
    txt(ctx, 'время (шкала логарифмическая) →', X1 + 20, YB + 76, { size: 28, weight: 'bold', align: 'right' });
    ctx.restore();
  }

  function chart(ctx, T, K, o) {
    axes(ctx, o.axesA === undefined ? 1 : o.axesA, K);
    const a727 = o.lineA === undefined ? 1 : o.lineA;
    ctx.save(); ctx.globalAlpha *= a727;
    line(ctx, X0, my(727), X1, my(727), C.orange, 4, [14, 10]); txt(ctx, '727 °C', X1 + 14, my(727), { size: 28, weight: 'bold', color: C.orange, base: 'middle' });
    line(ctx, X0, my(MS), X1, my(MS), C.red, 3.5, [10, 8]); txt(ctx, 'начало мартенсита', X1 - 6, my(MS) - 12, { size: 26, color: C.red, align: 'right' });
    ctx.restore();
    // области
    if (o.regions) {
      ctx.save(); ctx.globalAlpha *= o.regions;
      txt(ctx, 'аустенит (выше 727 °C устойчив)', mx(-0.8), my(893), { size: 28, weight: 'bold', color: C.muted });
      txt(ctx, 'перлит, сорбит, троостит', mx(2.0), my(600), { size: 32, weight: 'bold', color: C.blue, align: 'center' });
      txt(ctx, 'бейнит', mx(2.6), my(380), { size: 36, weight: 'bold', color: C.gold, align: 'center' });
      txt(ctx, 'мартенсит', mx(0.9), my(185), { size: 40, weight: 'bold', color: C.red, align: 'center' });
      ctx.restore();
    }
    // С-кривая(ые)
    (o.curves || []).forEach(c => {
      ctx.save(); ctx.beginPath(); ctx.rect(X0, YT - 30, X1 - X0 + 22, YB - YT + 30); ctx.clip();
      const pts = c.dx ? CURVE_S.map(p => [p[0] + c.dx * (X1 - X0) / 5, p[1]]) : CURVE_S;
      ctx.save(); ctx.globalAlpha *= (c.alpha === undefined ? 1 : c.alpha);
      const end = strokePath(ctx, pts, c.p === undefined ? 1 : c.p, c.color, c.lw || 7, c.dash);
      ctx.restore(); ctx.restore();
    });
    if (o.nose) { ctx.save(); ctx.globalAlpha *= o.nose; const nx = mx(0.0), ny = my(540);
      arrow(ctx, nx + 130, ny - 70, nx + 20, ny - 8, C.ink, 4, 16); txt(ctx, 'нос', nx + 140, ny - 74, { size: 36, weight: 'bold' }); ctx.restore(); }
    // пути охлаждения
    (o.paths || []).forEach(pp => {
      const pts = pp.pts || PATHS[pp.key]; ctx.save(); ctx.globalAlpha *= (pp.alpha === undefined ? 1 : pp.alpha);
      const end = strokePath(ctx, pts, pp.p, pp.color, pp.lw || 6, pp.dash);
      if (pp.p > 0.01) { circle(ctx, end.x, end.y, 10, pp.color); }
      if (pp.mark && pp.p >= pp.mark.f) { const m = pp.mark.pt; const r = 14 + 10 * Math.sin(T * 6); ctx.globalAlpha *= 1; circle(ctx, m.x, m.y, r, null, pp.color, 4); }
      if (pp.label && pp.p > 0.05) { const e = pts[pts.length - 1]; txt(ctx, pp.label, e[0] + (pp.lx || 0), e[1] + (pp.ly || -18), { size: 28, weight: 'bold', color: pp.color, align: pp.al || 'right' }); }
      ctx.restore();
    });
  }
  const cross = {};
  ['slow', 'mid'].forEach(k => { const c = firstCross(PATHS[k], CURVE_S); cross[k] = c ? { pt: { x: c.x, y: c.y }, f: c.f } : null; });
  { // пересечение быстрого пути с линией Мн
    const pts = PATHS.fast, c = cum(pts), y = my(MS);
    for (let i = 1; i < pts.length; i++) if ((pts[i - 1][1] - y) * (pts[i][1] - y) <= 0) {
      const f = (y - pts[i - 1][1]) / (pts[i][1] - pts[i - 1][1]);
      cross.fast = { pt: { x: lerp(pts[i - 1][0], pts[i][0], f), y }, f: (c[i - 1] + f * (c[i] - c[i - 1])) / c[c.length - 1] }; break;
    }
  }

  S.cdiag = (ctx, T, sc, K) => {
    const aAx = K.show('intro', 4.0, 0.8), aCurve = K.on('curve') ? E.io(clamp((T - K.s('curve') - 0.4) / 3.5)) : 0;
    const pr = (cue, dur = 0.8) => K.on(cue) ? E.io(clamp((T - K.s(cue) - 0.6) / (K.d(cue) * dur))) : 0;
    chart(ctx, T, K, {
      axesA: aAx, lineA: K.show('axes', 0.3, 0.8), regions: K.show('crit', 0, 1.0) * 0 + (K.on('fast') ? K.show('fast', 2.5, 1.0) : 0),
      curves: [{ p: aCurve, color: C.ink, lw: 8 }], nose: K.win('curve', 'slow', 0.6, 0.5) * (K.on('curve', 2.2) ? 1 : 0),
      paths: [
        { key: 'slow', p: pr('slow', 0.8), color: C.blue, mark: cross.slow, label: K.on('slow') ? 'медленно' : null, ly: -20 },
        { key: 'mid', p: pr('mid', 0.8), color: C.gold, mark: cross.mid, label: K.on('mid') ? 'быстрее' : null, ly: -20 },
        { key: 'fast', p: pr('fast', 0.6), color: C.red, mark: cross.fast, label: K.on('fast') ? 'очень быстро' : null, ly: -20 },
        { key: 'crit', p: pr('crit', 0.6), color: C.ink, lw: 4, dash: [10, 8], alpha: K.on('crit') ? 1 : 0 },
      ],
    });
    // правая колонка
    const R = 1250, RW = 560;
    win(ctx, K, 'intro', 'axes', () => {
      pill(ctx, 'БОНУС · в слайдах этого нет', R, 300, { fill: C.orange, size: 28 });
      block(ctx, 'Диаграмма распада аустенита', R, 400, RW, { size: 52, weight: 'bold', lh: 60 });
      block(ctx, 'Помогает понять, почему получаются разные структуры и зачем нужны легирующие элементы.', R, 560, RW, { size: 34, color: C.muted, lh: 44 });
    });
    win(ctx, K, 'axes', 'curve', () => {
      txt(ctx, '↑ температура', R, 370, { size: 48, weight: 'bold' }); txt(ctx, '→ время', R, 440, { size: 48, weight: 'bold' });
      block(ctx, 'Выше 727 °C аустенит устойчив. Ниже — начинает распадаться.', R, 520, RW, { size: 36, color: C.muted, lh: 46 });
    });
    win(ctx, K, 'curve', 'slow', () => {
      block(ctx, 'Кривая «С»', R, 360, RW, { size: 60, weight: 'bold' });
      block(ctx, 'Показывает, когда аустенит начинает распадаться. Слева от неё он ещё цел. Выступ — «нос».', R, 430, RW, { size: 36, color: C.muted, lh: 46 });
    });
    const rows = [['slow', C.blue, 'Медленно', '→ перлит', 'пересекает кривую вверху — диффузия быстрая'], ['mid', C.gold, 'Быстрее', '→ бейнит', 'пересекает ниже — углерод почти не движется'], ['fast', C.red, 'Очень быстро', '→ мартенсит', 'проскакивает мимо носа, не касаясь кривой']];
    rows.forEach(([cue, col, a1, a2, sub], i) => {
      const a = K.show(cue, 0.4, 0.6) * (1 - K.show('crit', -0.3, 0.5)); if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - a) * 30, 0);
      card(ctx, R, 320 + i * 170, RW, 150, { fill: C.card, r: 20 }); card(ctx, R, 320 + i * 170, 14, 150, { fill: col, r: 7 });
      txt(ctx, a1, R + 36, 372 + i * 170, { size: 38, weight: 'bold', color: col }); txt(ctx, a2, R + RW - 28, 372 + i * 170, { size: 44, weight: 'bold', align: 'right' });
      block(ctx, sub, R + 36, 416 + i * 170, RW - 60, { size: 28, color: C.muted, lh: 34 }); ctx.restore();
    });
    win(ctx, K, 'crit', null, () => {
      card(ctx, R, 320, RW, 400, { fill: C.card, r: 24 });
      block(ctx, 'Критическая скорость закалки', R + 30, 382, RW - 60, { size: 42, weight: 'bold', lh: 48 });
      block(ctx, 'Самое медленное охлаждение, при котором линия ещё проскакивает мимо носа, лишь касаясь его.', R + 30, 500, RW - 60, { size: 34, color: C.muted, lh: 44 });
      pill(ctx, 'ниже неё — мартенсита не будет', R + 30, 620, { fill: C.red, size: 28 });
    }, 0.6, 0.3);
  };

  // ============================== ЛЕГИРОВАНИЕ ==============================
  S.alloy = (ctx, T, sc, K) => {
    const shiftP = K.on('shift') ? E.io(clamp((T - K.s('shift') - 0.8) / 2.6)) : 0;
    const DX = 0.9 * shiftP;
    const inWater = K.on('water') && !K.on('oil'), inOil = K.on('oil');
    const pr = (cue, off = 0.5, dur = 0.55) => K.on(cue) ? E.io(clamp((T - K.s(cue) - off) / (K.d(cue) * dur))) : 0;
    const plainA = inOil ? 0.35 : 1, alloyA = (inOil ? 1 : (K.on('shift') ? (inWater ? 0.35 : 1) : 0));
    const oilP = inWater ? pr('water', 3.0, 0.5) : inOil ? pr('oil', 0.3, 0.45) : 0;
    const waterP = K.on('water') ? pr('water', 0.4, 0.4) : 0;
    const oilShift = PATHS.oil;
    chart(ctx, T, K, {
      axesA: 1, lineA: 1, regions: 0,
      curves: [{ p: 1, color: inOil ? '#9AA3B3' : C.ink, lw: 7, alpha: K.on('shift') ? plainA : 1, dash: K.on('shift') ? [12, 9] : null },
               { p: 1, color: C.orange, lw: 8, dx: DX, alpha: alloyA * clamp(shiftP * 3) }],
      paths: [
        { key: 'fast', p: waterP, color: C.blue, lw: 6, alpha: inOil ? 0 : 1, label: waterP > 0.05 ? 'вода' : null, ly: -20 },
        { key: 'oil', p: oilP, color: C.gold, lw: 6, label: oilP > 0.05 ? 'масло' : null, ly: -20 },
      ],
    });
    if (K.on('shift')) txt(ctx, 'обычная сталь', mx(1.9), my(772), { size: 28, weight: 'bold', color: inOil ? '#9AA3B3' : C.ink, align: 'center' });
    if (shiftP > 0.6) txt(ctx, 'легированная сталь', X1 + 6, my(772), { size: 28, weight: 'bold', color: C.orange, align: 'right', alpha: clamp(shiftP * 2 - 1) });
    // результат на диаграмме
    if (inWater && waterP > 0.95) pill(ctx, 'вода → мартенсит ✓, но жёстко', mx(-0.55), my(110), { fill: C.blue, size: 26, alpha: E.out(clamp((T - K.s('water') - 2.2) / 0.5)) });
    if (inWater && oilP > 0.95) pill(ctx, 'масло → мартенсита нет ✗', mx(0.6), my(62), { fill: C.gold, size: 26, color: '#fff' });
    if (inOil && oilP > 0.9) pill(ctx, 'масло → мартенсит ✓, мягче', mx(0.6), my(62), { fill: C.green, size: 26 });
    // правая колонка
    const R = 1270, RW = 540;
    win(ctx, K, 'what', 'brake', () => {
      block(ctx, 'Легированная сталь — в ней специально добавлены:', R, 330, RW, { size: 38, weight: 'bold', lh: 46 });
      ['хром', 'никель', 'молибден', 'марганец'].forEach((el, i) => {
        const a = E.out(clamp((T - K.s('what') - 3.2 - i * 0.9) / 0.5)); if (a <= 0) return;
        pill(ctx, el, R + (i % 2) * 270, 470 + Math.floor(i / 2) * 84, { fill: C.navy, size: 34, alpha: a });
      });
      const aX = K.show('x', 0, 0.6);
      if (aX > 0) { ctx.save(); ctx.globalAlpha *= aX; card(ctx, R, 660, RW, 150, { fill: C.card, r: 20 });
        txt(ctx, '40Х', R + 30, 740, { size: 80, weight: 'bold', color: C.orange }); txt(ctx, 'Х = хром', R + 250, 706, { size: 40, weight: 'bold' }); txt(ctx, 'название стали', R + 250, 750, { size: 28, color: C.muted }); ctx.restore(); }
    }, 0.5, 0.4);
    win(ctx, K, 'brake', 'shift', () => {
      block(ctx, 'Добавки тормозят распад аустенита', R, 350, RW, { size: 52, weight: 'bold', lh: 60 });
      block(ctx, 'Атомам становится труднее перемещаться — диффузия идёт медленнее.', R, 520, RW, { size: 36, color: C.muted, lh: 46 });
    });
    win(ctx, K, 'shift', 'water', () => {
      block(ctx, 'С-кривая сдвигается вправо', R, 350, RW, { size: 52, weight: 'bold', lh: 60, color: C.orange });
      block(ctx, 'Проскочить мимо носа можно и при более мягком охлаждении. Критическая скорость становится ниже.', R, 520, RW, { size: 36, color: C.muted, lh: 46 });
    });
    win(ctx, K, 'water', 'oil', () => {
      card(ctx, R, 330, RW, 440, { fill: C.card, r: 24 }); txt(ctx, 'Обычная сталь', R + 30, 394, { size: 46, weight: 'bold', color: C.blue });
      txt(ctx, 'нужна вода', R + 30, 458, { size: 56, weight: 'bold' });
      block(ctx, 'Вода охлаждает очень жёстко: в детали много напряжений, есть риск трещин.', R + 30, 520, RW - 60, { size: 34, color: C.muted, lh: 42 });
    });
    win(ctx, K, 'oil', null, () => {
      card(ctx, R, 330, RW, 440, { fill: C.card, r: 24 }); txt(ctx, 'Легированная сталь', R + 30, 394, { size: 46, weight: 'bold', color: C.orange });
      txt(ctx, 'хватает масла', R + 30, 458, { size: 56, weight: 'bold' });
      block(ctx, 'Масло охлаждает мягче: меньше напряжений, коробления и трещин.', R + 30, 520, RW - 60, { size: 34, color: C.muted, lh: 42 });
    }, 0.5, 0.3);
  };

  // ============================== ЗАКАЛКА И ОТПУСК ==============================
  S.temper = (ctx, T, sc, K) => {
    const CX0 = 190, CX1 = 1230, CY0 = 290, CY1 = 800;
    const px = x => CX0 + x / 10 * (CX1 - CX0), py = t => CY1 - t / 900 * (CY1 - CY0);
    // оси
    line(ctx, CX0, CY1, CX1 + 10, CY1, C.ink, 4); line(ctx, CX0, CY1, CX0, CY0 - 20, C.ink, 4);
    for (let v = 0; v <= 800; v += 200) { line(ctx, CX0 - 10, py(v), CX0, py(v), C.ink, 3); txt(ctx, String(v), CX0 - 18, py(v), { size: 26, color: C.muted, align: 'right', base: 'middle' }); }
    txt(ctx, 'температура, °C', CX0 - 60, CY0 - 40, { size: 28, weight: 'bold' }); txt(ctx, 'время →', CX1 + 10, CY1 + 44, { size: 28, weight: 'bold', align: 'right' });
    // полоса отпуска
    const aBand = K.show('temper', 0.2, 0.8);
    ctx.save(); ctx.globalAlpha *= aBand * 0.25; ctx.fillStyle = C.gold; ctx.fillRect(px(4.5), py(650), px(9.6) - px(4.5), py(500) - py(650)); ctx.restore();
    ctx.save(); ctx.globalAlpha *= aBand; txt(ctx, 'отпуск 500–650 °C', px(9.6), py(500) + 34, { size: 28, weight: 'bold', color: '#9A7618', align: 'right' }); ctx.restore();
    line(ctx, CX0, py(727), CX1, py(727), C.orange, 3, [12, 9]); txt(ctx, '727 °C', CX1 + 14, py(727), { size: 26, weight: 'bold', color: C.orange, base: 'middle' });
    const seg = (pts, color, f) => strokePath(ctx, pts.map(p => [px(p[0]), py(p[1])]), f, color, 8);
    const qp = K.on('quench') ? clamp((T - K.s('quench') - 0.3) / (K.d('quench') * 0.8)) : 0;
    // три участка до закалки: нагрев, выдержка, закалка
    const S1 = [[0.2, 20], [2.4, 850]], S2 = [[2.4, 850], [3.4, 850]], S3 = [[3.4, 850], [3.7, 400], [4.0, 25]];
    const lens = [2.3, 1.0, 0.9], tot = lens[0] + lens[1] + lens[2];
    const f1 = clamp(qp * tot / lens[0]), f2 = clamp((qp * tot - lens[0]) / lens[1]), f3 = clamp((qp * tot - lens[0] - lens[1]) / lens[2]);
    if (f1 > 0) seg(S1, C.hot, f1); if (f2 > 0) seg(S2, C.hot, f2); if (f3 > 0) seg(S3, C.red, f3);
    const tp = K.on('temper') ? clamp((T - K.s('temper') - 0.4) / (K.d('temper') * 0.85)) : 0;
    const S4 = [[4.0, 25], [4.6, 25]], S5 = [[4.6, 25], [6.0, 600]], S6 = [[6.0, 600], [7.2, 600]], S7 = [[7.2, 600], [8.3, 330], [9.5, 25]];
    const l4 = [0.6, 1.5, 1.2, 1.4], t2 = l4.reduce((a, b) => a + b, 0);
    let acc = 0; [[S4, C.muted], [S5, C.gold], [S6, C.gold], [S7, C.blue]].forEach(([pts, col], i) => { const f = clamp((tp * t2 - acc) / l4[i]); acc += l4[i]; if (f > 0) seg(pts, col, f); });
    // подписи
    const lab = (s, x, y, col, a, al = 'left') => txt(ctx, s, px(x), py(y), { size: 30, weight: 'bold', color: col, alpha: a, align: al });
    lab('нагрев до', 1.45, 330, C.hot, E.out(clamp(qp * 3))); lab('аустенита', 1.45, 270, C.hot, E.out(clamp(qp * 3)));
    lab('выдержка', 2.6, 890, C.hot, clamp((qp - 0.45) * 4)); lab('закалка', 4.0, 500, C.red, clamp((qp - 0.8) * 5));
    txt(ctx, 'быстрое охлаждение в масле', px(4.0) + 10, py(440), { size: 26, color: C.red, alpha: clamp((qp - 0.85) * 6) });
    lab('нагрев', 4.5, 200, '#9A7618', clamp(tp * 4)); lab('выдержка', 6.3, 660, '#9A7618', clamp((tp - 0.4) * 4)); lab('медленное остывание', 7.6, 330, C.blue, clamp((tp - 0.7) * 4));
    // правая колонка: состояния и свойства
    const R = 1350, RW = 460;
    const st = [
      { cue: 'quench', name: 'Аустенит', col: C.hot, sub: 'при нагреве', h: null },
      { cue: 'quench', off: 4.0, name: 'Мартенсит', col: C.red, sub: 'после закалки', h: 0.97, d: 0.12 },
      { cue: 'temper', off: 3.2, name: 'Сорбит отпуска', col: C.blue, sub: 'после отпуска', h: 0.7, d: 0.78 },
    ];
    st.forEach((s, i) => {
      const a = E.out(clamp((T - K.s(s.cue) - (s.off || 0) - (i === 0 ? 1.0 : 0)) / 0.7)); if (a <= 0) return;
      const cy = 280 + i * 196;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - a) * 24, 0);
      card(ctx, R, cy, RW, 178, { fill: C.card, r: 20 }); card(ctx, R, cy, 12, 178, { fill: s.col, r: 6 });
      txt(ctx, s.name, R + 32, cy + 50, { size: 38, weight: 'bold', color: s.col }); txt(ctx, s.sub, R + 32, cy + 84, { size: 26, color: C.muted });
      if (s.h !== null) { gauge(ctx, R + 32, cy + 124, 190, 'твёрдость', s.h, s.col, a); gauge(ctx, R + 250, cy + 124, 190, 'вязкость', s.d, C.green, a); }
      else txt(ctx, 'углерод растворён', R + 32, cy + 134, { size: 30, color: C.ink });
      ctx.restore();
    });
    const aE = K.show('exam', 0, 0.7);
    if (aE > 0) {
      const chips = [['нагрев ≈ 850 °C', C.hot], ['закалка в масле', C.red], ['отпуск', C.gold]];
      let x = 190; ctx.save(); ctx.globalAlpha *= aE;
      pill(ctx, 'Сталь 40Х:', x, 850, { fill: C.navy, size: 28 }); x += 190;
      chips.forEach(([s, col], i) => { const w = pill(ctx, s, x, 850, { fill: col, size: 28 }); x += w + 20; if (i < 2) arrow(ctx, x - 16, 874, x + 8, 874, C.ink, 4, 12); x += 14; });
      ctx.restore();
    }
  };

  // ============================== ШПАРГАЛКА ==============================
  S.cheat = (ctx, T, sc, K) => {
    const items = [
      ['f1', 'Нагрели — аустенит. Что из него выйдет, решает скорость охлаждения.', C.orangeL],
      ['f2', 'Медленно — перлит. Средне — бейнит. Очень быстро — мартенсит.', C.blueL],
      ['f3', 'Чем быстрее охлаждаем — тем твёрже сталь, но тем она хрупче.', C.goldL],
      ['f4', 'Легирующие элементы тормозят распад аустенита — закаливаем в масле, а не в воде.', C.redL],
      ['f5', 'После закалки — отпуск: убирает хрупкость.', '#B9E0C9'],
    ];
    items.forEach(([cue, s, col], i) => {
      const a = K.show(cue, 0, 0.6), y = 246 + i * 132; if (a <= 0) return;
      const now = K.on(cue) && (i === 4 || !K.on(items[i + 1][0], 0));
      ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - a) * 40, 0);
      card(ctx, 110, y, 1700, 116, { fill: now ? '#364260' : C.navy2, r: 24, stroke: now ? col : null });
      circle(ctx, 180, y + 58, 34, col); txt(ctx, String(i + 1), 180, y + 58, { size: 42, weight: 'bold', color: C.navy, align: 'center', base: 'middle' });
      txt(ctx, s, 248, y + 58, { size: 38, weight: now ? 'bold' : 'normal', color: C.cream, base: 'middle' });
      ctx.restore();
    });
  };
  S.cheat.dark = true;

  // ============================== ПЛАН ДОКЛАДА ==============================
  S.plan = (ctx, T, sc, K) => {
    const blocks = [
      ['s12', 'Слайды 1–2', 'Вступление', 40, 'Одна и та же сталь может иметь разные свойства — всё зависит от того, как её охлаждали', 'Состав один, свойства разные: решает структура', C.blue],
      ['s3', 'Слайд 3', 'Что происходит со сталью', 30, 'Нагрели — получился аустенит; что из него выйдет, решает скорость охлаждения', 'Нагрели, получили аустенит, потом охладили', C.blue],
      ['s4', 'Слайд 4', 'Схема внутри стали', 45, 'Чем быстрее охлаждаем, тем меньше углерод успевает собраться — и тем твёрже сталь', 'Чем быстрее охлаждаем, тем меньше углерод успевает собраться', C.gold],
      ['s5', 'Слайд 5', 'Три структуры', 50, 'Перлит — мягкий, бейнит — посередине, мартенсит — самый твёрдый, но хрупкий', 'Перлит, бейнит, мартенсит: что в них главное', C.gold],
      ['s6', 'Слайд 6', 'Легирующие элементы', 30, 'Легирующие элементы тормозят распад аустенита — закаливать можно в масле, а не в воде', 'Легирующие элементы позволяют закаливать мягче', C.red],
      ['s7', 'Слайд 7', 'Выводы', 30, 'Скорость охлаждения управляет структурой; легирование позволяет закаливать мягко', 'Скорость охлаждения управляет структурой и свойствами', C.red],
    ];
    const tot = 225, bx = 110, bw = 1700, by = 280, bh = 74;
    // полоса времени
    const aBar = K.show('intro', 3.0, 0.8);
    ctx.save(); ctx.globalAlpha *= aBar; let x = bx;
    blocks.forEach(([cue, a1, a2, sec, mt, ttl, col], i) => {
      const w = bw * sec / tot, active = K.on(cue) && (i === 5 || !K.on(blocks[i + 1][0], 0)) && !K.on('tips');
      card(ctx, x + 2, by, w - 4, bh, { fill: active ? col : mix(col, '#F4F1EB', 0.62), r: 14 });
      txt(ctx, `${sec} с`, x + w / 2, by + bh / 2, { size: 32, weight: 'bold', color: active ? '#fff' : C.ink, align: 'center', base: 'middle' });
      txt(ctx, a1.replace('Слайды ', '').replace('Слайд ', ''), x + w / 2, by + bh + 34, { size: 28, color: C.muted, align: 'center' });
      x += w;
    });
    txt(ctx, 'слайды', bx, by + bh + 34, { size: 26, color: C.muted, align: 'right', alpha: 0 });
    ctx.restore();
    // подробности блока
    blocks.forEach(([cue, a1, a2, sec, mt, ttl, col], i) => {
      const a = K.win(cue, i === 5 ? 'tips' : blocks[i + 1][0], 0.45, 0.35); if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 16);
      // мини-слайд
      const sx = 110, sy = 470, sw = 600, sh = 340;
      card(ctx, sx, sy, sw, sh, { fill: C.cream, r: 14, shadow: true, stroke: 'rgba(0,0,0,0.12)' });
      txt(ctx, a2, sx + 28, sy + 52, { size: 24, weight: 'bold', color: C.orange });
      block(ctx, ttl, sx + 28, sy + 112, sw - 56, { size: 42, weight: 'bold', lh: 50, color: C.ink });
      for (let k = 0; k < 3; k++) card(ctx, sx + 28 + k * 180, sy + sh - 110, 164, 80, { fill: C.card, r: 10 });
      txt(ctx, a1, sx, sy - 18, { size: 34, weight: 'bold', color: col });
      txt(ctx, `≈ ${sec} секунд`, sx + sw, sy - 18, { size: 30, color: C.muted, align: 'right' });
      // главная мысль
      txt(ctx, 'ГЛАВНАЯ МЫСЛЬ', 780, 520, { size: 28, weight: 'bold', color: C.orange });
      block(ctx, mt, 780, 590, 1030, { size: 56, weight: 'bold', lh: 68, color: C.cream });
      ctx.restore();
    });
    // интро
    win(ctx, K, 'intro', 's12', () => {
      block(ctx, 'У каждого слайда — одна главная мысль', 110, 520, 1700, { size: 64, weight: 'bold', color: C.cream, lh: 74 });
      block(ctx, 'Если собьёшься — скажи её своими словами и иди дальше.', 110, 620, 1700, { size: 44, color: '#B9C2D3', lh: 54 });
    });
    // советы
    const tips = [['Говори медленнее, чем кажется нужным', C.orangeL], ['Смотри на слайд: там почти те же слова', C.goldL], ['Названия «перлит, бейнит, мартенсит» — чётко', C.blueL]];
    tips.forEach(([s, col], i) => {
      const a = E.out(clamp((T - K.s('tips') - 0.6 - i * 3.6) / 0.6)) * K.show('tips', 0, 0.4); if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - a) * 30, 0);
      card(ctx, 110, 470 + i * 120, 1700, 100, { fill: C.navy2, r: 22 }); circle(ctx, 176, 520 + i * 120, 28, col);
      txt(ctx, String(i + 1), 176, 520 + i * 120, { size: 34, weight: 'bold', color: C.navy, align: 'center', base: 'middle' }); txt(ctx, s, 236, 520 + i * 120, { size: 42, color: C.cream, base: 'middle' });
      ctx.restore();
    });
  };
  S.plan.dark = true;

  // ============================== ВОПРОСЫ ==============================
  S.qa = (ctx, T, sc, K) => {
    const QA = [
      ['q1', 'a1', 'Чем бейнит отличается от перлита и мартенсита?', 'Перлит — диффузией: углерод успевает перераспределиться. Мартенсит — без диффузии. Бейнит посередине: решётка перестраивается сдвигом, как у мартенсита, а углерод ещё немного перемещается и выделяется мелкими карбидами.'],
      ['q2', 'a2', 'Почему легированные стали закаливают в масле, а не в воде?', 'Легирующие элементы замедляют распад аустенита, критическая скорость у них ниже, и мартенсит получается уже в масле. Масло охлаждает мягче — меньше напряжений, коробления и трещин.'],
      ['q3', 'a3', 'Почему мартенсит твёрдый и хрупкий?', 'Углерод остался внутри решётки железа и сильно её искажает. Кристалл напряжён, поэтому очень твёрдый, но малопластичный.'],
      ['q4', 'a4', 'Зачем нужен отпуск?', 'После закалки сталь твёрдая, но хрупкая и напряжённая. При нагреве в интервале 500–650 °C напряжения снимаются, вязкость растёт. У стали 40Х получается сорбит отпуска.'],
      ['q5', 'a5', 'Что такое аустенит и что такое диффузия?', 'Аустенит — горячая сталь, в которой углерод растворён в железе; при охлаждении распадается на перлит, бейнит или мартенсит. Диффузия — перемещение атомов в твёрдом теле; чем ниже температура, тем она медленнее.'],
    ];
    win(ctx, K, 'intro', 'q1', () => {
      block(ctx, 'Проверь себя', 960 - 800, 470, 1600, { size: 96, weight: 'bold', color: C.cream, align: 'center' });
      block(ctx, 'Вопрос → пауза, чтобы ответить вслух → ответ', 960 - 800, 580, 1600, { size: 46, color: C.orangeL, align: 'center' });
    });
    QA.forEach(([qc, ac, q, ans], i) => {
      const next = i < QA.length - 1 ? QA[i + 1][0] : null;
      const aQ = K.win(qc, next, 0.5, 0.45); if (aQ <= 0) return;
      ctx.save(); ctx.globalAlpha *= aQ;
      txt(ctx, `Вопрос ${i + 1} из ${QA.length}`, 110, 262, { size: 30, weight: 'bold', color: C.orangeL });
      block(ctx, q, 110, 340, 1700, { size: 66, weight: 'bold', color: C.cream, lh: 76 });
      // таймер в паузе
      const tq0 = K.e(qc), tq1 = K.s(ac), inPause = T >= tq0 - 0.2 && T < tq1;
      if (T < tq1) {
        const f = clamp((T - tq0) / (tq1 - tq0));
        const cx = 960, cy = 640;
        ctx.save(); ctx.globalAlpha *= clamp((T - tq0 + 0.4) / 0.4);
        circle(ctx, cx, cy, 70, null, 'rgba(255,255,255,0.15)', 12);
        ctx.beginPath(); ctx.arc(cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.lineWidth = 12; ctx.strokeStyle = C.orangeL; ctx.lineCap = 'round'; ctx.stroke();
        txt(ctx, String(Math.max(1, Math.ceil((tq1 - T)))), cx, cy, { size: 64, weight: 'bold', color: C.cream, align: 'center', base: 'middle' });
        txt(ctx, 'Ответь вслух…', cx, cy + 130, { size: 38, color: '#B9C2D3', align: 'center' });
        ctx.restore();
      }
      const aA = E.out(clamp((T - K.s(ac)) / 0.6));
      if (aA > 0) { ctx.save(); ctx.globalAlpha *= aA; ctx.translate(0, (1 - aA) * 20);
        card(ctx, 110, 520, 1700, 360, { fill: C.navy2, r: 26 }); card(ctx, 110, 520, 14, 360, { fill: C.orangeL, r: 7 });
        txt(ctx, 'ОТВЕТ', 160, 576, { size: 28, weight: 'bold', color: C.orangeL });
        block(ctx, ans, 160, 636, 1600, { size: 42, color: C.cream, lh: 54 }); ctx.restore(); }
      ctx.restore();
    });
  };
  S.qa.dark = true;

  // ============================== ФИНАЛ ==============================
  S.outro = (ctx, T, sc, K) => {
    const sents = sc.sents.list;
    const items = [['Числа в докладе — ориентировочные', 'сверь со своим учебником или конспектом', C.orangeL], ['Список источников на последнем слайде', 'допиши год и издательство', C.goldL], ['Утром: презентация открывается?', 'скопируй на флешку и отправь себе в мессенджер', C.blueL]];
    items.forEach(([a, b, col], i) => {
      const t0 = sents[i + 1] ? sents[i + 1].start : sc.b.list.s; const f = E.out(clamp((T - t0 + 0.2) / 0.6)); if (f <= 0) return;
      const done = E.out(clamp((T - t0 - 3.0) / 0.4));
      ctx.save(); ctx.globalAlpha *= f; ctx.translate((1 - f) * 30, 0);
      card(ctx, 110, 260 + i * 150, 1700, 128, { fill: C.navy2, r: 24 });
      circle(ctx, 190, 324 + i * 150, 34, null, col, 5);
      ctx.save(); ctx.globalAlpha *= done; ctx.beginPath(); ctx.moveTo(172, 326 + i * 150); ctx.lineTo(186, 340 + i * 150); ctx.lineTo(212, 308 + i * 150); ctx.lineWidth = 8; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
      txt(ctx, a, 256, 312 + i * 150, { size: 46, weight: 'bold', color: C.cream }); txt(ctx, b, 256, 360 + i * 150, { size: 34, color: '#B9C2D3' });
      ctx.restore();
    });
    const aE = E.out(clamp((T - K.s('end') + 0.2) / 0.8));
    if (aE > 0) {
      ctx.save(); ctx.globalAlpha *= aE; ctx.fillStyle = C.navy; ctx.fillRect(0, 230, 1920, 700); ctx.restore();
      [['#5E97C8', 0], ['#E0B040', 1], ['#BC3F1A', 2]].forEach(([c, i]) => circle(ctx, 810 + i * 150, 400, 40 * E.back(clamp((T - K.s('end') - 0.4 - i * 0.2) / 0.5)), c));
      txt(ctx, 'Удачи на защите!', 960, 620, { size: 130, weight: 'bold', color: C.cream, align: 'center', alpha: aE });
      txt(ctx, 'Расскажи доклад вслух 2–3 раза с таймером — и всё получится', 960, 710, { size: 44, color: C.orangeL, align: 'center', alpha: aE });
    }
  };
  S.outro.dark = true;

  return S;
};
