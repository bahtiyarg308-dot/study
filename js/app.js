import * as D from './dates.js';
import * as St from './store.js';
import { layout, radarHTML } from './radar.js';
import * as AI from './ai.js';
import * as Mem from './mem.js';
import { sfx, buzz, sinceLast, cfg as sndCfg } from './sfx.js';
import * as Auth from './auth.js';
import * as F from './fb.js';
import { openGate, isOpen as gateOpen } from './gate.js';
import { $, $$, esc, ic, num, toast, openSheet, closeSheet, sheetEl, applyAppearance, THEMES, accOf, themeId } from './ui.js';

const APP_VERSION = '2.3';
const ui = { view: 'today', sub: null, filter: 'all', lmode: 'list', q: '', day: null, sel: null, enter: true, models: {} };
const viewEl = $('#view'), tabsEl = $('#tabs');
const today = () => D.todayISO();
/** Тихие анимации на JS выключаются там же, где и CSS: «Тише анимации» и системная настройка. */
const calm = () => document.documentElement.dataset.calm === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const DAYMS = 864e5;
const when = it => it.due ? `${D.fmtDay(it.due)}${it.time ? ' · ' + it.time : ''}` : 'без срока';
const nTasks = n => `${n} ${D.plural(n, ['дело', 'дела', 'дел'])}`;
const nTails = n => `${n} ${D.plural(n, ['хвост', 'хвоста', 'хвостов'])}`;
const WDL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const syncSound = () => { const s = St.settings().snd || {}; sndCfg.on = s.on !== false; sndCfg.vol = s.vol ?? 2; };

/* ───────── общие куски ───────── */
const dateLabel = () => { const n = new Date(); return `${WDL[n.getDay()]}, ${n.getDate()} ${D.MON[n.getMonth()]}`; };
const headActs = add => `${add === 'topics' ? `<button class="btn btn-sm" data-act="topics-add">${ic('plus')}Темы</button>` : add ? `<button class="btn btn-sm" data-act="add">${ic('plus')}Дело</button>` : ''}<button class="icon-btn ai" data-act="ai" aria-label="Спросить ИИ">${ic('spark')}</button><button class="icon-btn" data-act="quick" aria-label="Ещё: аккаунт, оформление, данные">${ic('sliders')}</button>`;
const pageHead = (eyebrow, title, acts) => `<header class="page-head"><div class="ph-text"><div class="eyebrow">${eyebrow}</div><h1 class="h1">${title}</h1></div><div class="ph-act">${acts}</div></header>`;
const backHead = (title, eyebrow = 'Ещё') => `<header class="page-head"><div style="display:flex;align-items:flex-end;gap:10px;min-width:0"><button class="icon-btn" data-act="sub" data-s="" aria-label="Назад" style="margin-bottom:-4px">${ic('back')}</button><div class="ph-text"><div class="eyebrow">${eyebrow}</div><h1 class="h1">${title}</h1></div></div></header>`;
const emptyState = () => `<div class="empty"><h3>Пока пусто</h3><p>Нажми «+» и выгрузи всё из головы одной строкой. Сроки найдутся сами и встанут на горизонте.</p><button class="btn btn-primary" data-act="add">${ic('plus')}Добавить</button><br><button class="link" data-act="demo">Показать пример</button></div>`;

const swipeRow = (inner, id) => `<div class="swp" data-sw="${id}"><button class="swp-act" data-act="swdel" data-id="${id}" aria-label="Удалить"><span class="swp-btn">${ic('trash')}</span></button><div class="swp-fg">${inner}</div></div>`;
function taskRow(it, t) {
  const tail = St.isTail(it, t), dd = St.daysTo(it, t);
  let dcol;
  if (tail) dcol = `<div class="jr-d bad"><b>−${-dd}</b><span>дн</span></div>`;
  else if (!it.due) dcol = `<div class="jr-d"><b>—</b><span>без даты</span></div>`;
  else if (it.due === t && it.time) dcol = `<div class="jr-d tm"><b>${it.time}</b><span>сегодня</span></div>`;
  else { const d = D.fromISO(it.due); dcol = `<div class="jr-d"><b>${d.getDate()}</b><span>${it.due === t ? 'сегодня' : D.WD[d.getDay()]}</span></div>`; }
  const sub = [it.due === t ? '' : it.time, it.subject, it.est ? D.fmtHours(it.est) : ''].filter(Boolean).map(esc).join(' · ');
  return `<div class="jr ${it.done ? 'dn' : ''}">${dcol}<button class="jr-b" data-act="open" data-id="${it.id}"><b><span>${esc(it.title)}</span>${tail ? '<i class="tag hot" style="font-style:normal">хвост</i>' : ''}</b>${sub ? `<small>${sub}</small>` : ''}</button>
  <button class="ck ${it.done ? 'd' : ''}" data-act="toggle" data-id="${it.id}" aria-label="${it.done ? 'Вернуть в дела' : 'Отметить сделанным'}">${ic('check')}</button></div>`;
}
const noteRow = n => `<button class="note-r" data-act="open" data-id="${n.id}"><div class="meta"><span class="tag">${esc(n.subject || 'заметка')}</span><span class="h2">${D.fmtShort(D.iso(new Date(n.createdAt)))}</span></div>${esc(n.title)}</button>`;

/* ───────── «Сегодня» ───────── */
function weekStrip(t) {
  const open = St.items().filter(x => !x.done && x.kind === 'task' && x.due);
  const ws = D.addDays(t, -((D.dow(t) + 6) % 7)), names = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const d = D.addDays(ws, i), n = open.filter(x => x.due === d).length, late = d < t && n > 0;
    cells += `<button class="wd ${d === t ? 'today' : ''} ${n ? 'has' : ''} ${late ? 'late' : ''} ${d < t ? 'past' : ''}" data-act="day" data-d="${d}" aria-label="${D.fmtDay(d)}: ${n} дел"><span>${names[i]}</span><b>${+d.slice(8)}</b><i>${'<s></s>'.repeat(Math.min(3, n))}</i></button>`;
  }
  const weekOpen = open.filter(x => x.due >= ws && x.due <= D.addDays(ws, 6) && x.due >= t).length, tails = open.filter(x => x.due < t).length;
  return `<div class="panel week">${cells}</div><p class="week-sum">${weekOpen ? `Сроков до конца недели: ${weekOpen}` : 'До конца недели сроков нет'}${tails ? ` · ${nTails(tails)}` : ''}</p>`;
}
function nowCard(it) {
  const t = today(), tail = St.isTail(it, t), dd = St.daysTo(it, t);
  const sub = tail ? `<span class="hotc">Тянется ${D.days(-dd)}</span>` : `${esc(when(it))}${dd > 0 ? ' · ' + D.rel(it.due, t) : ''}`;
  return `<section class="panel now ${tail ? 'tail' : ''}"><span class="tag ${tail ? 'hot' : ''}">${tail ? 'Сейчас · хвост' : 'Сейчас'}</span>
    <h2 class="now-title" data-act="open" data-id="${it.id}">${esc(it.title)}</h2>
    <p class="now-sub">${sub}${it.step ? `<br>Шаг: ${esc(it.step)}` : ''}</p>${tail ? '<div class="comet"></div>' : ''}
    <div class="btn-row"><button class="btn btn-primary btn-lg" data-act="done" data-id="${it.id}">${ic('check')}Готово</button></div></section>`;
}
function vToday() {
  const all = St.items(), t = today(), name = St.settings().name?.trim();
  const head = pageHead(dateLabel(), name ? `Привет, ${esc(name)}` : 'Сегодня', headActs(false));
  if (!all.length) return head + emptyState();
  const open = all.filter(x => !x.done && x.kind === 'task');
  const now = St.pickNow(t);
  const rest = open.filter(x => x.due === t && (!now || x.id !== now.id)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const otherTails = open.filter(x => St.isTail(x, t) && (!now || x.id !== now.id)).length;
  const tomorrow = open.filter(x => x.due === D.addDays(t, 1)).length;
  let h = head + weekStrip(t);
  h += now ? nowCard(now) : `<section class="panel now"><span class="tag">Сейчас</span><h2 class="now-title">Всё сделано</h2><p class="now-sub">Срочного нет. Можно выдохнуть или добавить новое.</p></section>`;
  h += memCard();
  if (rest.length) h += `<section class="sec"><div class="sec-head"><h2 class="h2">Дальше сегодня</h2><span class="h2">${rest.length}</span></div><div class="panel flush">${rest.slice(0, 5).map(x => swipeRow(taskRow(x, t), x.id)).join('')}</div></section>`;
  if (otherTails || tomorrow) h += `<div class="panel flush" style="margin-top:12px">${otherTails ? `<button class="mrow" data-act="tails"><span class="grow"><b>Ещё ${nTails(otherTails)}</b></span>${ic('chev', 'chev')}</button>` : ''}${tomorrow ? `<button class="mrow" data-act="tomorrow"><span class="grow"><b>Завтра: ${nTasks(tomorrow)}</b></span>${ic('chev', 'chev')}</button>` : ''}</div>`;
  h += `<div style="margin-top:14px"><button class="btn-add" data-act="add">${ic('plus')}Добавить дело</button></div>`;
  return h;
}

/* ───────── «Горизонт» ───────── */
function vHorizon() {
  const t = today(), pts = layout(St.items(), t), tails = pts.filter(p => p.tail).length;
  const head = pageHead(pts.length ? `${nTasks(pts.length)}${tails ? ' · ' + nTails(tails) : ''}` : 'Ближе к центру — срочнее', 'Горизонт', headActs(true));
  if (!St.items().length) return head + emptyState();
  if (!pts.some(p => p.it.id === ui.sel)) { const n = St.pickNow(t); ui.sel = (n && pts.find(p => p.it.id === n.id)) ? n.id : pts[0]?.it.id; }
  const sel = pts.find(p => p.it.id === ui.sel);
  let h = head + `<div class="panel rad"><div class="radar" id="radar">${radarHTML(pts, ui.sel)}</div>
    <div class="legend"><span><i style="background:var(--bad)"></i>Хвост</span><span><i style="background:var(--gold)"></i>Скоро</span><span><i style="background:var(--ink)"></i>Неделя</span><span><i style="background:var(--steel)"></i>Дальше</span></div></div>`;
  h += sel ? `<button class="panel sel-row" data-act="open" data-id="${sel.it.id}"><div><b>${esc(sel.it.title)}</b><span class="sub" style="display:block;margin-top:2px">${esc(when(sel.it))} · ${D.rel(sel.it.due, t)}</span></div>${ic('chev')}</button>` : '';
  return h;
}

/* ───────── «Дела» ───────── */
function listBody() {
  const t = today(), all = St.items(), q = ui.q.trim().toLowerCase();
  const grp = (title, arr, note) => arr.length ? `<section class="sec"><div class="sec-head"><h2 class="h2">${title}</h2><span class="h2">${arr.length}</span></div><div class="panel flush">${arr.map(x => swipeRow(note ? noteRow(x) : taskRow(x, t), x.id)).join('')}</div></section>` : '';
  const tm = D.addDays(t, 1), byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99');
  if (q) {
    const hit = all.filter(x => (x.title + ' ' + (x.subject || '') + ' ' + (x.step || '')).toLowerCase().includes(q));
    return grp(`Найдено`, hit.filter(x => x.kind === 'task').sort((a, b) => (a.due || '9').localeCompare(b.due || '9')), false) + grp('Заметки', hit.filter(x => x.kind === 'note'), true) || '<div class="empty"><p>Ничего не нашлось.</p></div>';
  }
  const tasks = all.filter(x => x.kind === 'task' && !x.done), notes = all.filter(x => x.kind === 'note');
  const tails = tasks.filter(x => St.isTail(x, t)).sort((a, b) => a.due.localeCompare(b.due));
  const todays = tasks.filter(x => x.due === t).sort(byTime), tomorrow = tasks.filter(x => x.due === tm).sort(byTime);
  const later = tasks.filter(x => x.due && x.due > tm).sort((a, b) => a.due.localeCompare(b.due)), nodue = tasks.filter(x => !x.due);
  const done = all.filter(x => x.kind === 'task' && x.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 6);
  const f = ui.filter; let h = '';
  if (f === 'day') h = grp(D.fmtDay(ui.day), tasks.filter(x => x.due === ui.day).sort(byTime), false);
  else if (f === 'all') h = grp('Хвосты', tails) + grp(`Сегодня · ${D.fmtShort(t)}`, todays) + grp(`Завтра · ${D.fmtShort(tm)}`, tomorrow) + grp('Позже', later) + grp('Без срока', nodue) + grp('Идеи', notes, true) + grp('Сделано', done);
  else if (f === 'today') h = grp('Хвосты', tails) + grp('Сегодня', todays) + grp('Сделано', done);
  else if (f === 'tails') h = grp('Хвосты', tails);
  else if (f === 'ideas') h = grp('Идеи', notes, true);
  return h || `<div class="empty"><p>${f === 'tails' ? 'Хвостов нет. Так держать.' : f === 'ideas' ? 'Идей пока нет. Начни запись со слова «идея:».' : f === 'day' ? 'На этот день сроков нет.' : 'Здесь пусто.'}</p></div>`;
}
/* ───────── «Активность»: карта за 12 недель ───────── */
const doneDay = it => D.iso(new Date(it.doneAt));
function activityBy() { const by = {}; St.items().filter(x => x.kind === 'task' && x.done && x.doneAt).forEach(x => { (by[doneDay(x)] ||= []).push(x); }); return by; }
function vActivity() {
  const t = today(), ws = D.addDays(t, -((D.dow(t) + 6) % 7)), start = D.addDays(ws, -77), by = activityBy();
  const lvl = n => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4), MN = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  let cells = '', months = '', i = 0, total = 0, tails = 0, thisW = 0, lastW = 0;
  for (let w = 0; w < 12; w++) {
    const mon = D.addDays(start, w * 7), m = D.fromISO(mon).getMonth(), pm = w ? D.fromISO(D.addDays(start, (w - 1) * 7)).getMonth() : -1;
    if (m !== pm) months += `<span class="hm" style="grid-column:${w + 2};grid-row:1">${MN[m]}</span>`;
    for (let d = 0; d < 7; d++) {
      const date = D.addDays(mon, d), list = by[date] || [], n = list.length, fut = date > t;
      if (!fut) { total += n; list.forEach(x => { if (x.due && D.diffDays(x.due, date) > 0) tails++; }); if (date >= ws) thisW += n; else if (date >= D.addDays(ws, -7)) lastW += n; }
      cells += `<button class="hc l${lvl(n)} ${fut ? 'f' : ''} ${date === t ? 'today' : ''}" style="grid-column:${w + 2};grid-row:${d + 2};--i:${i++}" data-act="hday" data-d="${date}" aria-label="${D.fmtDay(date)}: ${n} ${D.plural(n, ['дело', 'дела', 'дел'])}" ${fut ? 'disabled' : ''}></button>`;
    }
  }
  const labels = ['пн', '', 'ср', '', 'пт', '', ''].map((l, k) => l ? `<span class="hl" style="grid-column:1;grid-row:${k + 2}">${l}</span>` : '').join('');
  const diff = thisW - lastW;
  return `<div class="panel heatp"><div class="h2">Активность · 12 недель</div><div class="heat">${months}${labels}${cells}</div>
    <div class="hleg">меньше ${[0, 1, 2, 3, 4].map(l => `<i style="background:var(--h${l})"></i>`).join('')} больше</div></div>
    <div class="stats"><div class="panel stat"><b>${total}</b><span>дел за 12 недель</span></div><div class="panel stat"><b>${thisW}</b><span>на этой неделе${lastW || diff ? `<small>${diff >= 0 ? '+' : '−'}${Math.abs(diff)}</small>` : ''}</span></div><div class="panel stat"><b>${tails}</b><span>хвостов закрыто</span></div></div>
    <p class="hnote">Тап по дню покажет, что в него было сделано.${total ? '' : ' Сделанные дела будут закрашивать дни.'}</p>`;
}
function openDay(date) {
  const list = (activityBy()[date] || []).slice().sort((a, b) => a.doneAt.localeCompare(b.doneAt));
  if (!list.length) { toast(`${D.fmtDay(date)}: ничего не сделано`); return; }
  openSheet({
    eyebrow: 'Сделано', title: esc(D.fmtDay(date)),
    body: list.map(x => { const late = x.due && D.diffDays(x.due, date) > 0, tm = new Date(x.doneAt); return `<div class="snap"><div><b>${esc(x.title)}</b><small>${String(tm.getHours()).padStart(2, '0')}:${String(tm.getMinutes()).padStart(2, '0')}${x.subject ? ' · ' + esc(x.subject) : ''}</small></div>${late ? '<span class="tag hot">хвост</span>' : ''}</div>`; }).join(''),
    foot: '<button class="btn btn-primary btn-block" data-act="close">Понятно</button>',
  });
}
function vList() {
  const all = St.items(), t = today();
  const open = all.filter(x => x.kind === 'task' && !x.done), tails = open.filter(x => St.isTail(x, t)).length;
  const head = pageHead(`${open.length} открыто`, 'Дела', headActs(true));
  const seg = `<div class="seg full" style="margin-bottom:14px"><button aria-pressed="${ui.lmode !== 'activity'}" data-act="lmode" data-m="list">Список</button><button aria-pressed="${ui.lmode === 'activity'}" data-act="lmode" data-m="activity">Активность</button></div>`;
  if (!all.length) return head + emptyState();
  const F = [['all', 'Все'], ['today', 'Сегодня'], ['tails', `Хвосты${tails ? ' ' + tails : ''}`], ['ideas', 'Идеи']];
  const chips = F.map(([k, l]) => `<button class="chip ${k === 'tails' ? 'hotf' : ''}" aria-pressed="${ui.filter === k}" data-act="filter" data-f="${k}">${l}</button>`).join('') + (ui.filter === 'day' ? `<button class="chip" aria-pressed="true" data-act="filter" data-f="all">${D.fmtShort(ui.day)} ${ic('close')}</button>` : '');
  if (ui.lmode === 'activity') return head + seg + vActivity();
  return head + seg + `<div class="search">${ic('search')}<input class="field" id="qs" type="search" placeholder="Поиск: дело, предмет, заметка" value="${esc(ui.q)}" autocomplete="off"></div><div class="chips scroll fl">${chips}</div><div id="lres">${listBody()}</div>`;
}

/* ───────── «Память»: темы к экзаменам ───────── */
const skey = v => String(v || '').trim().toLowerCase();
const memSubs = () => Mem.subjects(St.items());
const memPlan = () => Mem.plan(memSubs(), Date.now(), St.settings().memSec || 90);
const pc = r => `${Math.round((r || 0) * 100)}%`;
const nTopics = n => `${n} ${D.plural(n, ['тема', 'темы', 'тем'])}`;
const whenTs = ts => D.rel(D.iso(new Date(ts)), today());
function orderedSubs() {
  const rank = s => (Mem.stats(s).past ? 2 : s.due ? 0 : 1);
  return memSubs().sort((a, b) => (a.area === 'uni' ? 0 : 1) - (b.area === 'uni' ? 0 : 1) || rank(a) - rank(b) || (a.due || '').localeCompare(b.due || '') || a.name.localeCompare(b.name, 'ru'));
}
const examLabel = (s, st) => (s.due ? `${st.past ? 'Срок прошёл' : s.area === 'self' ? 'Цель' : 'Экзамен'} ${D.fmtShort(s.due)}${st.past ? '' : ' · ' + D.rel(s.due, today())}` : s.area === 'self' ? `Для себя · новых тем в день: ${s.pace}` : 'Без даты экзамена');

/** Узкая карточка на «Сегодня»: что тускнеет и сколько это займёт. */
function memCard() {
  const subs = memSubs().filter(s => !Mem.stats(s).past);
  if (!subs.length) return '';
  const pl = Mem.plan(subs, Date.now(), St.settings().memSec || 90);
  const next = subs.filter(s => s.due).sort((a, b) => a.due.localeCompare(b.due))[0];
  const exam = next ? `${esc(next.name)} · ${D.rel(next.due, today())}` : '';
  if (!pl.queue.length) {
    const nf = Mem.nextFade(subs);
    return `<section class="panel memc"><div class="grow"><span class="tag">Память</span><b>На сегодня всё свежо</b><small>${nf ? 'Следующее освежение ' + whenTs(nf) : exam}</small></div><button class="btn btn-sm btn-ghost" data-act="mem-open">Открыть</button></section>`;
  }
  const f = pl.fade.length, n = pl.fresh.length;
  return `<section class="panel memc"><div class="grow"><span class="tag">Память</span><b>${[f ? `Тускнеет: ${f}` : '', n ? `новых: ${n}` : ''].filter(Boolean).join(' · ')}</b><small>около ${pl.mins} мин${exam ? ' · ' + exam : ''}</small></div><button class="btn" data-act="mem-go">Освежить</button></section>`;
}

const topicRow = x => {
  const r = Mem.rec(x.mem), cls = r === null ? '' : r < Mem.FADE_AT ? 'fade' : 'ok';
  return `<div class="trow"><button class="tr-b" data-act="topic" data-id="${x.id}"><b>${esc(x.title)}</b><small>${r === null ? 'не начато' : r < Mem.FADE_AT ? 'тускнеет' : 'свежо'}${x.key ? ' · есть ответ' : ''}</small></button><div class="tr-v ${cls}"><span>${r === null ? '—' : pc(r)}</span><i style="--w:${r === null ? 0 : Math.round(r * 100)}%"></i></div></div>`;
};
/** Перемотка времени: клетки гаснут так, как тема забывается без повторов. */
function rewind(inp) {
  const sec = inp.closest('.subj'), sub = memSubs().find(x => x.key === inp.dataset.k); if (!sec || !sub) return;
  const d = +inp.value, T = Date.now() + d * DAYMS, ex = sub.due && !Mem.stats(sub).past;
  sec.querySelectorAll('.mc').forEach((c, i) => { const x = sub.topics[i]; if (x) c.className = 'mc l' + Mem.level(Mem.rec(x.mem, T)); });
  sec.querySelector('.mn-v').textContent = pc(Mem.stats(sub, T).now);
  sec.querySelector('.mn-l').textContent = d ? `свежесть через ${D.days(d)}` : 'свежесть сейчас';
  sec.querySelector('.tml').textContent = !d ? 'сейчас' : ex && d === +inp.max ? 'день экзамена' : `через ${D.days(d)}`;
  sec.classList.toggle('rew', d > 0);
}
function vMemory() {
  const subs = orderedSubs();
  if (!subs.length) return `<div class="empty"><h3>Что хочешь запомнить?</h3><p>Темы к экзамену, главы книги, язык, программирование. Выпиши по одной в строке, а Тень будет возвращать их, пока они не забылись, и покажет, что уже тускнеет.</p><button class="btn btn-primary" data-act="topics-add">${ic('plus')}Добавить темы</button><br><button class="link" data-act="demo">Показать пример</button></div>`;
  const pl = memPlan(), f = pl.fade.length, n = pl.fresh.length;
  let h = pl.queue.length
    ? `<div class="panel memtop"><div class="grow"><b>Сегодня: ${pl.queue.length} ${D.plural(pl.queue.length, ['карточка', 'карточки', 'карточек'])}</b><small>${[f ? `тускнеет ${f}` : '', n ? `новых ${n}` : '', `около ${pl.mins} мин`].filter(Boolean).join(' · ')}</small></div><button class="btn btn-primary" data-act="mem-go">Освежить</button></div>`
    : `<div class="panel memtop"><div class="grow"><b>На сегодня всё свежо</b><small>${Mem.nextFade(memSubs()) ? 'Следующее освежение ' + whenTs(Mem.nextFade(memSubs())) : 'Повторять пока нечего'}</small></div></div>`;
  const both = subs.some(x => x.area === 'uni') && subs.some(x => x.area === 'self');
  let lastArea = '';
  h += subs.map(s => {
    const st = Mem.stats(s), tone = st.exam === null ? '' : st.exam < 0.5 ? 'bad' : st.exam < 0.75 ? 'gold' : 'good';
    const parts = [st.fade ? `тускнеет ${st.fade}` : '', st.fresh ? `не начато ${st.fresh}` : ''].filter(Boolean).join(' · ') || 'Всё свежо';
    const head = both && s.area !== lastArea ? `<div class="sec-head" style="margin:${lastArea ? 22 : 4}px 0 -4px"><h2 class="h2">${s.area === 'uni' ? 'Учёба' : 'Для себя'}</h2></div>` : ''; lastArea = s.area;
    return head + `<section class="panel subj"><div class="sj-h"><div class="grow"><b>${esc(s.name)}</b><small>${examLabel(s, st)}</small></div><button class="icon-btn sm" data-act="subj-edit" data-k="${esc(s.key)}" aria-label="Изменить">${ic('more')}</button></div>
      <div class="mn"><div><b class="mn-v">${pc(st.now)}</b><span class="mn-l">свежесть сейчас</span></div>${st.exam !== null ? `<div class="${tone}"><b>${pc(st.exam)}</b><span>${s.area === 'self' ? 'к цели без повторов' : 'к экзамену без повторов'}</span></div>` : `<div><b>${st.n - st.fresh}/${st.n}</b><span>тем начато</span></div>`}</div>
      <div class="mstrip" aria-hidden="true">${s.topics.map(x => `<i class="mc l${Mem.level(Mem.rec(x.mem))}${ui.flash && ui.flash.has(x.id) ? ' fl' : ''}"></i>`).join('')}</div>
      ${st.fresh < st.n ? `<div class="tm"><input class="tmr" type="range" min="0" max="${s.due && !st.past ? Math.max(1, Math.min(60, D.diffDays(today(), s.due))) : 14}" step="1" value="0" data-k="${esc(s.key)}" aria-label="Перемотка времени: что останется в памяти, если не повторять"><span class="tml">сейчас</span></div>` : ''}
      <p class="sub" style="margin-top:10px">${parts}</p>
      <details class="more"${subs.length === 1 ? ' open' : ''}><summary>Темы · ${s.topics.length}<span>${ic('chev')}</span></summary><div class="trows">${s.topics.map(x => swipeRow(topicRow(x), x.id)).join('')}</div></details></section>`;
  }).join('');
  return h + `<div style="margin-top:14px"><button class="btn-add" data-act="topics-add">${ic('plus')}Добавить темы</button></div><p class="hnote">Яркая клетка — тема свежа в памяти, тусклая — скоро забудется. Свежесть считается по твоим оценкам и кривой забывания.</p>`;
}

/** Строки → темы: убираем номера и маркеры, повторы и мусор. «вопрос | ответ» даёт карточку с ответом. */
function parseTopics(text, have = []) {
  const seen = new Set(have.map(skey)), out = [];
  for (let line of String(text || '').split(/\r?\n/)) {
    line = line.replace(/^\s*(?:[-–—•*·▪]+|\d+(?:\.\d+)*[.)]?|[a-zа-я]\))\s+/i, '');
    const bar = line.indexOf('|'); let key = '';
    if (bar > 0) { key = line.slice(bar + 1).replace(/\s+/g, ' ').trim().slice(0, 300); line = line.slice(0, bar); }
    line = line.replace(/\s+/g, ' ').trim();
    if (line.length < 2 || seen.has(skey(line))) continue;
    seen.add(skey(line)); out.push({ title: line.slice(0, 120), key });
  }
  return out.slice(0, 100);
}
const AREA = {
  uni: { head: 'Колледж или университет: экзамен или зачёт в конкретный день.', dl: 'Экзамен или зачёт', ph: 'Например: Математический анализ', tx: '1. Пределы\n2. Производная\n3. Интеграл' },
  self: { head: 'Язык, программирование, книга, навык: всё, что хочешь освоить и не забыть.', dl: 'К какому дню освоить (необязательно)', ph: 'Например: Python или Английский для работы', tx: 'Списки и срезы\nСловари\nСлово | перевод' },
};
function openTopics(key) {
  const sub = key ? memSubs().find(s => s.key === key) : null, names = [...new Set(memSubs().map(s => s.name))];
  let area = sub ? sub.area : (memSubs().length && !memSubs().some(x => x.area === 'uni') ? 'self' : 'uni');
  let pace = sub ? sub.pace : Mem.PACE;
  const s = openSheet({
    eyebrow: 'Память', title: sub ? esc(sub.name) : 'Что учить',
    body: `<div class="seg full" id="tar"><button data-a="uni">Учёба</button><button data-a="self">Для себя</button></div><p class="sub" id="tarh" style="margin:8px 0 0;font-size:12.5px"></p>
    <div class="lbl">Название</div><input class="field" id="tsub" list="tsl" value="${esc(sub ? (sub.topics[0].subject || '').trim() : '')}" autocomplete="off"><datalist id="tsl">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="lbl" id="tdl"></div><input class="field" type="date" id="tdue" value="${sub?.due || ''}" aria-label="Срок">
    <p class="sub" style="font-size:12.5px;margin-top:6px" id="tdh"></p>
    <div id="tpw"><div class="lbl">Новых тем в день</div><div class="seg full" id="tpace">${[1, 2, 3, 5].map(n => `<button data-p="${n}">${n}</button>`).join('')}</div></div>
    <div class="lbl">${sub ? 'Добавить' : 'Что именно'} · по одной строке</div><textarea class="field" id="ttx" rows="7"></textarea>
    <p class="sub" style="font-size:12.5px" id="tcnt"></p>`,
    foot: `<button class="btn btn-primary btn-lg btn-block" id="tsave">Сохранить</button>${sub ? `<button class="btn btn-sm btn-danger" data-act="subj-del" data-k="${esc(sub.key)}">${ic('trash')}Удалить</button>` : ''}`,
  });
  const q = sel => s.querySelector(sel), have = () => (sub || memSubs().find(x => x.key === skey(q('#tsub').value)))?.topics.map(x => x.title) || [];
  const HINT = 'Можно вставить список целиком: номера и маркеры уберутся сами. Чтобы проверять себя по ответу, пиши «вопрос | ответ».';
  function paint() {
    const A = AREA[area];
    s.querySelectorAll('#tar button').forEach(b => b.setAttribute('aria-pressed', b.dataset.a === area));
    s.querySelectorAll('#tpace button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.p === pace));
    q('#tarh').textContent = A.head; q('#tdl').textContent = A.dl; q('#tsub').placeholder = A.ph; q('#ttx').placeholder = A.tx;
    const due = q('#tdue').value;
    q('#tdh').textContent = due ? (area === 'self' ? 'Тень разложит темы до этого дня, а срок появится на горизонте.' : 'К этому дню Тень разложит повторение, а экзамен появится на горизонте.') : (area === 'self' ? 'Без даты Тень вводит новые темы в твоём темпе и вовремя возвращает старые.' : 'Без даты Тень вводит по две новые темы в день.');
    q('#tpw').style.display = !due ? '' : 'none';
    const n = parseTopics(q('#ttx').value, have()).length;
    q('#tcnt').textContent = n ? `Будет добавлено: ${nTopics(n)}` : HINT;
  }
  s.addEventListener('click', e => {
    const a = e.target.closest('#tar button'); if (a) { area = a.dataset.a; paint(); return; }
    const pb = e.target.closest('#tpace button'); if (pb) { pace = +pb.dataset.p; paint(); }
  });
  q('#ttx').addEventListener('input', paint); q('#tdue').addEventListener('change', paint); q('#tsub').addEventListener('input', paint);
  q('#tsave').addEventListener('click', () => {
    const name = q('#tsub').value.trim(), due = q('#tdue').value || null, items = parseTopics(q('#ttx').value, have());
    if (!name) { toast('Напиши название'); return; }
    const old = sub || memSubs().find(x => x.key === skey(name));
    if (!sub && !items.length && !old) { toast('Добавь хотя бы одну тему'); return; }
    if (old && (old.name !== name || (old.due || null) !== due || old.area !== area || old.pace !== pace)) St.editSubject(old.name, name, due, { area, pace });
    if (items.length) St.addMany(items.map(t => ({ kind: 'topic', title: t.title, subject: name, due, area, pace, mem: null, key: t.key, source: 'manual' })));
    if (due) St.ensureExam(name, due, area);
    sfx('add'); closeSheet(); ui.enter = false;
    if (ui.view !== 'memory') go('memory', null, true); else render();
    toast(items.length ? `Добавлено: ${nTopics(items.length)}` : 'Сохранено');
  });
  paint();
  if (!sub) setTimeout(() => q('#tsub').focus(), 380);
}
function openTopic(id) {
  const x = St.get_(id); if (!x || x.kind !== 'topic') return;
  const r = Mem.rec(x.mem), due = Mem.dueAt(x.mem);
  const status = r === null ? 'Ещё не повторялась. Проверь себя: расскажи вслух, не подглядывая.' : `Свежесть ${pc(r)}. ${r < Mem.FADE_AT ? 'Пора освежить.' : 'Следующее освежение ' + whenTs(due) + '.'}`;
  const hist = ((x.mem && x.mem.h) || []).map(([ts, g]) => `<i class="hd g${g}" title="${esc(D.fmtShort(D.iso(new Date(ts))))}: ${Mem.GRADES[g][0]}"></i>`).join('');
  openSheet({
    eyebrow: esc(x.subject || 'Тема'), title: esc(x.title),
    body: `<p class="sub" style="margin:0">${status}</p>${hist ? `<div class="hist" aria-label="Оценки последних повторов">${hist}</div>` : ''}
    <div class="lbl">Ответ или главное: по чему проверить себя</div><textarea class="field" id="tkey" rows="4" placeholder="Например: определение и пример. Для слова: перевод. Покажется после твоего ответа.">${esc(x.key || '')}</textarea>`,
    foot: `<button class="btn btn-primary" data-act="topic-check" data-id="${x.id}">Проверить себя</button><button class="btn btn-ghost" data-act="topic-save" data-id="${x.id}">Сохранить</button><button class="btn btn-sm btn-danger" data-act="del" data-id="${x.id}">${ic('trash')}Удалить</button>`,
  });
}

/* проверка себя: карточки одна за другой, оценка честная и в один тап */
let rv = null;
const readiness = () => Object.fromEntries(memSubs().map(s => { const st = Mem.stats(s); return [s.key, { name: s.name, v: st.exam ?? st.now, exam: st.exam !== null }]; }));
function startReview(ids) {
  const list = ids.filter(id => St.get_(id));
  if (!list.length) { toast('Повторять пока нечего'); return; }
  rv = { q: list, i: 0, t0: Date.now(), show: false, res: [], before: readiness() };
  openSheet({ cls: 'rev', title: '…', body: '', foot: ' ', onOpen: () => paintReview() });
}
/** Цифры «было → стало» не прыгают, а досчитываются. */
function countUp(root) {
  if (calm()) return;
  root.querySelectorAll('b[data-to]').forEach(b => {
    const f = +b.dataset.from, t = +b.dataset.to, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(f + (t - f) * e) + '%'; if (k < 1) requestAnimationFrame(step); };
    b.textContent = f + '%'; requestAnimationFrame(step);
  });
}
function paintReview() {
  const sh = sheetEl(); if (!sh || !rv) return;
  const body = sh.querySelector('.sheet-body'), foot = sh.querySelector('.sheet-foot'), h2 = sh.querySelector('h2');
  const setHead = (e, t) => { let el = sh.querySelector('.eyebrow'); if (!el) { el = document.createElement('div'); el.className = 'eyebrow'; h2.before(el); } el.textContent = e; h2.textContent = t; };
  if (rv.i >= rv.q.length) {
    const after = readiness(), n = rv.res.length, c = [0, 0, 0]; rv.res.forEach(r => { c[r.g]++; });
    const lines = Object.entries(after).filter(([k]) => rv.res.some(r => skey(St.get_(r.id)?.subject) === k)).map(([k, a]) => { const b = rv.before[k]; return `<div class="snap"><div><b>${esc(a.name)}</b><small>${a.exam ? 'готовность к экзамену' : 'свежесть сейчас'}</small></div><span class="rv-d">${pc(b ? b.v : 0)} → <b data-from="${Math.round((b ? b.v : 0) * 100)}" data-to="${Math.round(a.v * 100)}">${pc(a.v)}</b></span></div>`; }).join('');
    const left = memPlan().queue.length, nf = Mem.nextFade(memSubs());
    setHead('Готово', `Освежено: ${n}`);
    body.innerHTML = `<div class="rv-card"><div class="chips" style="margin-bottom:8px"><span class="chip ok">Уверенно ${c[2]}</span><span class="chip warn">С трудом ${c[1]}</span><span class="chip hot">Не вспомнил ${c[0]}</span></div>${lines}<p class="sub">${left ? `В плане на сегодня ещё ${left}.` : nf ? `Следующее освежение ${whenTs(nf)}.` : 'На сегодня всё.'}</p></div>`;
    countUp(body);
    foot.innerHTML = `${left ? `<button class="btn btn-ghost" data-act="mem-more">Ещё ${Math.min(left, 10)}</button>` : ''}<button class="btn btn-primary" data-act="close">Закрыть</button>`;
    return;
  }
  const x = St.get_(rv.q[rv.i]); if (!x) { rv.i++; return paintReview(); }
  setHead(`${x.subject || 'Тема'} · ${rv.i + 1} из ${rv.q.length}`, x.title);
  body.innerHTML = `<div class="rv-card"><p class="rv-q">Расскажи вслух или набросай по памяти, как будто объясняешь новичку. Без подсказок.</p>
    ${x.key ? (rv.show ? `<div class="rv-key"><span class="lbl" style="margin-top:0">Ответ</span>${esc(x.key)}</div>` : `<button class="btn btn-ghost btn-sm" data-act="rv-key">Показать ответ</button>`) : ''}
    <div class="rv-dots" aria-hidden="true">${rv.q.map((_, k) => `<i class="${k < rv.i ? 'd g' + (rv.res[k] ? rv.res[k].g : 1) : k === rv.i ? 'c' : ''}${k === rv.i - 1 && rv.pop ? ' pop' : ''}"></i>`).join('')}</div></div>`;
  foot.innerHTML = Mem.GRADES.map(([l, g]) => `<button class="btn ${g === 2 ? 'btn-primary' : g === 0 ? 'btn-ghost' : ''}" data-act="rv-g" data-g="${g}">${l}</button>`).join('');
}

/* ───────── «Ещё» ───────── */
const mrow = (ico, t, s, act, extra = '') => `<button class="mrow" data-act="${act}" ${extra}>${ic(ico)}<span class="grow"><b>${t}</b><small>${s}</small></span>${ic('chev', 'chev')}</button>`;
function vMore() {
  if (ui.sub === 'look') return backHead('Оформление') + settingsHTML();
  if (ui.sub === 'data') return vData();
  if (ui.sub === 'ai') return vAI();
  if (ui.sub === 'account') return vAccount();
  if (ui.sub === 'about') return vAbout();
  return pageHead('Разделы и настройки', 'Ещё', '') + `<div class="panel mlist">${mrow('shield', 'Аккаунт', accSummary(), 'sub', 'data-s="account"')}${mrow('spark', 'ИИ-помощник', AI.ready() ? 'Подключён · ' + esc(AI.cur().model) : 'Подключить умного помощника', 'sub', 'data-s="ai"')}${mrow('theme', 'Оформление', `${THEMES[themeId()].name}, звуки`, 'sub', 'data-s="look"')}${mrow('db', 'Данные', 'Копии, перенос, календарь', 'sub', 'data-s="data"')}${mrow('info', 'О приложении', 'Установка и что нового', 'sub', 'data-s="about"')}</div>`;
}

/* ───────── аккаунт и синхронизация ───────── */
const hhmm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function syncLine() {
  const st = Auth.status, m = St.meta();
  if (st.state === 'sync') return 'Синхронизация…';
  if (st.state === 'offline') return m.dirty ? 'Нет сети. Изменения уйдут в облако, когда она появится' : 'Нет сети';
  if (st.state === 'err') return 'Не получилось синхронизировать';
  const at = st.at || m.syncedAt;
  return at ? `Синхронизировано в ${hhmm(at)}${m.dirty ? ' · есть неотправленное' : ''}` : 'Ждёт первой синхронизации';
}
const accSummary = () => { const a = Auth.acc(); return a ? `${esc(a.email)} · ${syncLine().toLowerCase()}` : 'Не выполнен вход'; };
function vAccount() {
  const a = Auth.acc(), st = Auth.status;
  return `${backHead('Аккаунт')}<div class="panel"><div class="h2">Почта</div><div style="font-size:16px;font-weight:600;margin-top:6px;word-break:break-all">${esc(a ? a.email : '')}</div><p class="sub" style="margin-top:10px">${syncLine()}</p>${st.state === 'err' && st.err ? `<p class="acc-err" style="margin-top:8px">${esc(st.err)}</p>` : ''}</div>
  <div class="panel mlist" style="margin-top:12px">${mrow('upload', 'Синхронизировать сейчас', 'Дела и темы уйдут в облако, чужие изменения придут', 'sync')}${mrow('db', 'Что лежит в облаке', 'Проверить, сколько дел и тем там уже есть', 'cloud-check')}${mrow('shield', 'Сменить пароль', 'Пришлём письмо со ссылкой', 'acc-pass')}${mrow('close', 'Выйти', 'Дела на этом телефоне останутся, но вход понадобится снова', 'acc-out')}</div>
  <p class="sub" style="font-size:12.5px;margin-top:14px">Один аккаунт на «Тень» и «Подход». Дела, темы и история повторов лежат в личном разделе аккаунта, партнёры «Подхода» их не видят. Тема, звуки и ключ ИИ остаются только на этом телефоне.</p>`;
}

const previewSvg = '<svg viewBox="0 0 160 92" aria-hidden="true"><circle cx="80" cy="46" r="15" class="ring"/><circle cx="80" cy="46" r="28" class="ring"/><circle cx="80" cy="46" r="42" class="ring"/><path d="M62 58L42 73" style="stroke:var(--bad)" stroke-width="3" stroke-linecap="round" opacity=".6"/><circle cx="62" cy="58" r="4.5" style="fill:var(--bad)"/><circle cx="98" cy="34" r="4" style="fill:var(--gold)"/><circle cx="112" cy="58" r="3.6" style="fill:var(--ink)"/><circle cx="52" cy="22" r="3.6" style="fill:var(--steel)"/><circle cx="80" cy="46" r="2.6" style="fill:var(--ink)"/></svg>';
function settingsHTML() {
  const s = St.settings(), snd = s.snd || {};
  const card = id => { const T = THEMES[id], c = accOf(T.look, s), on = s.theme === id;
    return `<button class="tc" aria-pressed="${on}" data-act="theme" data-t="${id}"><div class="tp" data-look="${T.look}" data-theme="${T.mode}" style="--acc-l:${c[0]};--acc-d:${c[1]};--acc-ink-l:${c[2]};--acc-ink-d:${c[3]}">${previewSvg}<div class="bars"><i class="p"></i><i></i><i></i></div></div><div class="nm"><span>${T.name}</span>${on ? `<span class="okc">${ic('check')}</span>` : ''}</div><small>${T.desc}</small></button>`; };
  const tog = (k, t, d, on) => `<button class="mrow" data-act="tog" data-k="${k}" role="switch" aria-checked="${on}"><span class="grow"><b>${t}</b><small>${d}</small></span><span class="switch" aria-checked="${on}"></span></button>`;
  return `<div class="tg">${['mrak', 'noch', 'bumaga', 'pastel'].map(card).join('')}</div>
  <div class="panel mlist" style="margin-top:18px">${tog('snd', 'Звуки', 'Щелчок на каждую кнопку и ноты на панели', snd.on !== false)}${snd.on !== false ? `<div class="mrow"><span class="grow"><b>Громкость</b></span><div class="seg" role="group" aria-label="Громкость">${[[1, 'Тихо'], [2, 'Средне'], [3, 'Громко']].map(([v, l]) => `<button aria-pressed="${(snd.vol ?? 2) === v}" data-act="vol" data-v="${v}">${l}</button>`).join('')}</div></div>` : ''}${tog('calm', 'Тише анимации', 'Выключить всё движение', !!s.calm)}</div>
  <div class="lbl">Как к тебе обращаться</div><input class="field" id="sname" placeholder="Имя, по желанию" value="${esc(s.name || '')}" maxlength="24" autocomplete="off">`;
}
function refreshSettings() {
  applyAppearance();
  const sh = sheetEl();
  if (sh && sh.dataset.k === 'set') { const b = $('.sheet-body', sh); const y = b.scrollTop; b.innerHTML = settingsHTML(); b.scrollTop = y; ui.enter = false; render(); }
  else { ui.enter = false; render(); }
}

function vData() {
  const n = St.items().length, sn = St.snaps().length;
  return `${backHead('Данные')}<p class="sub" style="margin:-6px 0 14px">Дела лежат на телефоне и в облаке твоего аккаунта. Записей: ${n}. Копия файлом нужна как запасной вариант.</p>
  <div class="panel mlist">${mrow('download', 'Сохранить копию', 'Файл .json, можно перенести на другое устройство', 'export')}${mrow('upload', 'Загрузить копию', 'Добавит дела из файла, повторы пропустит', 'import')}${mrow('copy', 'Копии на телефоне', sn ? `Раз в день, сейчас их ${sn}` : 'Раз в день, пока их нет', 'snaps')}${mrow('today', 'Сроки в календарь', 'Файл .ics: откроется в Календаре и напомнит', 'ics-all')}${mrow('spark', 'Показать пример', 'Добавит тестовые дела, потом их можно удалить', 'demo')}${mrow('trash', 'Удалить всё', 'Очистит список на этом устройстве', 'wipe')}</div>
  <input type="file" id="file" accept="application/json,.json" hidden>`;
}
function vAbout() {
  return `${backHead('О приложении')}<div class="panel"><b>Тень</b> — планировщик, который показывает сроки на горизонте и не даёт хвостам копиться. Версия ${APP_VERSION}.</div>
  <div class="sec-head" style="margin-top:22px"><h2 class="h2">Установка на телефон</h2></div>
  <ol class="steps panel"><li><span><b>iPhone.</b> Открой сайт в Safari → «Поделиться» → «На экран Домой».</span></li><li><span><b>Android.</b> Меню Chrome → «Установить приложение».</span></li><li><span>Приложение откроется без адресной строки и будет работать без интернета.</span></li></ol>
  <div class="sec-head" style="margin-top:22px"><h2 class="h2">На чём это построено</h2></div>
  <div class="panel" style="font-size:14px;color:var(--ink-2);line-height:1.55"><p style="margin:0 0 10px">Тень не мотивирует и не считает очки. Она сверяет планы с реальностью.</p>
  <p style="margin:0 0 10px"><b style="color:var(--ink)">Проверка себя вместо перечитывания.</b> В обзоре Данлоски и соавторов (2013) самыми полезными приёмами оказались проверка по памяти и повторение с паузами, а перечитывание и маркер работают слабо.</p>
  <p style="margin:0 0 10px"><b style="color:var(--ink)">Сроки по твоей статистике.</b> Предупреждение об ошибке планирования её не лечит (Buehler и др., 1994). Помогает сравнение с тем, как было на самом деле.</p>
  <p style="margin:0"><b style="color:var(--ink)">Ожидание против факта.</b> Так делали иезуиты и кальвинисты в XVI веке, а Друкер назвал это анализом обратной связи: записал, что ждёшь, через время сверил.</p></div>
  <div class="panel" style="margin-top:12px;font-size:14px;color:var(--ink-2)"><b style="color:var(--ink)">Где данные.</b> На телефоне и в облаке твоего аккаунта: так iPhone и Android видят одни и те же дела. Без сети всё работает, изменения уйдут позже.</div>
  <div style="margin-top:14px"><button class="btn btn-ghost btn-block" data-act="news">Что нового</button></div>`;
}

function vAI() {
  const a = AI.cfg(), c = AI.cur(a), P = AI.PROVIDERS;
  const tog = (k, t, d) => `<button class="mrow" data-act="ai-sees" data-k="${k}" role="switch" aria-checked="${!!a.sees[k]}"><span class="grow"><b>${t}</b><small>${d}</small></span><span class="switch" aria-checked="${!!a.sees[k]}"></span></button>`;
  const models = ui.models[a.provider] || (c.model ? [c.model] : []);
  return `${backHead('ИИ-помощник')}<p class="sub" style="margin:-6px 0 6px">Свой бесплатный ключ: ничего не платишь, а ключ хранится только в этом браузере.</p>
  <div class="lbl">Провайдер</div><div class="pv">${Object.entries(P).map(([k, p]) => `<button class="pvc" aria-pressed="${a.provider === k}" data-act="ai-prov" data-p="${k}"><b>${p.name}</b><small>${p.hint}</small></button>`).join('')}</div>
  <div class="lbl">Ключ</div><input class="field" id="akey" type="password" autocomplete="off" spellcheck="false" placeholder="Вставь ключ API" value="${esc(c.key)}">
  ${a.provider === 'custom' ? `<input class="field" id="abase" style="margin-top:8px" placeholder="Адрес, например https://api.example.com/v1" value="${esc(a.base)}">` : ''}
  ${P[a.provider].keyUrl ? `<a class="link" style="display:inline-block;margin-top:10px;color:var(--ink-2);font-size:13.5px;text-decoration:underline;text-underline-offset:3px" href="${P[a.provider].keyUrl}" target="_blank" rel="noopener">Где взять ключ →</a>` : ''}
  <div class="lbl">Модель</div>${a.provider === 'custom' ? `<input class="field" id="amodel" placeholder="Название модели" value="${esc(c.model)}">` : `<div class="select"><select class="field" id="amodel">${models.length ? models.map(m => `<option ${m === c.model ? 'selected' : ''}>${esc(m)}</option>`).join('') : '<option value="">Сначала нажми «Проверить ключ»</option>'}</select></div>`}
  <div class="btn-row"><button class="btn btn-primary" data-act="ai-check" id="acheck">Проверить ключ</button></div><div id="astat" style="margin-top:10px;min-height:30px">${AI.ready() ? '<span class="chip ok">Подключён</span>' : ''}</div>
  <div class="lbl">Что видит помощник</div><div class="panel mlist">${tog('tasks', 'Дела, сроки и хвосты', 'Основа для ответов')}${tog('notes', 'Заметки', 'Идеи и мысли')}${tog('priv', 'Личное', 'Дела и заметки с пометкой «Личное»')}</div>
  <button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="ai-ctx">${ic('eye')}Показать, что уйдёт помощнику</button>
  <p class="sub" style="font-size:12.5px;margin-top:12px">Бесплатные тарифы провайдеров могут использовать запросы для улучшения моделей, поэтому личное по умолчанию не отправляется. Помощник только предлагает, подтверждаешь ты.</p>`;
}

function vMemoryPage() { const n = St.items().filter(x => x.kind === 'topic').length; return pageHead(n ? nTopics(n) : 'Что учить', 'Память', headActs('topics')) + vMemory(); }
const V = { today: vToday, horizon: vHorizon, memory: vMemoryPage, list: vList, more: vMore };
const TABS = [['today', 'Сегодня', 'today'], ['horizon', 'Горизонт', 'radar'], null, ['memory', 'Память', 'mem'], ['list', 'Дела', 'list']];
function buildTabs() {
  tabsEl.innerHTML = '<span class="tab-ind" id="tind"></span>' + TABS.map(t => t ? `<button class="tab" data-act="nav" data-to="${t[0]}" aria-label="${t[1]}">${ic(t[2])}<span>${t[1]}</span></button>` : `<button class="addb" data-act="add" aria-label="Добавить дело">${ic('plus')}</button>`).join('');
}
let indReady = false;
function moveInd() {
  const i = TABS.findIndex(t => t && t[0] === ui.view);
  tabsEl.style.setProperty('--ti', Math.max(0, i)); tabsEl.classList.toggle('noind', i < 0);
  $$('.tab', tabsEl).forEach(b => b.setAttribute('aria-current', b.dataset.to === ui.view ? 'page' : 'false'));
  if (!indReady) { indReady = true; requestAnimationFrame(() => $('#tind')?.classList.add('ready')); }
}
/** Радар: когда дело закрыто или перенесено, точки плавно переезжают, а ушедшая гаснет кольцом. */
function radarFx() {
  if (ui.view !== 'horizon') { ui.rpos = null; return; }
  const pts = layout(St.items(), today()), old = ui.rpos;
  ui.rpos = Object.fromEntries(pts.map(p => [p.it.id, { x: p.x, y: p.y, tail: p.tail }]));
  const svg = $('#radar svg'); if (!old || !svg || calm()) return;
  $$('#radar .blip[data-id]').forEach(g => { const o = old[g.dataset.id], n = ui.rpos[g.dataset.id]; if (o && n && Math.hypot(o.x - n.x, o.y - n.y) > 0.5) g.animate([{ transform: `translate(${o.x - n.x}px,${o.y - n.y}px)` }, { transform: 'translate(0,0)' }], { duration: 750, easing: 'cubic-bezier(.2,.8,.2,1)' }); });
  Object.entries(old).forEach(([id, o]) => {
    if (ui.rpos[id]) return;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', o.x); c.setAttribute('cy', o.y); c.setAttribute('r', 6); c.setAttribute('class', 'gone'); c.style.stroke = o.tail ? 'var(--bad)' : 'var(--ink)';
    svg.append(c);
    c.animate([{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(5)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = () => c.remove();
  });
}
function render() {
  applyAppearance();
  viewEl.className = 'main' + (ui.enter ? ' enter' : '');
  viewEl.innerHTML = V[ui.view]();
  ui.enter = false; moveInd(); radarFx();
}
function go(to, sub = null, quiet) { ui.view = to; ui.sub = sub; ui.enter = true; render(); window.scrollTo(0, 0); if (!quiet) sfx('tap'); }

/* ───────── добавить / изменить ───────── */
function openEditor(id) {
  const it = id ? St.get_(id) : null, t = today();
  const ed = { kind: it?.kind || 'task', text: it?.title || '', due: it?.due || null, time: it?.time || null, tDue: !!it, tTime: !!it, parsed: [] };
  const fri = D.addDays(t, (5 - D.dow(t) + 7) % 7 || 7);
  const s = openSheet({
    eyebrow: it ? 'Правка' : 'Быстрый ввод', title: it ? (it.kind === 'note' ? 'Заметка' : 'Изменить дело') : 'Что добавить?',
    body: `${it ? '' : `<div class="seg" id="ek"><button aria-pressed="true" data-k="task">Дело</button><button aria-pressed="false" data-k="note">Заметка</button><button aria-pressed="false" data-k="topics">Темы</button></div>`}
    <textarea class="field" id="et" rows="3" placeholder="Что в голове? Например: сдать лабу в пятницу в 18:00" style="margin-top:12px">${esc(ed.text)}</textarea>
    <div id="ep"></div>
    <div id="em"><div class="lbl">Срок</div><div class="chips" id="eq"></div><div class="row2" style="margin-top:10px"><input class="field" type="date" id="ed" aria-label="Дата"><input class="field" type="time" id="etm" aria-label="Время"></div>
    <details class="more"><summary>Ещё: предмет, оценка, первый шаг<span>${ic('chev')}</span></summary>
      <div class="lbl" style="margin-top:2px">Предмет</div><input class="field" id="esub" placeholder="Например: Комп. графика" value="${esc(it?.subject || '')}">
      <div class="lbl">Сколько часов работы</div><input class="field" id="eest" inputmode="decimal" placeholder="Например: 3 (нужно для цены откладывания)" value="${it?.est ?? ''}">
      <div class="lbl">Первый шаг</div><input class="field" id="estep" placeholder="Например: открыть проект и запустить сцену" value="${esc(it?.step || '')}">
      <div class="row2"><div><div class="lbl">Напомнить в календаре</div><div class="select"><select class="field" id="erem"><option value="">по умолчанию</option><option value="15">за 15 минут</option><option value="60">за час</option><option value="1440">за день</option></select></div></div></div>
      <button class="mrow" id="epriv" type="button" role="switch" aria-checked="${!!it?.priv}" style="padding:14px 0;margin-top:6px"><span class="grow"><b>Личное</b><small>Не показывать ИИ-помощнику</small></span><span class="switch" aria-checked="${!!it?.priv}"></span></button></details></div>`,
    foot: `<button class="btn btn-primary btn-lg btn-block" id="esave">${it ? 'Сохранить' : 'Добавить'}</button>`,
    onOpen: sh => { sh.querySelector('#erem').value = it?.remind ? String(it.remind) : ''; },
  });
  const q = sel => s.querySelector(sel);
  const quick = [['Сегодня', t], ['Завтра', D.addDays(t, 1)], [D.fmtShort(fri), fri]];
  function compute() {
    ed.text = q('#et').value;
    if (it) ed.parsed = ed.text.trim() ? [{ title: ed.text.trim(), due: null, time: null }] : [];
    else if (ed.kind === 'note') ed.parsed = ed.text.trim() ? [{ title: ed.text.trim(), due: null, time: null, kind: 'note' }] : [];
    else ed.parsed = D.splitThoughts(ed.text).map(c => D.parseQuick(c)).filter(p => p.title);
  }
  const dueChip = x => x.due ? `<span class="chip ${x.due < t ? 'hot' : 'warn'}">${ic('today')}${esc(D.fmtDay(x.due))}</span>` : '<span class="chip">Без срока</span>';
  function paint() {
    const P = ed.parsed, single = P.length <= 1, p = P[0];
    const dueV = single ? (ed.tDue ? ed.due : p?.due ?? null) : null, timeV = single ? (ed.tTime ? ed.time : p?.time ?? null) : null;
    const isNote = (it ? it.kind : ed.kind) === 'note' || p?.kind === 'note';
    q('#em').style.display = single && !isNote && (P.length || it) ? '' : 'none';
    if (single) {
      q('#ep').innerHTML = !p ? `<div class="sub" style="margin-top:10px">Пиши по-человечески: «позвонить маме завтра в 18:00». Несколько дел можно писать через запятую или с новой строки.</div>`
        : `<div class="chips" style="margin-top:10px">${isNote ? '<span class="chip">Заметка без срока</span>' : dueChip({ due: dueV })}${timeV ? `<span class="chip warn">${ic('clock')}${timeV}</span>` : ''}${p.tail ? '<span class="chip hot">Хвост</span>' : ''}${p.approx && !ed.tDue ? '<span class="chip">≈ уточни день</span>' : ''}${dueV && !isNote ? `<span class="chip ok">${D.rel(dueV, t)}</span>` : ''}</div>`;
    } else {
      q('#ep').innerHTML = `<div class="lbl">Найдено: ${P.length}</div>` + P.map((x, i) => `<div class="pcard"><div><b>${esc(x.title)}</b><div class="chips">${dueChip(x)}${x.time ? `<span class="chip warn">${ic('clock')}${x.time}</span>` : ''}${x.tail ? '<span class="chip hot">Хвост</span>' : ''}${x.kind === 'note' ? '<span class="chip">Заметка</span>' : ''}</div></div><button class="x" data-rm="${i}" aria-label="Убрать">${ic('close')}</button></div>`).join('');
    }
    q('#eq').innerHTML = quick.map(([l, v]) => `<button class="chip" aria-pressed="${dueV === v}" data-q="${v}">${l}</button>`).join('');
    q('#ed').value = dueV || ''; q('#etm').value = timeV || '';
    q('#esave').textContent = it ? 'Сохранить' : P.length > 1 ? `Добавить ${P.length}` : 'Добавить';
  }
  const refresh = () => { compute(); paint(); };
  q('#et').addEventListener('input', refresh);
  s.addEventListener('click', e => {
    const pv = e.target.closest('#epriv'); if (pv) { const on = pv.getAttribute('aria-checked') !== 'true'; pv.setAttribute('aria-checked', on); pv.querySelector('.switch').setAttribute('aria-checked', on); sfx('toggle', on ? 1 : 0); return; }
    const k = e.target.closest('#ek button'); if (k && k.dataset.k === 'topics') { closeSheet(true); openTopics(); return; }
    if (k) { ed.kind = k.dataset.k; s.querySelectorAll('#ek button').forEach(b => b.setAttribute('aria-pressed', b === k)); refresh(); return; }
    const qq = e.target.closest('#eq button'); if (qq) { const v = qq.dataset.q; ed.tDue = true; ed.due = (ed.due === v && q('#ed').value === v) ? null : v; q('#ed').value = ed.due || ''; paint(); sfx('tap'); return; }
    const rm = e.target.closest('[data-rm]'); if (rm) { const ch = D.splitThoughts(q('#et').value); ch.splice(+rm.dataset.rm, 1); q('#et').value = ch.join('\n'); refresh(); }
  });
  q('#ed').addEventListener('change', e => { ed.tDue = true; ed.due = e.target.value || null; paint(); });
  q('#etm').addEventListener('change', e => { ed.tTime = true; ed.time = e.target.value || null; paint(); });
  q('#esave').addEventListener('click', () => {
    compute();
    if (!ed.parsed.length) { toast('Напиши, что нужно сделать'); return; }
    const P = ed.parsed, single = P.length === 1, p = P[0];
    if (it || single) {
      const dueV = ed.tDue ? ed.due : p.due ?? null, timeV = ed.tTime ? ed.time : p.time ?? null;
      const kind = it ? it.kind : (ed.kind === 'note' || p.kind === 'note') ? 'note' : 'task';
      const data = { title: p.title, kind, due: kind === 'note' ? null : dueV, time: kind === 'note' ? null : (dueV ? timeV : null), subject: q('#esub').value.trim(), est: num(q('#eest').value), step: q('#estep').value.trim(), remind: num(q('#erem').value), priv: q('#epriv').getAttribute('aria-checked') === 'true' };
      const r = it ? St.updateItem(it.id, data) : St.addItem(data);
      if (r.kind === 'task' && r.due) ui.sel = r.id;
      toast(it ? 'Сохранено' : r.due && r.kind === 'task' ? `Добавлено · встанет на горизонте ${D.rel(r.due)}` : 'Добавлено');
    } else {
      P.forEach(x => St.addItem({ title: x.title, due: x.due, time: x.due ? x.time : null, kind: x.kind === 'note' ? 'note' : 'task' }));
      toast(`Добавлено: ${P.length}`);
    }
    sfx('add'); closeSheet(); render();
  });
  refresh();
  if (!it) setTimeout(() => q('#et').focus(), 380);
}

/* ───────── детали дела ───────── */
function openDetail(id) {
  const it = St.get_(id); if (!it) return;
  const t = today(), tail = St.isTail(it, t), dd = St.daysTo(it, t), rows = St.costRows(it, t);
  let b = '';
  if (it.kind === 'task') b += `<p class="sub" style="margin:0">${it.due ? `${esc(when(it))} · ${tail ? `<span class="hotc">просрочено на ${D.days(-dd)}</span>` : D.rel(it.due, t)}` : 'Без срока'}${it.est ? ` · около ${D.fmtHours(it.est)}` : ''}</p>`;
  if (it.kind === 'task' && !it.done && it.step) b += `<p class="sub">Шаг: ${esc(it.step)}</p>`;
  if (rows) b += `<div class="lbl">Цена откладывания</div><div class="panel" style="padding:10px 14px 6px">${rows.map((r, i) => { const c = r.perDay <= 2 ? 'good' : r.perDay <= 5 ? 'gold' : 'bad'; const pct = Math.max(6, Math.min(100, r.perDay / it.est * 100)); return `<div class="cb ${i === 0 ? 'on' : ''}"><span class="l">${r.label}</span><span class="tr"><i style="width:${pct}%;background:var(--${c})"></i></span><span class="v">${D.fmtHours(r.perDay)}</span></div>`; }).join('')}<p class="sub" style="font-size:12.5px;margin:2px 0 6px">Нагрузка в день до сдачи</p></div>`;
  openSheet({
    eyebrow: esc(it.kind === 'note' ? 'Заметка' : it.subject || (tail ? 'Хвост' : 'Дело')), title: esc(it.title), body: b,
    foot: `<button class="btn ${it.done ? 'btn-ghost' : 'btn-primary'}" data-act="done" data-id="${it.id}">${it.done ? 'Вернуть в дела' : 'Готово'}</button><button class="btn btn-ghost" data-act="edit" data-id="${it.id}">Изменить</button>${it.due ? `<button class="btn btn-sm btn-ghost" data-act="ics" data-id="${it.id}">${ic('today')}В календарь</button>` : ''}<button class="btn btn-sm btn-danger" data-act="del" data-id="${it.id}">${ic('trash')}Удалить</button>`,
  });
}

/* ───────── ИИ-помощник ───────── */
let chat = [];
function paintChat() {
  const el = $('#chat'); if (!el) return;
  el.innerHTML = chat.map((x, i) => x.role === 'user' ? `<div class="msg me">${esc(x.text)}</div>`
    : x.loading ? `<div class="msg bot"><span class="dots"><i></i><i></i><i></i></span></div>`
      : `<div class="msg bot ${x.err ? 'err' : ''}">${esc(x.text)}${x.actions?.length && !x.applied ? `<div class="acts">${x.actions.map(a => { const d = AI.describe(a); return `<div class="a"><b>${d.sign}</b><span>${esc(d.text)}</span></div>`; }).join('')}<div class="btn-row"><button class="btn btn-primary btn-sm" data-act="ai-apply" data-i="${i}">Применить · ${x.actions.length}</button><button class="btn btn-ghost btn-sm" data-act="ai-skip" data-i="${i}">Не надо</button></div></div>` : ''}${x.applied ? `<div class="acts"><span class="chip ok">${esc(x.applied)}</span></div>` : ''}</div>`).join('');
  el.scrollTop = el.scrollHeight;
  const sg = $('#sugs'); if (sg) {
    const sel = St.get_(ui.sel), q = ['Что делать вечером?', 'Что я забыл?', 'С чего начать?'];
    if (sel && sel.kind === 'task') q.unshift(`Разбей «${sel.title.length > 22 ? sel.title.slice(0, 21) + '…' : sel.title}» на шаги`);
    sg.innerHTML = chat.length ? '' : q.map(t => `<button class="chip" data-act="ai-sug" data-q="${esc(t)}">${esc(t)}</button>`).join('');
  }
}
async function ask(text) {
  text = String(text || '').trim(); if (!text) return;
  const hist = chat.filter(m => !m.loading && !m.err).map(m => ({ role: m.role, text: m.text }));
  chat.push({ role: 'user', text }); const bot = { role: 'bot', loading: true }; chat.push(bot);
  const q = $('#aq'); if (q) q.value = ''; paintChat();
  try { const r = await AI.chat(hist, text); Object.assign(bot, { loading: false, text: r.reply, actions: r.actions }); }
  catch (e) { Object.assign(bot, { loading: false, err: true, text: AI.friendly(e) }); }
  paintChat();
}
function openCtx() {
  const j = JSON.stringify(AI.snapshot(), null, 1), cut = j.length > 7000 ? j.slice(0, 7000) + '\n…' : j;
  openSheet({ eyebrow: 'Прозрачность', title: 'Что уходит помощнику', body: `<p class="sub" style="margin:0 0 10px">Это целиком то, что приложение добавляет к каждому вопросу. Переписки и ключа здесь нет. Что показывать, решаешь в «Ещё → ИИ-помощник».</p><pre class="ctxpre">${esc(cut)}</pre>`, foot: '<button class="btn btn-primary btn-block" data-act="close">Понятно</button>' });
}
function openAI() {
  if (!AI.ready()) return openSheet({ eyebrow: 'Помощник', title: 'Спросить ИИ', body: `<p class="sub" style="margin:0;line-height:1.55">Помощник видит твои дела, хвосты и горизонт, отвечает по ним и добавляет дела, когда ты попросишь. Нужен свой бесплатный ключ, это займёт пару минут.</p>`, foot: '<button class="btn btn-primary btn-lg btn-block" data-act="ai-setup">Подключить</button>' });
  if (!St.meta().aiOk) return openSheet({ eyebrow: 'Перед первым вопросом', title: 'Что увидит помощник', body: `<p class="sub" style="margin:0;line-height:1.55">С каждым вопросом приложение отправляет твоему провайдеру ИИ снимок: ${AI.cfg().sees.tasks ? 'дела, сроки и хвосты' : ''}${AI.cfg().sees.notes ? ', заметки' : ''}. Помощник отвечает по ним и может предложить изменения, но применяются они только после твоего подтверждения.</p><p class="sub" style="line-height:1.55">Бесплатные тарифы могут использовать запросы для улучшения моделей. Дела с пометкой «Личное» не отправляются.</p>`, foot: '<button class="btn btn-primary btn-lg" data-act="ai-agree">Согласен</button><button class="btn btn-ghost" data-act="ai-ctx">Что именно уйдёт</button>' });
  const c = AI.counts();
  openSheet({
    eyebrow: `<span class="ctxl" style="display:inline-flex">${ic('eye')}${nTasks(c.tasks)} · ${nTails(c.tails)} · ${c.notes} ${D.plural(c.notes, ['заметка', 'заметки', 'заметок'])}</span>`, title: 'Помощник', cls: 'tall',
    body: '<div class="chat" id="chat"></div><div class="sugs" id="sugs"></div>',
    foot: `<div class="askbar" style="flex:1 1 100%"><textarea class="field" id="aq" rows="1" placeholder="Спроси про свои дела…"></textarea><button class="send" data-act="ai-send" aria-label="Отправить">${ic('arrow')}</button></div>`,
    onOpen: () => paintChat(),
  });
}

/* ───────── «Что нового» и копии ───────── */
function openNews() {
  St.setMeta({ seen: APP_VERSION });
  openSheet({ eyebrow: `Версия ${APP_VERSION}`, title: 'Что нового', body: `<ol class="steps">
    <li><span><b>Память не только для колледжа.</b> Направление бывает «Учёба» (с экзаменом) или «Для себя»: язык, программирование, книга. Без даты Тень вводит новые темы в твоём темпе.</span></li>
    <li><span><b>Карточки «вопрос | ответ».</b> Для слов и терминов: ответ показывается только после твоей попытки вспомнить.</span></li>
    <li><span><b>Видно, что в облаке.</b> «Ещё → Аккаунт → Что лежит в облаке» читает облако заново и сверяет с телефоном: дела, темы, повторы.</span></li>
    <li><span><b>Готово без таймера.</b> У быстрого дела одна кнопка, таймер только у больших дел.</span></li></ol>`, foot: '<button class="btn btn-primary btn-lg btn-block" data-act="close">Понятно</button>' });
}
function openCloud(c) {
  const mine = { tasks: St.items().filter(x => x.kind === 'task').length, notes: St.items().filter(x => x.kind === 'note').length, topics: St.items().filter(x => x.kind === 'topic').length, reviews: St.items().filter(x => x.kind === 'topic').reduce((n, x) => n + (x.mem && x.mem.n ? x.mem.n : 0), 0) };
  const row = (l, a, b) => `<div class="snap"><div><b>${l}</b></div><span class="rv-d">в облаке <b>${a}</b> · здесь <b>${b}</b></span></div>`;
  let body;
  if (c.empty) body = '<p class="sub" style="margin:0">В облаке пока ничего нет. Нажми «Синхронизировать сейчас»: всё, что на этом телефоне, уйдёт туда.</p>';
  else if (c.bad) body = '<p class="sub" style="margin:0">Документ в облаке не читается. Нажми «Синхронизировать сейчас»: он перезапишется данными с этого телефона.</p>';
  else {
    const same = c.tasks === mine.tasks && c.notes === mine.notes && c.topics === mine.topics && c.reviews === mine.reviews;
    body = `<div class="chips" style="margin-bottom:6px">${same ? '<span class="chip ok">Совпадает с телефоном</span>' : St.meta().dirty ? '<span class="chip warn">На телефоне есть неотправленное</span>' : '<span class="chip warn">Отличается от телефона: синхронизируй</span>'}</div>
    ${row('Дела (и экзамены)', c.tasks, mine.tasks)}${row('Темы', c.topics, mine.topics)}${row('Повторов записано', c.reviews, mine.reviews)}${row('Заметки', c.notes, mine.notes)}
    <div class="snap"><div><b>Размер</b><small>лимит облака около ${Math.round(Auth.LIMIT / 1000)} КБ</small></div><span class="rv-d"><b>${Math.max(1, Math.round(c.bytes / 1000))} КБ</b></span></div>
    <div class="snap"><div><b>Последняя запись</b></div><span class="rv-d"><b>${c.t ? `${D.fmtShort(D.iso(new Date(c.t)))} ${hhmm(c.t)}` : '—'}</b></span></div>`;
  }
  openSheet({ eyebrow: 'Облако', title: 'Что в облаке', body: `${body}<p class="sub" style="font-size:12.5px;margin-top:12px">Это прямой запрос к облаку, а не память телефона. Тема, звуки и ключ ИИ в облако не уходят.</p>`, foot: '<button class="btn btn-primary btn-block" data-act="close">Понятно</button>' });
}
function openSnaps() {
  const list = St.snaps().slice().reverse();
  openSheet({
    eyebrow: 'Данные', title: 'Копии на телефоне',
    body: `<p class="sub" style="margin:0 0 8px">Приложение само сохраняет копию раз в день и держит последние семь. Перед возвратом текущее состояние тоже сохраняется.</p>${list.length ? list.map((x, i) => `<div class="snap"><div><b>${esc(D.fmtDay(x.d))}</b><small>${nTasks(x.n)}</small></div><button class="btn btn-sm" data-act="snap-restore" data-i="${St.snaps().length - 1 - i}">Вернуть</button></div>`).join('') : '<div class="empty" style="margin-top:12px"><p>Копий пока нет. Первая появится, когда в списке будут дела.</p></div>'}`,
    foot: '<button class="btn btn-ghost btn-block" data-act="snap-now">Сделать копию сейчас</button>',
  });
}

/* ───────── действия ───────── */
let lastDeleted = null;
function finishTask(id) {
  const it = St.get_(id); if (!it) return;
  const wasTail = St.isTail(it);
  St.toggleDone(id); buzz(12);
  if (it.done) sfx(wasTail ? 'tail' : 'done'); else sfx('toggle', 0);
  toast(it.done ? (wasTail ? 'Хвост закрыт' : 'Готово') : 'Возвращено в дела');
}
function swipeDelete(id) {
  const it = St.get_(id); if (!it) return;
  const row = $(`.swp[data-sw="${id}"]`);
  lastDeleted = { ...it }; sfx('del'); buzz(10);
  const done = () => { St.removeItem(id); render(); toast(`Удалено: ${it.title.length > 28 ? it.title.slice(0, 27) + '…' : it.title}`, { label: 'Вернуть', act: 'undo', id }); };
  if (row) { row.style.height = row.offsetHeight + 'px'; row.classList.add('out'); requestAnimationFrame(() => { row.style.height = '0px'; row.style.opacity = '0'; }); setTimeout(done, 260); } else done();
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
const H = {
  nav: el => { if (ui.view === el.dataset.to && !ui.sub) { window.scrollTo({ top: 0, behavior: 'smooth' }); sfx('tap'); return; } go(el.dataset.to); },
  add: () => openEditor(),
  edit: el => { closeSheet(true); openEditor(el.dataset.id); },
  open: el => { const it = St.get_(el.dataset.id); if (!it) return; closeOpenSwipes(); it.kind === 'note' ? openEditor(it.id) : openDetail(it.id); },
  close: () => { const ids = rv ? rv.res.map(r => r.id) : []; closeSheet(); if (rv) { rv = null; ui.enter = false; ui.flash = new Set(ids); render(); ui.flash = null; } },
  quick: () => go('more'),
  toggle: el => {
    const row = el.closest('.jr'), it = St.get_(el.dataset.id);
    if (row && it && !it.done) { row.classList.add('leaving'); el.classList.add('d'); setTimeout(() => { finishTask(el.dataset.id); render(); }, 320); }
    else { finishTask(el.dataset.id); render(); }
  },
  done: el => { closeSheet(); finishTask(el.dataset.id); render(); },
  del: el => { const it = St.get_(el.dataset.id); closeSheet(true); if (it) { lastDeleted = { ...it }; St.removeItem(it.id); render(); sfx('del'); toast(`Удалено: ${it.title.length > 28 ? it.title.slice(0, 27) + '…' : it.title}`, { label: 'Вернуть', act: 'undo', id: it.id }); } },
  swdel: el => swipeDelete(el.dataset.id),
  undo: () => { if (lastDeleted) { St.restoreItem(lastDeleted); lastDeleted = null; render(); sfx('add'); toast('Возвращено'); } },
  ics: el => { const it = St.get_(el.dataset.id); it && download(`${it.title}.ics`, St.icsFor([it]), 'text/calendar'); },
  'ics-all': () => { const l = St.items().filter(x => x.due && !x.done); l.length ? download('ten-сроки.ics', St.icsFor(l), 'text/calendar') : toast('Нет дел со сроками'); },
  selblip: el => { ui.sel = el.dataset.id; const pts = layout(St.items(), today()); $('#radar').innerHTML = radarHTML(pts, ui.sel); const sel = pts.find(p => p.it.id === ui.sel); const card = $('.sel-row'); if (sel && card) { card.dataset.id = sel.it.id; card.querySelector('b').textContent = sel.it.title; card.querySelector('.sub').textContent = `${when(sel.it)} · ${D.rel(sel.it.due, today())}`; } sfx('tap'); },
  filter: el => { ui.filter = el.dataset.f; if (ui.filter !== 'day') ui.day = null; ui.enter = false; render(); sfx('tap'); },
  day: el => { ui.day = el.dataset.d; ui.filter = 'day'; ui.lmode = 'list'; go('list'); },
  'mem-go': () => { const pl = memPlan(); startReview(pl.queue.slice(0, 10).map(q => q.x.id)); },
  'mem-more': () => startReview(memPlan().queue.slice(0, 10).map(q => q.x.id)),
  'mem-open': () => go('memory'),
  'topics-add': () => openTopics(),
  'subj-edit': el => openTopics(el.dataset.k),
  'subj-del': el => { const sub = memSubs().find(x => x.key === el.dataset.k); if (!sub || !confirm(`Удалить «${sub.name}» вместе с темами (${sub.topics.length})? Это исчезнет и на других телефонах.`)) return; St.removeSubject(sub.name); closeSheet(true); ui.enter = false; render(); toast('Предмет удалён'); },
  topic: el => { closeOpenSwipes(); openTopic(el.dataset.id); },
  'topic-save': el => { St.updateItem(el.dataset.id, { key: ($('#tkey')?.value || '').trim().slice(0, 600) }); closeSheet(); ui.enter = false; render(); toast('Сохранено'); },
  'topic-check': el => { const x = St.get_(el.dataset.id), k = ($('#tkey')?.value ?? '').trim().slice(0, 600); closeSheet(true); if (!x) return; if (k !== (x.key || '')) St.updateItem(x.id, { key: k }); startReview([x.id]); },
  'rv-key': () => { if (rv) { rv.show = true; rv.pop = false; sfx('open'); paintReview(); } },
  'rv-g': el => {
    if (!rv || rv.lock) return; const g = +el.dataset.g, id = rv.q[rv.i];
    const sec = Math.min(240, Math.max(8, (Date.now() - rv.t0) / 1000)), ms = St.settings().memSec || 90;
    St.setSettings({ memSec: Math.round(ms * 0.75 + sec * 0.25) });
    St.reviewTopic(id, g); rv.res.push({ id, g }); rv.i++; rv.show = false; rv.t0 = Date.now(); rv.pop = true; rv.lock = true;
    sfx(g === 2 ? 'done' : g === 1 ? 'chip' : 'tap'); buzz(8);
    const next = () => { if (!rv) return; rv.lock = false; paintReview(); if (rv.i >= rv.q.length) { ui.enter = false; render(); } };
    const card = $('.sheet .rv-card');
    if (card && !calm()) { card.classList.add('out'); setTimeout(next, 170); } else next();
  },
  lmode: el => { ui.lmode = el.dataset.m; ui.enter = false; render(); sfx('tap'); },
  hday: el => { sfx('tap'); openDay(el.dataset.d); },
  tails: () => { ui.filter = 'tails'; ui.lmode = 'list'; go('list'); },
  tomorrow: () => { ui.filter = 'all'; ui.lmode = 'list'; go('list'); },
  sub: el => { ui.sub = el.dataset.s || null; ui.enter = true; render(); window.scrollTo(0, 0); sfx('tap'); },
  theme: el => { St.setSettings({ theme: el.dataset.t, auto: false }); sfx('tap'); refreshSettings(); },
  vol: el => { St.setSettings({ snd: { ...(St.settings().snd || {}), vol: +el.dataset.v } }); syncSound(); sfx('press'); refreshSettings(); },
  tog: el => {
    const k = el.dataset.k, s = St.settings();
    if (k === 'snd') { const on = !(s.snd?.on !== false); St.setSettings({ snd: { ...(s.snd || {}), on } }); syncSound(); sfx('toggle', on ? 1 : 0); }
    else { St.setSettings({ [k]: !s[k] }); sfx('toggle', !s[k] ? 1 : 0); }
    refreshSettings();
  },
  demo: () => { if (St.items().length && !confirm('Добавить тестовые дела к твоим?')) return; St.loadDemo(); render(); toast('Пример добавлен. Удалить можно в «Данные».'); },
  export: () => { download(`ten-копия-${today()}.json`, St.exportJSON(), 'application/json'); St.setMeta({ lastExport: Date.now() }); render(); toast('Копия сохранена'); },
  import: () => $('#file')?.click(),
  snaps: () => openSnaps(),
  'snap-now': () => { St.snapNow(true); openSnaps(); toast('Копия сделана'); },
  'snap-restore': el => { if (!confirm('Вернуть дела на этот день? Текущее состояние тоже сохранится в копиях.')) return; if (St.snapRestore(+el.dataset.i)) { closeSheet(true); render(); toast('Дела возвращены'); } else toast('Не получилось вернуть копию'); },
  wipe: () => { if (confirm('Удалить все дела? Они исчезнут и из облака на всех ваших телефонах. Копии на телефоне останутся.')) { St.snapNow(true); St.clearAll(); render(); toast('Всё удалено'); } },
  news: () => openNews(),
  sync: async () => { toast('Синхронизирую…'); await Auth.syncNow(); toast(Auth.status.state === 'ok' ? 'Синхронизировано' : (Auth.status.err || 'Нет сети')); },
  'cloud-check': async () => { toast('Проверяю облако…'); try { openCloud(await Auth.cloudInfo()); } catch (e) { toast(e.code === 'net' ? 'Нет сети. Проверить облако пока нельзя' : F.errText(e)); } },
  'acc-pass': async () => { const a = Auth.acc(); if (!a) return; try { await Auth.resetMail(a.email); toast('Письмо отправлено'); } catch (e) { toast(F.errText(e)); } },
  'acc-out': () => { if (confirm('Выйти из аккаунта? Дела на телефоне останутся, но войти придётся заново.')) { Auth.signOut(); ensureGate(); } },
  ai: () => { sfx('tap'); openAI(); },
  'ai-agree': () => { St.setMeta({ aiOk: Date.now() }); openAI(); },
  'ai-ctx': () => openCtx(),
  'ai-setup': () => { closeSheet(true); ui.view = 'more'; ui.sub = 'ai'; ui.enter = true; render(); window.scrollTo(0, 0); },
  'ai-send': () => ask($('#aq')?.value),
  'ai-sug': el => ask(el.dataset.q),
  'ai-apply': el => { const m = chat[+el.dataset.i]; if (!m) return; const n = AI.apply(m.actions); m.applied = n ? `Готово: изменений ${n}` : 'Ничего не изменилось'; sfx('add'); render(); paintChat(); },
  'ai-skip': el => { const m = chat[+el.dataset.i]; if (m) { m.actions = []; paintChat(); } },
  'ai-prov': el => { St.setAI({ provider: el.dataset.p }); sfx('tap'); ui.enter = false; render(); },
  'ai-sees': el => { const k = el.dataset.k; St.setSees({ [k]: !AI.cfg().sees[k] }); sfx('toggle', !AI.cfg().sees[k] ? 0 : 1); ui.enter = false; render(); },
  'ai-check': async el => {
    const a = AI.cfg(), key = ($('#akey')?.value || '').trim(), st = $('#astat');
    St.setAI({ keys: { ...a.keys, [a.provider]: key }, ...(a.provider === 'custom' ? { base: ($('#abase')?.value || '').trim() } : {}) });
    if (!key) { st.innerHTML = '<span class="chip hot">Вставь ключ</span>'; return; }
    st.innerHTML = '<span class="chip">Проверяю…</span>'; el.disabled = true;
    try {
      const list = await AI.listModels(); ui.models[a.provider] = list;
      const cur = AI.cur().model; const m = cur && list.includes(cur) ? cur : AI.pickModel(list);
      St.setAI({ models: { ...AI.cfg().models, [a.provider]: m } });
      ui.enter = false; render(); $('#astat').innerHTML = `<span class="chip ok">Работает · моделей: ${list.length}</span>`;
    } catch (e) { st.innerHTML = `<span class="chip hot">${esc(AI.friendly(e))}</span>`; el.disabled = false; }
  },
};
document.addEventListener('click', e => { if (e.target.closest('.swp-fg') && Date.now() - (swLast || 0) < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = H[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); }
});
/* звук на любую кнопку: если действие само ничего не сыграло, играет общий щелчок */
const SND_SEL = 'button, summary, a[href], [role=button], [role=switch], .tab, .addb, .cdot';
function clickKind(el) {
  if (el.matches('[role=switch], .switch')) return ['toggle', el.getAttribute('aria-checked') === 'true' ? 1 : 0];
  if (el.matches('.btn-danger, [data-act=del], [data-act=swdel], [data-act=wipe], [data-act=acc-out]')) return ['del'];
  if (el.matches('[data-act=close], [aria-label="Назад"], [aria-label="Закрыть"], [data-act=sub][data-s=""]')) return ['close'];
  if (el.matches('.chip, .seg button, .cdot, .tc, .pvc, .wd, .hc, .fl button')) return ['chip'];
  if (el.matches('.btn-primary, .addb, .send, .btn-lg')) return ['press'];
  return ['tap'];
}
document.addEventListener('click', e => {
  const el = e.target.closest(SND_SEL); if (!el || el.disabled) return;
  if (el.matches('.tab') && el.closest('#tabs')) return;                       // у панели своя нота (линза)
  if (el.closest('.swp-fg') && Date.now() - swLast < 400) return;              // это было смахивание
  if (sinceLast() < 90) return;                                                // действие уже издало свой звук
  const [k, a] = clickKind(el); sfx(k, a);
});
document.addEventListener('change', e => {
  const id = e.target.id, a = AI.cfg();
  if (id === 'akey') { St.setAI({ keys: { ...a.keys, [a.provider]: e.target.value.trim() } }); return; }
  if (id === 'abase') { St.setAI({ base: e.target.value.trim() }); return; }
  if (id === 'amodel') { St.setAI({ models: { ...a.models, [a.provider]: e.target.value.trim() } }); return; }
  if (id === 'sname') { St.setSettings({ name: e.target.value.trim() }); return; }
  if (id !== 'file') return;
  const file = e.target.files[0]; if (!file) return;
  file.text().then(t => { try { const n = St.importJSON(t); render(); toast(`Загружено дел: ${n}`); } catch (err) { toast('Не получилось прочитать файл'); } });
});
document.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('tmr')) { rewind(e.target); return; } if (e.target.id === 'qs') { ui.q = e.target.value; const r = $('#lres'); if (r) r.innerHTML = listBody(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'aq') { e.preventDefault(); ask(e.target.value); return; }
  if (e.key === 'Escape') { closeSheet(); }
});

/* ───────── смахивание строки влево ───────── */
let sw = null, swLast = 0;
function closeSwipe(row) { const fg = $('.swp-fg', row); if (!fg) return; fg.style.transition = 'transform .25s var(--out)'; fg.style.transform = ''; row.style.setProperty('--e', 0); row.classList.remove('armed'); setTimeout(() => { row.classList.remove('on'); fg.style.transition = ''; }, 260); }
function closeOpenSwipes(except) { $$('.swp.on').forEach(r => { if (r !== except && !r.classList.contains('drag')) closeSwipe(r); }); }
viewEl.addEventListener('pointerdown', e => {
  const fg = e.target.closest('.swp-fg');
  if (!fg) { closeOpenSwipes(); return; }
  if (e.pointerType === 'mouse' && e.button > 0) return;
  const row = fg.parentElement; closeOpenSwipes(row);
  sw = { row, fg, x0: e.clientX, y0: e.clientY, id: e.pointerId, drag: false, base: row.classList.contains('on') ? 80 : 0, pulled: 0 };
});
viewEl.addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
  if (!sw.drag) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) { sw.drag = true; sw.row.classList.add('on', 'drag'); sw.fg.style.transition = ''; try { sw.fg.setPointerCapture(e.pointerId); } catch (err) { /* нет */ } }
    else { if (Math.abs(dy) > 10) sw = null; return; }
  }
  const p = Math.max(0, Math.min(190, sw.base - dx)); sw.pulled = p;
  sw.fg.style.transform = `translateX(${-p}px)`; sw.row.style.setProperty('--e', p);
  const armed = p > 110; if (armed !== sw.row.classList.contains('armed')) { sw.row.classList.toggle('armed', armed); if (armed) buzz(6); }
});
const swEnd = e => {
  if (!sw || e.pointerId !== sw.id) return;
  const s = sw; sw = null; if (!s.drag) return;
  swLast = Date.now(); s.row.classList.remove('drag');
  if (s.pulled > 110) swipeDelete(s.row.dataset.sw);
  else if (s.pulled > 50) { s.fg.style.transition = 'transform .25s var(--out)'; s.fg.style.transform = 'translateX(-80px)'; s.row.style.setProperty('--e', 80); }
  else closeSwipe(s.row);
};
viewEl.addEventListener('pointerup', swEnd); viewEl.addEventListener('pointercancel', swEnd);

/* ───────── стеклянная панель: прижми и води пальцем ───────── */
(() => {
  let st = null; const PAD = 4, N = 5;
  const geo = () => { const r = tabsEl.getBoundingClientRect(); return { l: r.left + PAD, w: (r.width - 2 * PAD) / N }; };
  const colAt = x => { const g = geo(); return Math.max(0, Math.min(N - 1, Math.floor((x - g.l) / g.w))); };
  const fracAt = x => { const g = geo(); return Math.max(0, Math.min(N - 1, (x - g.l) / g.w - .5)); };
  const live = col => { const t = TABS[col]; if (t && t[0] !== ui.view) { go(t[0], null, true); } };
  tabsEl.addEventListener('pointerdown', e => {
    if ((e.pointerType === 'mouse' && e.button > 0) || !e.target.closest('.tab') || sheetEl()) return;
    st = { id: e.pointerId, x0: e.clientX, moved: false, col: colAt(e.clientX) };
    try { tabsEl.setPointerCapture(e.pointerId); } catch (err) { /* нет */ }
    tabsEl.style.setProperty('--ti', fracAt(e.clientX)); tabsEl.classList.add('press'); buzz(4); sfx('lens', st.col);
  });
  tabsEl.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    if (!st.moved && Math.abs(e.clientX - st.x0) > 6) st.moved = true;
    tabsEl.style.setProperty('--ti', fracAt(e.clientX));
    const c = colAt(e.clientX); if (c !== st.col) { st.col = c; if (TABS[c]) { buzz(5); sfx('lens', c); live(c); } }
  });
  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null; tabsEl._sw = Date.now();
    if (e.type !== 'pointercancel') { const t = TABS[colAt(e.clientX)]; if (t && (!s.moved || t[0] !== ui.view)) { if (t[0] === ui.view && !ui.sub) window.scrollTo({ top: 0, behavior: 'smooth' }); else if (t[0] !== ui.view || ui.sub) go(t[0], null, true); } }
    tabsEl.classList.remove('press'); moveInd();
  };
  tabsEl.addEventListener('pointerup', end); tabsEl.addEventListener('pointercancel', end);
  tabsEl.addEventListener('contextmenu', e => { if (st) e.preventDefault(); });
  tabsEl.addEventListener('click', e => { if (tabsEl._sw && Date.now() - tabsEl._sw < 600 && e.detail > 0 && e.target.closest('.tab')) { e.stopPropagation(); e.preventDefault(); } }, true);
})();

/* ───────── смена суток, копии, запуск ───────── */
let lastDay = today();
const tick = () => { if (today() !== lastDay) { lastDay = today(); render(); } St.snapNow(); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (Auth.gateOk()) Auth.syncNow(); } });
setInterval(tick, 60000);

/* ───────── вход: приложение закрыто без подтверждённой почты ───────── */
function ensureGate(link) {
  if (Auth.gateOk() || gateOpen()) return;
  closeSheet(true);
  openGate({ link, onDone: () => { Auth.start(); render(); toast('Вход выполнен'); } });
}
let lastSyncErr = '';
/** Ошибку облака показываем один раз, чтобы данные не копились на телефоне незаметно. */
function syncErrToast() { const st = Auth.status; if (st.trimmed) { toast(`Облако почти заполнено: убрал старые выполненные дела (${st.trimmed})`); st.trimmed = 0; } if (st.state === 'err' && st.err && st.err !== lastSyncErr) { lastSyncErr = st.err; toast(`Облако: ${st.err}`); } else if (st.state === 'ok') lastSyncErr = ''; }
Auth.onChange(() => { syncErrToast(); if (!Auth.gateOk()) ensureGate(); else if (ui.view === 'more' && (!ui.sub || ui.sub === 'account')) { ui.enter = false; render(); } });
Auth.onMerged(() => { if (!sheetEl()) { ui.enter = false; render(); } });

syncSound(); buildTabs(); render();
const authLink = Auth.takeLink();
if (authLink && authLink.mode === 'verifyEmail') F.applyOob(authLink.oob).then(() => toast('Почта подтверждена')).catch(e => toast(F.errText(e)));
ensureGate(authLink);
Auth.start();
setTimeout(() => St.snapNow(), 1200);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
