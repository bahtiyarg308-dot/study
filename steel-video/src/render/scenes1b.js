'use strict';
// Сцены 4–6: перлит, бейнит, мартенсит
module.exports = function (L) {
  const { C, clamp, lerp, E, rng, mix, rgba, txt, block, tw, card, circle, line, arrow, pill, bar, micro, rr, strokePath } = L;
  const S = {};

  const gauge = (ctx, x, y, w, label, v, col, a = 1, note) => {
    ctx.save(); ctx.globalAlpha *= a;
    txt(ctx, label, x, y, { size: 32, weight: 'bold' });
    if (note) txt(ctx, note, x + w, y, { size: 28, color: C.muted, align: 'right' });
    bar(ctx, x, y + 14, w, 26, v * E.out(clamp((a - 0.2) / 0.8)), col); ctx.restore();
  };
  const leader = (ctx, x1, y1, x2, y2, col, a) => {
    ctx.save(); ctx.globalAlpha *= a; line(ctx, x1, y1, x2, y2, col, 3.5); circle(ctx, x2, y2, 7, col); ctx.restore();
  };
  const spectrum = (ctx, x, y, w, marker, a) => {
    ctx.save(); ctx.globalAlpha *= a;
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, C.blue); g.addColorStop(0.5, C.gold); g.addColorStop(1, C.red);
    rr(ctx, x, y, w, 30, 15); ctx.fillStyle = g; ctx.fill();
    txt(ctx, 'Перлит', x, y - 14, { size: 36, weight: 'bold', color: C.blue });
    txt(ctx, 'Бейнит', x + w / 2, y - 14, { size: 36, weight: 'bold', color: C.gold, align: 'center' });
    txt(ctx, 'Мартенсит', x + w, y - 14, { size: 36, weight: 'bold', color: C.red, align: 'right' });
    txt(ctx, 'медленно', x, y + 66, { size: 28, color: C.muted }); txt(ctx, 'очень быстро', x + w, y + 66, { size: 28, color: C.muted, align: 'right' });
    arrow(ctx, x + w * 0.36, y + 54, x + w * 0.64, y + 54, C.muted, 3, 12);
    ctx.restore();
  };

  // ============================== ПЕРЛИТ ==============================
  const PITCH = 64, PLATE = 14;
  function lamella(ctx, x, y, w, h, p, T, K) {
    card(ctx, x, y, w, h, { fill: C.panel, r: 18, stroke: 'rgba(0,0,0,0.06)' });
    ctx.save(); rr(ctx, x, y, w, h, 18); ctx.clip();
    const n = Math.floor(h / PITCH), r = rng(21);
    // феррит — слои
    const ferr = K.show('ferr', 0, 0.8);
    for (let k = 0; k < n; k++) {
      const cy = y + k * PITCH + PITCH * 0.5 + 6;
      ctx.fillStyle = mix('#EEF0F4', '#D5DCE8', ferr * p); ctx.fillRect(x, cy - PITCH * 0.5 + 6, w, PITCH - PLATE - 4);
      // пластина цементита растёт слева направо
      const pw = w * clamp(p * 1.25 - k * 0.04);
      card(ctx, x, cy + PITCH / 2 - PLATE - 2, pw, PLATE, { fill: C.blue, r: 3 });
    }
    // углерод (точки) — летит к пластинам
    for (let i = 0; i < 46; i++) {
      const k = i % n, tx = x + 30 + (i * 53) % (w - 60), ty = y + k * PITCH + PITCH * 0.5 + 6 + PITCH / 2 - PLATE / 2 - 2;
      const sx = x + 30 + r() * (w - 60), sy = y + 20 + r() * (h - 40);
      const q = E.io(clamp(p * 1.1 - (i % 7) * 0.03));
      if (q < 1 || p < 1) circle(ctx, lerp(sx, tx, q) + Math.sin(T * 3 + i) * 3 * (1 - q), lerp(sy, ty, q) + Math.cos(T * 3 + i) * 3 * (1 - q), 5.5, C.ink);
    }
    ctx.restore();
    return { n };
  }
  function strip(ctx, x, y, w, h, pitch, a, col) {
    ctx.save(); ctx.globalAlpha *= a; card(ctx, x, y, w, h, { fill: '#DDE3EC', r: 14 });
    rr(ctx, x, y, w, h, 14); ctx.clip();
    const th = Math.max(1.6, pitch * 0.24);
    for (let px = x + pitch * 0.5; px < x + w; px += pitch) { ctx.fillStyle = col; ctx.fillRect(px - th / 2, y, th, h); }
    ctx.restore();
  }

  S.pearlite = (ctx, T, sc, K) => {
    const px = 110, py = 270, pw = 840, ph = 520;
    const p = K.on('plates') ? E.io(clamp((T - K.s('plates') - 0.5) / (K.d('plates') * 0.8))) : 0;
    lamella(ctx, px, py, pw, ph, p, T, K);
    // подпись у панели
    const aW = K.show('what', 0.2, 0.6);
    pill(ctx, 'медленное охлаждение · например, вместе с печью', px, py + ph + 24, { fill: C.blue, size: 30, alpha: aW });
    // выноски
    const lw = 1 - K.show('thin', -0.3, 0.4);
    const aC = K.show('plates', 3.0, 0.6) * lw, aF = K.show('ferr', 0.2, 0.6) * lw;
    if (aC > 0) {
      ctx.save(); ctx.globalAlpha *= aC; const yy = py + 2 * PITCH + PITCH * 1.5 + 6 - PLATE / 2 + 24;
      line(ctx, px + 480, yy, 1020, 484, C.blue, 3.5); circle(ctx, px + 480, yy, 7, C.blue); ctx.restore();
    }
    if (aF > 0) {
      ctx.save(); ctx.globalAlpha *= aF; const yy = py + 4 * PITCH + 38;
      line(ctx, px + 300, yy, 1020, 604, C.muted, 3.5); circle(ctx, px + 300, yy, 7, C.muted); ctx.restore();
    }
    // Правая колонка
    const R = 1030, RW = 780;
    const win = (c1, c2, fn) => { const a = K.win(c1, c2, 0.5, 0.4); if (a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 14); fn(a); ctx.restore(); } };
    win('what', 'thin', () => {
      txt(ctx, 'ПЕРЛИТ', R, 350, { size: 104, weight: 'bold', color: C.blue });
      txt(ctx, 'слоёный пирог из твёрдых и мягких слоёв', R, 408, { size: 38, color: C.muted });
      const l1 = K.show('plates', 2.4, 0.5), l2 = K.show('ferr', 0, 0.5);
      ctx.save(); ctx.globalAlpha *= l1; card(ctx, R, 470, 62, 26, { fill: C.blue, r: 6 }); txt(ctx, 'цементит Fe₃C', R + 84, 484, { size: 38, weight: 'bold', base: 'middle' }); txt(ctx, 'очень твёрдые тонкие пластинки (карбид железа)', R + 84, 528, { size: 30, color: C.muted }); ctx.restore();
      ctx.save(); ctx.globalAlpha *= l2; card(ctx, R, 590, 62, 26, { fill: '#C9D2E0', r: 6 }); txt(ctx, 'феррит', R + 84, 604, { size: 38, weight: 'bold', base: 'middle' }); txt(ctx, 'мягкое чистое железо между пластинками', R + 84, 648, { size: 30, color: C.muted }); ctx.restore();
      const l3 = K.show('prop', 0, 0.6);
      gauge(ctx, R, 720, 560, 'Твёрдость', 0.22, C.blue, l3, 'самая низкая из трёх'); gauge(ctx, R, 800, 560, 'Пластичность', 0.9, C.green, l3, 'высокая');
    });
    // шаг «тоньше»
    const sw = (c1) => K.show(c1, 0, 0.6);
    const aT = K.win('thin', null, 0.5, 0.4);
    if (aT > 0) {
      ctx.save(); ctx.globalAlpha *= aT;
      const rows = [['Перлит', 36, '0,6 мкм', 'пластинки толще — сталь мягче'], ['Сорбит', 18, '0,3 мкм', 'тоньше — твёрже'], ['Троостит', 6, '0,1 мкм', 'самые тонкие — самый твёрдый']];
      const t0 = K.s('thin');
      rows.forEach((r, i) => {
        const ap = E.out(clamp((T - (t0 + 1.0 + i * 3.0)) / 0.7)), y = 290 + i * 150;
        if (ap <= 0) return;
        ctx.save(); ctx.globalAlpha *= ap; ctx.translate((1 - ap) * 30, 0);
        strip(ctx, R, y, 440, 120, r[1], 1, C.blue);
        const showName = K.on('names', 0.2 + i * 1.5) ? 1 : 0;
        txt(ctx, showName ? r[0] : ['тоньше', 'ещё тоньше', 'самые тонкие'][i], R + 470, y + 50, { size: 44, weight: 'bold', color: showName ? C.blue : C.muted });
        const showNum = K.on('nums', [2.6, 4.3, 6.0][i]);
        txt(ctx, showNum ? `≈ ${r[2]}` : (i === 0 ? 'расстояние между пластинками' : ''), R + 470, y + 96, { size: showNum ? 38 : 24, weight: showNum ? 'bold' : 'normal', color: showNum ? C.ink : C.muted });
        ctx.restore();
      });
      // стрелка «быстрее охлаждение»
      const ab = E.out(clamp((T - (t0 + 6.5)) / 0.6));
      if (ab > 0) { ctx.save(); ctx.globalAlpha *= ab; arrow(ctx, R, 748, R + 760, 748, C.orange, 6, 24);
        txt(ctx, 'быстрее охлаждение', R, 792, { size: 32, weight: 'bold', color: C.orange }); txt(ctx, 'тоньше пластинки → твёрже сталь', R + 760, 792, { size: 30, color: C.ink, align: 'right' }); ctx.restore(); }
      if (K.on('nums', 9.2)) pill(ctx, 'числа помнить не обязательно — скажи «около»', R, 826, { fill: C.orange, size: 28, alpha: E.out(clamp((T - K.s('nums') - 9.2) / 0.5)) });
      ctx.restore();
    }
  };

  // ============================== БЕЙНИТ ==============================
  S.bainite = (ctx, T, sc, K) => {
    const px = 110, py = 290, sc_ = 1.5;
    const p = K.on('carbon') ? E.io(clamp((T - K.s('carbon') - 0.4) / (K.d('carbon') * 0.8))) : 0;
    const shear = K.on('hybrid') ? 0.85 * E.io(clamp((T - K.s('hybrid') - 0.8) / 2.0)) : 0;
    const dim = 1;
    micro(ctx, px, py, 'bain', p, T, { scale: sc_, shear });
    txt(ctx, 'Бейнит', px, py + 504 + 56, { size: 52, weight: 'bold', color: C.gold, alpha: K.show('what', 0, 0.6) });
    txt(ctx, 'схема условная', px + 672, py + 504 + 56, { size: 26, color: C.muted, align: 'right' });
    const R = 900, RW = 910;
    spectrum(ctx, R, 360, RW, 0.5, K.show('what', 0.3, 0.6));
    const aM = K.show('what', 2.5, 0.6);
    if (aM > 0) { ctx.save(); ctx.globalAlpha *= aM; const mx = R + RW * 0.5;
      ctx.beginPath(); ctx.moveTo(mx, 400); ctx.lineTo(mx - 16, 440); ctx.lineTo(mx + 16, 440); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
      txt(ctx, 'промежуточная структура', mx, 482, { size: 36, weight: 'bold', align: 'center' }); ctx.restore(); }
    const win = (c1, c2, fn) => { const a = K.win(c1, c2, 0.5, 0.4); if (a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 14); fn(a); ctx.restore(); } };
    win('carbon', 'hybrid', () => {
      card(ctx, R, 560, RW, 250, { fill: C.card, r: 22 });
      card(ctx, R + 36, 604, 74, 26, { fill: C.blueL, r: 6 }); txt(ctx, 'мелкие карбиды', R + 134, 618, { size: 40, weight: 'bold', base: 'middle' });
      block(ctx, 'Углерод успевает сместиться лишь немного: собирается не в длинные пластинки, а в мелкие кусочки.', R + 36, 676, RW - 72, { size: 34, lh: 44, color: C.muted });
    });
    win('hybrid', 'props', () => {
      card(ctx, R, 560, RW, 120, { fill: '#F3DDD3', r: 22 }); card(ctx, R, 700, RW, 120, { fill: '#DCE6F0', r: 22 });
      txt(ctx, 'как у мартенсита', R + 30, 608, { size: 34, weight: 'bold', color: C.red }); txt(ctx, 'решётка железа перестраивается сдвигом', R + 30, 650, { size: 32 });
      txt(ctx, 'как у перлита', R + 30, 748, { size: 34, weight: 'bold', color: C.blue }); txt(ctx, 'углерод ещё немного перемещается', R + 30, 790, { size: 32 });
    });
    const aP = K.show('props', 0, 0.6);
    if (aP > 0) {
      ctx.save(); ctx.globalAlpha *= aP; card(ctx, R, 560, RW, 270, { fill: C.card, r: 22 });
      txt(ctx, 'Нижний бейнит', R + 30, 616, { size: 44, weight: 'bold', color: C.gold }); txt(ctx, 'образуется при более низкой температуре', R + 30, 656, { size: 28, color: C.muted });
      gauge(ctx, R + 30, 700, 400, 'Прочность', 0.85, C.gold, aP); gauge(ctx, R + 460, 700, 400, 'Вязкость', 0.8, C.green, aP);
      txt(ctx, 'и прочный, и вязкий — сочетание редкое', R + 30, 806, { size: 32, weight: 'bold', color: C.ink }); ctx.restore();
    }
  };

  // ============================== МАРТЕНСИТ ==============================
  function spring(ctx, x, y, L, amp, turns, col) {
    ctx.save(); ctx.beginPath(); const n = 160;
    for (let i = 0; i <= n; i++) { const f = i / n; ctx.lineTo(x + f * L, y + Math.sin(f * turns * Math.PI * 2) * amp); }
    ctx.lineWidth = 9; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  S.martensite = (ctx, T, sc, K) => {
    const px = 110, py = 290, sc_ = 1.5;
    const p = K.on('what') ? E.out(clamp((T - K.s('what') - 3.0) / 1.5)) : 0;
    micro(ctx, px, py, 'mart', p, T, { scale: sc_, jitter: 0.6 });
    txt(ctx, 'Мартенсит', px, py + 504 + 56, { size: 52, weight: 'bold', color: C.red, alpha: K.show('what', 0, 0.6) });
    txt(ctx, 'схема условная', px + 672, py + 504 + 56, { size: 26, color: C.muted, align: 'right' });
    // пульсирующие круги вокруг застрявшего углерода
    const aT = K.win('trapped', 'spring', 0.5, 0.5);
    if (aT > 0) {
      const sp = 56 * sc_; ctx.save(); ctx.globalAlpha *= aT;
      L.CARBON_START.forEach((d, i) => { const ph = (T * 1.1 + i * 0.13) % 1; circle(ctx, px + d[0] * sp, py + d[1] * sp, 10 + ph * 28, null, rgba(C.red, 0.85 * (1 - ph)), 4); });
      ctx.restore();
    }
    const R = 900, RW = 910;
    const win = (c1, c2, fn) => { const a = K.win(c1, c2, 0.5, 0.4); if (a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 14); fn(a); ctx.restore(); } };
    win('what', 'trapped', () => {
      // график: резкое падение температуры
      const x0 = R + 50, y0 = 760, w = 700, h = 380;
      txt(ctx, 'Очень быстрое охлаждение', R, 330, { size: 52, weight: 'bold', color: C.red });
      line(ctx, x0, y0, x0 + w, y0, C.muted, 4); line(ctx, x0, y0, x0, y0 - h, C.muted, 4);
      txt(ctx, 'время →', x0 + w, y0 + 38, { size: 26, color: C.muted, align: 'right' }); txt(ctx, 'температура', x0 + 10, y0 - h - 8, { size: 26, color: C.muted });
      const pts = [[x0 + 20, y0 - h + 40], [x0 + 110, y0 - h + 46], [x0 + 150, y0 - 24], [x0 + 400, y0 - 8]];
      strokePath(ctx, L.catmull(pts, 16), K.prog('what', 0.6, 5), C.red, 8);
      txt(ctx, 'в масле или в воде', x0 + 190, y0 - h + 140, { size: 34, weight: 'bold', color: C.red });
    });
    win('trapped', 'spring', () => {
      card(ctx, R, 380, RW, 270, { fill: C.card, r: 22 });
      txt(ctx, 'Углерод не успел выйти', R + 36, 450, { size: 48, weight: 'bold', color: C.red });
      block(ctx, 'Он застрял прямо внутри железа и теперь «сидит» между атомами, раздвигая их.', R + 36, 510, RW - 72, { size: 36, lh: 46, color: C.muted });
    });
    win('spring', 'props', () => {
      const comp = E.io(clamp((T - K.s('spring') - 1.2) / 2.2));
      const L0 = 520, Lc = L0 * (1 - 0.42 * comp), x0 = R + 130, yy = 470;
      rr(ctx, x0 - 34, yy - 70, 24, 140, 8); ctx.fillStyle = C.muted; ctx.fill();
      spring(ctx, x0, yy, Lc, 46, 7, C.red);
      rr(ctx, x0 + Lc + 10, yy - 70, 24, 140, 8); ctx.fillStyle = C.muted; ctx.fill();
      arrow(ctx, x0 + Lc + 130, yy, x0 + Lc + 54, yy, C.ink, 7, 24);
      txt(ctx, 'Решётка перекошена — как сжатая пружина', R, 620, { size: 44, weight: 'bold' });
      txt(ctx, 'внутри кристалла копится напряжение', R, 672, { size: 34, color: C.muted });
    });
    const aP = K.show('props', 0, 0.6);
    if (aP > 0) {
      ctx.save(); ctx.globalAlpha *= aP; card(ctx, R, 340, RW, 400, { fill: C.card, r: 22 });
      txt(ctx, 'Самый твёрдый, но хрупкий', R + 36, 408, { size: 48, weight: 'bold', color: C.red });
      gauge(ctx, R + 36, 450, 520, 'Твёрдость', 0.97, C.red, aP, 'очень высокая'); gauge(ctx, R + 36, 540, 520, 'Пластичность', 0.12, C.green, aP, 'очень низкая');
      // кристалл с трещиной
      const cx = R + 640, cy = 470; rr(ctx, cx, cy - 60, 220, 200, 16); ctx.fillStyle = C.redL; ctx.fill();
      const crack = [[cx + 110, cy - 60], [cx + 90, cy - 10], [cx + 130, cy + 30], [cx + 100, cy + 80], [cx + 120, cy + 140]];
      strokePath(ctx, crack, E.out(clamp((T - K.s('props') - 2.0) / 1.2)), C.ink, 6);
      txt(ctx, 'трещине легко пройти', cx + 110, cy + 190, { size: 28, color: C.muted, align: 'center' }); ctx.restore();
      block(ctx, 'Кристалл напряжён, поэтому он скорее разлетится, чем согнётся.', R, 800, RW, { size: 34, lh: 42, color: C.ink, alpha: aP });
    }
    const aF = K.show('fix', 0, 0.6);
    if (aF > 0) { ctx.save(); ctx.globalAlpha *= aF; ctx.fillStyle = C.cream; ctx.fillRect(R - 20, 330, RW + 40, 560);
      txt(ctx, 'Что делать с хрупкостью?', R, 470, { size: 60, weight: 'bold' });
      pill(ctx, 'Отпуск — о нём чуть позже →', R, 530, { fill: C.orange, size: 48, h: 90 }); ctx.restore(); }
  };

  return S;
};
