// Имитация Firebase: вход по почте, токены, личный документ Firestore (как в правилах: только подтверждённая почта владельца).
const http = require('http');
const users = new Map(), toks = new Map(), refs = new Map(), docs = new Map(), log = [];
let n = 0;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,authorization,x-firebase-locale', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' };
const byUid = uid => [...users.values()].find(x => x.uid === uid);
const issue = (u, ttl) => {
  const idToken = 'id' + (++n) + Math.random().toString(36).slice(2), refreshToken = 'rt' + n + Math.random().toString(36).slice(2);
  toks.set(idToken, u.uid); refs.set(refreshToken, u.uid);
  return { idToken, refreshToken, expiresIn: String(ttl || 3600), localId: u.uid, email: u.email };
};
const SHORT = process.env.SHORT ? 2 : 3600;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); let body = '';
  req.on('data', d => { body += d; });
  req.on('end', () => {
    const send = (c, o) => { res.writeHead(c, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const err = (m, c = 400) => send(c, { error: { code: c, message: m } });
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const isJson = (req.headers['content-type'] || '').includes('json');
    const J = body && isJson ? JSON.parse(body) : {};
    const p = url.pathname;
    if (p.startsWith('/idt/')) {
      const m = p.slice(5);
      if (m === 'signUp') {
        const email = (J.email || '').toLowerCase();
        if (!email) return err('MISSING_EMAIL');
        if (!/^.+@.+\..+$/.test(email)) return err('INVALID_EMAIL');
        if (users.has(email)) return err('EMAIL_EXISTS');
        if ((J.password || '').length < 6) return err('WEAK_PASSWORD : Password should be at least 6 characters');
        const u = { uid: 'u' + (++n), email, pass: J.password, verified: false }; users.set(email, u); log.push('signUp ' + email);
        return send(200, issue(u, SHORT));
      }
      if (m === 'signInWithPassword') { const u = users.get((J.email || '').toLowerCase()); if (!u || u.pass !== J.password) return err('INVALID_LOGIN_CREDENTIALS'); return send(200, issue(u, SHORT)); }
      if (m === 'sendOobCode') {
        log.push('oob ' + J.requestType + ' ' + (J.email || 'token'));
        if (J.requestType === 'PASSWORD_RESET' && !users.has((J.email || '').toLowerCase())) return err('EMAIL_NOT_FOUND');
        return send(200, { email: J.email || '' });
      }
      if (m === 'lookup') { const u = byUid(toks.get(J.idToken)); if (!u) return err('INVALID_ID_TOKEN'); return send(200, { users: [{ localId: u.uid, email: u.email, emailVerified: u.verified }] }); }
      if (m === 'update') { const em = String(J.oobCode || '').replace('verify-', ''), u = users.get(em); if (!u) return err('INVALID_OOB_CODE'); u.verified = true; return send(200, { email: em }); }
      if (m === 'resetPassword') { const em = String(J.oobCode || '').replace('reset-', ''), u = users.get(em); if (!u) return err('INVALID_OOB_CODE'); u.pass = J.newPassword; return send(200, { email: em }); }
      if (m === 'delete') { const u = byUid(toks.get(J.idToken)); if (u) users.delete(u.email); return send(200, {}); }
    }
    if (p === '/token') {
      const rt = new URLSearchParams(body).get('refresh_token'), u = byUid(refs.get(rt));
      if (!u) return err('INVALID_REFRESH_TOKEN');
      const o = issue(u, SHORT); return send(200, { id_token: o.idToken, refresh_token: o.refreshToken, expires_in: String(SHORT) });
    }
    if (p.startsWith('/fs/')) {
      const m = p.match(/\/documents\/(users\/([^/]+)\/pv\/(?:ten|bot))$/);
      if (!m) return err('not found', 404);
      const u = byUid(toks.get((req.headers.authorization || '').replace('Bearer ', '')));
      if (!u) return err('UNAUTHENTICATED', 401);
      if (!u.verified || u.uid !== m[2]) return err('PERMISSION_DENIED', 403);
      const key = m[1], doc = docs.get(key);
      if (req.method === 'GET') { if (!doc) return err('NOT_FOUND', 404); return send(200, { name: p, fields: { d: { stringValue: doc.d }, t: { integerValue: String(doc.t) }, v: { integerValue: '1' } }, updateTime: doc.ut }); }
      if (req.method === 'PATCH') {
        const pre = url.searchParams.get('currentDocument.updateTime'), ex = url.searchParams.get('currentDocument.exists');
        if (ex === 'false' && doc) return send(409, { error: { status: 'ALREADY_EXISTS' } });
        if (pre && (!doc || doc.ut !== pre)) return send(412, { error: { status: 'FAILED_PRECONDITION' } });
        const f = J.fields, nd = { d: f.d.stringValue, t: +f.t.integerValue, ut: new Date(Date.now() + (++n)).toISOString() };
        docs.set(key, nd); log.push('write ' + key + ' len=' + nd.d.length); return send(200, { name: p, fields: f, updateTime: nd.ut });
      }
    }
    if (p === '/admin/verify') { const u = users.get(url.searchParams.get('email')); if (u) { u.verified = true; return send(200, { ok: 1 }); } return err('no', 404); }
    if (p === '/admin/raw') return send(200, [...docs.entries()].map(([k, v]) => ({ k, d: v.d })));
    if (p === '/admin/state') return send(200, { log, users: [...users.values()].map(u => ({ email: u.email, verified: u.verified, uid: u.uid })), docs: [...docs.entries()].map(([k, v]) => { const j = JSON.parse(v.d); return { k, items: (j.items || []).map(i => ({ t: i.title, done: i.done })), dead: Object.keys(j.dead || {}).length }; }) });
    err('nf', 404);
  });
}).listen(+process.env.FB_PORT || 8130, '127.0.0.1', () => console.log('mock fb up'));
