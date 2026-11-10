// Telegram-бот «Тени». Живёт в GitHub Actions: каждые 5 минут стартует и работает ~5 минут,
// принимает сообщения, шлёт напоминания и правит те же дела, что и приложение, через облако.
// Логика общая с приложением: разбор текста (dates.js), хранилище (store.js), память (mem.js).
import { fileURLToPath } from 'node:url';

// store.js написан для браузера: вместо localStorage подставляем память процесса
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } };
globalThis.document ??= {};
const F = await import('../js/fb.js');
const St = await import('../js/store.js');
const D = await import('../js/dates.js');
const Mem = await import('../js/mem.js');

const E = process.env;
const api = () => `${E.TG_API || 'https://api.telegram.org'}/bot${E.TG_TOKEN}`;
const APP_URL = () => E.APP_URL || 'https://bahtiyarg308-dot.github.io/study/';
const SETUP_V = 3;                              // поднять, чтобы бот заново выставил команды и описание
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ───────── Telegram ───────── */
export async function tg(method, p = {}) {
  const r = await fetch(`${api()}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) { const e = new Error(`${method}: ${j.description || r.status}`); e.code = j.error_code; throw e; }
  return j.result;
}
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const send = (chat, text, extra = {}) => tg('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });
const edit = (chat, mid, text, extra = {}) => tg('editMessageText', { chat_id: chat, message_id: mid, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra }).catch(e => { if (!/not modified/i.test(e.message)) throw e; });
const btn = (text, data, style) => ({ text, callback_data: data, ...(style ? { style } : {}) }); // style: primary (синяя), success (зелёная), danger (красная); старые клиенты игнорируют
const appBtn = text => ({ text, web_app: { url: APP_URL() }, style: 'primary' });
const LABELS = { 'сегодня': 'today', 'скоро': 'soon', 'память': 'memory', 'настройки': 'settings' };   // кнопки нижнего меню
const KB_V = 1;                                                                                          // поднять, чтобы бот заново прислал меню
const replyKb = () => ({ keyboard: [[{ text: 'Сегодня' }, { text: 'Скоро' }], [{ text: 'Память' }, { text: 'Настройки' }], [{ text: 'Открыть Тень', web_app: { url: APP_URL() }, style: 'primary' }]], resize_keyboard: true, is_persistent: true, input_field_placeholder: 'Напиши дело: сдать лабу в пятницу в 18:00' });
const cut = (s, n = 22) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const kb = rows => ({ reply_markup: { inline_keyboard: rows } });

/* ───────── облако: те же документы, что у приложения ───────── */
export const S = { tok: null, rt: '', exp: 0, uid: '', bot: null, botDoc: null, botDirty: false, pushedAt: 0 };
const PATH = () => `users/${S.uid}/pv/ten`, BPATH = () => `users/${S.uid}/pv/bot`;
async function auth() {
  if (S.tok && Date.now() < S.exp - 60000) return S.tok;
  if (S.rt) { try { const r = await F.refresh(S.rt); S.tok = r.it; S.rt = r.rt; S.exp = r.exp; return S.tok; } catch (e) { /* войдём заново */ } }
  const r = await F.signIn(E.FB_EMAIL, E.FB_PASSWORD);
  S.tok = r.idToken; S.rt = r.refreshToken; S.uid = r.localId; S.exp = Date.now() + (+r.expiresIn || 3600) * 1000;
  return S.tok;
}
export async function pull() {
  const doc = await F.docGet(await auth(), PATH());
  if (doc && doc.d) { try { St.mergeRemote(JSON.parse(doc.d)); } catch (e) { /* пусто или повреждено */ } }
}
export async function push() {
  if (St.meta().dirty <= S.pushedAt) return false;
  for (let i = 0; i < 4; i++) {
    const tok = await auth(), doc = await F.docGet(tok, PATH());
    if (doc && doc.d) { try { St.mergeRemote(JSON.parse(doc.d)); } catch (e) { /* ок */ } }
    St.trimOld(900000);
    const json = JSON.stringify(St.payload());
    if (doc && doc.d === json) { S.pushedAt = Date.now(); return true; }
    try { await F.docSet(tok, PATH(), { d: json, t: Date.now() }, doc ? doc.updateTime : null); S.pushedAt = Date.now(); return true; }
    catch (e) { if (e.code !== 'conflict') throw e; }
  }
  return false;
}
const DEF = { chat: null, tz: null, digest: 8, eve: true, timed: true, on: true, off: 0, setup: 0, sent: {}, undo: {} };
const applyTz = () => { if (S.bot.tz) process.env.TZ = S.bot.tz; };
export async function loadBot() {
  const doc = await F.docGet(await auth(), BPATH()); S.botDoc = doc;
  let b = {}; try { b = doc && doc.d ? JSON.parse(doc.d) : {}; } catch (e) { /* заново */ }
  S.bot = { ...DEF, ...b, sent: b.sent || {}, undo: b.undo || {} };
  if (E.TG_CHAT_ID && !S.bot.chat) S.bot.chat = Number(E.TG_CHAT_ID);
  applyTz();
}
export async function saveBot() {
  if (!S.botDirty) return;
  const b = S.bot, keep = Date.now() - 3 * 864e5;
  Object.keys(b.sent).forEach(k => { if (b.sent[k] < keep) delete b.sent[k]; });
  const ks = Object.keys(b.undo); ks.slice(0, Math.max(0, ks.length - 20)).forEach(k => { delete b.undo[k]; });
  for (let i = 0; i < 2; i++) {
    try { const ut = await F.docSet(await auth(), BPATH(), { d: JSON.stringify(b), t: Date.now() }, S.botDoc ? S.botDoc.updateTime : null); S.botDoc = { updateTime: ut }; S.botDirty = false; return; }
    catch (e) { if (e.code !== 'conflict') throw e; const doc = await F.docGet(await auth(), BPATH()); S.botDoc = doc; }
  }
}
const mark = () => { S.botDirty = true; };

/* ───────── что показываем ───────── */
// Оформление: без значков в тексте, только типографика: жирные заголовки, цитаты для списков, время моноширинным.
const open = () => St.items().filter(x => x.kind === 'task' && !x.done);
const quote = s => `<blockquote>${s}</blockquote>`;
const tm = it => (it.time ? `<code>${it.time}</code>  ` : '');
const sub = it => (it.subject ? ` · <i>${esc(it.subject)}</i>` : '');
const itemLine = it => `${tm(it)}${esc(it.title)}${sub(it)}`;
const tailLine = (it, t) => `${esc(it.title)} · <i>просрочено ${D.days(-St.daysTo(it, t))}</i>`;
const dayName = (d, t) => (d === t ? 'Сегодня' : d === D.addDays(t, 1) ? 'Завтра' : D.fmtDay(d));
const whenText = (it, t) => (!it.due ? 'без срока' : St.isTail(it, t) ? `просрочено на ${D.days(-St.daysTo(it, t))}` : (it.due === t ? 'сегодня' : D.rel(it.due, t)) + (it.time ? `, ${it.time}` : ''));
const doneRows = (list, v) => list.slice(0, 4).map(it => [btn('✓ ' + cut(it.title, 18), `d:${it.id}:${v}`, 'success'), btn('Завтра', `z:${it.id}:${v}`)]);
const memSubs = () => Mem.subjects(St.items());
const memPlan = () => Mem.plan(memSubs(), Date.now(), St.settings().memSec || 90);
const tails = t => open().filter(x => St.isTail(x, t)).sort((a, b) => a.due.localeCompare(b.due));
const todays = t => open().filter(x => x.due === t).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
const nCards = n => `${n} ${D.plural(n, ['карточка', 'карточки', 'карточек'])}`;
const bottom = n => [...(n ? [btn(`Память · ${n}`, 'mem', 'primary')] : []), appBtn('Открыть Тень')];

function viewToday(t, head = 'Сегодня') {
  const tl = tails(t), td = todays(t), pl = memPlan(), list = [...tl, ...td], parts = [];
  if (tl.length) parts.push(`<b>Хвосты</b>\n${quote(tl.slice(0, 6).map(x => tailLine(x, t)).join('\n'))}`);
  if (td.length) parts.push(`<b>Дела</b>\n${quote(td.slice(0, 8).map(itemLine).join('\n'))}`);
  let text = `<b>${head}</b>\n<i>${esc(D.fmtDay(t))}</i>\n\n${parts.length ? parts.join('\n') : 'На сегодня чисто. Напиши дело текстом, и я его добавлю.'}`;
  if (pl.queue.length) text += `${parts.length ? '\n' : '\n\n'}Память: ${nCards(pl.queue.length)}, около ${pl.mins} мин`;
  return { text, ...kb([...doneRows(list, 't'), bottom(pl.queue.length)]) };
}
function viewSoon(t) {
  const l = open().filter(x => x.due && x.due > t && D.diffDays(t, x.due) <= 14).sort((a, b) => a.due.localeCompare(b.due) || (a.time || '').localeCompare(b.time || ''));
  if (!l.length) return { text: 'На ближайшие две недели сроков нет.', ...kb([[appBtn('Открыть Тень')]]) };
  const days = [...new Set(l.map(x => x.due))].slice(0, 6);
  return { text: `<b>Ближайшие сроки</b>\n\n${days.map(d => `<b>${esc(dayName(d, t))}</b>\n${quote(l.filter(x => x.due === d).map(itemLine).join('\n'))}`).join('\n')}`, ...kb([...doneRows(l, 's'), [appBtn('Открыть Тень')]]) };
}
function viewTails(t) {
  const l = tails(t);
  if (!l.length) return { text: 'Хвостов нет. Так держать.' };
  return { text: `<b>Хвосты</b>  <i>${l.length}</i>\n${quote(l.slice(0, 10).map(x => tailLine(x, t)).join('\n'))}`, ...kb(doneRows(l, 'x')) };
}
const rerender = { t: viewToday, s: viewSoon, x: viewTails };

/* память: карточки по одной, ответ скрыт «спойлером» (тап открывает), состояние хранится в самих темах */
function card(x, left) {
  const text = `<b>${esc(x.title)}</b>${x.subject ? `\n<i>${esc(x.subject)}</i>` : ''}\n\nРасскажи вслух или набросай по памяти, потом оцени себя.${x.key ? `\n\n<b>Ответ</b>\n<tg-spoiler>${esc(x.key)}</tg-spoiler>` : ''}\n\n<i>Осталось в плане: ${left}</i>`;
  return { text, ...kb([Mem.GRADES.map(([l, g]) => btn(l, `rv:${x.id}:${g}`, g === 2 ? 'success' : g === 0 ? 'danger' : undefined))]) };
}
async function nextCard(chat, mid) {
  const q = memPlan().queue;
  if (!q.length) {
    const nf = Mem.nextFade(memSubs()), text = `Память освежена.${nf ? ` Следующее освежение ${D.rel(D.iso(new Date(nf)), D.todayISO())}.` : ''}`;
    return mid ? edit(chat, mid, text, { reply_markup: { inline_keyboard: [] } }) : send(chat, text);
  }
  const c = card(q[0].x, q.length);
  return mid ? edit(chat, mid, c.text, { reply_markup: c.reply_markup }) : send(chat, c.text, { reply_markup: c.reply_markup });
}

const ZONES = [['Москва', 'Europe/Moscow'], ['Киев', 'Europe/Kyiv'], ['Минск', 'Europe/Minsk'], ['Ташкент', 'Asia/Tashkent'], ['Алматы', 'Asia/Almaty'], ['Бишкек', 'Asia/Bishkek'], ['Баку', 'Asia/Baku'], ['Тбилиси', 'Asia/Tbilisi'], ['Ереван', 'Asia/Yerevan'], ['Екатеринбург', 'Asia/Yekaterinburg'], ['Новосибирск', 'Asia/Novosibirsk'], ['Владивосток', 'Asia/Vladivostok']];
const zoneRows = () => ZONES.reduce((r, z, i) => { if (i % 2 === 0) r.push([]); r[r.length - 1].push(btn(z[0], `tz:${z[1]}`)); return r; }, []);
const validTz = z => { try { new Intl.DateTimeFormat('ru', { timeZone: z }); return true; } catch (e) { return false; } };
function viewSettings() {
  const b = S.bot, chk = on => (on ? '✓ ' : '');
  return {
    text: `<b>Настройки</b>\n\nУтренняя сводка  <code>${b.digest ? b.digest + ':00' : 'выкл'}</code>\nЧасовой пояс  <code>${esc(b.tz || 'не выбран')}</code>`,
    ...kb([[7, 8, 9, 10].map(h => btn(`${chk(b.digest === h)}${h}:00`, `c:dg:${h}`)).concat(btn(`${chk(!b.digest)}Выкл`, 'c:dg:0')),
      [btn(`Вечер про завтра · ${b.eve ? 'вкл' : 'выкл'}`, 'c:ev')], [btn(`За 30 минут до дела · ${b.timed ? 'вкл' : 'выкл'}`, 'c:tm')],
      [btn(b.on ? 'Уведомления включены' : 'Тишина: уведомления выключены', 'c:on')], [btn(`Часовой пояс: ${b.tz || 'выбрать'}`, 'c:tz')]]),
  };
}
const HELP = `<b>Тень</b>\nСроки и память вместе с приложением.\n\nПиши дело как есть: <i>сдать лабу в пятницу в 18:00</i>. Несколько дел можно с новой строки.\n\n${quote('/today  сегодня и хвосты\n/soon  ближайшие сроки\n/memory  освежить темы\n/settings  сводка и напоминания\n/app  открыть приложение')}`;

/* ───────── входящие ───────── */
async function addText(chat, text) {
  const items = D.splitThoughts(text).map(c => D.parseQuick(c)).filter(p => p.title);
  if (!items.length) return send(chat, 'Не вижу дела в этом сообщении. Напиши, например: <i>сдать лабу в пятницу в 18:00</i>');
  const t = D.todayISO(), made = items.slice(0, 20).map(p => St.addItem({ title: p.title, due: p.due, time: p.due ? p.time : null, source: 'telegram' }));
  const key = Date.now().toString(36); S.bot.undo[key] = made.map(x => x.id); mark();
  return send(chat, `<b>Добавлено</b>\n${made.map(x => `${esc(x.title)}  <i>${esc(whenText(x, t))}</i>`).join('\n')}`, kb([[btn('Отменить', `u:${key}`, 'danger')]]));
}
async function onMessage(m) {
  const chat = m.chat.id, text = (m.text || '').trim();
  if (!text) return send(chat, 'Пока понимаю только текст. Напиши дело словами.');
  const t = D.todayISO();
  const lab = LABELS[text.toLowerCase()]; if (lab) return onMessage({ ...m, text: '/' + lab });
  if (text[0] === '/') {
    const [cmd, ...rest] = text.split(/\s+/), c = cmd.slice(1).split('@')[0].toLowerCase(), arg = rest.join(' ');
    if (c === 'start') return S.bot.tz ? send(chat, HELP, { reply_markup: replyKb() }) : send(chat, 'Привет. Выбери часовой пояс, чтобы напоминания приходили вовремя.', kb(zoneRows()));
    if (c === 'help') return send(chat, HELP, { reply_markup: replyKb() });
    if (c === 'today') { const v = viewToday(t); return send(chat, v.text, { reply_markup: v.reply_markup }); }
    if (c === 'soon') { const v = viewSoon(t); return send(chat, v.text, { reply_markup: v.reply_markup }); }
    if (c === 'tails') { const v = viewTails(t); return send(chat, v.text, { reply_markup: v.reply_markup }); }
    if (c === 'memory') return nextCard(chat);
    if (c === 'settings') { const v = viewSettings(); return send(chat, v.text, { reply_markup: v.reply_markup }); }
    if (c === 'app') return send(chat, 'Приложение откроется прямо в Telegram.', kb([[appBtn('Открыть Тень')]]));
    if (c === 'add') return arg ? addText(chat, arg) : send(chat, 'Напиши дело после команды или просто отправь его текстом.');
    if (c === 'tz') {
      if (arg && validTz(arg)) { S.bot.tz = arg; mark(); applyTz(); return send(chat, `Часовой пояс: <code>${esc(arg)}</code>`); }
      return send(chat, 'Выбери из списка или напиши, например, <code>/tz Asia/Tashkent</code>', kb(zoneRows()));
    }
    return send(chat, HELP);
  }
  return addText(chat, text);
}
async function onCallback(cq) {
  const chat = cq.message.chat.id, mid = cq.message.message_id, [a, x, y] = String(cq.data).split(':');
  const ack = text => tg('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) }).catch(() => { });
  const t = D.todayISO(), it = x && St.get_(x);
  if (a === 'd' || a === 'z') {
    if (!it) { await ack('Такого дела уже нет'); return; }
    if (a === 'd') { if (!it.done) St.toggleDone(x); } else St.updateItem(x, { due: D.addDays(t, 1) });
    await ack(a === 'd' ? 'Готово' : 'Перенёс на завтра');
    if (y === 'r') return edit(chat, mid, a === 'd' ? `Сделано · <b>${esc(it.title)}</b>` : `Перенесено на завтра · <b>${esc(it.title)}</b>`, { reply_markup: { inline_keyboard: [] } });
    const v = (rerender[y] || viewToday)(D.todayISO());
    return edit(chat, mid, v.text, { reply_markup: v.reply_markup || { inline_keyboard: [] } });
  }
  if (a === 'u') {
    const ids = S.bot.undo[x] || []; ids.forEach(id => { if (St.get_(id)) St.removeItem(id); }); delete S.bot.undo[x]; mark();
    await ack('Отменено'); return edit(chat, mid, 'Отменено.', { reply_markup: { inline_keyboard: [] } });
  }
  if (a === 'mem') { await ack(); return nextCard(chat); }
  if (a === 'rv') { if (it) St.reviewTopic(x, +y); await ack(['Вернусь к этому скоро', 'Принято', 'Отлично'][+y] || ''); return nextCard(chat, mid); }
  if (a === 'tz') {
    if (!validTz(x)) { await ack('Не знаю такой пояс'); return; }
    S.bot.tz = x; mark(); applyTz(); await ack('Готово');
    await edit(chat, mid, `Часовой пояс: <code>${esc(x)}</code>`, { reply_markup: { inline_keyboard: [] } });
    return send(chat, HELP, { reply_markup: replyKb() });
  }
  if (a === 'c') {
    const b = S.bot;
    if (x === 'dg') b.digest = +y; else if (x === 'ev') b.eve = !b.eve; else if (x === 'tm') b.timed = !b.timed; else if (x === 'on') b.on = !b.on;
    else if (x === 'tz') { await ack(); return edit(chat, mid, 'Выбери часовой пояс:', { reply_markup: { inline_keyboard: zoneRows() } }); }
    mark(); await ack(); const v = viewSettings(); return edit(chat, mid, v.text, { reply_markup: v.reply_markup });
  }
  await ack();
}
export async function handle(u) {
  const m = u.message, cq = u.callback_query, chatObj = m ? m.chat : cq && cq.message ? cq.message.chat : null;
  if (!chatObj || chatObj.type !== 'private') return;
  const chat = chatObj.id, owner = String(E.TG_CHAT_ID || '');
  if (!owner) return send(chat, `Привет. Это личный бот. Твой chat id: <code>${chat}</code>\n\nЧтобы я начал работать, добавь его в GitHub: <b>Settings → Secrets and variables → Actions → New secret</b>, имя <code>TG_CHAT_ID</code>.`);
  if (String(chat) !== owner) { if (cq) return tg('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => { }); return send(chat, 'Это личный бот, доступ закрыт.'); }
  if (!S.bot.chat) { S.bot.chat = chat; mark(); }
  return cq ? onCallback(cq) : onMessage(m);
}

/* ───────── напоминания ───────── */
// Первая строка сообщения видна в уведомлении на экране блокировки, поэтому в ней сразу суть.
const once = key => { if (S.bot.sent[key]) return false; S.bot.sent[key] = Date.now(); mark(); return true; };
export async function tick(now = new Date()) {
  const b = S.bot; if (!b.chat || !b.on || !b.tz) return;
  const t = D.todayISO(), h = now.getHours(), min = h * 60 + now.getMinutes();
  if (b.digest && h >= b.digest && h < b.digest + 6 && once('dig:' + t)) {
    const v = viewToday(t, 'Доброе утро'); await send(b.chat, v.text, { reply_markup: v.reply_markup });
  }
  if (b.timed) for (const x of todays(t)) {
    if (!x.time) continue;
    const [hh, mm] = x.time.split(':').map(Number), at = hh * 60 + mm;
    if (min >= at - 30 && min < at + 20 && once(`t:${x.id}:${t}${x.time}`)) {
      await send(b.chat, `<b>${min < at ? `Через ${at - min} мин` : 'Пора'}</b> · ${esc(x.title)}\n<code>${x.time}</code>${x.subject ? ` · <i>${esc(x.subject)}</i>` : ''}`, kb([[btn('Готово', `d:${x.id}:r`, 'success'), btn('Завтра', `z:${x.id}:r`)]]));
    }
  }
  if (b.eve && h >= 20 && h < 23 && once('eve:' + t)) {
    const tm2 = D.addDays(t, 1), l = open().filter(x => x.due === tm2).sort((a, c) => (a.time || '99').localeCompare(c.time || '99')), tl = tails(t), pl = memPlan();
    if (l.length || tl.length || pl.queue.length) {
      let text = `<b>Вечер</b>\n<i>завтра, ${esc(D.fmtDay(tm2))}</i>\n\n${l.length ? quote(l.slice(0, 6).map(itemLine).join('\n')) : 'На завтра дел со сроком нет.'}`;
      if (tl.length) text += `\nХвостов: ${tl.length}`;
      if (pl.queue.length) text += `\nПамять: ${nCards(pl.queue.length)}, около ${pl.mins} мин`;
      await send(b.chat, text, kb([bottom(pl.queue.length)]));
    }
  }
}

/* ───────── запуск ───────── */
async function setup() {
  if (S.bot.setup >= SETUP_V) return;
  await tg('setMyCommands', { commands: [['today', 'Сегодня и хвосты'], ['soon', 'Ближайшие сроки'], ['memory', 'Освежить память'], ['add', 'Добавить дело'], ['settings', 'Сводка и напоминания'], ['app', 'Открыть приложение'], ['help', 'Что я умею']].map(([command, description]) => ({ command, description })) });
  await tg('setMyDescription', { description: 'Личный помощник по срокам и памяти. Пиши дела обычным текстом, получай напоминания и освежай темы. Работает вместе с приложением «Тень».' });
  await tg('setMyShortDescription', { short_description: 'Сроки, напоминания и память вместе с приложением «Тень»' });
  await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Тень', web_app: { url: APP_URL() } } });
  S.bot.setup = SETUP_V; mark();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function main() {
  for (const k of ['TG_TOKEN', 'FB_EMAIL', 'FB_PASSWORD']) if (!E[k]) { console.error(`Не задан секрет ${k}: GitHub → Settings → Secrets and variables → Actions`); process.exit(1); }
  const end = Date.now() + (+E.BOT_SECONDS || 280) * 1000;
  await auth(); await loadBot(); await pull(); S.pushedAt = Date.now();
  try { await setup(); } catch (e) { log('setup:', e.message); }
  if (S.bot.chat && S.bot.kb !== KB_V) {                                            // меню внизу чата появляется само, без /start
    try { await send(S.bot.chat, 'Внизу появилось меню. Дела можно писать прямо в строку ввода.', { reply_markup: replyKb() }); S.bot.kb = KB_V; mark(); } catch (e) { log('меню:', e.message); }
  }
  await saveBot();
  log('бот запущен, дел:', St.items().length, 'пояс:', S.bot.tz || 'не выбран');
  let lastPull = Date.now(), lastTick = 0;
  while (Date.now() < end) {
    let ups = [];
    try { ups = await tg('getUpdates', { offset: S.bot.off || undefined, timeout: Math.max(1, Math.min(25, Math.floor((end - Date.now()) / 1000))), allowed_updates: ['message', 'callback_query'] }); }
    catch (e) { log('getUpdates:', e.message); await sleep(4000); continue; }
    if (ups.length) {
      await pull(); lastPull = Date.now();
      S.bot.off = ups[ups.length - 1].update_id + 1; mark(); await saveBot();      // сначала запоминаем, что приняли: повторов не будет
      for (const u of ups) { try { await handle(u); } catch (e) { log('update:', e.message); } }
      await push(); await saveBot();
    } else if (Date.now() - lastPull > 60000) { await pull(); lastPull = Date.now(); }
    if (Date.now() - lastTick > 30000) { lastTick = Date.now(); try { await tick(); } catch (e) { log('tick:', e.message); } await saveBot(); }
  }
  await push(); await saveBot();
  log('цикл закончен');
}
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main().then(() => process.exit(0)).catch(e => { console.error('Бот остановлен:', e.code || e.message || e); process.exit(1); });
