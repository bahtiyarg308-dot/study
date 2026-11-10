// Проверка бота без настоящих Telegram и Firebase: запуск `node bot/test/bot.test.mjs` (нужен Node 22).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const procs = ['mockfb.cjs', 'mocktg.cjs'].map(f => spawn(process.execPath, [path.join(here, f)], { stdio: ['ignore', 'pipe', 'inherit'] }));
await Promise.all(procs.map(p => new Promise(r => p.stdout.once('data', r))));
process.on('exit', () => procs.forEach(p => p.kill()));

const FB = 'http://127.0.0.1:8130', TG = 'http://127.0.0.1:8131';
globalThis.window = { TEN_FB: { idt: FB + '/idt/', stk: FB + '/token', fs: FB + '/fs/', db: 'projects/p/databases/default/documents' } };
Object.assign(process.env, { TG_API: TG, TG_TOKEN: 'test:token', TG_CHAT_ID: '42', FB_EMAIL: 'bot@test.dev', FB_PASSWORD: 'secret1', BOT_SECONDS: '3', APP_URL: 'https://example.test/app/' });
process.env.TZ = 'Asia/Tashkent'; // тест считает даты в том же поясе, который потом выберет «пользователь»
let bad = 0; const ok = (n, c, x) => { if (!c) bad++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' | ' + String(x).slice(0, 150) : '')); };

// — аккаунт и данные в «облаке», как их оставило бы приложение
const F = await import('../../js/fb.js');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const reg = await F.signUp('bot@test.dev', 'secret1'); await fetch(FB + '/admin/verify?email=bot@test.dev');
const tok = (await F.signIn('bot@test.dev', 'secret1')).idToken, uid = reg.localId;
const base = { kind: 'task', done: false, doneAt: null, createdAt: new Date().toISOString(), subject: '', est: null, step: '', remind: null, source: 'manual', priv: false, spent: 0, time: null, due: null, u: Date.now() - 5000 };
const mem0 = { s: 1, t: Date.now() - 5 * 864e5, n: 1, h: [[Date.now() - 5 * 864e5, 1]] };
const seed = [
  { ...base, id: 'tail1', title: 'Сдать договор', due: day(-6) },
  { ...base, id: 'td1', title: 'Позвонить маме', due: day(0), time: '18:30' },
  { ...base, id: 'tm1', title: 'Лаба по физике', due: day(1) },
  { ...base, id: 'tp1', kind: 'topic', title: 'Present Perfect', subject: 'Английский', due: day(20), area: 'uni', pace: 2, mem: null, key: '' },
  { ...base, id: 'tp2', kind: 'topic', title: 'Conditionals', subject: 'Английский', due: day(20), area: 'uni', pace: 2, mem: mem0, key: 'if + past simple' },
];
await F.docSet(tok, `users/${uid}/pv/ten`, { d: JSON.stringify({ items: seed, dead: {} }), t: Date.now() }, null);

const { S, handle, tick, pull, push, loadBot, saveBot, main } = await import('../bot.mjs');
const St = await import('../../js/store.js');
const D = await import('../../js/dates.js');
const calls = async () => (await fetch(TG + '/admin/calls')).json();
const clear = () => fetch(TG + '/admin/clear');
const last = async m => (await calls()).filter(c => c.method === m).pop();
const count = async (m, re) => (await calls()).filter(c => c.method === m && (!re || re.test(c.text || ''))).length;
const msg = (text, chat = 42) => ({ message: { chat: { id: chat, type: 'private' }, text } });
const cb = (data, mid = 7, chat = 42) => ({ callback_query: { id: 'q' + Math.random(), data, message: { chat: { id: chat, type: 'private' }, message_id: mid } } });
const buttons = r => (r?.reply_markup?.inline_keyboard || []).flat();
const cloud = async () => JSON.parse((await (await fetch(FB + '/admin/raw')).json()).find(x => x.k.endsWith('/ten')).d);

await loadBot(); await pull();
ok('bot signs in and reads the cloud data', St.items().length === 5, St.items().length);

// — доступ только владельцу
const n0 = St.items().length; await clear();
await handle(msg('сдать всё', 99));
ok('a stranger is refused', /личный бот/.test((await last('sendMessage')).text));
ok('and changes nothing', St.items().length === n0);
await handle(cb('d:tail1:t', 7, 99)); ok('a stranger cannot press buttons either', St.get_('tail1').done === false);
const owner = process.env.TG_CHAT_ID; delete process.env.TG_CHAT_ID; await clear();
await handle(msg('/start', 77));
ok('without TG_CHAT_ID the bot just tells the sender their id', /77/.test((await last('sendMessage')).text) && /TG_CHAT_ID/.test((await last('sendMessage')).text) && St.items().length === n0);
process.env.TG_CHAT_ID = owner;
await handle({ message: { chat: { id: 42, type: 'group' }, text: 'сдать в чате' } });
ok('group chats are ignored', St.items().length === n0);

// — старт и часовой пояс
await clear(); await handle(msg('/start'));
const st1 = await last('sendMessage');
ok('/start asks for a time zone with buttons', /часовой пояс/.test(st1.text) && buttons(st1).some(b => b.callback_data === 'tz:Asia/Tashkent'));
await handle(cb('tz:Asia/Tashkent'));
ok('choosing a zone is stored and applied', S.bot.tz === 'Asia/Tashkent' && process.env.TZ === 'Asia/Tashkent');
await clear(); await handle(msg('/tz Mars/Base'));
ok('a made-up zone is refused', /Выбери/.test((await last('sendMessage')).text) && S.bot.tz === 'Asia/Tashkent');

// — добавление обычным текстом, отмена
await clear(); await handle(msg('сдать лабу завтра в 10'));
const added = St.items().find(x => x.title === 'Сдать лабу');
ok('plain text becomes a task with date and time (same parser as the app)', added && added.due === day(1) && added.time === '10:00' && added.source === 'telegram', JSON.stringify(added && [added.due, added.time]));
const am = await last('sendMessage'); const undo = buttons(am).find(b => /^u:/.test(b.callback_data));
ok('the reply confirms and offers undo', /Добавлено/.test(am.text) && !!undo);
await handle(cb(undo.callback_data));
ok('undo removes it (and leaves a tombstone for the app)', !St.get_(added.id) && !!St.get().dead[added.id]);
await clear(); await handle(msg('купить билет\nпозвонить в деканат в пятницу'));
ok('several lines add several tasks', /Добавлено/.test((await last('sendMessage')).text) && St.items().some(x => x.title === 'Купить билет') && St.items().some(x => /деканат/i.test(x.title)));
await clear(); await handle({ message: { chat: { id: 42, type: 'private' }, sticker: {} } });
ok('non-text messages get a polite hint', /только текст/.test((await last('sendMessage')).text));

// — сегодня, «Готово», «завтра»
await clear(); await handle(msg('/today'));
const today = await last('sendMessage');
ok('/today shows the tail and today\'s task with buttons', /Хвосты/.test(today.text) && /Сдать договор/.test(today.text) && /Позвонить маме/.test(today.text) && buttons(today).some(b => b.callback_data === 'd:tail1:t'));
ok('and offers the app as a Mini App button', buttons(today).some(b => b.web_app && b.web_app.url === 'https://example.test/app/'));
await clear(); await handle(cb('d:tail1:t', 55));
ok('«Готово» finishes the task', St.get_('tail1').done === true);
const ed = await last('editMessageText');
ok('the list is edited in place without the finished task', ed && ed.message_id === 55 && !/Сдать договор/.test(ed.text) && /Позвонить маме/.test(ed.text));
await handle(cb('z:td1:t', 55));
ok('«→ завтра» moves the task by a day', St.get_('td1').due === day(1));
await handle(cb('d:nope:t', 55)); ok('a stale button does not crash', true);
await clear(); await handle(msg('/soon'));
ok('/soon lists upcoming deadlines', /Лаба по физике/.test((await last('sendMessage')).text) && /Позвонить маме/.test((await last('sendMessage')).text));

// — память прямо в Telegram
await clear(); await handle(msg('/memory'));
let c1 = await last('sendMessage');
ok('/memory sends the most urgent card with the answer hidden behind a spoiler', /Conditionals/.test(c1.text) && /<tg-spoiler>if \+ past simple<\/tg-spoiler>/.test(c1.text));
ok('and three grade buttons, no extra «show answer» step', buttons(c1).filter(b => /^rv:/.test(b.callback_data)).length === 3 && !buttons(c1).some(b => /^rk:/.test(b.callback_data)));
await handle(cb('rv:tp2:2', 60));
ok('a grade is applied to the topic (memory updated, same model as the app)', St.get_('tp2').mem.n === 2 && St.get_('tp2').mem.s > 1.5, JSON.stringify(St.get_('tp2').mem.s));
ok('the next card appears in the same message', /Present Perfect/.test((await last('editMessageText')).text));
await handle(cb('rv:tp1:2', 60));
ok('finishing the plan shows a summary', /Память освежена/.test((await last('editMessageText')).text));

// — синхронизация с приложением в обе стороны
await push();
let doc = await cloud();
ok('bot changes reach the cloud for the app', doc.items.find(x => x.id === 'tail1').done === true && doc.items.find(x => x.id === 'td1').due === day(1) && doc.items.find(x => x.id === 'tp2').mem.n === 2);
ok('deletions travel as tombstones', Object.keys(doc.dead).includes(added.id));
const cur = await F.docGet(tok, `users/${uid}/pv/ten`), pd = JSON.parse(cur.d);
pd.items.push({ ...base, id: 'app1', title: 'Из приложения', due: day(2), u: Date.now() + 2000 });
await F.docSet(tok, `users/${uid}/pv/ten`, { d: JSON.stringify(pd), t: Date.now() }, cur.updateTime);
await pull();
ok('a task added in the app appears in the bot', !!St.get_('app1'));
await clear(); await handle(msg('/soon'));
ok('and in its lists', /Из приложения/.test((await last('sendMessage')).text));

// — напоминания
const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
St.addItem({ title: 'Прочитать главу', due: D.todayISO() });
S.bot.sent = {}; await clear();
await tick(at(8, 5));
const dg = await last('sendMessage');
ok('morning digest at the chosen hour', dg && /Доброе утро/.test(dg.text) && /Прочитать главу/.test(dg.text) && buttons(dg).some(b => /^d:/.test(b.callback_data)) && buttons(dg).some(b => b.web_app), dg && dg.text.slice(0, 60));
await tick(at(8, 20)); ok('and only once a day', (await count('sendMessage', /Доброе утро/)) === 1);
St.addItem({ title: 'Консультация', due: D.todayISO(), time: '18:30' });
await clear(); await tick(at(18, 10));
const rem = await last('sendMessage');
ok('a timed task is announced 30 minutes before', rem && /Через 20 мин/.test(rem.text) && !/⏰/.test(rem.text) && /Консультация/.test(rem.text) && buttons(rem).some(b => b.callback_data.endsWith(':r')));
await tick(at(18, 12)); ok('and not twice', (await count('sendMessage', /Консультация/)) === 1);
await handle(cb(buttons(rem).find(b => /^d:/.test(b.callback_data)).callback_data, 88));
ok('«Готово» on a reminder edits it to a short confirmation', /Сделано · <b>Консультация/.test((await last('editMessageText')).text));
await clear(); await tick(at(20, 30));
ok('evening message looks at tomorrow', /Вечер/.test((await last('sendMessage'))?.text || '') && /Лаба по физике/.test((await last('sendMessage')).text));

// — настройки и тишина
await clear(); await handle(msg('/settings'));
ok('/settings shows toggles', /Утренняя сводка/.test((await last('sendMessage')).text));
await handle(cb('c:dg:9', 70)); ok('digest hour can be changed', S.bot.digest === 9 && /9:00/.test((await last('editMessageText')).text));
await handle(cb('c:ev', 70)); ok('evening reminder can be switched off', S.bot.eve === false);
await handle(cb('c:on', 70)); S.bot.sent = {}; await clear(); await tick(at(10, 0));
ok('silent mode sends nothing', S.bot.on === false && (await count('sendMessage')) === 0);

// — состояние бота переживает перезапуск
S.bot.on = true; S.bot.sent['dig:test'] = Date.now(); S.botDirty = true; await saveBot();
const keep = { tz: S.bot.tz, digest: S.bot.digest, off: S.bot.off }; S.bot = null; await loadBot();
ok('bot settings survive a restart (stored in the cloud)', S.bot.tz === keep.tz && S.bot.digest === 9 && !!S.bot.sent['dig:test'] && process.env.TZ === 'Asia/Tashkent');

// — основной цикл: берёт сообщение из очереди, настраивает бота при первом запуске
S.bot.setup = 0; S.botDirty = true; await saveBot(); await clear();
await fetch(TG + '/admin/push', { method: 'POST', body: JSON.stringify(msg('проверка цикла')) });
await main();
ok('the main loop picks up a queued message', St.items().some(x => x.title === 'Проверка цикла'));
ok('and remembers the offset so nothing is processed twice', S.bot.off > 0);
const cl = await calls();
ok('first run sets commands, description and the Mini App menu button', cl.some(c => c.method === 'setMyCommands' && c.commands.length >= 6) && cl.some(c => c.method === 'setMyDescription') && cl.some(c => c.method === 'setChatMenuButton' && c.menu_button.web_app.url === 'https://example.test/app/'));
doc = await cloud();
ok('the loop pushed the new task to the cloud', doc.items.some(x => x.title === 'Проверка цикла'));
process.exit(bad ? 1 : 0);
