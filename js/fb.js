// Firebase по обычному HTTPS, без SDK и CDN: вход по почте (Identity Toolkit) и данные (Firestore).
// Проект общий с «Подходом»: один аккаунт на оба приложения. Данные «Тени» лежат в личном
// документе users/{uid}/pv/ten, который правила проекта уже разрешают читать и писать владельцу.
const DEF = {
  key: 'AIzaSyCsPQssm8V6RvmOOtPSySJKczQ5LqaBWws',
  idt: 'https://identitytoolkit.googleapis.com/v1/accounts:',
  stk: 'https://securetoken.googleapis.com/v1/token',
  fs: 'https://firestore.googleapis.com/v1/',
  db: 'projects/podhod-5d27f/databases/default/documents',
};
// для проверок без интернета адреса можно подменить: window.TEN_FB = { idt, stk, fs, db }
export const FB = { ...DEF, ...((typeof window !== 'undefined' && window.TEN_FB) || {}) };

const ERR = {
  EMAIL_EXISTS: 'Такая почта уже зарегистрирована. Войдите или восстановите пароль',
  EMAIL_NOT_FOUND: 'Аккаунта с такой почтой нет',
  INVALID_PASSWORD: 'Неверный пароль',
  INVALID_LOGIN_CREDENTIALS: 'Неверная почта или пароль',
  INVALID_EMAIL: 'Проверьте адрес почты',
  MISSING_EMAIL: 'Введите почту',
  MISSING_PASSWORD: 'Введите пароль',
  WEAK_PASSWORD: 'Слишком короткий пароль: нужно хотя бы 6 символов',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Слишком много попыток. Подождите пару минут',
  USER_DISABLED: 'Аккаунт отключён',
  EXPIRED_OOB_CODE: 'Ссылка из письма устарела. Запросите письмо ещё раз',
  INVALID_OOB_CODE: 'Ссылка из письма не подошла. Запросите письмо ещё раз',
  OPERATION_NOT_ALLOWED: 'Этот способ входа выключен',
  net: 'Нет связи с интернетом. Попробуйте ещё раз',
  relogin: 'Вход устарел. Войдите в аккаунт заново',
  denied: 'Облако не пустило: подтвердите почту и войдите заново',
  short: 'Пароль: хотя бы 6 символов',
  nomatch: 'Пароли не совпадают',
  conflict: 'Данные изменились на другом телефоне, пробуем ещё раз',
};
export const errText = e => ERR[(e && e.code) || ''] || ('Не получилось' + (e && e.code ? ` (${e.code})` : ''));

export async function idt(method, body, ru) {
  const go = h => fetch(`${FB.idt}${method}?key=${FB.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
  let r;
  try { r = await go(ru ? { 'X-Firebase-Locale': 'ru' } : {}); } catch (e) { if (!ru) throw { code: 'net' }; try { r = await go({}); } catch (e2) { throw { code: 'net' }; } }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: String((j.error && j.error.message) || 'HTTP_' + r.status).split(/[ :]/)[0] };
  return j;
}

/** Обновляет токен по refresh-токену. Возвращает {it, rt, exp}. */
export async function refresh(rt) {
  let r;
  try { r = await fetch(`${FB.stk}?key=${FB.key}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt || '') }); } catch (e) { throw { code: 'net' }; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: r.status >= 500 ? 'net' : 'relogin' };
  return { it: j.id_token, rt: j.refresh_token || rt, exp: Date.now() + (+j.expires_in || 3600) * 1000 };
}

const appUrl = () => location.origin + location.pathname;
export const signUp = (email, password) => idt('signUp', { email, password, returnSecureToken: true }, true);
export const signIn = (email, password) => idt('signInWithPassword', { email, password, returnSecureToken: true }, true);
export const sendVerify = idToken => idt('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken, continueUrl: appUrl() }, true);
export const sendReset = email => idt('sendOobCode', { requestType: 'PASSWORD_RESET', email, continueUrl: appUrl() }, true);
export const lookup = async idToken => ((await idt('lookup', { idToken })).users || [])[0] || null;
export const applyOob = oobCode => idt('update', { oobCode });
export const newPassword = (oobCode, pass) => idt('resetPassword', { oobCode, newPassword: pass });
export const deleteAccount = idToken => idt('delete', { idToken });

/* ───── Firestore: один личный документ ───── */
const docUrl = path => `${FB.fs}${FB.db}/${path}`;
async function fsReq(token, method, url, body) {
  let r;
  try { r = await fetch(url, { method, cache: 'no-store', headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); } catch (e) { throw { code: 'net' }; }
  if (r.status === 404 && method === 'GET') return null;
  const j = await r.json().catch(() => null);
  if (r.status === 401) throw { code: 'relogin' };
  if (r.status === 403) throw { code: 'denied' };
  if (r.status === 409 || r.status === 412 || (j && j.error && j.error.status === 'ALREADY_EXISTS') || (j && j.error && j.error.status === 'FAILED_PRECONDITION')) throw { code: 'conflict' };
  if (!r.ok) throw { code: 'http_' + r.status };
  return j;
}
/** Читает документ: {d: строка, t: число, updateTime} или null. */
export async function docGet(token, path) {
  const j = await fsReq(token, 'GET', docUrl(path));
  if (!j || !j.fields) return null;
  return { d: j.fields.d?.stringValue ?? '', t: +(j.fields.t?.integerValue ?? 0), updateTime: j.updateTime };
}
/** Пишет документ. Если updateTime задан, запись пройдёт только когда документ с тех пор не менялся. */
export async function docSet(token, path, { d, t }, updateTime) {
  const mask = ['d', 't', 'v'].map(f => 'updateMask.fieldPaths=' + f).join('&');
  const pre = updateTime ? 'currentDocument.updateTime=' + encodeURIComponent(updateTime) : 'currentDocument.exists=false';
  const j = await fsReq(token, 'PATCH', `${docUrl(path)}?${mask}&${pre}`, { fields: { d: { stringValue: d }, t: { integerValue: String(Math.round(t)) }, v: { integerValue: '1' } } });
  return j && j.updateTime;
}
