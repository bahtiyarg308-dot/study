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
process.env.TZ = 'Asia/Tashkent'; // даты считаются в том же поясе, который потом выберет «пользователь»
let bad = 0; const ok = (n, c, x) => { if (!c) bad++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' | ' + String(x).slice(0, 150) : '')); };

// — аккаунт и данные в «облаке», как их оставило бы приложение
const F = await import('../../js/fb.js');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const reg = await F.signUp('bot@test.dev', 'secret1'); await fetch(FB + '/admin/verify?email=bot@test.dev');
const tok = (await F.signIn('bot@test.dev', 'secret1')).idToken, uid = reg.localId;
const base = { kind: 'task', done: false, doneAt: null, createdAt: new Date().toISOString(), subject: '', est: null, step: '', remind: null, source: 'manual', priv: false, spent: 0, time: null, due: null, u: Date.now() - 5000 };
const seed = [
  { ...base, id: 'tail1', title: 'Сдать договор', due: day(-6) },
  { ...base, id: 'td1', title: 'Позвонить маме', due: day(0), time: '18:30', subject: 'Личное' },
  { ...base, id: 'tm1', title: 'Лаба по физике', due: day(1) },
  { ...base, id: 'tp2', kind: 'topic', title: 'Conditionals', subject: 'Английский', due: day(20), area: 'uni', pace: 2, mem: { s: 1, t: Date.now() - 5 * 864e5, n: 1, h: [[Date.now() - 5 * 864e5, 1]] }, key: '' },
];
await F.docSet(tok, `users/${uid}/pv/ten`, { d: JSON.stringify({ items: seed, dead: {} }), t: Date.now() }, null);

const { S, handle, tick, pull, push, loadBot, saveBot, main } = await import('../bot.mjs');
const St = await import('../../js/store.js');
const D = await import('../../js/dates.js');
const calls = async () => (await fetch(TG + '/admin/calls')).json();
const clear = () => fetch(TG + '/admin/clear');
const sent = async re => (await calls()).filter(c => c.method === 'sendMessage' && (!re || re.test(c.text || '')));
const dels = async () => (await calls()).filter(c => c.method === 'deleteMessage').map(c => c.message_id);
const msg = (text, chat = 42) => ({ message: { chat: { id: chat, type: 'private' }, text } });
const cb = (data, mid = 7, chat = 42) => ({ callback_query: { id: 'q' + Math.random(), data, message: { chat: { id: chat, type: 'private' }, message_id: mid } } });
const buttons = r => (r?.reply_markup?.inline_keyboard || []).flat();
const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const go = async (h, m) => { await clear(); S.testNow = at(h, m).getTime(); await tick(); };   // «сейчас» = h:m, затем проверка напоминаний

await loadBot(); await pull();
ok('until a level is chosen the bot nags as persistently as possible', S.bot.lvl === 'max' && !S.bot.lvlSet);
ok('bot signs in and reads the cloud data', St.items().length === 4, St.items().length);

// — доступ только владельцу
const n0 = St.items().length; await clear();
await handle(msg('привет', 99)); ok('a stranger is refused', /личный бот/.test((await sent()).pop().text));
await handle(cb('d:tail1', 7, 99)); ok('a stranger cannot press buttons either', St.get_('tail1').done === false);
const owner = process.env.TG_CHAT_ID; delete process.env.TG_CHAT_ID; await clear();
await handle(msg('/start', 77)); ok('without TG_CHAT_ID the bot just tells the sender their id', /77/.test((await sent()).pop().text) && /TG_CHAT_ID/.test((await sent()).pop().text));
process.env.TG_CHAT_ID = owner;
await handle({ message: { chat: { id: 42, type: 'group' }, text: 'в чате' } }); ok('group chats are ignored', St.items().length === n0);

// — старт: часовой пояс; бот ничего не добавляет и не умеет, кроме напоминаний
await clear(); await handle(msg('/start'));
const s1 = (await sent()).pop();
ok('/start asks for a time zone first', /часовой пояс/.test(s1.text) && buttons(s1).some(b => b.callback_data === 'tz:Asia/Tashkent'));
await tick(); ok('no reminders are sent before a time zone is chosen', (await sent(/Не сделано|Доброе|Пора|Через/)).length === 0);
await handle(cb('tz:Asia/Tashkent', 9));
ok('choosing a zone is stored and applied', S.bot.tz === 'Asia/Tashkent' && process.env.TZ === 'Asia/Tashkent');
S.bot.lvl = 'steady'; S.bot.lvlSet = true;   // дальше проверяем режим «Настойчиво», «Не отстану» отдельным блоком ниже
await clear(); await handle(msg('сдать лабу завтра в 10'));
ok('plain text is NOT turned into a task: the bot only reminds', St.items().length === n0 && /только присылаю напоминания/.test((await sent()).pop().text));
ok('and points to the app with a Mini App button', buttons((await sent()).pop()).some(b => b.web_app && b.web_app.url === 'https://example.test/app/'));
await clear(); await handle(msg('/today')); ok('there are no commands except settings: /today gets the same hint', /только присылаю напоминания/.test((await sent()).pop().text));
await clear(); await handle(msg('/tz Mars/Base')); ok('a made-up zone is refused', /Выбери/.test((await sent()).pop().text));

// — утро: сводка остаётся, а общий список «не сделано» повторяется и заменяет себя
await go(8, 5);
const dg = (await sent(/Доброе утро/)).pop();
ok('morning digest lists the tail and today\'s task, with the memory line', dg && /Хвосты/.test(dg.text) && /Сдать договор/.test(dg.text) && /Позвонить маме/.test(dg.text) && /Память/.test(dg.text), dg && dg.text.slice(0, 50));
ok('with a green done button and the Mini App', buttons(dg).find(b => b.callback_data === 'd:tail1:g').style === 'success' && buttons(dg).some(b => b.web_app));
await go(8, 30); ok('no nagging right after the digest', (await sent()).length === 0);
// — заранее (Настойчиво): зачёт без времени, до него 3 дня; «за 30 минут» тут нет, но напоминания идут
St.addItem({ title: 'Зачёт по английскому', due: day(3), subject: 'Английский', est: 6, step: 'Написать план' });
St.addItem({ title: 'Курсовая', due: day(5) });
delete S.bot.sent['ah:' + D.todayISO() + ':480'];
await go(8, 40); const ah = (await sent(/Не забудь|Осталось|Завтра срок/)).pop();
ok('a date-only deadline is announced ahead (3 days and 1 day in this mode)', ah && /Осталось 3 дня/.test(ah.text) && /Зачёт по английскому/.test(ah.text) && /Завтра срок/.test(ah.text) && /Лаба по физике/.test(ah.text), ah && ah.text.replace(/\n/g, ' / '));
ok('it counts the daily load from the estimate and shows the first step', /около 2 ч в день/.test(ah.text) && /Первый шаг: Написать план/.test(ah.text));
ok('but not 5 days ahead in this mode', !/Курсовая/.test(ah.text));
await go(8, 50); ok('and not twice in the same slot', (await sent(/Не забудь|Осталось|Завтра срок/)).length === 0);
await go(9, 10);
const n1 = (await sent(/Не сделано: 1/)).pop();
ok('an hour later a short «not done» list arrives (tail only, the 18:30 call has its own timer)', n1 && /Сдать договор/.test(n1.text) && !/Позвонить/.test(n1.text));
const mid1 = S.bot.pend.mid;
await go(10, 15);
ok('the next one replaces the previous: old message deleted, new one sent', (await sent(/Не сделано: 1/)).length === 1 && (await dels()).includes(mid1));
const mid2 = S.bot.pend.mid; await clear(); await handle(cb('d:tail1:p', mid2));
ok('«Готово» on the list finishes the task', St.get_('tail1').done === true);
ok('and with nothing left the list message disappears', (await dels()).includes(mid2) && S.bot.pend.mid === 0);
await go(12, 30); ok('and nothing more is sent', (await sent()).length === 0);

// — дело со временем: за 30 и 10 минут, в срок, потом каждые 10 минут
await go(17, 59); ok('nothing before the first step', (await sent()).length === 0);
await go(18, 0); let r = (await sent(/Через 30 мин/)).pop();
ok('30 minutes before: «Через 30 мин» with the time', r && /Через 30 мин/.test(r.text) && /<code>18:30<\/code>/.test(r.text) && /Личное/.test(r.text), r && r.text.replace(/\n/g, ' / '));
ok('with Готово, Через час, Завтра and the app', ['Готово', 'Через час', 'Завтра', 'Открыть Тень'].every(t => buttons(r).some(b => b.text === t)) && buttons(r).find(b => b.text === 'Готово').style === 'success');
await go(18, 2); ok('the same step is never sent twice', (await sent()).length === 0);
const m30 = S.bot.nag.td1.mid; await go(18, 20);
ok('10 minutes before replaces the previous message', (await sent(/Через 10 мин/)).length === 1 && (await dels()).includes(m30));
await go(18, 30); ok('at the time: «Пора»', (await sent(/Пора/)).length === 1);
await go(18, 40); r = (await sent()).pop(); ok('then every 10 minutes: «Не сделано», how long it has been', /Не сделано/.test(r.text) && /прошло 10 мин/.test(r.text), r.text.replace(/\n/g, ' / '));
await go(18, 41); ok('and again not twice in the same step', (await sent()).length === 0);
await go(18, 50); ok('the next repeat counts further: 20 minutes', /прошло 20 мин/.test((await sent()).pop().text));
const mLast = S.bot.nag.td1.mid; await clear(); await handle(cb('d:td1', mLast));
ok('«Готово» finishes it and the reminder disappears', St.get_('td1').done === true && (await dels()).includes(mLast) && !S.bot.nag.td1);
await go(19, 0); ok('and it never nags about a finished task', (await sent(/Позвонить/)).length === 0);

// — «Через час»
const cons = St.addItem({ title: 'Консультация', due: D.todayISO(), time: '19:30', subject: 'Английский' });
await go(19, 0); const cm = S.bot.nag[cons.id].mid; ok('a new timed task starts its own countdown', (await sent(/Через 30 мин/)).length === 1);
S.testNow = at(19, 0).getTime(); await clear(); await handle(cb(`s:${cons.id}`, cm));
ok('«Через час» removes the reminder', (await dels()).includes(cm));
await go(19, 20); ok('and stays quiet for an hour', (await sent()).length === 0);
await go(20, 5); r = (await sent(/Не сделано/)).pop(); ok('then comes back with the time that passed', r && /прошло 35 мин/.test(r.text));
const ev = (await sent(/Вечер/)).pop();
ok('after 20:00 one evening message looks at tomorrow (once a day)', ev && /Лаба по физике/.test(ev.text));

// — дело закрыли в приложении: уведомление исчезает само, вечером приходит взгляд на завтра
const cm2 = S.bot.nag[cons.id].mid; St.toggleDone(cons.id);
await go(20, 31);
ok('finished in the app: the reminder is cleaned up by itself', (await dels()).includes(cm2) && !S.bot.nag[cons.id]);
await go(20, 45); ok('the evening message is not repeated', (await sent(/Вечер/)).length === 0);

// — тихие часы, общий список днём, настойчивость
St.addItem({ title: 'Прочитать главу', due: D.todayISO() });
S.bot.pend.last = 0; S.bot.pend.snz = 0;
await go(23, 30); ok('nothing is sent at night (after 23:00)', (await sent()).length === 0);
await go(3, 0); ok('nor before 06:00', (await sent()).length === 0);
await go(14, 0); ok('in the afternoon the undone task without a time arrives in the list', /Прочитать главу/.test((await sent()).pop().text));
await clear(); await handle(msg('/settings'));
const st = (await sent()).pop();
ok('/settings offers three levels and the digest hour', ['Спокойно', 'Настойчиво', 'Не отстану'].every(n => buttons(st).some(b => b.text.includes(n))) && /Напоминания/.test(st.text));
await handle(cb('c:lv:max', 70)); ok('«Не отстану» can be chosen and is remembered as an explicit choice', S.bot.lvl === 'max' && S.bot.lvlSet === true);
await go(14, 20); ok('the list repeats every 30 minutes in that mode, not before', (await sent(/Не сделано/)).length === 0);
await go(14, 35); ok('…and after 35 minutes it does', (await sent(/Не сделано/)).length === 1);
await handle(cb('c:lv:steady', 70)); await handle(cb('c:on', 70)); await go(16, 0);
ok('silent mode sends nothing', S.bot.on === false && (await sent()).length === 0);
await handle(cb('c:on', 70)); ok('and can be switched back on', S.bot.on === true);

// — «Не отстану»: каждый день до срока, чем ближе срок, тем чаще
await handle(cb('c:lv:max', 70)); await handle(cb('c:on', 70)); if (!S.bot.on) await handle(cb('c:on', 70));
St.items().filter(x => x.kind === 'task' && !x.done).forEach(x => St.toggleDone(x.id));
S.bot.sent = {}; S.bot.ahead = { mid: 0, snz: 0 }; S.bot.pend = { last: 0, mid: 0, snz: 0 }; S.bot.ign = {}; S.bot.nag = {};
const tday = D.todayISO(), far = St.addItem({ title: 'Далёкая сдача', due: day(12) }), prj = St.addItem({ title: 'Проект', due: day(6) });
const zach = St.addItem({ title: 'Зачёт', due: day(3), est: 6, step: 'Написать план' }), exm = St.addItem({ title: 'Экзамен', due: day(1), time: '15:00' });
await go(8, 5); let a1 = (await sent(/Не забудь/)).pop();
ok('morning: everything with a date ahead is mentioned every day (even 12 days away)', a1 && /Не забудь: 4 дела/.test(a1.text) && /Через 12 дн/.test(a1.text) && /Далёкая сдача/.test(a1.text), a1 && a1.text.slice(0, 40));
ok('with the daily load and first step of the one that has an estimate', /около 2 ч в день/.test(a1.text) && /Первый шаг: Написать план/.test(a1.text));
const am1 = S.bot.ahead.mid; await clear(); S.testNow = at(8, 5).getTime(); await handle(cb('sa', am1));
ok('«Через 3 часа» removes the message and pauses this stream', (await dels()).includes(am1) && S.bot.ahead.snz > at(8, 5).getTime());
await go(11, 0); ok('while paused the 11:00 slot is skipped', (await sent(/Завтра срок/)).length === 0);
await go(11, 10); let a2 = (await sent(/Завтра срок/)).pop();
ok('after the pause it comes back, and only about what is due tomorrow (the closer, the more often)', a2 && /Экзамен/.test(a2.text) && !/Далёкая/.test(a2.text) && /15:00/.test(a2.text), a2 && a2.text.replace(/\n/g, ' / '));
const am2 = S.bot.ahead.mid; await go(13, 5); let a3 = (await sent(/Осталось 3 дня/)).pop();
ok('13:00: 2–3 days ahead get their extra reminder, tomorrow\'s do not', a3 && /Зачёт/.test(a3.text) && !/Экзамен/.test(a3.text));
const am3 = S.bot.ahead.mid; await go(14, 5);
ok('14:00: tomorrow again, and the previous message is replaced (chat stays clean)', (await sent(/Завтра срок/)).length === 1 && (await dels()).includes(am3));
await go(19, 5); let a4 = (await sent(/Не забудь/)).pop();
ok('evening: 4–7 days and 2–3 days ahead get their second reminder', a4 && /Проект/.test(a4.text) && /Зачёт/.test(a4.text) && !/Далёкая/.test(a4.text) && !/Экзамен/.test(a4.text), a4 && a4.text.replace(/\n/g, ' / '));
S.bot.ign[zach.id] = 5; delete S.bot.sent[`ah:${tday}:${19 * 60}`]; await go(19, 20);
ok('after many ignored reminders the tone gets firmer', /Напоминаю уже 5 раз/.test((await sent(/Не забудь/)).pop().text));
const am4 = S.bot.ahead.mid; await clear(); await handle(cb(`d:${zach.id}:a`, am4));
ok('«Готово» finishes it, removes the message and forgets the counter', St.get_(zach.id).done === true && (await dels()).includes(am4) && !S.bot.ign[zach.id]);
await go(20, 5); ok('at night-time slot 20:00 only what is due tomorrow remains (the finished one is gone)', /Экзамен/.test((await sent(/Завтра срок/)).pop()?.text || '') && !/Зачёт/.test((await sent()).map(c => c.text).join('')));
await go(23, 30); ok('and after 23:00 it is quiet again', (await sent()).length === 0);

// — состояние переживает перезапуск
S.botDirty = true; await saveBot(); const keep = { tz: S.bot.tz, lvl: S.bot.lvl }; S.bot = null; await loadBot();
ok('bot state survives a restart (stored in the cloud)', S.bot.tz === keep.tz && S.bot.lvl === 'max' && !!S.bot.sent['dig:' + D.todayISO()] && process.env.TZ === 'Asia/Tashkent');

// — основной цикл: убирает прежнее нижнее меню один раз и настраивает бота
S.testNow = 0; S.bot.setup = 0; S.bot.kb = 1; S.botDirty = true; await saveBot(); await clear();
await main();
const cl = await calls();
ok('the old bottom menu is removed once', cl.filter(c => c.method === 'sendMessage' && c.reply_markup && c.reply_markup.remove_keyboard).length === 1 && S.bot.kb === 2);
ok('commands are reduced to /settings, Mini App menu button is set', cl.some(c => c.method === 'setMyCommands' && c.commands.length === 1 && c.commands[0].command === 'settings') && cl.some(c => c.method === 'setChatMenuButton' && c.menu_button.web_app.url === 'https://example.test/app/'));
process.exit(bad ? 1 : 0);
