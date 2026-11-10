// Экран входа: приложение закрыто, пока нет аккаунта с подтверждённой почтой (как в «Подходе»).
import * as Auth from './auth.js';
import * as F from './fb.js';
import * as St from './store.js';
import { esc, ic, toast } from './ui.js';
import { sfx } from './sfx.js';

const MARK = '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="32" cy="32" r="8" opacity=".55"/><circle cx="32" cy="32" r="16" opacity=".4"/><circle cx="32" cy="32" r="26" opacity=".3"/><path d="M23 36L9 44" stroke-width="4" opacity=".85"/><circle cx="23" cy="36" r="3.2" fill="currentColor" stroke="none"/><circle cx="50" cy="16" r="3" fill="currentColor" stroke="none"/><circle cx="32" cy="32" r="1.8" fill="currentColor" stroke="none"/></svg>';
let el = null, g = null, pollT = null, done = null;

export const isOpen = () => !!el;

export function openGate({ onDone, link } = {}) {
  if (el) return;
  done = onDone;
  const a = Auth.acc();
  g = { mode: 'start', email: a ? a.email : '', pass: '', pass2: '', eye: false, busy: false, err: '', sent: '', oob: '' };
  if (a && a.bad) { g.mode = 'login'; g.err = F.errText({ code: 'relogin' }); }
  else if (a && a.ver === 0) g.mode = 'verify';
  if (link && link.mode === 'resetPassword') { g.mode = 'newpass'; g.oob = link.oob; }
  el = document.createElement('div'); el.className = 'gate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Вход');
  document.body.append(el);
  el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('keydown', onKey);
  paint();
}
function closeGate() { clearInterval(pollT); pollT = null; if (el) { el.remove(); el = null; } }

const sync = () => { if (!el) return; const v = id => { const n = el.querySelector('#' + id); return n ? n.value : null; }; const e = v('ge'), p = v('gp'), p2 = v('gp2'); if (e !== null) g.email = e; if (p !== null) g.pass = p; if (p2 !== null) g.pass2 = p2; };
const pass = (id, label, value) => `<div class="lbl">${label}</div><div class="gate-pass"><input class="field" id="${id}" type="${g.eye ? 'text' : 'password'}" autocomplete="${id === 'gp' && g.mode === 'login' ? 'current-password' : 'new-password'}" value="${esc(value)}" placeholder="Хотя бы 6 символов"><button class="eye" type="button" data-g="eye" aria-label="Показать пароль">${ic('eye')}</button></div>`;
const mail = () => `<div class="lbl">Почта</div><input class="field" id="ge" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="${esc(g.email)}" placeholder="name@example.com">`;

function paint() {
  if (!el) return;
  const busy = g.busy ? ' disabled aria-busy="true"' : '', err = g.err ? `<p class="acc-err" role="alert">${esc(g.err)}</p>` : '';
  const head = (t, e = '') => `<div class="gate-h">${e ? `<div class="eyebrow">${e}</div>` : ''}<h2>${t}</h2></div>`;
  let body = '', start = false;
  if (g.mode === 'start') {
    start = true;
    body = `<ul class="gate-feats">${['Горизонт сроков и хвосты', 'Дела в облаке: на любом телефоне', 'Работает без интернета'].map((t, i) => `<li><span class="num">0${i + 1}</span><span>${t}</span></li>`).join('')}</ul>
      <button class="btn btn-primary btn-lg btn-block" data-g="mode" data-m="signup">Создать аккаунт</button>
      <button class="btn btn-ghost btn-lg btn-block" data-g="mode" data-m="login">Войти</button>
      <p class="gate-note">Аккаунт общий с «Подходом»: можно войти им.</p>`;
  } else if (g.mode === 'signup') {
    body = `${head('Создать аккаунт', 'Новый аккаунт')}${mail()}${pass('gp', 'Пароль', g.pass)}${pass('gp2', 'Повторите пароль', g.pass2)}${err}
      <button class="btn btn-primary btn-lg btn-block" data-g="submit"${busy}>${g.busy ? 'Создаём…' : 'Создать аккаунт'}</button>
      <button class="gate-link" data-g="mode" data-m="login">У меня уже есть аккаунт</button>`;
  } else if (g.mode === 'login') {
    body = `${head('Вход', 'С возвращением')}${mail()}${pass('gp', 'Пароль', g.pass)}${err}
      <button class="btn btn-primary btn-lg btn-block" data-g="submit"${busy}>${g.busy ? 'Входим…' : 'Войти'}</button>
      <button class="gate-link" data-g="mode" data-m="reset">Забыли пароль?</button><button class="gate-link" data-g="mode" data-m="signup">Создать аккаунт</button>`;
  } else if (g.mode === 'reset') {
    body = `${head('Новый пароль', 'Восстановление')}${g.sent ? `<div class="hint">${ic('shield')}<span>Если аккаунт с адресом <b>${esc(g.sent)}</b> есть, мы отправили туда письмо со ссылкой. Откройте её и задайте новый пароль.</span></div>` : mail()}${err}
      ${g.sent ? '' : `<button class="btn btn-primary btn-lg btn-block" data-g="submit"${busy}>${g.busy ? 'Отправляем…' : 'Прислать письмо'}</button>`}
      <button class="gate-link" data-g="mode" data-m="login">Назад ко входу</button>`;
  } else if (g.mode === 'newpass') {
    body = `${head('Новый пароль', 'По ссылке из письма')}${pass('gp', 'Новый пароль', g.pass)}${err}
      <button class="btn btn-primary btn-lg btn-block" data-g="submit"${busy}>${g.busy ? 'Сохраняем…' : 'Сохранить пароль'}</button>`;
  } else if (g.mode === 'verify') {
    const a = Auth.acc();
    body = `${head('Подтвердите почту', 'Последний шаг')}<div class="hint">${ic('shield')}<span>Мы отправили письмо на <b>${esc(a ? a.email : '')}</b>. Откройте ссылку в письме и вернитесь сюда: вход откроется сам. Если письма нет, загляните в «Спам».</span></div>${err}
      <button class="btn btn-primary btn-lg btn-block" data-g="check"${busy}>${g.busy ? 'Проверяем…' : 'Я подтвердил'}</button>
      <button class="btn btn-ghost btn-block" data-g="resend"${busy}>Отправить письмо ещё раз</button>
      <button class="gate-link" data-g="other">Другая почта</button>`;
  } else if (g.mode === 'owner') {
    const n = St.items().length;
    body = `${head('Другой аккаунт', 'Дела на телефоне')}<div class="hint">${ic('info')}<span>На этом телефоне остались дела другого аккаунта (${n}). Что с ними сделать?</span></div>
      <button class="btn btn-primary btn-lg btn-block" data-g="own-add">Добавить к этому аккаунту</button>
      <button class="btn btn-ghost btn-lg btn-block" data-g="own-wipe">Очистить телефон</button>`;
  }
  el.innerHTML = `<div class="gate-wrap"><div class="gate-mark">${MARK}</div><div class="gate-title">Тень</div>${start ? '<div class="gate-sub">Сроки · хвосты · горизонт</div>' : ''}${body}</div>`;
  const first = el.querySelector('input'); if (first && !g.busy) { const empty = [...el.querySelectorAll('input')].find(i => !i.value) || first; try { empty.focus({ preventScroll: true }); } catch (e) { /* нет */ } }
  watch();
}

function watch() {
  clearInterval(pollT); pollT = null;
  if (g && g.mode === 'verify') pollT = setInterval(async () => {
    if (!el || document.visibilityState !== 'visible' || navigator.onLine === false || g.busy) return;
    try { if (await Auth.checkVerified()) finish(); } catch (e) { /* попробуем позже */ }
  }, 4000);
}

async function finish() {
  clearInterval(pollT); pollT = null;
  if (Auth.ownerConflict()) { g.mode = 'owner'; g.err = ''; paint(); return; }
  Auth.adoptOwner(); closeGate(); sfx('add'); if (done) done();
}

async function run(fn) {
  g.busy = true; g.err = ''; paint();
  try { await fn(); } catch (e) { g.err = F.errText(e); }
  g.busy = false; if (el) paint();
}

function submit() {
  if (g.busy) return;
  sync();
  const email = g.email.trim().toLowerCase();
  if (g.mode === 'signup') {
    if (!email) { g.err = F.errText({ code: 'MISSING_EMAIL' }); return paint(); }
    if (g.pass.length < 6) { g.err = F.errText({ code: 'short' }); return paint(); }
    if (g.pass !== g.pass2) { g.err = F.errText({ code: 'nomatch' }); return paint(); }
    return run(async () => { await Auth.signUp(email, g.pass); g.mode = 'verify'; g.pass = g.pass2 = ''; });
  }
  if (g.mode === 'login') {
    if (!email) { g.err = F.errText({ code: 'MISSING_EMAIL' }); return paint(); }
    if (!g.pass) { g.err = F.errText({ code: 'MISSING_PASSWORD' }); return paint(); }
    return run(async () => { const ok = await Auth.signIn(email, g.pass); g.pass = ''; if (ok) { await finish(); } else g.mode = 'verify'; });
  }
  if (g.mode === 'reset') {
    if (!email) { g.err = F.errText({ code: 'MISSING_EMAIL' }); return paint(); }
    return run(async () => { await Auth.resetMail(email); g.sent = email; });
  }
  if (g.mode === 'newpass') {
    if (g.pass.length < 6) { g.err = F.errText({ code: 'short' }); return paint(); }
    return run(async () => { await F.newPassword(g.oob, g.pass); g.mode = 'login'; g.pass = ''; toast('Пароль изменён. Войдите с новым'); });
  }
}

const A = {
  mode: b => { sync(); g.mode = b.dataset.m; g.err = ''; g.sent = ''; paint(); },
  eye: () => { sync(); g.eye = !g.eye; paint(); },
  submit,
  check: () => run(async () => { if (await Auth.checkVerified()) return finish(); g.err = 'Почта ещё не подтверждена. Откройте ссылку из письма'; }),
  resend: () => run(async () => { const ok = await Auth.resendVerify(false); toast(ok ? 'Письмо отправлено' : 'Подождите минуту перед повтором'); }),
  other: () => { Auth.signOut(); g.mode = 'signup'; g.err = ''; paint(); },
  'own-add': () => { Auth.adoptOwner(); closeGate(); if (done) done(); },
  'own-wipe': () => { St.wipeLocal(); Auth.adoptOwner(); closeGate(); if (done) done(); },
};
function onClick(e) { const b = e.target.closest('[data-g]'); if (b && A[b.dataset.g]) { e.preventDefault(); A[b.dataset.g](b); } }
function onInput() { sync(); }
function onKey(e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } }
