// Память: простая модель забывания (по мотивам кривой Эббингауза и интервальных повторений).
// У темы есть m = { s, t, n, h }:
//   s — устойчивость в днях: ровно через s дней после повтора шанс вспомнить падает до 90%;
//   t — когда повторяли в последний раз (мс), n — сколько раз, h — последние оценки [[время, 0|1|2]].
// Это приближение для планирования, а не точная наука: оценки приходят от самого человека.
import { fromISO } from './dates.js';

export const DAY = 864e5;
export const GRADES = [['Не вспомнил', 0], ['С трудом', 1], ['Уверенно', 2]];
const FIRST = [0.4, 1, 2.5];                                   // устойчивость после первого повтора
export const FADE_AT = 0.9;                                    // ниже этой свежести тема «тускнеет»

/** Шанс вспомнить сейчас (0..1). null — тему ещё ни разу не повторяли. */
export const rec = (m, at = Date.now()) => (!m || !m.n ? null : Math.pow(0.9, Math.max(0, at - m.t) / DAY / m.s));

/** Новое состояние памяти после повтора. g: 0 не вспомнил, 1 с трудом, 2 уверенно. */
export function after(m, g, at = Date.now()) {
  const n = m && m.n ? m.n : 0;
  let s;
  if (!n) s = FIRST[g];
  else {
    const e = Math.max(0, (at - m.t) / DAY), r = Math.pow(0.9, e / m.s);
    const early = Math.max(0.15, Math.min(1, e / (0.6 * m.s)));   // слишком ранний повтор почти ничего не даёт
    if (g === 2) s = m.s * (1 + (0.8 + 1.5 * (1 - r)) * early);   // чем глубже забыл и вспомнил, тем крепче
    else if (g === 1) s = m.s * (1 + 0.15 * Math.max(0.3, early));
    else s = Math.max(0.4, m.s * 0.35);
  }
  s = Math.min(365, Math.max(0.3, s));
  return { s: +s.toFixed(3), t: at, n: n + 1, h: [...((m && m.h) || []), [at, g]].slice(-12) };
}

/** Когда свежесть упадёт до 90% (мс). 0 — тема не начата. */
export const dueAt = m => (m && m.n ? m.t + m.s * DAY : 0);
/** Экзамен считаем в 9 утра указанного дня. */
export const examTs = iso => fromISO(iso).getTime() + 9 * 36e5;

/** Темы → направления. Дата — ближайшая из дат тем. area: 'uni' (учёба, экзамен) или 'self' (для себя). pace — новых тем в день, когда даты нет. */
export const PACE = 2;
export function subjects(items) {
  const g = new Map();
  for (const x of items) {
    if (x.kind !== 'topic') continue;
    const name = (x.subject || '').trim(), key = name.toLowerCase();
    if (!g.has(key)) g.set(key, { key, name: name || 'Без предмета', due: null, area: null, pace: null, topics: [] });
    const s = g.get(key); s.topics.push(x);
    if (x.due && (!s.due || x.due < s.due)) s.due = x.due;
    if (!s.area && x.area) s.area = x.area;
    if (!s.pace && x.pace) s.pace = x.pace;
  }
  for (const s of g.values()) { if (!s.area) s.area = s.due ? 'uni' : 'self'; if (!s.pace) s.pace = PACE; }
  return [...g.values()];
}

/** Цифры по предмету: свежесть сейчас и прогноз на экзамен, если больше ничего не повторять. */
export function stats(sub, now = Date.now()) {
  const T = sub.topics, n = T.length, E = sub.due ? examTs(sub.due) : null, past = !!E && E <= now;
  let cur = 0, ex = 0, fade = 0, fresh = 0;
  for (const x of T) {
    const r = rec(x.mem, now);
    if (r === null) { fresh++; continue; }
    cur += r; if (r < FADE_AT) fade++;
    if (E && !past) ex += rec(x.mem, E);
  }
  return { n, now: n ? cur / n : 0, exam: E && !past && n ? ex / n : null, fade, fresh, past };
}

/** Что освежить сегодня: сначала тускнеющее, потом новое — столько, чтобы к экзамену успеть всё. */
export function plan(subs, now = Date.now(), memSec = 90) {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const fade = [], fresh = [];
  for (const s of subs) {
    const E = s.due ? examTs(s.due) : null;
    if (E && E <= now) continue;
    const left = E ? Math.max(1, Math.ceil((E - now) / DAY)) : null;
    const untouched = s.topics.filter(x => !(x.mem && x.mem.n));
    const intro = s.topics.filter(x => x.mem && x.mem.n && x.mem.h && x.mem.h[0] && x.mem.h[0][0] >= d0.getTime()).length;
    const total = untouched.length + intro;
    // с датой: раскладываем до дня экзамена; без даты: в своём темпе
    const quota = !total ? 0 : left ? Math.max(0, Math.ceil(total / Math.max(1, left - 2)) - intro) : Math.max(0, (s.pace || PACE) - intro);
    for (const x of s.topics) {
      const r = rec(x.mem, now);
      if (r !== null && r < FADE_AT) fade.push({ x, r, E, sub: s });
    }
    untouched.slice(0, quota).forEach(x => fresh.push({ x, r: null, E, sub: s }));
  }
  // порядок — по выгоде: сколько повтор прибавит к готовности на день экзамена (ближайшие экзамены весят больше)
  const gain = a => {
    const left = a.E ? (a.E - now) / DAY : null;
    const base = a.r === null ? 0.8 : Math.max(0, 0.95 - (a.E ? rec(a.x.mem, a.E) : a.r));
    return base * (left === null ? 0.7 : 1 + Math.max(0, 14 - left) / 14);
  };
  fade.forEach(a => { a.g = gain(a); }); fresh.forEach(a => { a.g = gain(a); });
  fade.sort((a, b) => b.g - a.g);
  fresh.sort((a, b) => (a.E || Infinity) - (b.E || Infinity));
  const queue = [...fade, ...fresh].sort((a, b) => b.g - a.g);
  return { fade, fresh, queue, mins: queue.length ? Math.max(1, Math.round(queue.length * memSec / 60)) : 0 };
}

/** Ближайший момент, когда что-то начнёт тускнеть (для подписи «следующее освежение»). */
export function nextFade(subs, now = Date.now()) {
  let best = 0;
  for (const s of subs) {
    const E = s.due ? examTs(s.due) : null; if (E && E <= now) continue;
    for (const x of s.topics) { const d = dueAt(x.mem); if (d > now && (!best || d < best)) best = d; }
  }
  return best;
}

/** Свежесть → ступень цвета 0..4 для карты тем. */
export const level = r => (r === null ? 0 : r < 0.5 ? 1 : r < 0.75 ? 2 : r < FADE_AT ? 3 : 4);
