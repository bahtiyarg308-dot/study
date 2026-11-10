// Хранилище: всё лежит в браузере на устройстве (localStorage). Никуда не отправляется.
import { todayISO, addDays, diffDays, iso, fromISO } from './dates.js';
import { after as memAfter, DAY as MDAY } from './mem.js';

const KEY = 'ten.v1';
const DEFAULTS = () => ({
  v: 1,
  items: [],
  dead: {},
  meta: { seen: '', lastExport: 0, bannerHide: 0, aiOk: 0, acc: null, owner: '', syncedAt: 0, dirty: 0 },
  settings: { theme: 'mrak', auto: false, calm: false, memSec: 90, accent: 'lime', noirAcc: 'bone', name: '', snd: { on: true, vol: 2 }, ai: { provider: 'gemini', keys: {}, models: {}, base: '', sees: { tasks: true, notes: true, priv: false } } },
});

let migratedOnLoad = false;
let S = load();
if (migratedOnLoad) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* приватный режим */ } } // перенос заметок в дела сохраняем сразу
const subs = new Set();
let timer = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw), base = DEFAULTS();
      const items = Array.isArray(d.items) ? d.items : [];
      items.forEach(x => { if (!x.u) x.u = Date.parse(x.doneAt || x.createdAt) || Date.now(); }); // отметка изменения нужна для синхронизации
      let migrated = false;                                                                          // «заметка» и «дело» — одно и то же: заметка становится делом без срока
      items.forEach(x => { if (x.kind === 'note') { x.kind = 'task'; x.u = Date.now(); migrated = migratedOnLoad = true; } });
      return { ...base, ...d, dead: d.dead && typeof d.dead === 'object' ? d.dead : {}, meta: { ...base.meta, ...(d.meta || {}), ...(migrated ? { dirty: Date.now() } : {}) }, settings: { ...base.settings, ...(d.settings || {}), ai: { ...base.settings.ai, ...((d.settings || {}).ai || {}) } }, items };
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

const blank = () => ({
  id: uid(), kind: 'task', title: '', due: null, time: null, done: false, doneAt: null, createdAt: new Date().toISOString(),
  subject: '', est: null, step: '', stepMin: null, remind: null, source: 'manual', priv: false, spent: 0,
});
export function addItem(o) {
  const it = { ...blank(), ...o, u: Date.now() };
  S.items.push(it); touch(); return it;
}
/** Несколько записей за одно сохранение (темы к экзамену). */
export function addMany(list) {
  const u = Date.now(), out = list.map(o => ({ ...blank(), ...o, u }));
  S.items.push(...out); touch(); return out;
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

// ---- память: темы к экзамену ----
const skey = x => String(x || '').trim().toLowerCase();
/** Повтор темы: g — 0 не вспомнил, 1 с трудом, 2 уверенно. */
export function reviewTopic(id, g, at = Date.now()) {
  const it = S.items.find(x => x.id === id && x.kind === 'topic'); if (!it) return null;
  it.mem = memAfter(it.mem, g, at); it.u = at; touch(); return it;
}
const examTitle = (area, name) => `${area === 'self' ? 'Цель' : 'Экзамен'}: ${name.trim()}`;
/** Карточка срока на горизонте: одна на направление, дата следует за темами. */
export function ensureExam(subject, due, area = 'uni') {
  if (!due) return null;
  const ex = S.items.find(x => x.exam && skey(x.subject) === skey(subject));
  if (ex) { if (ex.due !== due) return updateItem(ex.id, { due, done: false, doneAt: null }); return ex; }
  return addItem({ title: examTitle(area, subject), due, subject: subject.trim(), exam: true, source: 'memory' });
}
/** Переименовать направление, сменить дату, тип и темп у всех его тем. Пустая дата убирает карточку срока. */
export function editSubject(oldName, name, due, extra = {}) {
  const k = skey(oldName), now = Date.now(); name = name.trim();
  S.items.forEach(x => {
    if (skey(x.subject) !== k) return;
    if (x.kind === 'topic') { x.subject = name; x.due = due || null; if (extra.area) x.area = extra.area; if (extra.pace) x.pace = extra.pace; x.u = now; }
    else if (x.exam) {
      const was = /^(Экзамен|Цель): /.test(x.title) && x.title.slice(x.title.indexOf(': ') + 2) === oldName.trim();
      x.subject = name; if (was) x.title = examTitle(extra.area || (x.title.startsWith('Цель') ? 'self' : 'uni'), name); x.u = now;
    }
  });
  if (due) ensureExam(name, due, extra.area || 'uni');
  else S.items.filter(x => x.exam && skey(x.subject) === skey(name)).forEach(x => { S.items = S.items.filter(y => y.id !== x.id); S.dead[x.id] = now; });
  touch();
}
export function removeSubject(name) {
  const k = skey(name);
  S.items.filter(x => (x.kind === 'topic' || x.exam) && skey(x.subject) === k).forEach(x => { S.items = S.items.filter(y => y.id !== x.id); S.dead[x.id] = Date.now(); });
  touch();
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

/** Облако почти заполнено (80% лимита): убираем самые старые выполненные дела. Старше 120 дней: карте активности нужны только 12 недель. Темы и открытые дела не трогаем. */
export function trimOld(limit) {
  const enc = new TextEncoder(), size = o => enc.encode(JSON.stringify(o)).length;
  let total = size(payload());
  if (total < limit * 0.8) return 0;
  const cutoff = Date.now() - 120 * 864e5;
  const old = S.items.filter(x => x.kind === 'task' && x.done && !x.exam && x.doneAt && Date.parse(x.doneAt) < cutoff).sort((a, b) => a.doneAt.localeCompare(b.doneAt));
  const gone = new Set(); const now = Date.now();
  for (const x of old) { if (total < limit * 0.7) break; total -= size(x) + 28; gone.add(x.id); }
  if (!gone.size) return 0;
  S.items = S.items.filter(x => !gone.has(x.id)); gone.forEach(id => { S.dead[id] = now; });
  touch(); return gone.size;
}

// ---- экспорт / импорт ----
export const exportJSON = () => JSON.stringify({ app: 'ten', exportedAt: new Date().toISOString(), data: { items: S.items, settings: { ...S.settings, ai: { ...S.settings.ai, keys: {} } } } }, null, 2);
export function importJSON(text) {
  const j = JSON.parse(text), d = j.data || j;
  if (!Array.isArray(d.items)) throw new Error('В файле нет списка дел');
  const ids = new Set(S.items.map(x => x.id));
  let n = 0;
  for (const it of d.items) if (it && it.title && !ids.has(it.id)) { S.items.push({ kind: 'task', due: null, time: null, done: false, doneAt: null, createdAt: new Date().toISOString(), subject: '', est: null, step: '', stepMin: null, remind: null, source: 'manual', priv: false, spent: 0, ...it, kind: it.kind === 'note' ? 'task' : (it.kind || 'task'), id: it.id || uid(), u: Date.now() }); delete S.dead[it.id]; n++; }
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
    if (r.kind === 'note') r.kind = 'task'; // телефон со старой версией ещё присылает заметки
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
  // память: темы к зачёту и экзамену с разной свежестью
  const nowT = Date.now(), ago = n => nowT - n * MDAY;
  const hist = (...steps) => steps.reduce((m, [daysAgo, g]) => memAfter(m, g, ago(daysAgo)), null);
  const eng = [['Present Perfect', hist([6, 2], [2.5, 2])], ['Conditionals', hist([5, 1])], ['Phrasal verbs', hist([1, 2])], ['Passive voice', null], ['Reported speech', null], ['Modal verbs', hist([7, 0])], ['Articles', null], ['Word formation', null]];
  const phy = [['Кинематика', hist([4, 2])], ['Законы Ньютона', hist([3, 1])], ['Работа и энергия', null], ['Импульс', null], ['Колебания', null], ['Термодинамика', null]];
  const py = [['Списки и срезы', hist([8, 2], [4, 2])], ['Словари', hist([2, 1])], ['Функции и аргументы', null, 'def, *args, **kwargs, значения по умолчанию'], ['Генераторы', null], ['Исключения', null], ['Классы и __init__', null]];
  addMany([...eng.map(([title, mem]) => ({ kind: 'topic', title, subject: 'Английский', due: d(17), area: 'uni', mem, source: 'demo' })), ...phy.map(([title, mem]) => ({ kind: 'topic', title, subject: 'Физика', due: d(24), area: 'uni', mem, source: 'demo' })), ...py.map(([title, mem, key]) => ({ kind: 'topic', title, subject: 'Python для себя', due: null, area: 'self', pace: 2, mem, key: key || '', source: 'demo' }))]);
  addItem({ title: 'Экзамен: Физика', due: d(24), subject: 'Физика', exam: true, source: 'memory' });
  mk({ title: 'Позвонить в деканат', due: d(1), time: '10:00', subject: 'Деканат' });
  mk({ title: 'Шейдер: туман и rim light. Глянуть урок по PBR.', subject: 'Комп. графика' });
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
