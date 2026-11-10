// Telegram-бот «Тени»: только уведомления. Живёт в GitHub Actions: каждые 5 минут стартует и работает ~5 минут.
// Напоминает о делах из приложения и повторяет, пока дело не сделано. Читает и правит те же дела через облако.
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
const SETUP_V = 4;                              // поднять, чтобы бот заново выставил команды и описание
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
const del = (chat, mid) => (mid ? tg('deleteMessage', { chat_id: chat, message_id: mid }).catch(() => { }) : null);
const btn = (text, data, style) => ({ text, callback_data: data, ...(style ? { style } : {}) }); // style: primary (синяя), success (зелёная), danger (красная); старые клиенты игнорируют
const appBtn = text => ({ text, web_app: { url: APP_URL() }, style: 'primary' });
const cut = (s, n = 22) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const kb = rows => ({ reply_markup: { inline_keyboard: rows } });

/* ───────── облако: те же документы, что у приложения ───────── */
export const S = { tok: null, rt: '', exp: 0, uid: '', bot: null, botDoc: null, botDirty: false, pushedAt: 0, testNow: 0 };
const clock = () => S.testNow || Date.now();   // в проверках время подменяется
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
const DEF = { chat: null, tz: null, digest: 8, eve: true, on: true, lvl: 'steady', off: 0, setup: 0, kb: 0, sent: {}, nag: {}, pend: { last: 0, mid: 0, snz: 0 } };
const applyTz = () => { if (S.bot.tz) process.env.TZ = S.bot.tz; };
export async function loadBot() {
  const doc = await F.docGet(await auth(), BPATH()); S.botDoc = doc;
  let b = {}; try { b = doc && doc.d ? JSON.parse(doc.d) : {}; } catch (e) { /* заново */ }
  S.bot = { ...DEF, ...b, sent: b.sent || {}, nag: b.nag || {}, pend: { ...DEF.pend, ...(b.pend || {}) } };
  if (E.TG_CHAT_ID && !S.bot.chat) S.bot.chat = Number(E.TG_CHAT_ID);
  applyTz();
}
export async function saveBot() {
  if (!S.botDirty) return;
  const b = S.bot, keep = Date.now() - 3 * 864e5;
  Object.keys(b.sent).forEach(k => { if (b.sent[k] < keep) delete b.sent[k]; });
  for (let i = 0; i < 2; i++) {
    try { const ut = await F.docSet(await auth(), BPATH(), { d: JSON.stringify(b), t: Date.now() }, S.botDoc ? S.botDoc.updateTime : null); S.botDoc = { updateTime: ut }; S.botDirty = false; return; }
    catch (e) { if (e.code !== 'conflict') throw e; const doc = await F.docGet(await auth(), BPATH()); S.botDoc = doc; }
  }
}
const mark = () => { S.botDirty = true; };

/* ───────── как часто напоминать ───────── */
// pre — за сколько минут до срока (минус), rep — через сколько минут повторять после срока, maxAfter — как долго,
// pend — как часто присылать общий список «не сделано» (хвосты и дела без времени),
// ahead — за сколько дней до срока напоминать утром (для зачётов и сдач, у которых нет точного времени)
const LEVELS = {
  calm: { name: 'Спокойно', pre: [-30], rep: 60, maxAfter: 120, pend: 180, ahead: [1] },
  steady: { name: 'Настойчиво', pre: [-30, -10], rep: 10, maxAfter: 120, pend: 60, ahead: [3, 1] },
  loud: { name: 'Очень настойчиво', pre: [-60, -30, -10, -5], rep: 5, maxAfter: 180, pend: 30, ahead: [7, 3, 2, 1] },
};
const lv = () => LEVELS[S.bot.lvl] || LEVELS.steady;

/* ───────── что показываем ───────── */
// Оформление: без значков в тексте, только типографика. Первая строка видна на экране блокировки, поэтому в ней сразу суть.
const open = () => St.items().filter(x => x.kind === 'task' && !x.done);
const quote = s => `<blockquote>${s}</blockquote>`;
const tm = it => (it.time ? `<code>${it.time}</code>  ` : '');
const sub = it => (it.subject ? ` · <i>${esc(it.subject)}</i>` : '');
const itemLine = it => `${tm(it)}${esc(it.title)}${sub(it)}`;
const tailLine = (it, t) => `${esc(it.title)} · <i>просрочено ${D.days(-St.daysTo(it, t))}</i>`;
const dur = m => (m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `${m} мин`);
const hm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const nCards = n => `${n} ${D.plural(n, ['карточка', 'карточки', 'карточек'])}`;
const minOf = x => { const [h, m] = x.time.split(':').map(Number); return h * 60 + m; };
const tails = t => open().filter(x => St.isTail(x, t)).sort((a, b) => a.due.localeCompare(b.due));
const todays = t => open().filter(x => x.due === t).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
/** Что висит «без своего будильника»: хвосты, дела дня без времени и дела со временем, о которых уже напоминали достаточно. */
const pending = (t, min) => [...tails(t), ...todays(t).filter(x => !x.time || min >= minOf(x) + lv().maxAfter)];
const taskRows = (list, v) => list.slice(0, 4).map(it => [btn('✓ ' + cut(it.title, 24), `d:${it.id}:${v}`, 'success')]);

function viewTimed(x, left) {
  const head = left > 0 ? `Через ${left} мин` : left === 0 ? 'Пора' : 'Не сделано';
  return {
    text: `<b>${head}</b> · ${esc(x.title)}\n<code>${x.time}</code>${sub(x)}${left < 0 ? ` · <i>прошло ${dur(-left)}</i>` : ''}`,
    ...kb([[btn('Готово', `d:${x.id}`, 'success'), btn('Через час', `s:${x.id}`)], [btn('Завтра', `z:${x.id}`), appBtn('Открыть Тень')]]),
  };
}
/** Заранее: «Через 3 дня · Зачёт по английскому». Утром, за несколько дней до срока. */
function viewAhead(t, list) {
  const word = n => (n === 1 ? 'Завтра' : `Через ${D.days(n)}`);
  const head = list.length === 1 ? `<b>Скоро · ${esc(list[0].title)}</b>` : `<b>Скоро: ${list.length} ${D.plural(list.length, ['дело', 'дела', 'дел'])}</b>`;
  const lines = list.slice(0, 8).map(x => `<b>${word(D.diffDays(t, x.due))}</b>  ${esc(x.title)}${sub(x)}\n<i>${esc(D.fmtDay(x.due))}${x.time ? ', ' + x.time : ''}</i>`).join('\n');
  return { text: `${head}\n\n${quote(lines)}`, ...kb([[appBtn('Открыть Тень')]]) };
}
function viewPending(t, min, now) {
  const list = pending(t, min), tl = tails(t), td = list.filter(x => !St.isTail(x, t)), parts = [];
  if (tl.length) parts.push(`<b>Хвосты</b>\n${quote(tl.slice(0, 6).map(x => tailLine(x, t)).join('\n'))}`);
  if (td.length) parts.push(`<b>Сегодня</b>\n${quote(td.slice(0, 8).map(itemLine).join('\n'))}`);
  const more = list.length > 4 ? `\n\nЕщё ${list.length - 4} в приложении` : '';
  return { list, text: `<b>Не сделано: ${list.length}</b>\n<i>${esc(D.fmtDay(t))}, ${hm(now)}</i>\n\n${parts.join('\n')}${more}`, ...kb([...taskRows(list, 'p'), [btn('Через час', 'sp'), appBtn('Открыть Тень')]]) };
}
function viewDigest(t) {
  const tl = tails(t), td = todays(t), parts = [];
  if (tl.length) parts.push(`<b>Хвосты</b>\n${quote(tl.slice(0, 6).map(x => tailLine(x, t)).join('\n'))}`);
  if (td.length) parts.push(`<b>Сегодня</b>\n${quote(td.slice(0, 8).map(itemLine).join('\n'))}`);
  const cards = Mem.plan(Mem.subjects(St.items()), clock(), St.settings().memSec || 90);
  let text = `<b>Доброе утро</b>\n<i>${esc(D.fmtDay(t))}</i>\n\n${parts.length ? parts.join('\n') : 'На сегодня всё чисто.'}`;
  if (cards.queue.length) text += `${parts.length ? '\n' : '\n\n'}Память: ${nCards(cards.queue.length)}, около ${cards.mins} мин`;
  return { text, ...kb([...taskRows([...tl, ...td.filter(x => !x.time)], 'g'), [appBtn('Открыть Тень')]]) };
}
const ZONES = [['Москва', 'Europe/Moscow'], ['Киев', 'Europe/Kyiv'], ['Минск', 'Europe/Minsk'], ['Ташкент', 'Asia/Tashkent'], ['Алматы', 'Asia/Almaty'], ['Бишкек', 'Asia/Bishkek'], ['Баку', 'Asia/Baku'], ['Тбилиси', 'Asia/Tbilisi'], ['Ереван', 'Asia/Yerevan'], ['Екатеринбург', 'Asia/Yekaterinburg'], ['Новосибирск', 'Asia/Novosibirsk'], ['Владивосток', 'Asia/Vladivostok']];
const zoneRows = () => ZONES.reduce((r, z, i) => { if (i % 2 === 0) r.push([]); r[r.length - 1].push(btn(z[0], `tz:${z[1]}`)); return r; }, []);
const validTz = z => { try { new Intl.DateTimeFormat('ru', { timeZone: z }); return true; } catch (e) { return false; } };
function viewSettings() {
  const b = S.bot, chk = on => (on ? '✓ ' : '');
  return {
    text: `<b>Напоминания</b>\n\n${quote('<b>Спокойно</b>: за 30 минут и каждый час после срока\n<b>Настойчиво</b>: за 30 и 10 минут, потом каждые 10 минут\n<b>Очень настойчиво</b>: каждые 5 минут, пока не сделаешь')}\nДела без точного времени (зачёт, сдача) напоминают утром за несколько дней: в режиме «Настойчиво» за 3 дня и за 1 день. Хвосты и дела дня приходят общим списком, пока не будут сделаны. Часовой пояс: <code>${esc(b.tz || 'не выбран')}</code>`,
    ...kb([Object.entries(LEVELS).map(([k, v]) => btn(`${chk(b.lvl === k)}${v.name}`, `c:lv:${k}`)),
      [7, 8, 9, 10].map(h => btn(`${chk(b.digest === h)}${h}:00`, `c:dg:${h}`)).concat(btn(`${chk(!b.digest)}Без сводки`, 'c:dg:0')),
      [btn(`Вечер про завтра · ${b.eve ? 'вкл' : 'выкл'}`, 'c:ev')],
      [btn(b.on ? 'Уведомления включены' : 'Тишина: уведомления выключены', 'c:on')], [btn(`Часовой пояс: ${b.tz || 'выбрать'}`, 'c:tz')]]),
  };
}

/* ───────── входящие: бот только напоминает, поэтому здесь почти ничего нет ───────── */
const HINT = 'Я только присылаю напоминания. Дела добавляются и редактируются в приложении.\nКак напоминать: /settings';
async function onMessage(m) {
  const chat = m.chat.id, text = (m.text || '').trim();
  const cmd = text[0] === '/' ? text.slice(1).split(/\s+/)[0].split('@')[0].toLowerCase() : '';
  if (cmd === 'tz') {
    const arg = text.split(/\s+/).slice(1).join(' ');
    if (arg && validTz(arg)) { S.bot.tz = arg; mark(); applyTz(); return send(chat, `Часовой пояс: <code>${esc(arg)}</code>`); }
    return send(chat, 'Выбери из списка или напиши, например, <code>/tz Asia/Tashkent</code>', kb(zoneRows()));
  }
  if (cmd === 'start' || cmd === 'settings') {
    if (!S.bot.tz) return send(chat, 'Привет. Я присылаю напоминания о делах и повторяю их, пока дело не сделано. Выбери часовой пояс, чтобы они приходили вовремя.', kb(zoneRows()));
    const v = viewSettings(); return send(chat, v.text, { reply_markup: v.reply_markup });
  }
  return send(chat, HINT, kb([[appBtn('Открыть Тень')]]));
}
/** После «Готово»/«Завтра» на общем списке или сводке обновляем то же сообщение. */
async function refresh(chat, mid, kind) {
  const t = D.todayISO(), now = new Date(clock()), min = now.getHours() * 60 + now.getMinutes();
  if (kind === 'p') {
    const v = viewPending(t, min, clock());
    if (!v.list.length) { await del(chat, mid); S.bot.pend.mid = 0; mark(); return; }
    return edit(chat, mid, v.text, { reply_markup: v.reply_markup });
  }
  const v = viewDigest(t); return edit(chat, mid, v.text, { reply_markup: v.reply_markup });
}
async function onCallback(cq) {
  const chat = cq.message.chat.id, mid = cq.message.message_id, [a, x, y] = String(cq.data).split(':');
  const ack = text => tg('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) }).catch(() => { });
  const t = D.todayISO(), it = x && St.get_(x), b = S.bot;
  if (a === 'd' || a === 'z') {
    if (!it) { await ack('Такого дела уже нет'); await del(chat, mid); return; }
    if (a === 'd') { if (!it.done) St.toggleDone(x); } else St.updateItem(x, { due: D.addDays(t, 1) });
    await ack(a === 'd' ? 'Готово' : 'Перенёс на завтра');
    if (b.nag[x]) { delete b.nag[x]; mark(); }
    if (y === 'p' || y === 'g') return refresh(chat, mid, y);
    return del(chat, mid);
  }
  if (a === 's') { b.nag[x] = { ...(b.nag[x] || {}), snz: clock() + 3600000, mid: 0, due: it ? it.due : '', time: it ? it.time : '' }; mark(); await ack('Напомню через час'); return del(chat, mid); }
  if (a === 'sp') { b.pend.snz = clock() + 3600000; b.pend.mid = 0; mark(); await ack('Напомню через час'); return del(chat, mid); }
  if (a === 'tz') {
    if (!validTz(x)) { await ack('Не знаю такой пояс'); return; }
    b.tz = x; mark(); applyTz(); await ack('Готово');
    const v = viewSettings(); return edit(chat, mid, v.text, { reply_markup: v.reply_markup });
  }
  if (a === 'c') {
    if (x === 'lv' && LEVELS[y]) b.lvl = y; else if (x === 'dg') b.digest = +y; else if (x === 'ev') b.eve = !b.eve; else if (x === 'on') b.on = !b.on;
    else if (x === 'tz') { await ack(); return edit(chat, mid, 'Выбери часовой пояс:', { reply_markup: { inline_keyboard: zoneRows() } }); }
    mark(); await ack(); const v = viewSettings(); return edit(chat, mid, v.text, { reply_markup: v.reply_markup });
  }
  await ack();   // кнопки старых сообщений
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
const once = key => { if (S.bot.sent[key]) return false; S.bot.sent[key] = clock(); mark(); return true; };
export async function tick(now = new Date(clock())) {
  const b = S.bot; if (!b.chat || !b.on || !b.tz) return;
  const t = D.todayISO(), h = now.getHours(), min = h * 60 + now.getMinutes(), ms = now.getTime(), L = lv(), awake = h >= 6 && h < 23;

  // 0. уборка: сообщения про дела, которые уже сделаны или перенесены (здесь или в приложении), исчезают
  for (const [id, n] of Object.entries(b.nag)) {
    const x = St.get_(id);
    if (!x || x.done || x.due !== n.due || x.time !== n.time) { await del(b.chat, n.mid); delete b.nag[id]; mark(); }
  }

  // 1. дела со временем: за 30 и 10 минут, в срок и потом каждые несколько минут, пока не сделано
  if (awake) for (const x of todays(t)) {
    if (!x.time) continue;
    const at = minOf(x), offs = [...L.pre, 0];
    for (let k = 1; k * L.rep <= L.maxAfter; k++) offs.push(k * L.rep);
    const reached = offs.filter(o => min >= at + o); if (!reached.length) continue;
    const slot = reached[reached.length - 1], n = b.nag[x.id];
    if (n && (n.slot === slot || n.snz > ms)) continue;      // этот шаг уже был или человек попросил подождать
    const v = viewTimed(x, at - min);
    await del(b.chat, n && n.mid);                            // новое напоминание заменяет предыдущее, чат остаётся чистым
    const r = await send(b.chat, v.text, { reply_markup: v.reply_markup });
    b.nag[x.id] = { slot, mid: r.message_id, due: x.due, time: x.time, snz: 0 }; mark();
  }

  // 2. утренняя сводка (остаётся в чате) и общий список «не сделано» (каждый раз заменяет предыдущий)
  const start = b.digest || 8;
  const soon = open().filter(x => x.due && L.ahead.includes(D.diffDays(t, x.due))).sort((a, c) => a.due.localeCompare(c.due) || (a.time || '').localeCompare(c.time || ''));
  if (soon.length && awake && h >= start && h < start + 6 && once('ahead:' + t)) { const v = viewAhead(t, soon); await send(b.chat, v.text, { reply_markup: v.reply_markup }); }
  if (b.digest && h >= b.digest && h < b.digest + 6 && once('dig:' + t)) {
    const v = viewDigest(t); await send(b.chat, v.text, { reply_markup: v.reply_markup }); b.pend.last = ms; mark();
  }
  const P = b.pend, pl = pending(t, min);
  if (!pl.length) { if (P.mid) { await del(b.chat, P.mid); P.mid = 0; mark(); } }
  else if (awake && h >= start && !(P.snz > ms) && ms - P.last >= L.pend * 60000) {
    const v = viewPending(t, min, ms);
    await del(b.chat, P.mid);
    const r = await send(b.chat, v.text, { reply_markup: v.reply_markup });
    P.mid = r.message_id; P.last = ms; mark();
  }

  // 3. вечером про завтра
  if (b.eve && h >= 20 && h < 23 && once('eve:' + t)) {
    const tm2 = D.addDays(t, 1), l = open().filter(x => x.due === tm2).sort((a, c) => (a.time || '99').localeCompare(c.time || '99')), pl2 = Mem.plan(Mem.subjects(St.items()), ms, St.settings().memSec || 90);
    if (l.length || pl2.queue.length) {
      let text = `<b>Вечер</b>\n<i>завтра, ${esc(D.fmtDay(tm2))}</i>\n\n${l.length ? quote(l.slice(0, 6).map(itemLine).join('\n')) : 'На завтра дел со сроком нет.'}`;
      if (pl2.queue.length) text += `\nПамять: ${nCards(pl2.queue.length)}, около ${pl2.mins} мин`;
      await send(b.chat, text, kb([[appBtn('Открыть Тень')]]));
    }
  }
}

/* ───────── запуск ───────── */
async function setup() {
  if (S.bot.setup >= SETUP_V) return;
  await tg('setMyCommands', { commands: [{ command: 'settings', description: 'Как напоминать' }] });
  await tg('setMyDescription', { description: 'Напоминает о делах из приложения «Тень» и повторяет, пока дело не сделано. Всё остальное в приложении.' });
  await tg('setMyShortDescription', { short_description: 'Напоминания о делах из «Тени»' });
  await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Тень', web_app: { url: APP_URL() } } });
  S.bot.setup = SETUP_V; mark();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function main() {
  for (const k of ['TG_TOKEN', 'FB_EMAIL', 'FB_PASSWORD']) if (!E[k]) { console.error(`Не задан секрет ${k}: GitHub → Settings → Secrets and variables → Actions`); process.exit(1); }
  const end = Date.now() + (+E.BOT_SECONDS || 280) * 1000;
  await auth(); await loadBot(); await pull(); S.pushedAt = Date.now();
  try { await setup(); } catch (e) { log('setup:', e.message); }
  if (S.bot.chat && S.bot.kb !== 2) {                                               // прежнее нижнее меню убираем один раз
    try { await send(S.bot.chat, 'Теперь бот только присылает напоминания и повторяет их, пока дело не сделано. Как напоминать: /settings. Всё остальное в приложении: кнопка «Тень» слева от строки ввода.', { reply_markup: { remove_keyboard: true } }); S.bot.kb = 2; mark(); } catch (e) { log('меню:', e.message); }
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
    if (Date.now() - lastTick > 30000) { lastTick = Date.now(); try { await tick(); } catch (e) { log('tick:', e.message); } await push(); await saveBot(); }
  }
  await push(); await saveBot();
  log('цикл закончен');
}
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) main().then(() => process.exit(0)).catch(e => { console.error('Бот остановлен:', e.code || e.message || e); process.exit(1); });
