// Имитация Telegram Bot API: запоминает вызовы, отдаёт поставленные в очередь обновления.
const http = require('http');
const calls = [], queue = []; let mid = 100, uid = 1;
http.createServer((req, res) => {
  let body = ''; req.on('data', d => { body += d; });
  req.on('end', async () => {
    const send = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/admin/calls') return send(calls);
    if (url.pathname === '/admin/clear') { calls.length = 0; return send({ ok: 1 }); }
    if (url.pathname === '/admin/push') { const u = JSON.parse(body); queue.push({ update_id: uid++, ...u }); return send({ ok: 1 }); }
    const m = url.pathname.match(/^\/bot[^/]+\/(\w+)$/); if (!m) return send({ ok: false, description: 'not found' });
    const P = body ? JSON.parse(body) : {}; calls.push({ method: m[1], ...P });
    if (m[1] === 'getUpdates') { if (!queue.length) await new Promise(r => setTimeout(r, 300)); return send({ ok: true, result: queue.splice(0) }); }
    if (m[1] === 'sendMessage') return send({ ok: true, result: { message_id: ++mid, chat: { id: P.chat_id } } });
    send({ ok: true, result: true });
  });
}).listen(+process.env.TG_PORT || 8131, '127.0.0.1', () => console.log('mock tg up'));
