// Даты и разбор русского текста: «позвонить в деканат завтра в 10:00»
export const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const pad = n => String(n).padStart(2, '0');

export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => iso(new Date());
export const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5); // b - a, в днях
export const dow = s => fromISO(s).getDay();
export const fmtDay = s => { const d = fromISO(s); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtShort = s => { const d = fromISO(s); return `${WD[d.getDay()]} ${d.getDate()}.${pad(d.getMonth() + 1)}`; };

export const plural = (n, [a, b, c]) => {
  const m = Math.abs(n) % 100, k = m % 10;
  return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c;
};
export const days = n => `${n} ${plural(n, ['день', 'дня', 'дней'])}`;

export const rel = (due, today = todayISO()) => {
  const d = diffDays(today, due);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'завтра';
  if (d === -1) return 'вчера';
  return d > 0 ? `через ${days(d)}` : `${days(-d)} назад`;
};

export const fmtHours = h => {
  if (h == null || h === '') return '';
  const m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
  return hh && mm ? `${hh} ч ${mm} м` : hh ? `${hh} ч` : `${mm} м`;
};

const NUM = { один: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10 };
const WDMAP = [['воскресень', 0], ['понедельник', 1], ['вторник', 2], ['сред', 3], ['четверг', 4], ['пятниц', 5], ['суббот', 6]];
const WDSHORT = { вс: 0, пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6 };
const END = '(?=\\s|$|[.,;!?])';

const FIX = [
  [/^не\s+сдал[аи]?\s+/i, 'Сдать '], [/^не\s+сделал[аи]?\s+/i, 'Сделать '], [/^не\s+отправил[аи]?\s+/i, 'Отправить '],
  [/^не\s+написал[аи]?\s+/i, 'Написать '], [/^не\s+оплатил[аи]?\s+/i, 'Оплатить '], [/^не\s+подписал[аи]?\s+/i, 'Подписать '],
  [/^не\s+закрыл[аи]?\s+/i, 'Закрыть '], [/^забыл[аи]?\s+/i, ''], [/^(?:надо|нужно|не забыть|напомни(?:ть)?(?:\s+мне)?)\s+/i, ''],
];

/** Разбирает одну мысль: возвращает {title, due, time, approx, tail, kind}. */
export function parseQuick(raw, now = new Date()) {
  let s = ' ' + raw.trim() + ' ';
  const today = iso(now), dnow = now.getDay();
  let due = null, time = null, approx = false, kind = null, m;
  const cut = re => { const r = s.match(re); if (r) s = s.replace(re, ' '); return r; };

  const tailWord = /(?:^|\s)(не\s+(?:сдал|сделал|отправил|написал|оплатил|подписал|закрыл)\S*|просрочил\S*|забыл\S*)/i.test(s);

  // время
  if ((m = cut(new RegExp(`(?:^|\\s)(?:в|к|до|около)?\\s*(\\d{1,2}):(\\d{2})(?!\\d)`, 'i')))) time = `${pad(+m[1])}:${m[2]}`;
  else if ((m = cut(new RegExp(`(?:^|\\s)(?:в|к|до|около)\\s+(\\d{1,2})\\s*(утра|вечера|дня|ночи)${END}`, 'i')))) {
    let h = +m[1];
    if ((m[2] === 'вечера' || m[2] === 'дня') && h < 12) h += 12;
    if (m[2] === 'ночи' && h === 12) h = 0;
    time = `${pad(h)}:00`;
  }

  // дата
  if (cut(/(?:^|\s)послезавтра(?=\s|$|[.,;!?])/i)) due = addDays(today, 2);
  else if (cut(/(?:^|\s)завтра(?=\s|$|[.,;!?])/i)) due = addDays(today, 1);
  else if (cut(/(?:^|\s)сегодня(?=\s|$|[.,;!?])/i)) due = today;
  else if (cut(/(?:^|\s)вчера(?=\s|$|[.,;!?])/i)) due = addDays(today, -1);
  else if ((m = cut(new RegExp(`(?:^|\\s)через\\s+(\\d+|${Object.keys(NUM).join('|')})\\s+(дн\\S*|недел\\S*|месяц\\S*)${END}`, 'i')))) {
    const n = NUM[m[1].toLowerCase()] || +m[1], u = m[2].toLowerCase();
    due = addDays(today, u.startsWith('недел') ? n * 7 : u.startsWith('месяц') ? n * 30 : n);
  } else if (cut(/(?:^|\s)через\s+неделю(?=\s|$|[.,;!?])/i)) due = addDays(today, 7);
  else if (cut(/(?:^|\s)на\s+след(?:ующей|\.)?\s+неделе(?=\s|$|[.,;!?])/i) || cut(/(?:^|\s)на\s+будущей\s+неделе(?=\s|$|[.,;!?])/i)) {
    due = addDays(today, ((8 - dnow) % 7 || 7) + 4); // пятница следующей недели
    approx = true;
  } else if (cut(/(?:^|\s)на\s+этой\s+неделе(?=\s|$|[.,;!?])/i)) {
    const fri = addDays(today, (5 - dnow + 7) % 7); due = fri >= today ? fri : today; approx = true;
  } else if ((m = cut(new RegExp(`(?:^|\\s)(?:до|к|на|в)?\\s*(\\d{1,2})\\s+(${MON.join('|')})(?:\\s+(\\d{4}))?${END}`, 'i')))) {
    const mo = MON.indexOf(m[2].toLowerCase()); let y = m[3] ? +m[3] : now.getFullYear();
    let d = new Date(y, mo, +m[1]);
    if (!m[3] && diffDays(iso(d), today) > 180) d = new Date(y + 1, mo, +m[1]);
    due = iso(d);
  } else if ((m = cut(new RegExp(`(?:^|\\s)(?:до|к|на|в)?\\s*(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?${END}`, 'i')))) {
    let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
    let d = new Date(y, +m[2] - 1, +m[1]);
    if (!m[3] && diffDays(iso(d), today) > 180) d = new Date(y + 1, +m[2] - 1, +m[1]);
    due = iso(d);
  } else if ((m = cut(new RegExp(`(?:^|\\s)(?:в|во|до|к|на)?\\s*(понедельник(?:а|у|ом|е)?|вторник(?:а|у|ом|е)?|сред(?:а|ы|е|у|ой)|четверг(?:а|у|ом|е)?|пятниц(?:а|ы|е|у|ей)|суббот(?:а|ы|е|у|ой)|воскресень(?:е|я|ю|ем))${END}`, 'i')))) {
    const t = WDMAP.find(([k]) => m[1].toLowerCase().startsWith(k))[1];
    due = addDays(today, (t - dnow + 7) % 7 || 7);
  } else if ((m = cut(new RegExp(`(?:^|\\s)(?:в|до|к)\\s+(пн|вт|ср|чт|пт|сб|вс)\\.?${END}`, 'i')))) {
    due = addDays(today, (WDSHORT[m[1].toLowerCase()] - dnow + 7) % 7 || 7);
  }

  // «в 10» без минут (после того как даты вырезаны)
  if (!time && (m = cut(new RegExp(`(?:^|\\s)(?:в|к)\\s+(\\d{1,2})${END}`, 'i'))) && +m[1] <= 23) time = `${pad(+m[1])}:00`;
  // утром/днём/вечером
  if (!time) {
    if (cut(/(?:^|\s)утром(?=\s|$|[.,;!?])/i)) time = '09:00';
    else if (cut(/(?:^|\s)днём(?=\s|$|[.,;!?])/i) || cut(/(?:^|\s)днем(?=\s|$|[.,;!?])/i)) time = '14:00';
    else if (cut(/(?:^|\s)вечером(?=\s|$|[.,;!?])/i)) time = '19:00';
  }
  if (time && !due) due = today;

  let tail = false;
  if (tailWord && !due) { due = addDays(today, -1); tail = true; }
  if (due && due < today) tail = true;

  let title = s.replace(/\s+/g, ' ').trim().replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, '');
  if ((m = title.match(/^(идея|заметка|мысль|запомнить)\s*[:—-]?\s*/i))) { title = title.slice(m[0].length); }
  for (const [re, to] of FIX) title = title.replace(re, to);
  title = title.replace(/\s+[—-]\s+(?:надо|нужно|а|и)\s.*$/i, '').trim();
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return { title, due, time, approx, tail, kind };
}

/** Делит «выгрузку головы» на отдельные мысли. */
export const splitThoughts = t => {
  const first = t.split(/\n+|;\s*|\.\s+(?=\S)|,\s*(?:ещё|еще|а также|потом|и ещё|и еще)\s+/i)
    .map(x => x.trim().replace(/[.,;]+$/, '')).filter(x => x.length > 1);
  const out = [];
  for (const chunk of first) {
    const parts = chunk.split(/,\s+/);
    let cur = parts[0];
    for (const p of parts.slice(1)) {
      const q = parseQuick(cur);
      if ((q.due || q.time) && p.split(/\s+/).length >= 2) { out.push(cur); cur = p; } else cur += ', ' + p;
    }
    out.push(cur);
  }
  return out;
};
