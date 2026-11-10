import * as D from './dates.js';
import * as St from './store.js';
import { layout, radarHTML } from './radar.js';
import * as AI from './ai.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-today" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
<symbol id="i-radar" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-note" viewBox="0 0 24 24"><path d="M6 3.5h9l4 4V20.5H6zM14.5 3.5v4.5H19M9 12.5h7M9 16h7"/></symbol>
<symbol id="i-more" viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="M11 3.5l1.9 5.6 5.6 1.9-5.6 1.9L11 18.5l-1.9-5.6L3.5 11l5.6-1.9z"/><path d="M19 15.5v4M17 17.5h4"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></symbol>
<symbol id="i-chev" viewBox="0 0 24 24"><path d="M9 5.5l6.5 6.5L9 18.5"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5.5L8.5 12l6.5 6.5"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></symbol>
<symbol id="i-theme" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10 11v5M14 11v5"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/></symbol>
<symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14"/></symbol>
<symbol id="i-db" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
</defs></svg>`);

/* ───────── состояние интерфейса ───────── */
const ui = { view: 'today', sub: null, filter: 'all', sel: null, enter: true, models: {} };
const viewEl = $('#view'), tabsEl = $('#tabs'), layer = $('#layer');
const today = () => D.todayISO();
const when = it => it.due ? `${D.fmtDay(it.due)}${it.time ? ' · ' + it.time : ''}` : 'без срока';
const nTasks = n => `${n} ${D.plural(n, ['дело', 'дела', 'дел'])}`;
const nTails = n => `${n} ${D.plural(n, ['хвост', 'хвоста', 'хвостов'])}`;

function applyTheme() {
  const s = St.settings(); let t = s.theme;
  if (s.auto) { const h = new Date().getHours(); t = h >= 20 || h < 7 ? 'mrak' : 'bumaga'; }
  const r = document.documentElement;
  r.dataset.theme = t; r.dataset.fog = String(!!s.fog); r.dataset.calm = String(!!s.calm);
  const bg = getComputedStyle(r).getPropertyValue('--bg').trim();
  $('meta[name=theme-color]')?.setAttribute('content', bg || '#07070A');
}

function toast(msg) {
  $('.toast', layer)?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  layer.append(t); setTimeout(() => t.remove(), 3300);
}

/* ───────── экраны ───────── */
const hd = () => `<div class="hd"><span class="ey">${D.WD[new Date().getDay()]} · ${new Date().getDate()} ${D.MON[new Date().getMonth()]}</span><button class="icb ai" data-act="ai" aria-label="Спросить ИИ">${ic('spark')}</button></div>`;

function emptyState() {
  return `<div class="empty"><h2 class="hf">Пока пусто</h2><p>Нажми «+» и выгрузи всё из головы одной строкой. Я сам найду сроки и разложу на горизонте.</p>
  <button class="btn" data-act="add">${ic('plus')}Добавить</button><br><button class="linkb" data-act="demo">Показать пример</button></div>`;
}

function nowCard(it) {
  const t = today(), tail = St.isTail(it, t), dd = St.daysTo(it, t), mins = it.stepMin || (tail ? 5 : 15);
  const sub = tail ? `<span class="hotc">Тянется ${D.days(-dd)}</span>` : `${esc(when(it))}${dd > 0 ? ' · ' + D.rel(it.due, t) : ''}`;
  return `<div class="card now ${tail ? 'tail' : ''}"><span class="tag ${tail ? 'hot' : ''}">${tail ? 'СЕЙЧАС · ХВОСТ' : 'СЕЙЧАС'}</span>
    <h2 class="hf" data-act="open" data-id="${it.id}" style="cursor:pointer">${esc(it.title)}</h2>
    <div class="nsub">${sub}${it.step ? `<br>Шаг: ${esc(it.step)}` : ''}</div>${tail ? '<div class="comet"></div>' : ''}
    <div class="btns"><button class="btn" data-act="room" data-id="${it.id}">Начать · ${mins} мин</button><button class="btn g" data-act="done" data-id="${it.id}">Готово</button></div></div>`;
}

function vToday() {
  const all = St.items(), t = today();
  if (!all.length) return `${hd()}<h1 class="ttl">Сегодня</h1>${emptyState()}`;
  const open = all.filter(x => !x.done && x.kind === 'task');
  const tails = open.filter(x => St.isTail(x, t)), todays = open.filter(x => x.due === t);
  const now = St.pickNow(t);
  const rest = todays.filter(x => !now || x.id !== now.id).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const otherTails = tails.filter(x => !now || x.id !== now.id).length;
  const tomorrow = open.filter(x => x.due === D.addDays(t, 1)).length;
  const doneToday = all.filter(x => x.done && x.doneAt && D.iso(new Date(x.doneAt)) === t).length;
  const cnt = todays.length + tails.length;
  const sub = cnt ? `${nTasks(cnt)}${tails.length ? ` и ${nTails(tails.length)}` : ''}` : 'На сегодня чисто';
  let h = `${hd()}<h1 class="ttl">Сегодня</h1><p class="sub">${sub}</p>`;
  h += now ? nowCard(now) : `<div class="card now"><h2 class="hf" style="margin-top:0">Всё сделано</h2><div class="nsub">Срочного нет. Можно выдохнуть или добавить новое через «+».</div></div>`;
  if (rest.length || otherTails || tomorrow || doneToday) h += `<div class="sec">Дальше сегодня</div>`;
  rest.slice(0, 4).forEach(it => { h += `<button class="lt" data-act="open" data-id="${it.id}"><span>${esc(it.title)}</span><span class="mono">${it.time || ''}</span></button>`; });
  if (otherTails) h += `<button class="lt dim" data-act="tails"><span>Ещё ${nTails(otherTails)}</span>${ic('chev')}</button>`;
  if (tomorrow) h += `<button class="lt dim" data-act="tomorrow"><span>Завтра · ${nTasks(tomorrow)}</span>${ic('chev')}</button>`;
  if (doneToday) h += `<div class="lt dim"><span>Сделано сегодня</span><span class="mono">${doneToday}</span></div>`;
  return h;
}

function vHorizon() {
  const t = today(), pts = layout(St.items(), t);
  const tails = pts.filter(p => p.tail).length;
  if (!St.items().length) return `${hd()}<h1 class="ttl">Горизонт</h1>${emptyState()}`;
  if (!pts.some(p => p.it.id === ui.sel)) { const n = St.pickNow(t); ui.sel = (n && pts.find(p => p.it.id === n.id)) ? n.id : pts[0]?.it.id; }
  const sel = pts.find(p => p.it.id === ui.sel);
  let h = `${hd()}<h1 class="ttl">Горизонт</h1><p class="sub">${pts.length ? `${nTasks(pts.length)}${tails ? ` · ${nTails(tails)}` : ''} · ближе к центру — срочнее` : 'Дел со сроками пока нет'}</p>`;
  h += `<div class="radar" id="radar">${radarHTML(pts, ui.sel)}</div>`;
  if (pts.length) h += `<div class="sumline">ТАП ПО ТОЧКЕ — ПОДРОБНОСТИ</div>`;
  if (sel) h += `<button class="card lrow" data-act="open" data-id="${sel.it.id}"><div><b>${esc(sel.it.title)}</b><span class="sub" style="display:block;margin-top:2px">${esc(when(sel.it))} · ${D.rel(sel.it.due, t)}</span></div>${ic('chev')}</button>`;
  return h;
}

const rowHTML = (it, t) => {
  const tail = St.isTail(it, t), dd = St.daysTo(it, t);
  const sub = [it.subject, it.est ? D.fmtHours(it.est) : ''].filter(Boolean).map(esc).join(' · ');
  const right = it.done ? '' : tail ? `<span class="hotc">−${dd === null ? '' : -dd}д</span>` : it.time && it.due === t ? it.time : it.due && it.due !== t ? D.fmtShort(it.due) : '';
  return `<div class="it ${it.done ? 'dn' : ''}"><button class="ck ${it.done ? 'd' : ''}" data-act="toggle" data-id="${it.id}" aria-label="${it.done ? 'Вернуть' : 'Отметить сделанным'}">${ic('check')}</button>
  <button class="t" data-act="open" data-id="${it.id}"><b>${esc(it.title)}${tail ? '<span class="tag hot">ХВОСТ</span>' : ''}</b>${sub ? `<small>${sub}</small>` : ''}</button><span class="m">${right}</span></div>`;
};

function vList() {
  const t = today(), all = St.items();
  const tasks = all.filter(x => x.kind === 'task' && !x.done), notes = all.filter(x => x.kind === 'note');
  const tails = tasks.filter(x => St.isTail(x, t)).sort((a, b) => a.due.localeCompare(b.due));
  const todays = tasks.filter(x => x.due === t).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const tm = D.addDays(t, 1);
  const tomorrow = tasks.filter(x => x.due === tm).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const later = tasks.filter(x => x.due && x.due > tm).sort((a, b) => a.due.localeCompare(b.due));
  const nodue = tasks.filter(x => !x.due);
  const done = all.filter(x => x.kind === 'task' && x.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 6);
  const f = ui.filter;
  const F = [['all', 'Все'], ['today', 'Сегодня'], ['tails', `Хвосты${tails.length ? ' ' + tails.length : ''}`], ['ideas', 'Идеи']];
  let h = `${hd()}<h1 class="ttl">Дела</h1><div class="fl">${F.map(([k, l]) => `<button class="${f === k ? 'on' : ''} ${k === 'tails' ? 'hot' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>`;
  const grp = (title, arr) => arr.length ? `<div class="sec">${title}</div>${arr.map(x => rowHTML(x, t)).join('')}` : '';
  if (!all.length) return h + emptyState();
  if (f === 'all') h += grp('Хвосты', tails) + grp(`Сегодня · ${D.fmtShort(t)}`, todays) + grp(`Завтра · ${D.fmtShort(tm)}`, tomorrow) + grp('Позже', later) + grp('Без срока', nodue);
  if (f === 'today') h += grp('Хвосты', tails) + grp('Сегодня', todays);
  if (f === 'tails') h += grp('Хвосты', tails);
  if (f === 'all' || f === 'ideas') h += notes.length ? `<div class="sec">Идеи</div>${notes.map(n => `<button class="card note" data-act="open" data-id="${n.id}"><div class="row"><span class="tag">${esc(n.subject || 'ЗАМЕТКА').toUpperCase()}</span><span class="dd">${D.fmtShort(D.iso(new Date(n.createdAt)))}</span></div>${esc(n.title)}</button>`).join('')}` : '';
  if (f === 'all' || f === 'today') h += grp('Сделано', done);
  if (!/class="(it|card note)/.test(h)) h += `<div class="empty"><p>${f === 'tails' ? 'Хвостов нет. Так держать.' : f === 'ideas' ? 'Идей пока нет. Начни запись со слова «идея:».' : 'Здесь пусто.'}</p></div>`;
  return h;
}

function vMore() {
  if (ui.sub === 'themes') return vThemes();
  if (ui.sub === 'data') return vData();
  if (ui.sub === 'ai') return vAI();
  if (ui.sub === 'about') return vAbout();
  const row = (ico, t, s, act, extra = '') => `<button class="mrow" data-act="${act}" ${extra}>${ic(ico)}<span><b>${t}</b><small>${s}</small></span>${ic('chev').replace('class="ic"', 'class="ic chev"')}</button>`;
  return `${hd()}<h1 class="ttl">Ещё</h1>
  <div class="card group">${row('moon', 'Комната', 'Фокус в темноте: один таймер и ничего лишнего', 'room-free')}${row('theme', 'Темы', 'Мрак, Ночь, Бумага, Пастель', 'sub', 'data-s="themes"')}${row('spark', 'ИИ-помощник', AI.ready() ? 'Подключён · ' + esc(AI.cur().model) : 'Подключить бесплатную модель', 'sub', 'data-s="ai"')}${row('db', 'Данные', 'Копия, перенос, календарь', 'sub', 'data-s="data"')}${row('info', 'О приложении', 'Как установить и где всё хранится', 'sub', 'data-s="about"')}</div>`;
}

const backHd = title => `<div class="hd"><button class="icb" data-act="sub" data-s="" aria-label="Назад">${ic('back')}</button><span class="ey">Ещё</span><span style="width:42px"></span></div><h1 class="ttl">${title}</h1>`;
const tp = (th, nm, ds, on) => `<button class="tc ${on ? 'on' : ''}" data-act="theme" data-t="${th}"><div class="tp" data-theme="${th}">
  <svg viewBox="0 0 160 100" aria-hidden="true"><circle cx="80" cy="50" r="16" class="ring"/><circle cx="80" cy="50" r="30" class="ring"/><circle cx="80" cy="50" r="46" class="ring"/>
  <path d="M62 62L40 78" style="stroke:var(--hot)" stroke-width="3" stroke-linecap="round" opacity=".6"/><circle cx="62" cy="62" r="4.5" style="fill:var(--hot)"/><circle cx="98" cy="38" r="4" style="fill:var(--warn)"/><circle cx="112" cy="64" r="3.6" style="fill:var(--ink)"/><circle cx="52" cy="24" r="3.6" style="fill:var(--cool)"/><circle cx="80" cy="50" r="2.6" style="fill:var(--ink)"/></svg>
  <div class="bars"><i class="p"></i><i></i><i></i></div></div>
  <div class="nm"><span>${nm}</span>${on ? `<span class="okc">${ic('check')}</span>` : ''}</div><small>${ds}</small></button>`;
function vThemes() {
  const s = St.settings();
  const tog = (k, t, d) => `<button class="mrow" data-act="tog" data-k="${k}"><span style="flex:1"><b>${t}</b><small>${d}</small></span><span class="sw ${s[k] ? 'on' : ''}"></span></button>`;
  return `${backHd('Оформление')}<p class="sub">Тему можно сменить в любой момент. Дела остаются как есть.</p>
  <div class="tg">${tp('mrak', 'Мрак', 'По умолчанию', s.theme === 'mrak')}${tp('noch', 'Ночь', 'Тёмная, лайм', s.theme === 'noch')}${tp('bumaga', 'Бумага', 'Светлая, спокойная', s.theme === 'bumaga')}${tp('pastel', 'Пастель', 'Мягкие цвета', s.theme === 'pastel')}</div>
  <div class="card group">${tog('auto', 'Авто по времени суток', 'С 20:00 до 7:00 — «Мрак», днём — «Бумага»')}${tog('fog', 'Туман и зерно', 'Медленный фон на тёмных темах')}${tog('calm', 'Тише анимации', 'Выключить всё движение')}</div>`;
}

function vData() {
  const n = St.items().length;
  const row = (ico, t, s, act) => `<button class="mrow" data-act="${act}">${ic(ico)}<span><b>${t}</b><small>${s}</small></span></button>`;
  return `${backHd('Данные')}<p class="sub">Всё хранится только в этом браузере. Сейчас записей: ${n}. Делай копию, чтобы не потерять.</p>
  <div class="card group">${row('download', 'Сохранить копию', 'Файл .json, можно перенести на другое устройство', 'export')}${row('upload', 'Загрузить копию', 'Добавит дела из файла, повторы пропустит', 'import')}${row('today', 'Сроки в календарь', 'Файл .ics: откроется в Календаре и напомнит', 'ics-all')}${row('spark', 'Показать пример', 'Добавит тестовые дела, потом их можно удалить', 'demo')}${row('trash', 'Удалить всё', 'Очистит список на этом устройстве', 'wipe')}</div>
  <input type="file" id="file" accept="application/json,.json" hidden>`;
}
function vAbout() {
  return `${backHd('О приложении')}
  <div class="card" style="margin-top:20px;line-height:1.55;font-size:14.5px"><b>Тень</b> — планировщик, который показывает сроки на горизонте и не даёт хвостам копиться.<br><br>
  <b>Установка на телефон.</b> iPhone: в Safari нажми «Поделиться» → «На экран Домой». Android: меню браузера → «Установить приложение». Так оно откроется без адресной строки и будет работать без интернета.<br><br>
  <b>Где данные.</b> Только на этом устройстве, в браузере. На сервер ничего не отправляется. Раз в неделю делай копию в «Данные».</div>`;
}

function vAI() {
  const a = AI.cfg(), c = AI.cur(a), P = AI.PROVIDERS;
  const tog = (k, t, d) => `<button class="mrow" data-act="ai-sees" data-k="${k}"><span style="flex:1"><b>${t}</b><small>${d}</small></span><span class="sw ${a.sees[k] ? 'on' : ''}"></span></button>`;
  const models = ui.models[a.provider] || (c.model ? [c.model] : []);
  return `${backHd('ИИ-помощник')}<p class="sub">Свой бесплатный ключ: ничего не платишь, а ключ хранится только в этом браузере.</p>
  <div class="lab">Провайдер</div>
  <div class="pv">${Object.entries(P).map(([k, p]) => `<button class="pvc ${a.provider === k ? 'on' : ''}" data-act="ai-prov" data-p="${k}"><b>${p.name}</b><small>${p.hint}</small></button>`).join('')}</div>
  <div class="lab">Ключ</div>
  <input class="inp" id="akey" type="password" autocomplete="off" spellcheck="false" placeholder="Вставь ключ API" value="${esc(c.key)}">
  ${a.provider === 'custom' ? `<input class="inp" id="abase" style="margin-top:8px" placeholder="Адрес, например https://api.example.com/v1" value="${esc(a.base)}">` : ''}
  ${P[a.provider].keyUrl ? `<a class="linkb" href="${P[a.provider].keyUrl}" target="_blank" rel="noopener">Где взять ключ →</a>` : ''}
  <div class="lab">Модель</div>
  ${a.provider === 'custom' ? `<input class="inp" id="amodel" placeholder="Название модели" value="${esc(c.model)}">` : `<select class="inp" id="amodel">${models.length ? models.map(m => `<option ${m === c.model ? 'selected' : ''}>${esc(m)}</option>`).join('') : '<option value="">Сначала нажми «Проверить ключ»</option>'}</select>`}
  <div class="btns"><button class="btn" data-act="ai-check" id="acheck">Проверить ключ</button></div>
  <div class="stat" id="astat">${AI.ready() ? '<span class="chip ok">Подключён</span>' : ''}</div>
  <div class="lab" style="margin-top:22px">Что видит помощник</div>
  <div class="card group" style="margin-top:0">${tog('tasks', 'Дела, сроки и хвосты', 'Основа для ответов')}${tog('notes', 'Заметки', 'Идеи и мысли')}${tog('priv', 'Личное', 'Дела и заметки с пометкой «Личное»')}</div>
  <p class="sub" style="font-size:12.5px;margin-top:12px">Бесплатные тарифы провайдеров могут использовать запросы для улучшения моделей, поэтому личное по умолчанию не отправляется. Помощник только предлагает, подтверждаешь ты.</p>`;
}

/* чат с помощником */
let chat = [];
function paintChat() {
  const el = $('#chat'); if (!el) return;
  el.innerHTML = chat.map((x, i) => x.role === 'user' ? `<div class="msg me">${esc(x.text)}</div>`
    : x.loading ? `<div class="msg bot"><span class="dots"><i></i><i></i><i></i></span></div>`
      : `<div class="msg bot ${x.err ? 'err' : ''}">${esc(x.text)}${x.actions?.length && !x.applied ? `<div class="acts">${x.actions.map(a => { const d = AI.describe(a); return `<div><b>${d.sign}</b><span>${esc(d.text)}</span></div>`; }).join('')}<div class="btns"><button class="btn sm" data-act="ai-apply" data-i="${i}">Применить · ${x.actions.length}</button><button class="btn g sm" data-act="ai-skip" data-i="${i}">Не надо</button></div></div>` : ''}${x.applied ? `<div class="acts"><span class="chip ok">${esc(x.applied)}</span></div>` : ''}</div>`).join('');
  el.scrollTop = el.scrollHeight;
  const sg = $('#sugs'); if (sg) {
    const sel = St.get_(ui.sel), q = ['Что делать вечером?', 'Что я забыл?', 'С чего начать?'];
    if (sel && sel.kind === 'task') q.unshift(`Разбей «${sel.title.length > 22 ? sel.title.slice(0, 21) + '…' : sel.title}» на шаги`);
    sg.innerHTML = chat.length ? '' : q.map(t => `<button data-act="ai-sug" data-q="${esc(t)}">${esc(t)}</button>`).join('');
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
function openAI() {
  const head = `<div class="shead"><h3 class="hf">Помощник</h3><button class="gh" data-act="close">ЗАКРЫТЬ</button></div>`;
  if (!AI.ready()) { openSheet(`${head}<p class="sub" style="margin-top:14px;line-height:1.5">Помощник видит твои дела, хвосты и горизонт, отвечает по ним и добавляет дела, когда ты попросишь. Нужен свой бесплатный ключ, это займёт пару минут.</p><button class="btn wide" style="margin-top:18px" data-act="ai-setup">Подключить</button>`); return; }
  const c = AI.counts();
  const sh = openSheet(`${head}<div class="ctxl">${ic('eye')}ВИДИТ: ${nTasks(c.tasks)} · ${nTails(c.tails)} · ${c.notes} ${D.plural(c.notes, ['ЗАМЕТКА', 'ЗАМЕТКИ', 'ЗАМЕТОК'])}</div><div class="chat" id="chat"></div><div class="sugs" id="sugs"></div>
  <div class="askbar"><textarea class="inp" id="aq" rows="1" placeholder="Спроси про свои дела…"></textarea><button class="send" data-act="ai-send" aria-label="Отправить">${ic('arrow')}</button></div>`);
  sh.classList.add('tall'); paintChat();
}

const V = { today: vToday, horizon: vHorizon, list: vList, more: vMore };

function renderTabs() {
  const T = [['today', 'today', 'Сегодня'], ['horizon', 'radar', 'Горизонт'], ['add'], ['list', 'note', 'Дела'], ['more', 'more', 'Ещё']];
  tabsEl.innerHTML = T.map(([k, i, l]) => k === 'add' ? `<div class="tab"><button class="plus" data-act="add" aria-label="Добавить">${ic('plus')}</button></div>` : `<button class="tab ${ui.view === k ? 'on' : ''}" data-act="nav" data-to="${k}">${ic(i)}${l}</button>`).join('');
}
function render() {
  applyTheme();
  viewEl.className = 'view' + (ui.enter ? ' enter' : '');
  viewEl.innerHTML = V[ui.view]();
  ui.enter = false;
  renderTabs();
}
function go(to, sub = null) { ui.view = to; ui.sub = sub; ui.enter = true; render(); window.scrollTo(0, 0); }

/* ───────── шторки ───────── */
function openSheet(html, init) {
  closeSheet(true);
  const sc = document.createElement('div'); sc.className = 'scrim'; sc.dataset.act = 'close';
  const s = document.createElement('div'); s.className = 'sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
  s.innerHTML = `<div class="grab"></div>${html}`;
  layer.append(sc, s); init?.(s); return s;
}
function closeSheet(instant) {
  const s = $('.sheet', layer), sc = $('.scrim', layer); if (!s) return;
  if (instant) { s.remove(); sc?.remove(); return; }
  s.classList.add('out'); sc?.classList.add('out'); setTimeout(() => { s.remove(); sc?.remove(); }, 260);
}

/* добавить / изменить */
function openEditor(id) {
  const it = id ? St.get_(id) : null, t = today();
  const ed = { kind: it?.kind || 'task', text: it?.title || '', due: it?.due || null, time: it?.time || null, tDue: !!it, tTime: !!it, parsed: [] };
  const fri = D.addDays(t, (5 - D.dow(t) + 7) % 7 || 7);
  const s = openSheet(`<div class="shead"><h3 class="hf">${it ? (it.kind === 'note' ? 'Заметка' : 'Изменить дело') : 'Что добавить?'}</h3><button class="gh" data-act="close">ОТМЕНА</button></div>
  ${it ? '' : `<div class="pills" id="ek" style="margin-top:14px"><button data-k="task" class="on">Дело</button><button data-k="note">Заметка</button></div>`}
  <textarea class="inp" id="et" rows="3" placeholder="Что в голове? Например: сдать лабу в пятницу в 18:00" style="margin-top:14px">${esc(ed.text)}</textarea>
  <div id="ep"></div>
  <div id="em"><div class="lab">Срок</div><div class="pills" id="eq"></div><div class="row2" style="margin-top:10px"><input class="inp" type="date" id="ed" aria-label="Дата"><input class="inp" type="time" id="etm" aria-label="Время"></div>
  <details class="more"><summary>Ещё: предмет, оценка, первый шаг<span>${ic('chev')}</span></summary>
    <div class="lab" style="margin-top:6px">Предмет</div><input class="inp" id="esub" placeholder="Например: Комп. графика" value="${esc(it?.subject || '')}">
    <div class="lab">Сколько часов работы</div><input class="inp" id="eest" inputmode="decimal" placeholder="Например: 3 (нужно для цены откладывания)" value="${it?.est ?? ''}">
    <div class="lab">Первый шаг</div><input class="inp" id="estep" placeholder="Например: открыть проект и запустить сцену" value="${esc(it?.step || '')}">
    <div class="row2" style="margin-top:14px"><div><div class="lab" style="margin-top:0">Шаг, минут</div><input class="inp" id="emin" inputmode="numeric" placeholder="15" value="${it?.stepMin ?? ''}"></div>
    <div><div class="lab" style="margin-top:0">Напомнить в календаре</div><select class="inp" id="erem"><option value="">за 9 часов</option><option value="15">за 15 минут</option><option value="60">за час</option><option value="1440">за день</option></select></div></div><button class="mrow" id="epriv" type="button" style="padding:14px 0;margin-top:8px"><span style="flex:1;text-align:left"><b>Личное</b><small>Не показывать ИИ-помощнику</small></span><span class="sw ${it?.priv ? 'on' : ''}"></span></button></details></div>
  <button class="btn wide" id="esave" style="margin-top:20px">${it ? 'Сохранить' : 'Добавить'}</button>`, sh => {
    sh.querySelector('#erem').value = it?.remind ? String(it.remind) : '';
  });
  const q = sel => s.querySelector(sel);
  const quick = [['Сегодня', t], ['Завтра', D.addDays(t, 1)], [D.fmtShort(fri), fri]];

  function compute() {
    ed.text = q('#et').value;
    if (it) ed.parsed = ed.text.trim() ? [{ title: ed.text.trim(), due: null, time: null }] : [];
    else if (ed.kind === 'note') ed.parsed = ed.text.trim() ? [{ title: ed.text.trim(), due: null, time: null, kind: 'note' }] : [];
    else ed.parsed = D.splitThoughts(ed.text).map(c => D.parseQuick(c)).filter(p => p.title);
  }
  function paint() {
    const P = ed.parsed, single = P.length <= 1, p = P[0];
    const dueV = single ? (ed.tDue ? ed.due : p?.due ?? null) : null, timeV = single ? (ed.tTime ? ed.time : p?.time ?? null) : null;
    const isNote = (it ? it.kind : ed.kind) === 'note' || p?.kind === 'note';
    q('#em').style.display = single && !isNote && P.length ? '' : (it && !isNote ? '' : 'none');
    if (single && !(it && !ed.text.trim())) {
      q('#ep').innerHTML = !p ? `<div class="sub" style="margin-top:10px">Пиши по-человечески: «позвонить маме завтра в 18:00». Несколько дел можно писать через запятую или с новой строки.</div>`
        : `<div class="chips">${isNote ? '<span class="chip">Заметка без срока</span>' : (dueV ? `<span class="chip ${dueV < t ? 'hot' : 'warn'}">${ic('today')}${esc(D.fmtDay(dueV))}</span>` : '<span class="chip">Без срока</span>')}${timeV ? `<span class="chip warn">${ic('clock')}${timeV}</span>` : ''}${p.tail ? '<span class="chip hot">Хвост</span>' : ''}${p.approx && !ed.tDue ? '<span class="chip">≈ уточни день</span>' : ''}${dueV && !isNote ? `<span class="chip ok">${D.rel(dueV, t)}</span>` : ''}</div>`;
    } else {
      q('#ep').innerHTML = `<div class="lab">Найдено: ${P.length}</div>` + P.map((x, i) => `<div class="pcard"><div><b>${esc(x.title)}</b><div class="chips">${x.due ? `<span class="chip ${x.due < t ? 'hot' : 'warn'}">${ic('today')}${esc(D.fmtDay(x.due))}</span>` : '<span class="chip">Без срока</span>'}${x.time ? `<span class="chip warn">${ic('clock')}${x.time}</span>` : ''}${x.tail ? '<span class="chip hot">Хвост</span>' : ''}${x.kind === 'note' ? '<span class="chip">Заметка</span>' : ''}</div></div><button class="x" data-rm="${i}" aria-label="Убрать">${ic('close')}</button></div>`).join('');
    }
    q('#eq').innerHTML = quick.map(([l, v]) => `<button data-q="${v}" class="${dueV === v ? 'on' : ''}">${l}</button>`).join('');
    q('#ed').value = dueV || ''; q('#etm').value = timeV || '';
    q('#esave').textContent = it ? 'Сохранить' : P.length > 1 ? `Добавить ${P.length}` : 'Добавить';
  }
  const refresh = () => { compute(); paint(); };

  q('#et').addEventListener('input', refresh);
  s.addEventListener('click', e => {
    const pv = e.target.closest('#epriv'); if (pv) { pv.querySelector('.sw').classList.toggle('on'); return; }
    const k = e.target.closest('#ek button'); if (k) { ed.kind = k.dataset.k; s.querySelectorAll('#ek button').forEach(b => b.classList.toggle('on', b === k)); refresh(); return; }
    const qq = e.target.closest('#eq button'); if (qq) { const v = qq.dataset.q; ed.tDue = true; ed.due = ed.due === v && ed.tDue && q('#ed').value === v ? null : v; paint(); q('#ed').value = ed.due || ''; paint(); return; }
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
      const data = { title: p.title, kind, due: kind === 'note' ? null : dueV, time: kind === 'note' ? null : (dueV ? timeV : null), subject: q('#esub').value.trim(), est: num(q('#eest').value), step: q('#estep').value.trim(), stepMin: num(q('#emin').value), remind: num(q('#erem').value), priv: q('#epriv .sw').classList.contains('on') };
      const r = it ? St.updateItem(it.id, data) : St.addItem(data);
      if (r.kind === 'task' && r.due) ui.sel = r.id;
      toast(it ? 'Сохранено' : r.due && r.kind === 'task' ? `Добавлено · встанет на горизонте ${D.rel(r.due)}` : 'Добавлено');
    } else {
      P.forEach(x => St.addItem({ title: x.title, due: x.due, time: x.due ? x.time : null, kind: x.kind === 'note' ? 'note' : 'task' }));
      toast(`Добавлено: ${P.length}`);
    }
    closeSheet(); render();
  });
  refresh();
  if (!it) setTimeout(() => q('#et').focus(), 350);
}

/* детали */
function openDetail(id) {
  const it = St.get_(id); if (!it) return;
  const t = today(), tail = St.isTail(it, t), dd = St.daysTo(it, t), rows = St.costRows(it, t), mins = it.stepMin || (tail ? 5 : 15);
  let h = `<div class="shead"><span class="tag ${tail ? 'hot' : ''}">${esc((it.kind === 'note' ? 'заметка' : it.subject || (tail ? 'хвост' : 'дело')).toUpperCase())}</span><button class="gh" data-act="close">ЗАКРЫТЬ</button></div>
  <h2 class="hf" style="margin-top:16px;font-size:calc(var(--fh3z) + 5px)">${esc(it.title)}</h2>`;
  if (it.kind === 'task') h += `<p class="sub">${it.due ? `${esc(when(it))} · ${tail ? `<span class="hotc">просрочено на ${D.days(-dd)}</span>` : D.rel(it.due, t)}` : 'Без срока'}${it.est ? ` · около ${D.fmtHours(it.est)}` : ''}${it.spent ? ` · потрачено ${D.fmtHours(it.spent / 60)}` : ''}</p>`;
  if (it.kind === 'task' && !it.done) h += `<div class="card stepcard"><div class="dd">${it.step ? 'ПЕРВЫЙ ШАГ' : 'СТАРТ'} · ${mins} МИН</div><div class="hf">${esc(it.step || 'Начни с малого')}</div><button class="btn wide" data-act="room" data-id="${it.id}" style="margin-top:14px">Начать</button></div>`;
  if (rows) {
    h += `<div class="lab">Цена откладывания</div><div class="card" style="padding:12px 14px 8px">${rows.map((r, i) => { const c = r.perDay <= 2 ? 'ok' : r.perDay <= 5 ? 'warn' : 'hot'; const pct = Math.max(6, Math.min(100, r.perDay / it.est * 100)); return `<div class="cb ${i === 0 ? 'on' : ''}"><span class="l">${r.label}</span><span class="tr"><i style="width:${pct}%;background:var(--${c})"></i></span><span class="v">${D.fmtHours(r.perDay)}</span></div>`; }).join('')}<p class="sub" style="font-size:12.5px;margin:2px 0 6px">Нагрузка в день до сдачи</p></div>`;
  }
  h += `<div class="btns" style="margin-top:18px"><button class="btn ${it.done ? 'g' : ''}" data-act="done" data-id="${it.id}">${it.done ? 'Вернуть в дела' : 'Готово'}</button><button class="btn g" data-act="edit" data-id="${it.id}">Изменить</button></div>
  <div class="btns" style="margin-top:8px">${it.due ? `<button class="btn g sm" data-act="ics" data-id="${it.id}">${ic('today')}В календарь</button>` : ''}<button class="btn danger sm" data-act="del" data-id="${it.id}">${ic('trash')}Удалить</button></div>`;
  openSheet(h);
}

/* комната: фокус в темноте */
let roomState = null;
function openRoom({ id = null, minutes = 15, title = 'Фокус', subject = '' } = {}) {
  closeSheet(true); exitRoom(true);
  const total = minutes * 60, C = 2 * Math.PI * 130;
  const el = document.createElement('div'); el.className = 'room';
  let em = ''; for (let i = 0; i < 22; i++) { const r = Math.random(); em += `<i class="em" style="left:${(Math.random() * 100).toFixed(1)}%;width:${(2 + r * 3).toFixed(1)}px;height:${(2 + r * 3).toFixed(1)}px;animation-duration:${(16 + Math.random() * 16).toFixed(1)}s;animation-delay:-${(Math.random() * 30).toFixed(1)}s;--dx:${((Math.random() - .5) * 70).toFixed(0)}px;--o:${(.18 + Math.random() * .35).toFixed(2)};box-shadow:0 0 ${(4 + r * 8).toFixed(0)}px #F2A65A"></i>`; }
  el.innerHTML = `${em}<div class="top"><span>КОМНАТА</span><button class="icb" data-act="room-exit" aria-label="Выйти">${ic('close')}</button></div>
  <div class="orb"><svg viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="146" fill="none" stroke="rgba(255,255,255,.07)"/><circle class="breath" cx="150" cy="150" r="118" fill="none" stroke="rgba(242,166,90,.16)"/><circle class="breath" style="animation-delay:-3s" cx="150" cy="150" r="92" fill="none" stroke="rgba(242,166,90,.09)"/>
  <circle class="arc" cx="150" cy="150" r="130" fill="none" stroke="#F2A65A" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 150 150)"/></svg>
  <div class="tm"><b id="rt">${fmt(total)}</b><span id="rl">ОСТАЛОСЬ</span></div></div>
  <div class="rtitle">${esc(title)}</div><div class="rsub">${esc((subject || '').toUpperCase() || 'ФОКУС')} · ${minutes} МИН</div>
  <div class="btns" id="rb"><button class="btn g" data-act="room-pause" id="rp">Пауза</button><button class="btn" data-act="room-done">Готово</button></div>
  <div class="rsub" style="margin-top:16px">Лучше выключить уведомления</div>`;
  layer.append(el);
  const st = roomState = { el, id, total, left: total, run: true, last: performance.now(), minutes, C, wl: null, iv: null, finished: false };
  st.iv = setInterval(() => {
    const now = performance.now(); if (st.run && !st.finished) st.left = Math.max(0, st.left - (now - st.last) / 1000); st.last = now;
    const arc = el.querySelector('.arc'); if (arc) arc.style.strokeDashoffset = String(C * (1 - st.left / st.total));
    const rt = el.querySelector('#rt'); if (rt) rt.textContent = fmt(Math.ceil(st.left));
    if (st.left <= 0 && !st.finished) finishRoom();
  }, 250);
  try { navigator.wakeLock?.request('screen').then(w => { st.wl = w; }).catch(() => { }); } catch (e) { /* нет поддержки */ }
}
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
function finishRoom() {
  const st = roomState; if (!st) return; st.finished = true; navigator.vibrate?.(200);
  st.el.querySelector('#rl').textContent = 'ВРЕМЯ ВЫШЛО';
  st.el.querySelector('#rb').innerHTML = `${st.id ? '<button class="btn" data-act="room-done">Дело сделано</button>' : ''}<button class="btn g" data-act="room-more">Ещё ${st.minutes} мин</button><button class="btn g" data-act="room-exit">Выйти</button>`;
}
function exitRoom(silent) {
  const st = roomState; if (!st) return; roomState = null;
  clearInterval(st.iv); try { st.wl?.release(); } catch (e) { /* ок */ }
  const spent = Math.round((st.total - st.left) / 60);
  if (st.id && spent >= 1) { const it = St.get_(st.id); if (it) St.updateItem(st.id, { spent: (it.spent || 0) + spent }); }
  st.el.style.transition = 'opacity .4s'; st.el.style.opacity = '0'; setTimeout(() => st.el.remove(), 400);
  if (!silent) render();
}

/* ───────── действия ───────── */
function finishTask(id) {
  const it = St.get_(id); if (!it) return;
  const wasTail = St.isTail(it);
  St.toggleDone(id); navigator.vibrate?.(12);
  toast(it.done ? 'Вернула в дела' : wasTail ? 'Хвост закрыт' : 'Готово');
}
const H = {
  nav: el => go(el.dataset.to),
  add: () => openEditor(),
  edit: el => { closeSheet(true); openEditor(el.dataset.id); },
  open: el => { const it = St.get_(el.dataset.id); it && (it.kind === 'note' ? openEditor(it.id) : openDetail(it.id)); },
  close: () => closeSheet(),
  toggle: el => {
    const row = el.closest('.it'), it = St.get_(el.dataset.id);
    if (row && it && !it.done) { row.classList.add('leaving'); el.classList.add('d'); setTimeout(() => { finishTask(el.dataset.id); render(); }, 380); }
    else { finishTask(el.dataset.id); render(); }
  },
  done: el => { closeSheet(); finishTask(el.dataset.id); render(); },
  del: el => { const it = St.get_(el.dataset.id); closeSheet(true); St.removeItem(el.dataset.id); render(); toast(`Удалено: ${it ? it.title : ''}`); },
  ics: el => { const it = St.get_(el.dataset.id); it && download(`${it.title}.ics`, St.icsFor([it]), 'text/calendar'); },
  'ics-all': () => { const l = St.items().filter(x => x.due && !x.done); l.length ? download('ten-сроки.ics', St.icsFor(l), 'text/calendar') : toast('Нет дел со сроками'); },
  selblip: el => { ui.sel = el.dataset.id; const pts = layout(St.items(), today()); $('#radar').innerHTML = radarHTML(pts, ui.sel); const sel = pts.find(p => p.it.id === ui.sel); const card = $('.lrow'); if (sel && card) { card.dataset.id = sel.it.id; card.querySelector('b').textContent = sel.it.title; card.querySelector('.sub').textContent = `${when(sel.it)} · ${D.rel(sel.it.due, today())}`; } },
  filter: el => { ui.filter = el.dataset.f; ui.enter = false; render(); },
  tails: () => { ui.filter = 'tails'; go('list'); },
  tomorrow: () => { ui.filter = 'all'; go('list'); },
  room: el => { const it = St.get_(el.dataset.id); if (it) openRoom({ id: it.id, minutes: it.stepMin || (St.isTail(it) ? 5 : 15), title: it.step || it.title, subject: it.subject || it.title }); },
  'room-free': () => openRoom({ minutes: 25, title: 'Свободный фокус' }),
  'room-pause': el => { const st = roomState; if (!st) return; st.run = !st.run; st.last = performance.now(); el.textContent = st.run ? 'Пауза' : 'Продолжить'; },
  'room-exit': () => exitRoom(),
  'room-done': () => { const st = roomState; if (!st) return; const id = st.id; exitRoom(true); if (id) { const it = St.get_(id); if (it && !it.done) finishTask(id); } render(); },
  'room-more': () => { const st = roomState; if (!st) return; st.total = st.left = st.minutes * 60; st.finished = false; st.last = performance.now(); st.el.querySelector('#rl').textContent = 'ОСТАЛОСЬ'; st.el.querySelector('#rb').innerHTML = '<button class="btn g" data-act="room-pause" id="rp">Пауза</button><button class="btn" data-act="room-done">Готово</button>'; },
  sub: el => { ui.sub = el.dataset.s || null; ui.enter = true; render(); window.scrollTo(0, 0); },
  theme: el => { St.setSettings({ theme: el.dataset.t, auto: false }); ui.enter = false; render(); },
  tog: el => { const k = el.dataset.k; St.setSettings({ [k]: !St.settings()[k] }); ui.enter = false; render(); },
  demo: () => { if (St.items().length && !confirm('Добавить тестовые дела к твоим?')) return; St.loadDemo(); render(); toast('Добавила пример. Удалить можно в «Данные».'); },
  export: () => download(`ten-копия-${today()}.json`, St.exportJSON(), 'application/json'),
  import: () => $('#file')?.click(),
  wipe: () => { if (confirm('Удалить все дела на этом устройстве? Это нельзя отменить.')) { St.clearAll(); render(); toast('Всё удалено'); } },
  ai: () => openAI(),
  'ai-setup': () => { closeSheet(true); ui.view = 'more'; ui.sub = 'ai'; ui.enter = true; render(); window.scrollTo(0, 0); },
  'ai-send': () => ask($('#aq')?.value),
  'ai-sug': el => ask(el.dataset.q),
  'ai-apply': el => { const m = chat[+el.dataset.i]; if (!m) return; const n = AI.apply(m.actions); m.applied = n ? `Готово: изменений ${n}` : 'Ничего не изменилось'; render(); paintChat(); },
  'ai-skip': el => { const m = chat[+el.dataset.i]; if (m) { m.actions = []; paintChat(); } },
  'ai-prov': el => { St.setAI({ provider: el.dataset.p }); ui.enter = false; render(); },
  'ai-sees': el => { const k = el.dataset.k; St.setSees({ [k]: !AI.cfg().sees[k] }); ui.enter = false; render(); },
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
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = H[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => {
  const id = e.target.id, a = AI.cfg();
  if (id === 'akey') { St.setAI({ keys: { ...a.keys, [a.provider]: e.target.value.trim() } }); return; }
  if (id === 'abase') { St.setAI({ base: e.target.value.trim() }); return; }
  if (id === 'amodel') { St.setAI({ models: { ...a.models, [a.provider]: e.target.value.trim() } }); return; }
  if (id !== 'file') return;
  const file = e.target.files[0]; if (!file) return;
  file.text().then(t => { try { const n = St.importJSON(t); render(); toast(`Загружено дел: ${n}`); } catch (err) { toast('Не получилось прочитать файл'); } });
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'aq') { e.preventDefault(); ask(e.target.value); return; } if (e.key === 'Escape') { if (roomState) exitRoom(); else closeSheet(); } });

/* смена суток и возврат в приложение */
let lastDay = today();
const tick = () => { if (today() !== lastDay) { lastDay = today(); render(); } else if (St.settings().auto) applyTheme(); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
setInterval(tick, 60000);

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
