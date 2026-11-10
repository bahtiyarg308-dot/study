// Хранилище: всё лежит в браузере на устройстве (localStorage). Никуда не отправляется.
import { todayISO, addDays, diffDays, iso, fromISO } from './dates.js';

const KEY = 'ten.v1';
const DEFAULTS = () => ({
  v: 1,
  items: [],
  dead: {},
  meta: { seen: '', lastExport: 0, bannerHide: 0, aiOk: 0, acc: null, owner: '', syncedAt: 0, dirty: 0 },
  settings: { theme: 'mrak', auto: false, calm: false, timer: true, accent: 'lime', noirAcc: 'bone', name: '', snd: { on: true, vol: 2 }, ai: { provider: 'gemini', keys: {}, models: {}, base: '', sees: { tasks: true, notes: true, priv: false } } },
});

let S = load();
const subs = new Set();
let timer = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw), base = DEFAULTS();
      const items = Array.isArray(d.items) ? d.items : [];
      items.forEach(x => { if (!x.u) x.u = Date.parse(x.doneAt || x.createdAt) || Date.now(); }); // отметка изменения нужна для синхронизации
      return { ...base, ...d, dead: d.dead && typeof d.dead === 'object' ? d.dead : {}, meta: { ...base.meta, ...(d.meta || {}) }, settings: { ...base.settings, ...(d.settings || {}), ai: { ...base.settings.ai, ...((d.settings || {}).ai || {}) } }, items };
    }
  } catch (e) { /* пустое хранилище */ }
  return DEFAULTS();
}
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* приватный режим */ } snapNow(); }, 120);
}
function emit() { persist(); subs.forEach(f => f()); }
let itemsHook = null;
export const onItems = f => { itemsHook = f; };
function touch() { S.meta.dirty = Date.now(); emit(); if (itemsHook) itemsHook(); }

export const get = () => S;
export const items = () => S.items;
export const settings = () => S.settings;
export const meta = () => S.meta;
export function setMeta(patch) { Object.assign(S.meta, patch); emit(); }
export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function addItem(o) {
  const it = {
    id: uid(), kind: 'task', title: '', due: null, time: null, done: false, doneAt: null, createdAt: new Date().toISOString(),
    subject: '', est: null, step: '', stepMin: null, remind: null, source: 'manual', priv: false, spent: 0, ...o, u: Date.now(),
  };
  S.items.push(it); touch(); return it;
}
export function updateItem(id, patch) {
  const it = S.items.find(x => x.id === id); if (!it) return null;
  Object.assign(it, patch, { u: Date.now() }); touch(); return it;
}
export function removeItem(id) { S.items = S.items.filter(x => x.id !== id); S.dead[id] = Date.now(); touch(); }
export function restoreItem(it) { if (!S.items.some(x => x.id === it.id)) { delete S.dead[it.id]; S.items.push({ ...it, u: Date.now() }); touch(); } }
// заменить список целиком (возврат из копии): пропавшие дела получают метку удаления, чтобы это дошло до других телефонов
function adopt(list) {
  const now = Date.now(), keep = new Set(list.map(x => x.id));
  S.items.forEach(x => { if (!keep.has(x.id)) S.dead[x.id] = now; });
  list.forEach(x => { x.u = now; delete S.dead[x.id]; });
  S.items = list;
}
export function replaceItems(list) { adopt(list); touch(); }

// ---- копии на телефоне: по одной в день, последние 7 ----
const SKEY = 'ten.snaps';
export function snaps() { try { return JSON.parse(localStorage.getItem(SKEY) || '[]'); } catch (e) { return []; } }
let snapDay = '';
export function snapNow(force) {
  const d = todayISO();
  if (!force && snapDay === d) return false;
  const list = snaps();
  if (!S.items.length) return false;
  if (!force && list.some(x => x.d === d)) { snapDay = d; return false; }
  snapDay = d;
  const next = list.filter(x => x.d !== d).concat({ d, t: Date.now(), n: S.items.length, json: JSON.stringify(S.items) }).slice(-7);
  try { localStorage.setItem(SKEY, JSON.stringify(next)); return true; } catch (e) { return false; }
}
export function snapRestore(i) {
  const x = snaps()[i]; if (!x) return false;
  snapNow(true); // перед восстановлением сохраняем текущее состояние
  try { adopt(JSON.parse(x.json)); touch(); return true; } catch (e) { return false; }
}
export function toggleDone(id) {
  const it = S.items.find(x => x.id === id); if (!it) return;
  it.done = !it.done; it.doneAt = it.done ? new Date().toISOString() : null; it.u = Date.now(); touch(); return it;
}
export function setSettings(patch) { Object.assign(S.settings, patch); emit(); }
export function setAI(patch) { Object.assign(S.settings.ai, patch); emit(); }
export function setSees(patch) { Object.assign(S.settings.ai.sees, patch); emit(); }

// ---- производные ----
export const isTail = (it, today = todayISO()) => !it.done && it.kind === 'task' && !!it.due && it.due < today;
export const daysTo = (it, today = todayISO()) => (it.due ? diffDays(today, it.due) : null);
export const get_ = id => S.items.find(x => x.id === id);

/** Что делать «сейчас»: самый дешёвый хвост → дело на сегодня → ближайший срок. */
export function pickNow(today = todayISO()) {
  const open = S.items.filter(x => !x.done && x.kind === 'task');
  const tails = open.filter(x => isTail(x, today)).sort((a, b) => (a.est ?? 0.5) - (b.est ?? 0.5) || a.due.localeCompare(b.due));
  if (tails.length) return tails[0];
  const tod = open.filter(x => x.due === today).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  if (tod.length) return tod[0];
  const soon = open.filter(x => x.due && x.due > today).sort((a, b) => a.due.localeCompare(b.due));
  return soon[0] || null;
}

/** Цена откладывания: сколько работы в день, если начать позже. */
export function costRows(it, today = todayISO()) {
  if (!it.due || !it.est || it.done) return null;
  const dd = diffDays(today, it.due); // дней до срока
  if (dd < 1) return null;
  const rows = [], add = (label, startOffset) => {
    const n = Math.max(1, dd - startOffset);
    rows.push({ label, perDay: it.est / n, n });
  };
  add('Начать сегодня', 0);
  if (dd >= 2) add('Завтра', 1);
  if (dd >= 5) add(`Через ${Math.floor(dd / 2)} дн.`, Math.floor(dd / 2));
  add('В последний день', dd - 1);
  return rows;
}

// ---- экспорт / импорт ----
export const exportJSON = () => JSON.stringify({ app: 'ten', exportedAt: new Date().toISOString(), data: { items: S.items, settings: { ...S.settings, ai: { ...S.settings.ai, keys: {} } } } }, null, 2);
export function importJSON(text) {
  const j = JSON.parse(text), d = j.data || j;
  if (!Array.isArray(d.items)) throw new Error('В файле нет списка дел');
  const ids = new Set(S.items.map(x => x.id));
  let n = 0;
  for (const it of d.items) if (it && it.title && !ids.has(it.id)) { S.items.push({ kind: 'task', due: null, time: null, done: false, doneAt: null, createdAt: new Date().toISOString(), subject: '', est: null, step: '', stepMin: null, remind: null, source: 'manual', priv: false, spent: 0, ...it, id: it.id || uid(), u: Date.now() }); delete S.dead[it.id]; n++; }
  touch(); return n;
}
export function clearAll() { const now = Date.now(); S.items.forEach(x => { S.dead[x.id] = now; }); S.items = []; touch(); }
/** Смена аккаунта: убрать дела с телефона, не помечая их удалёнными в облаке. */
export function wipeLocal() { S.items = []; S.dead = {}; S.meta.dirty = 0; emit(); }

// ---- синхронизация между телефонами: по делу побеждает последнее изменение ----
export const payload = () => ({ items: S.items, dead: S.dead });
export function mergeRemote(rem) {
  let changed = false;
  const now = Date.now(), old = now - 90 * 864e5;
  for (const [id, t] of Object.entries(rem.dead || {})) if (!(S.dead[id] >= t)) { S.dead[id] = t; changed = true; }
  const mine = new Map(S.items.map(x => [x.id, x]));
  for (const r of rem.items || []) {
    if (!r || !r.id || !r.title) continue;
    const dead = S.dead[r.id] || 0, l = mine.get(r.id);
    if (dead && dead >= (r.u || 0)) continue;
    if (!l) { S.items.push(r); changed = true; }
    else if ((r.u || 0) > (l.u || 0)) { Object.keys(l).forEach(k => { delete l[k]; }); Object.assign(l, r); changed = true; }
  }
  const before = S.items.length;
  S.items = S.items.filter(x => { const d = S.dead[x.id]; return !(d && d >= (x.u || 0)); });
  if (S.items.length !== before) changed = true;
  for (const [id, t] of Object.entries(S.dead)) if (t < old) delete S.dead[id];
  if (changed) emit();
  return changed;
}

export function loadDemo() {
  const t = todayISO(), d = n => addDays(t, n);
  const mk = o => addItem({ source: 'manual', ...o });
  mk({ title: 'Сдать договор по учёбе', due: d(-6), subject: 'Деканат', est: 0.25, step: 'Написать в деканат: что принести' });
  mk({ title: 'Конспект §12', due: d(-2), subject: 'История', est: 1, step: 'Открыть учебник и прочитать первый абзац', stepMin: 10 });
  mk({ title: 'Распечатать лабу', due: t, time: '09:30', subject: 'Комп. графика', done: true, doneAt: new Date().toISOString() });
  mk({ title: 'Повторить §14', due: t, time: '18:00', subject: 'История', est: 0.5, stepMin: 25 });
  mk({ title: 'Позвонить маме', due: t, time: '18:30', subject: 'Личное' });
  mk({ title: 'Реферат по истории', due: d(3), subject: 'История', est: 4, step: 'Написать план из пяти пунктов', stepMin: 15 });
  mk({ title: 'Лаба по физике', due: d(6), subject: 'Физика', est: 3, step: 'Собрать данные измерений', stepMin: 15 });
  mk({ title: 'Сдать лабораторную', due: d(9), subject: 'Комп. графика', est: 12, step: 'Запустить сцену в проекте', stepMin: 15 });
  mk({ title: 'Курсовая: черновик', due: d(14), subject: 'Курсовая', est: 10 });
  mk({ title: 'Зачёт по английскому', due: d(17), subject: 'Английский', est: 6 });
  mk({ title: 'Позвонить в деканат', due: d(1), time: '10:00', subject: 'Деканат' });
  mk({ kind: 'note', title: 'Шейдер: туман и rim light. Глянуть урок по PBR.', subject: 'Комп. графика' });
  // история: сделанные дела за последние недели (для «Активность»)
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const T = ['Конспект §', 'Лаба №', 'Задачи ', 'Отчёт №', 'Реферат: глава ', 'Статья ', 'Практика №'], SUB = ['История', 'Физика', 'Комп. графика', 'Английский', 'Деканат'];
  for (let w = 0; w < 12; w++) {
    for (let k = 0; k < 7; k++) {
      if (w === 0 && k === 0) continue;
      if (rnd() > (w < 2 ? .78 : w < 6 ? .55 : .4)) continue;
      const day = d(-(w * 7 + k)), n = 1 + Math.floor(rnd() * (w < 3 ? 4 : 3));
      for (let j = 0; j < n; j++) {
        const late = rnd() < .16;
        addItem({ title: T[Math.floor(rnd() * T.length)] + (1 + Math.floor(rnd() * 14)), due: late ? addDays(day, -3) : day, subject: SUB[Math.floor(rnd() * SUB.length)], done: true, doneAt: new Date(`${day}T${String(13 + j * 2).padStart(2, '0')}:20:00`).toISOString(), spent: rnd() < .2 ? 25 : 0 });
      }
    }
  }
}

// ---- календарь (.ics) ----
const icsEsc = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
const stamp = d => d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0') + 'T' + String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0') + '00Z';
export function icsFor(list) {
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ten//RU', 'CALSCALE:GREGORIAN'];
  for (const it of list) {
    if (!it.due) continue;
    out.push('BEGIN:VEVENT', `UID:${it.id}@ten`, `DTSTAMP:${stamp(new Date())}`);
    if (it.time) {
      const start = fromISO(it.due); const [h, m] = it.time.split(':').map(Number); start.setHours(h, m);
      const end = new Date(start.getTime() + 3600e3);
      out.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    } else {
      out.push(`DTSTART;VALUE=DATE:${it.due.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(it.due, 1).replace(/-/g, '')}`);
    }
    out.push(`SUMMARY:${icsEsc(it.title)}`);
    if (it.subject) out.push(`DESCRIPTION:${icsEsc(it.subject)}`);
    // с временем: за 30 минут (или как выбрано); без времени: в 9:00 в день срока, «за день» — в 9:00 накануне
    const rm = it.remind, trig = it.time ? `-PT${Math.max(1, rm || 30)}M` : (rm >= 1440 ? `-PT${Math.round(rm / 60 - 9)}H` : 'PT9H');
    out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(it.title)}`, `TRIGGER:${trig}`, 'END:VALARM', 'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}
