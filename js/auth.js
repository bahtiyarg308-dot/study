// Аккаунт и облако: вход по почте с подтверждением письмом, синхронизация дел между телефонами.
// Состояние входа лежит в meta.acc на этом телефоне; без подтверждённой почты приложение закрыто.
import * as St from './store.js';
import * as F from './fb.js';

export const acc = () => St.meta().acc || null;
export const gateOk = () => { const a = acc(); return !!a && !a.bad && a.ver === 1; };
const save = patch => St.setMeta({ acc: { ...acc(), ...patch } });
const subs = new Set();
export const onChange = f => { subs.add(f); return () => subs.delete(f); };
const fire = () => subs.forEach(f => f());
const msubs = new Set();
/** Вызывается, когда с другого телефона пришли изменения: список нужно перерисовать. */
export const onMerged = f => { msubs.add(f); return () => msubs.delete(f); };

/** Свежий токен доступа. Если облако говорит «войдите заново», помечаем вход устаревшим. */
export async function token(force) {
  const a = acc(); if (!a) throw { code: 'relogin' };
  if (!force && a.it && a.exp > Date.now() + 60000) return a.it;
  try { const r = await F.refresh(a.rt); save(r); return r.it; }
  catch (e) { if (e.code === 'relogin') { save({ bad: true }); fire(); } throw e; }
}

const take = res => St.setMeta({ acc: { uid: res.localId, email: res.email, it: res.idToken, rt: res.refreshToken, exp: Date.now() + (+res.expiresIn || 3600) * 1000, ver: 0, vs: 0 } });

export async function checkVerified() {
  const a = acc(); if (!a) return false;
  const u = await F.lookup(await token());
  if (!u) { save({ bad: true }); throw { code: 'relogin' }; }
  if (u.emailVerified) { save({ ver: 1, bad: false }); await token(true); return true; } // свежий токен уже несёт отметку «почта подтверждена»
  save({ ver: 0 }); return false;
}
/** Письмо со ссылкой. Не чаще раза в минуту, если не просили явно. */
export async function resendVerify(force) {
  const a = acc(); if (!a) return false;
  if (!force && a.vs && Date.now() - a.vs < 55000) return false;
  save({ vs: Date.now() }); await F.sendVerify(await token()); return true;
}
export async function signUp(email, pass) { take(await F.signUp(email, pass)); await resendVerify(true); }
export async function signIn(email, pass) { take(await F.signIn(email, pass)); return checkVerified(); }
export const resetMail = email => F.sendReset(email);
export function signOut() { const a = acc(); St.setMeta({ acc: null, owner: a ? a.uid : St.meta().owner }); stop(); fire(); }

/** Ссылки из писем: …/?mode=verifyEmail&oobCode=… или resetPassword (если адрес действий в Firebase указывает на приложение). */
export function takeLink() {
  const q = new URLSearchParams(location.search), mode = q.get('mode'), oob = q.get('oobCode');
  if (!mode || !oob) return null;
  history.replaceState(null, '', location.origin + location.pathname + (location.hash || ''));
  return { mode, oob };
}

/* ───── смена аккаунта на телефоне ───── */
export const ownerConflict = () => { const m = St.meta(), a = acc(); return !!(a && m.owner && m.owner !== a.uid && St.items().length); };
export const adoptOwner = () => { const a = acc(); if (a) St.setMeta({ owner: a.uid }); };

/* ───── синхронизация ───── */
let busy = false, timer = null, poll = null;
export const status = { state: 'idle', at: 0, err: '' };
const path = a => `users/${a.uid}/pv/ten`;
/** Размер в байтах: русские буквы занимают по два, а лимит документа в облаке считается именно в байтах. */
const bytes = str => new TextEncoder().encode(str).length;
export const LIMIT = 900000;

export async function syncNow() {
  if (busy || !gateOk() || navigator.onLine === false) { if (navigator.onLine === false && gateOk()) { status.state = 'offline'; fire(); } return false; }
  busy = true; status.state = 'sync'; fire();
  const started = Date.now(); let changed = false;
  try {
    for (let tries = 0; tries < 4; tries++) {
      const a = acc(), tok = await token(), doc = await F.docGet(tok, path(a));
      if (doc && doc.d) { let rem = null; try { rem = JSON.parse(doc.d); } catch (e) { /* облако пустое или повреждено */ } if (rem && St.mergeRemote(rem)) changed = true; }
      const json = JSON.stringify(St.payload());
      if (bytes(json) > LIMIT) throw { code: 'big' };
      if (doc && doc.d === json) break; // облако уже такое же
      try { await F.docSet(tok, path(a), { d: json, t: Date.now() }, doc ? doc.updateTime : null); break; }
      catch (e) { if (e.code === 'conflict' && tries < 3) continue; throw e; }
    }
    status.state = 'ok'; status.at = Date.now(); status.err = '';
    St.setMeta({ syncedAt: status.at, ...(St.meta().dirty <= started ? { dirty: 0 } : {}) });
  } catch (e) {
    status.state = e.code === 'net' ? 'offline' : 'err'; status.err = e.code === 'big' ? 'Данных слишком много для облака' : F.errText(e);
  } finally { busy = false; fire(); }
  if (changed) msubs.forEach(f => f());
  return changed;
}
/** Что прямо сейчас лежит в облаке (читаем документ заново, а не из памяти телефона). */
export async function cloudInfo() {
  const a = acc(); if (!a) throw { code: 'relogin' };
  const doc = await F.docGet(await token(), path(a));
  if (!doc || !doc.d) return { empty: true };
  let rem; try { rem = JSON.parse(doc.d); } catch (e) { return { bad: true }; }
  const it = Array.isArray(rem.items) ? rem.items : [], topics = it.filter(x => x.kind === 'topic');
  return { bytes: bytes(doc.d), tasks: it.filter(x => x.kind === 'task').length, notes: it.filter(x => x.kind === 'note').length, topics: topics.length, reviews: topics.reduce((n, x) => n + (x.mem && x.mem.n ? x.mem.n : 0), 0), t: doc.t };
}
export function schedule(ms = 4000) { clearTimeout(timer); if (!gateOk()) return; timer = setTimeout(() => { syncNow(); }, ms); }
export function start() {
  St.onItems(() => schedule(4000));
  clearInterval(poll);
  poll = setInterval(() => { if (gateOk() && document.visibilityState === 'visible' && navigator.onLine !== false) syncNow(); }, 90000);
  if (gateOk()) schedule(800);
}
function stop() { clearTimeout(timer); clearInterval(poll); poll = null; status.state = 'idle'; }
window.addEventListener('online', () => { if (gateOk()) schedule(500); });
