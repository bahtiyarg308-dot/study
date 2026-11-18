'use strict';
// Сцены 1–7: вступление, проблема, аустенит, главная идея, перлит, бейнит, мартенсит
module.exports = function (L) {
  const { C, clamp, lerp, E, rng, mix, rgba, txt, block, tw, card, circle, line, arrow, pill, bar, micro, rr, wrap } = L;
  const S = {};

  // ---------- общие значки ----------
  function gear(ctx, cx, cy, r, teeth, fill, hole = 0.35) {
    ctx.save(); ctx.beginPath();
    const n = teeth * 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, rr_ = i % 2 ? r * 0.82 : r;
      ctx.lineTo(cx + Math.cos(a0) * rr_, cy + Math.sin(a0) * rr_); ctx.lineTo(cx + Math.cos(a1) * rr_, cy + Math.sin(a1) * rr_);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    circle(ctx, cx, cy, r * hole, C.cream); ctx.restore();
  }
  function steelBlock(ctx, x, y, w, h, heat) {
    const base = mix('#8E99AB', C.hot, heat), top = mix('#B7C0CE', '#FFB070', heat);
    if (heat > 0.15) { ctx.save(); ctx.shadowColor = `rgba(255,120,40,${0.7 * heat})`; ctx.shadowBlur = 50 * heat; rr(ctx, x, y, w, h, 14); ctx.fillStyle = base; ctx.fill(); ctx.restore(); }
    rr(ctx, x, y, w, h, 14); ctx.fillStyle = base; ctx.fill();
    rr(ctx, x + 6, y + 6, w - 12, h * 0.28, 8); ctx.fillStyle = top; ctx.globalAlpha *= 0.55; ctx.fill(); ctx.globalAlpha /= 0.55;
  }
  function cup(ctx, x, y, s, a, t) { // чашка с паром и растворяющимся сахаром
    ctx.save(); ctx.globalAlpha *= a;
    rr(ctx, x, y, 110 * s, 90 * s, 18 * s); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.muted; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 118 * s, y + 42 * s, 26 * s, -1.2, 1.2); ctx.stroke();
    rr(ctx, x + 6 * s, y + 18 * s, 98 * s, 66 * s, 12 * s); ctx.fillStyle = '#B9814A'; ctx.fill();
    for (let i = 0; i < 6; i++) circle(ctx, x + (20 + i * 14) * s + Math.sin(t * 2 + i) * 4 * s, y + (40 + (i % 3) * 14) * s + Math.cos(t * 2.3 + i) * 3 * s, 3.2 * s, '#FFF3DC');
    for (let i = 0; i < 3; i++) { ctx.beginPath(); const sx = x + (28 + i * 26) * s; ctx.moveTo(sx, y - 6 * s);
      ctx.bezierCurveTo(sx - 12 * s, y - 24 * s + Math.sin(t * 2 + i) * 4 * s, sx + 12 * s, y - 36 * s, sx, y - 54 * s); ctx.lineWidth = 3.5 * s; ctx.strokeStyle = 'rgba(120,130,150,0.55)'; ctx.stroke(); }
    ctx.restore();
  }
  const legend = (ctx, x, y, a, o = {}) => {
    circle(ctx, x + 14, y, 15, C.iron, C.ironS, 1.5); txt(ctx, 'атом железа (Fe)', x + 42, y, { size: 30, color: o.c || C.ink, base: 'middle', alpha: a });
    circle(ctx, x + 14, y + 48, 7, o.dot || C.ink); txt(ctx, 'атом углерода (C)', x + 42, y + 48, { size: 30, color: o.c || C.ink, base: 'middle', alpha: a });
  };

  // ============================== 0. ВСТУПЛЕНИЕ ==============================
  S.intro = (ctx, T, sc, K) => {
    const a1 = E.out(clamp((T - 0.3) / 0.8));
    [[C.blueL, 0], [C.goldL, 1], [C.red, 2]].forEach(([c, i]) => {
      const p = E.back(clamp((T - 0.25 - i * 0.18) / 0.6));
      circle(ctx, 140 + i * 66, 150, 26 * p, i === 0 ? '#5E97C8' : i === 1 ? '#E0B040' : '#BC3F1A');
    });
    txt(ctx, 'Химия · Материаловедение', 110, 290, { size: 36, weight: 'bold', color: C.orangeL, alpha: a1 });
    const a2 = E.out(clamp((T - 0.6) / 0.9));
    ctx.save(); ctx.translate(0, (1 - a2) * 30);
    txt(ctx, 'Перлит, бейнит,', 110, 430, { size: 128, weight: 'bold', color: C.cream, alpha: a2 });
    txt(ctx, 'мартенсит', 110, 560, { size: 128, weight: 'bold', color: C.cream, alpha: a2 });
    ctx.restore();
    const a3 = E.out(clamp((T - 1.3) / 0.9));
    txt(ctx, 'Как скорость охлаждения меняет сталь', 110, 640, { size: 54, color: C.orangeL, alpha: a3 });
    txt(ctx, 'Разбор доклада: понять тему и рассказать её', 110, 706, { size: 36, color: '#9AA3B3', alpha: a3 });
    const items = ['Что происходит со сталью при охлаждении', 'Три структуры: перлит, бейнит, мартенсит', 'Легирующие элементы, закалка и отпуск', 'Как рассказывать доклад и отвечать на вопросы'];
    const t0 = K.s('plan');
    items.forEach((s, i) => {
      const a = E.out(clamp((T - (t0 + [0.2, 2.4, 5.2, 7.2][i])) / 0.6));
      card(ctx, 110 + i * 432, 790, 408, 150, { fill: C.navy2, r: 20, alpha: a });
      ctx.save(); ctx.globalAlpha *= a; circle(ctx, 110 + i * 432 + 48, 790 + 48, 26, [C.blue, C.gold, C.red, C.orange][i], null); ctx.restore();
      txt(ctx, String(i + 1), 110 + i * 432 + 48, 790 + 48, { size: 32, weight: 'bold', color: '#fff', align: 'center', base: 'middle', alpha: a });
      block(ctx, s, 110 + i * 432 + 24, 790 + 106, 360, { size: 25, color: C.cream, lh: 28, alpha: a });
    });
  };
  S.intro.noHeader = true;

  // ============================== 1. ПРОБЛЕМА ==============================
  S.problem = (ctx, T, sc, K) => {
    const xA = 150, xB = 1150, bw = 620, bh = 110, by = 330;
    const chainA = K.show('idea', -0.3, 0.8);                  // уход брусков
    const vis = 1 - chainA;
    // нагрев
    const heatUp = K.on('heat') ? E.io(clamp((T - K.s('heat')) / 3.0)) : 0;
    const coolA = K.on('cool') ? E.lin(clamp((T - K.s('cool')) / (K.d('cool') + 4))) : 0;
    const coolB = K.on('cool') ? E.out(clamp((T - K.s('cool') - 2.4) / 2.0)) : 0;
    const hA = heatUp * (1 - 0.8 * coolA), hB = heatUp * (1 - coolB);
    const dip = K.on('cool') ? E.io(clamp((T - K.s('cool') - 1.2) / 1.4)) : 0;
    ctx.save(); ctx.globalAlpha *= vis;
    // подписи
    const a0 = K.show('twin', 0.1, 0.6);
    txt(ctx, 'Брусок 1', xA, 296, { size: 40, weight: 'bold', alpha: a0 }); txt(ctx, 'Брусок 2', xB, 296, { size: 40, weight: 'bold', alpha: a0 });
    txt(ctx, 'сталь 40Х', xA + bw, 296, { size: 32, color: C.muted, align: 'right', alpha: a0 }); txt(ctx, 'сталь 40Х', xB + bw, 296, { size: 32, color: C.muted, align: 'right', alpha: a0 });
    txt(ctx, '=', 960, by + 78, { size: 130, weight: 'bold', color: C.orange, align: 'center', alpha: a0 });
    txt(ctx, 'один состав', 960, by + 130, { size: 32, weight: 'bold', color: C.orange, align: 'center', alpha: a0 });
    // печи
    const fA = K.show('heat', 0, 0.8), fBvis = fA * (1 - dip);
    const furnace = (x, a, glow) => {
      card(ctx, x - 26, by - 30, bw + 52, bh + 60, { fill: mix('#6B6560', '#7A3A22', glow), r: 20, alpha: a });
      card(ctx, x - 12, by - 14, bw + 24, bh + 28, { fill: mix('#4B4743', '#C9501E', glow * 0.9), r: 14, alpha: a });
    };
    furnace(xA, fA, hA * 0.9 + 0.1); furnace(xB, fBvis, hB * 0.9 + 0.1);
    steelBlock(ctx, xA, by, bw, bh, hA);
    // брусок B: вынимаем и опускаем в масло
    const yB = by + dip * 240;
    ctx.save(); steelBlock(ctx, xB, yB, bw, bh, hB); ctx.restore();
    // масло
    const oilA = K.show('cool', 0.3, 0.8);
    if (oilA > 0) {
      const ty = 540, th = 190;
      ctx.save(); ctx.globalAlpha *= oilA;
      card(ctx, xB - 30, ty, bw + 60, th, { fill: 'rgba(120,80,30,0.92)', r: 20 });
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= oilA * 0.9;
      rr(ctx, xB - 30, ty, bw + 60, th, 20); ctx.clip();
      steelBlock(ctx, xB, yB, bw, bh, hB);
      ctx.fillStyle = 'rgba(150,100,40,0.55)'; ctx.fillRect(xB - 30, Math.max(ty + 14, yB), bw + 60, 400);
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= oilA; ctx.fillStyle = 'rgba(255,230,180,0.5)'; ctx.fillRect(xB - 30, ty + 12, bw + 60, 4); ctx.restore();
      txt(ctx, 'масло', xB + bw - 10, ty + th - 22, { size: 34, weight: 'bold', color: '#F3D9A8', align: 'right', alpha: oilA });
      // пузырьки
      if (dip > 0.3 && coolB < 0.95) for (let i = 0; i < 9; i++) {
        const ph = ((T * 0.9 + i * 0.37) % 1), bx = xB + 40 + i * 66 + Math.sin(T * 3 + i) * 8;
        circle(ctx, bx, ty + 120 - ph * 110, 5 + (i % 3) * 2, `rgba(255,240,210,${0.7 * (1 - ph)})`);
      }
    }
    // подписи способа охлаждения
    const cA = K.show('cool', 0, 0.6);
    pill(ctx, 'очень медленно · вместе с печью', xA, 470, { fill: C.blue, size: 30, alpha: cA });
    pill(ctx, 'быстро · в масле', xB, 470, { fill: C.red, size: 30, alpha: cA * (1 - dip * 0.0) });
    // часы под первым бруском
    if (cA > 0) {
      const cx = xA + 90, cy = 640; ctx.save(); ctx.globalAlpha *= cA;
      circle(ctx, cx, cy, 52, C.cream, C.muted, 4);
      const ang = (T - K.s('cool')) * 0.5; line(ctx, cx, cy, cx + Math.sin(ang) * 36, cy - Math.cos(ang) * 36, C.ink, 5);
      line(ctx, cx, cy, cx + Math.sin(ang * 12) * 28, cy - Math.cos(ang * 12) * 28, C.ink, 3);
      ctx.restore(); txt(ctx, 'остывает часами', cx + 80, cy + 12, { size: 36, color: C.muted, alpha: cA });
    }
    // результат
    const rA = K.show('res', 0, 0.7), rB = K.show('res', 2.4, 0.7);
    const resCard = (x, a, name, desc, hard, col) => {
      card(ctx, x, 760, bw, 130, { fill: C.card, r: 20, alpha: a });
      txt(ctx, name, x + 28, 806, { size: 40, weight: 'bold', color: col, alpha: a });
      txt(ctx, desc, x + 28, 846, { size: 30, color: C.muted, alpha: a });
      txt(ctx, 'твёрдость', x + bw - 28, 800, { size: 24, color: C.muted, align: 'right', alpha: a });
      ctx.save(); ctx.globalAlpha *= a; bar(ctx, x + bw - 248, 812, 220, 22, hard * E.out(clamp((a - 0.3) / 0.7)), col); ctx.restore();
    };
    resCard(xA, rA, 'Мягкая сталь', 'легко обрабатывать', 0.25, C.blue);
    resCard(xB, rB, 'Твёрдая сталь', 'почти как инструмент', 0.92, C.red);
    ctx.restore();

    // цепочка «скорость → структура → свойства»
    const ch = [['Скорость\nохлаждения', C.navy, C.cream], ['Структура', C.navy, C.cream], ['Свойства', C.orange, '#fff']];
    const times = [K.sent('idea', 2), K.sent('idea', 1), K.sent('idea', 0)];
    const cy = 300 + 0 * 0, cw = 460, chh = 170, gap = 160, x0 = (1920 - (3 * cw + 2 * gap)) / 2;
    ch.forEach((c, i) => {
      const a = E.out(clamp((T - times[i]) / 0.6)) * chainA; if (a <= 0) return;
      const x = x0 + i * (cw + gap);
      ctx.save(); ctx.translate(0, (1 - a) * 20);
      card(ctx, x, cy + 40, cw, chh, { fill: c[1], r: 26, alpha: a, shadow: true });
      c[0].split('\n').forEach((l, k, arr) => txt(ctx, l, x + cw / 2, cy + 40 + chh / 2 + (k - (arr.length - 1) / 2) * 52 + 14, { size: 52, weight: 'bold', color: c[2], align: 'center', alpha: a }));
      ctx.restore();
      if (i < 2) arrow(ctx, x + cw + 26, cy + 40 + chh / 2, x + cw + gap - 26, cy + 40 + chh / 2, rgba(C.ink, a), 7, 26);
    });
    const aB = E.out(clamp((T - K.sent('idea', 3)) / 0.6)) * chainA * (1 - K.show('uses', -0.4, 0.4));
    if (aB > 0) { const w = pill(ctx, 'Об этом — твой доклад', 960, 560, { fill: C.orange, size: 46, align: 'center', alpha: aB, h: 84 }); }
    // детали
    const uses = K.show('uses', 0, 0.6);
    if (uses > 0) {
      const items = [['валы', 0], ['шестерни', 1], ['оси', 2]];
      items.forEach(([nm, i]) => {
        const cx = 480 + i * 480, cyy = 780, a = E.out(clamp((T - K.s('uses') - 0.4 - i * 0.9) / 0.6));
        ctx.save(); ctx.globalAlpha *= a;
        if (i === 0) { rr(ctx, cx - 120, cyy - 22, 240, 44, 8); ctx.fillStyle = '#8E99AB'; ctx.fill(); rr(ctx, cx - 150, cyy - 14, 40, 28, 5); ctx.fill(); rr(ctx, cx + 110, cyy - 14, 40, 28, 5); ctx.fill(); rr(ctx, cx - 30, cyy - 26, 60, 10, 4); ctx.fillStyle = '#6E788A'; ctx.fill(); }
        if (i === 1) gear(ctx, cx, cyy, 56, 12, '#8E99AB');
        if (i === 2) { rr(ctx, cx - 120, cyy - 8, 240, 16, 6); ctx.fillStyle = '#8E99AB'; ctx.fill(); circle(ctx, cx - 110, cyy, 40, '#8E99AB'); circle(ctx, cx - 110, cyy, 14, C.cream); circle(ctx, cx + 110, cyy, 40, '#8E99AB'); circle(ctx, cx + 110, cyy, 14, C.cream); }
        ctx.restore();
        txt(ctx, nm, cx, cyy + 100, { size: 38, weight: 'bold', color: C.ink, align: 'center', alpha: a });
      });
      txt(ctx, 'Детали работают под нагрузкой — свойства стали критичны', 960, 640, { size: 40, color: C.muted, align: 'center', alpha: uses });
    }
  };

  // ============================== 2. АУСТЕНИТ ==============================
  S.austenite = (ctx, T, sc, K) => {
    // температура
    let temp = 20;
    if (K.on('heat')) temp = lerp(20, 850, E.io(clamp((T - K.s('heat')) / 6.5)));
    if (K.on('unst', 0.8)) temp = lerp(850, 620, E.io(clamp((T - K.s('unst') - 0.8) / 6)));
    const diss = E.io(clamp((temp - 20) / 520));   // растворение углерода
    // положения углерода: карбидные «кучки» (холодно) -> равномерно (горячо)
    const clusters = [[1.6, 1.6], [5.6, 2.6], [3.2, 4.6]]; const r2 = rng(11);
    const dots = L.micro.__d || (L.micro.__d = (() => { const arr = []; const base = []; for (let i = 0; i < 14; i++) { const c = clusters[i % 3]; const ang = r2() * 6.28, rad = 0.12 + r2() * 0.3; base.push([c[0] + Math.cos(ang) * rad, c[1] + Math.sin(ang) * rad]); } return base; })());
    const spread = (() => { const r = rng(5), arr = []; for (let i = 0; i < 14; i++) arr.push([0.6 + r() * 6.8, 0.5 + r() * 5]); return arr; })();
    const cur = dots.map((d, i) => [lerp(d[0], spread[i][0], diss), lerp(d[1], spread[i][1], diss)]);
    const lab = K.show('steel', 0.2, 0.6);
    micro(ctx, 110, 275, 'aus', 0, T, { scale: 1.8, dots: cur, jitter: 0.3 + temp / 850 * 2.2 });
    legend(ctx, 1340, 836, lab);
    // термометр
    const tx = 1080, tt = 300, tb = 870, ty = T_ => tb - T_ / 900 * (tb - tt);
    ctx.save(); ctx.globalAlpha *= K.show('steel', 0.3, 0.6);
    card(ctx, tx, tt - 16, 56, tb - tt + 32, { fill: '#E1DCD2', r: 28 });
    const fillH = temp / 900 * (tb - tt);
    card(ctx, tx + 8, tb - fillH, 40, fillH + 8, { fill: mix(C.blue, C.hot, clamp((temp - 100) / 650)), r: 20 });
    circle(ctx, tx + 28, tb + 18, 34, mix(C.blue, C.hot, clamp((temp - 100) / 650)));
    for (let v = 0; v <= 800; v += 200) { line(ctx, tx - 14, ty(v), tx, ty(v), C.muted, 3); txt(ctx, String(v), tx - 22, ty(v), { size: 26, color: C.muted, align: 'right', base: 'middle' }); }
    ctx.restore();
    const a727 = K.show('heat', 0, 0.7);
    line(ctx, tx - 8, ty(727), 1340, ty(727), C.orange, 4, [14, 10]); ctx.globalAlpha = 1;
    ctx.save(); ctx.globalAlpha *= a727; line(ctx, tx - 8, ty(727), 1340, ty(727), C.orange, 4, [14, 10]);
    txt(ctx, '727 °C', tx + 70, ty(727) - 10, { size: 30, weight: 'bold', color: C.orange });
    line(ctx, tx - 8, ty(850), 1340, ty(850), C.hot, 3, [4, 8]); txt(ctx, '≈ 850 °C', tx + 70, ty(850) - 10, { size: 28, color: C.hot });
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 1;
    // табло температуры
    txt(ctx, `${Math.round(temp)} °C`, 1340, 340, { size: 96, weight: 'bold', color: mix(C.ink, C.hot, clamp((temp - 300) / 500)), align: 'left', alpha: K.show('steel', 0.3, 0.6) });
    ctx.restore();
    // текстовые блоки справа
    const R = 1340, RW = 470;
    const blk = (c1, c2, fn) => { const a = K.win(c1, c2, 0.5, 0.4); if (a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 16); fn(); ctx.restore(); } };
    blk('steel', 'heat', () => { block(ctx, 'Сталь = железо + немного углерода', R, 480, RW, { size: 46, weight: 'bold', lh: 54 }); block(ctx, 'При комнатной температуре углерод собран в «кучки» — карбиды.', R, 660, RW, { size: 32, color: C.muted, lh: 40 }); });
    blk('heat', 'name', () => { block(ctx, 'Выше 727 °C углерод равномерно растворяется в железе', R, 480, RW, { size: 42, weight: 'bold', lh: 50 }); cup(ctx, R + 20, 700, 1.0, 1, T); txt(ctx, 'как сахар\nв горячем чае'.split('\n')[0], R + 180, 740, { size: 32, color: C.muted }); txt(ctx, 'в горячем чае', R + 180, 780, { size: 32, color: C.muted }); });
    blk('name', 'unst', () => { txt(ctx, 'АУСТЕНИТ', R, 520, { size: 78, weight: 'bold', color: C.orange }); block(ctx, 'горячая сталь, в которой углерод растворён в железе', R, 580, RW, { size: 38, lh: 46 }); });
    blk('unst', null, () => { block(ctx, 'Ниже 727 °C аустенит неустойчив и начинает распадаться', R, 480, RW, { size: 42, weight: 'bold', lh: 50 }); pill(ctx, 'на что — решает скорость охлаждения', R, 690, { fill: C.orange, size: 28 }); arrow(ctx, R + 60, 640, R + 60, 680, C.orange, 5, 18); });
    // название на схеме
    if (K.on('name')) txt(ctx, 'аустенит', 110 + 806 / 2, 262, { size: 34, weight: 'bold', color: C.orange, align: 'center', alpha: K.show('name', 0, 0.6) });
  };

  // ============================== 3. ГЛАВНАЯ ИДЕЯ ==============================
  S.idea = (ctx, T, sc, K) => {
    const kinds = [['pearl', 'Перлит', 'медленное охлаждение', C.blue, 'slow', 1.0], ['bain', 'Бейнит', 'средняя скорость', C.gold, 'mid', 0.45], ['mart', 'Мартенсит', 'очень быстро', C.red, 'fast', 0.1]];
    const dimmed = K.on('slow') ? 1 : 1 - 0.7 * K.show('need', 0, 0.6);
    const overlay = (K.on('slow') && !K.on('temp', -0.3)) ? 0 : 1;
    kinds.forEach(([kind, name, sub, col, cue, tfrac], i) => {
      const x = 110 + i * 626, y = 300;
      let p = 0, tp = 0;
      if (K.on(cue)) { const dur = cue === 'fast' ? 1.4 : K.d(cue) * 0.85; p = E.lin(clamp((T - K.s(cue) - 0.3) / dur)); tp = clamp((T - K.s(cue) - 0.3) / (K.d(cue) * 0.9)) * tfrac; }
      const ov = Math.max(K.win('temp', 'sum', 0.5, 0.45), K.win('sum', null, 0.6, 0.3));
      ctx.save(); ctx.globalAlpha *= (K.on('slow') ? (K.on(cue, -0.5) ? 1 : 0.5) : dimmed) * (1 - 0.82 * ov);
      micro(ctx, x, y, kind, p, T, { jitter: kind === 'mart' && p > 0.95 ? 0 : 1 });
      const nameA = K.on(cue, -0.3) ? 1 : 0;
      txt(ctx, K.on(cue, -0.3) ? name : 'Аустенит', x, 700, { size: 48, weight: 'bold', color: K.on(cue, -0.3) ? col : C.muted });
      txt(ctx, K.on(cue, -0.3) ? sub : 'углерод растворён', x, 746, { size: 32, color: C.muted });
      // шкала времени
      txt(ctx, 'время на перемещение', x, 806, { size: 24, color: C.muted });
      bar(ctx, x, 822, 448, 20, tp, col);
      ctx.restore();
    });
    // стрелка диффузии
    if (K.on('need') && !K.on('game', -0.4)) {
      const a = K.show('need', 1.0, 0.6) * (1 - K.show('game', -0.5, 0.4));
    }
    // карточка «диффузия»
    const cNeed = K.win('need', 'slow', 0.5, 0.5) * (K.on('game') ? 0 : 1);
    const overlayCard = (a, fn, h = 380) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 20); card(ctx, 250, 330, 1420, h, { fill: C.cream, r: 28, shadow: true, stroke: 'rgba(0,0,0,0.08)' }); fn(); ctx.restore(); };
    overlayCard(K.win('need', 'game', 0.5, 0.45), () => {
      txt(ctx, 'ДИФФУЗИЯ', 320, 440, { size: 70, weight: 'bold', color: C.orange });
      block(ctx, 'перемещение атомов в твёрдом теле', 320, 500, 1280, { size: 48, weight: 'bold', lh: 56 });
      const a = K.show('need', 5.5, 0.6);
      txt(ctx, 'Чтобы аустенит распался, углерод должен выйти из железа', 320, 600, { size: 38, color: C.muted, alpha: a });
      txt(ctx, 'и собраться в новом месте. А для этого нужно время.', 320, 650, { size: 38, color: C.muted, alpha: a });
    });
    overlayCard(K.win('game', 'slow', 0.5, 0.45), () => {
      const fig = (cx, cy, col, pose) => { circle(ctx, cx, cy - 56, 22, col); rr(ctx, cx - 22, cy - 28, 44, 70, 14); ctx.fillStyle = col; ctx.fill();
        line(ctx, cx - 22, cy - 14, cx - 44, cy + (pose ? -34 : 22), col, 9); line(ctx, cx + 22, cy - 14, cx + 44, cy + (pose ? -34 : 22), col, 9);
        line(ctx, cx - 10, cy + 40, cx - 16, cy + 84, col, 11); line(ctx, cx + 10, cy + 40, cx + 16, cy + 84, col, 11); };
      txt(ctx, 'Как в игре «замри»', 960, 404, { size: 52, weight: 'bold', align: 'center' });
      card(ctx, 330, 436, 600, 330, { fill: C.card, r: 22 }); card(ctx, 990, 436, 600, 330, { fill: C.card, r: 22 });
      txt(ctx, 'Предупредили заранее', 630, 486, { size: 36, weight: 'bold', color: C.blue, align: 'center' });
      rr(ctx, 540, 676, 180, 14, 7); ctx.fillStyle = C.blue; ctx.fill(); fig(630, 600, C.blue, 0);
      txt(ctx, 'успел занять место', 630, 740, { size: 32, color: C.muted, align: 'center' });
      txt(ctx, 'Резкая команда: «Замри!»', 1290, 486, { size: 36, weight: 'bold', color: C.red, align: 'center' });
      rr(ctx, 1380, 676, 120, 14, 7); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill(); fig(1290, 600, C.red, 1);
      txt(ctx, 'застыл там, где стоял', 1290, 740, { size: 32, color: C.muted, align: 'center' });
    }, 460);
    // «температура»
    overlayCard(K.win('temp', 'sum', 0.5, 0.45), () => {
      txt(ctx, 'Чем ниже температура — тем медленнее диффузия', 960, 400, { size: 48, weight: 'bold', align: 'center' });
      const x0 = 400, y0 = 650, w = 560, h = 190;
      line(ctx, x0, y0, x0 + w, y0, C.muted, 4); line(ctx, x0, y0, x0, y0 - h, C.muted, 4);
      txt(ctx, 'температура падает →', x0 + w, y0 + 36, { size: 26, color: C.muted, align: 'right' }); txt(ctx, 'скорость диффузии', x0 + 12, y0 - h - 6, { size: 26, color: C.muted });
      const pts = []; for (let i = 0; i <= 60; i++) { const f = i / 60; pts.push([x0 + f * w, y0 - h * Math.pow(1 - f, 3.2) - 6]); }
      L.strokePath(ctx, pts, K.prog('temp', 0.4, 2), C.red, 7);
      block(ctx, 'Поэтому при быстром охлаждении углерод как будто «замерзает» на месте', 1060, 520, 540, { size: 40, lh: 50, color: C.ink });
    });
    // итог
    const aS = K.win('sum', null, 0.6, 0.3);
    if (aS > 0) { ctx.save(); ctx.globalAlpha *= aS; card(ctx, 250, 340, 1420, 360, { fill: C.navy, r: 28, shadow: true });
      txt(ctx, 'Всё остальное в докладе —', 960, 470, { size: 60, color: C.cream, align: 'center' });
      txt(ctx, 'следствие одной идеи', 960, 550, { size: 74, weight: 'bold', color: C.orangeL, align: 'center' });
      txt(ctx, 'нет времени  →  нет перемещения углерода  →  другая структура', 960, 640, { size: 34, color: '#B9C2D3', align: 'center' }); ctx.restore(); }
  };

  return Object.assign(S, require('./scenes1b')(L));
};
