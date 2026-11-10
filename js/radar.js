// Горизонт (радар): расстояние от центра = время до срока. Просроченное — «хвост».
import { todayISO, diffDays, days } from './dates.js';
import { isTail } from './store.js';

const C = 173, RINGS = [[40, 'СЕГОДНЯ'], [90, '3 ДНЯ'], [135, 'НЕДЕЛЯ'], [170, 'МЕСЯЦ']];
const P = (r, a) => { const t = a * Math.PI / 180; return [C + r * Math.cos(t), C + r * Math.sin(t)]; };
const f = n => n.toFixed(1);

function radius(dd) {
  if (dd <= 0) return 28;
  if (dd <= 3) return 40 + (dd / 3) * 50;
  if (dd <= 7) return 90 + ((dd - 3) / 4) * 45;
  if (dd <= 30) return 135 + ((dd - 7) / 23) * 35;
  return 170;
}
function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Раскладывает дела по кругу так, чтобы точки не слипались. */
export function layout(list, today = todayISO()) {
  const pts = [];
  const sorted = [...list].filter(it => !it.done && it.kind === 'task' && it.due)
    .sort((a, b) => (isTail(b, today) - isTail(a, today)) || a.due.localeCompare(b.due));
  for (const it of sorted) {
    const dd = diffDays(today, it.due), tail = dd < 0;
    const r = radius(dd);
    let ang = (hash(it.id) % 360), x, y, tries = 0;
    do {
      [x, y] = P(r, ang);
      const clash = pts.some(p => Math.hypot(p.x - x, p.y - y) < (tail || p.tail ? 26 : 19));
      if (!clash) break;
      ang = (ang + 31) % 360; tries++;
    } while (tries < 24);
    pts.push({ it, x, y, r, ang, dd, tail, kind: tail ? 'hot' : dd <= 3 ? 'warn' : dd <= 7 ? 'ink' : 'cool', far: dd > 30 });
  }
  return pts;
}

export function radarHTML(pts, selId) {
  const [sx1, sy1] = P(170, -124), [sx2, sy2] = P(170, -52);
  let o = `<svg viewBox="0 0 346 346" class="rsvg" role="img" aria-label="Горизонт: дела по срокам"><defs>
    <radialGradient id="rbg" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:var(--bad);stop-opacity:.12"/><stop offset=".5" style="stop-color:var(--cool);stop-opacity:.07"/><stop offset="1" style="stop-color:var(--cool);stop-opacity:0"/></radialGradient>
    <linearGradient id="rsw" gradientUnits="userSpaceOnUse" x1="${f(sx1)}" y1="${f(sy1)}" x2="${f(sx2)}" y2="${f(sy2)}"><stop offset="0" style="stop-color:var(--ink);stop-opacity:0"/><stop offset="1" style="stop-color:var(--ink);stop-opacity:.05"/></linearGradient></defs>
    <circle cx="${C}" cy="${C}" r="170" fill="url(#rbg)"/>`;
  RINGS.forEach(([r], i) => { o += `<circle cx="${C}" cy="${C}" r="${r}" fill="none" class="ring" ${i === 3 ? 'stroke-dasharray="2 5"' : ''}/>`; });
  o += `<path d="M${C} 3V343M3 ${C}H343" class="cross"/>`;
  o += `<g class="sweep" style="animation-delay:-${((Date.now() / 1000) % 32).toFixed(2)}s"><path d="M${C} ${C}L${f(sx1)} ${f(sy1)}A170 170 0 0 1 ${f(sx2)} ${f(sy2)}Z" fill="url(#rsw)"/><path d="M${C} ${C}L${f(sx2)} ${f(sy2)}" class="sweepline"/></g>`;
  RINGS.forEach(([r, l]) => { o += `<text x="${C}" y="${C - r + 12}" text-anchor="middle" class="rlab">${l}</text>`; });

  // хвосты
  pts.filter(p => p.tail).forEach((p, i) => {
    const len = Math.min(-p.dd * 14, 112), [ex, ey] = P(p.r + len, p.ang), [mx, my] = P(p.r + len * .65, p.ang);
    const ox = Math.cos((p.ang + 90) * Math.PI / 180) * 4.5, oy = Math.sin((p.ang + 90) * Math.PI / 180) * 4.5;
    o += `<defs><linearGradient id="tl${i}" gradientUnits="userSpaceOnUse" x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(ex)}" y2="${f(ey)}"><stop offset="0" style="stop-color:var(--bad);stop-opacity:.95"/><stop offset="1" style="stop-color:var(--bad);stop-opacity:0"/></linearGradient></defs>
    <g class="tailg" style="animation-delay:${-i * 1.7}s"><line x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(ex)}" y2="${f(ey)}" stroke="url(#tl${i})" stroke-width="6" stroke-linecap="round"/>
    <line x1="${f(p.x + ox)}" y1="${f(p.y + oy)}" x2="${f(mx + ox)}" y2="${f(my + oy)}" stroke="url(#tl${i})" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
    <line x1="${f(p.x - ox)}" y1="${f(p.y - oy)}" x2="${f(mx - ox)}" y2="${f(my - oy)}" stroke="url(#tl${i})" stroke-width="1.8" stroke-linecap="round" opacity=".7"/></g>`;
  });
  // точки
  pts.forEach((p, i) => {
    const sel = p.it.id === selId;
    const c = { hot: 'var(--bad)', warn: 'var(--gold)', ink: 'var(--ink)', cool: 'var(--steel)' }[p.kind];
    if (sel) {
      o += `<path d="M${C} ${C}L${f(p.x)} ${f(p.y)}" class="leader"/>
      <circle cx="${f(p.x)}" cy="${f(p.y)}" r="14" class="pulse"/><circle cx="${f(p.x)}" cy="${f(p.y)}" r="22" class="pulse p2"/><circle cx="${f(p.x)}" cy="${f(p.y)}" r="7" style="fill:var(--accent)"/>`;
    } else {
      o += `<g class="blip ${p.kind}" style="animation-delay:${-(i * 1.3 % 7).toFixed(1)}s"><circle cx="${f(p.x)}" cy="${f(p.y)}" r="9" style="fill:${c};opacity:.18"/><circle cx="${f(p.x)}" cy="${f(p.y)}" r="${p.tail ? 6 : 4.6}" style="fill:${c}"/></g>`;
    }
  });
  o += `<circle cx="${C}" cy="${C}" r="9" fill="none" class="ring"/><circle cx="${C}" cy="${C}" r="3.5" style="fill:var(--ink)"/>`;
  // зоны касания
  pts.forEach(p => { o += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="15" fill="transparent" data-act="selblip" data-id="${p.it.id}" style="cursor:pointer"><title>${esc(p.it.title)}</title></circle>`; });
  o += '</svg>';

  // подписи: выбранная точка и главный хвост
  const lab = (p, cls, title, suffix) => {
    const roomL = p.x - 18, roomR = 342 - p.x - 14;
    const left = roomL >= roomR, avail = left ? roomL : roomR;
    const maxCh = Math.max(8, Math.floor((avail - 22) / 6.6));
    let t = title; const cap = maxCh - suffix.length - 3;
    if (t.length > cap) t = t.slice(0, Math.max(3, cap - 1)).trimEnd() + '…';
    const x = left ? p.x - 14 : p.x + 14;
    return `<div class="rl ${cls}" style="left:${(x / 346 * 100).toFixed(2)}%;top:${(p.y / 346 * 100).toFixed(2)}%;transform:translate(${left ? '-100%' : '0'},-50%)">${esc(t)} · ${esc(suffix)}</div>`;
  };
  const sel = pts.find(p => p.it.id === selId);
  if (sel) o += lab(sel, 'sel', sel.it.title, sel.dd < 0 ? '−' + days(-sel.dd) : sel.dd === 0 ? 'сегодня' : days(sel.dd));
  const t = pts.find(p => p.tail && (!sel || (p.it.id !== sel.it.id && Math.hypot(p.x - sel.x, p.y - sel.y) > 70)));
  if (t) o += lab(t, 'hot', t.it.title, '−' + days(-t.dd));
  return o;
}
