// ИИ-помощник. Ключ хранится только в браузере; запросы идут напрямую к провайдеру.
import * as St from './store.js';
import * as D from './dates.js';

export const PROVIDERS = {
  gemini: { name: 'Google Gemini', hint: 'ключ из AI Studio', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/apikey' },
  groq: { name: 'Groq', hint: 'быстрый, бесплатный тариф', kind: 'openai', base: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys' },
  openrouter: { name: 'OpenRouter', hint: 'бесплатные модели', kind: 'openai', base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys' },
  custom: { name: 'Свой адрес', hint: 'OpenAI-совместимый', kind: 'openai', base: '', keyUrl: '' },
};

export const cfg = () => St.settings().ai;
export const cur = (a = cfg()) => ({ key: a.keys?.[a.provider] || '', model: a.models?.[a.provider] || '' });
export const baseOf = (a = cfg()) => (a.provider === 'custom' || a.base ? (a.base || '') : PROVIDERS[a.provider].base).replace(/\/+$/, '');
export const ready = () => { const c = cur(); return !!(c.key && c.model && baseOf()); };

async function http(url, opts, ms = 40000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { /* не JSON */ }
    if (!r.ok) { const e = new Error(j?.error?.message || j?.message || txt.slice(0, 200) || `HTTP ${r.status}`); e.status = r.status; throw e; }
    return j;
  } catch (e) {
    if (e.status) throw e;
    const x = new Error(e.name === 'AbortError' ? 'Провайдер не ответил вовремя' : 'Нет связи с провайдером. Проверь интернет'); x.net = true; throw x;
  } finally { clearTimeout(t); }
}
export function friendly(e) {
  if (e.status === 400 && /api key/i.test(e.message)) return 'Ключ не подошёл';
  if (e.status === 401 || e.status === 403) return 'Ключ не подошёл или нет доступа';
  if (e.status === 404) return 'Модель или адрес не найдены';
  if (e.status === 429) return 'Лимит бесплатного тарифа исчерпан. Попробуй позже';
  return e.message || 'Что-то пошло не так';
}

export async function listModels() {
  const a = cfg(), c = cur(a), base = baseOf(a);
  if (PROVIDERS[a.provider].kind === 'gemini') {
    const j = await http(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': c.key } });
    return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  }
  const j = await http(`${base}/models`, { headers: { Authorization: `Bearer ${c.key}` } });
  return (j.data || []).map(m => m.id);
}
/** Подбирает бодрую быструю модель, чтобы не зависеть от переименований. */
export function pickModel(list) {
  if (list.includes('gemini-flash-latest')) return 'gemini-flash-latest';
  const f = list.filter(m => /flash/i.test(m) && !/lite|image|tts|live|audio|embed|thinking|exp|vision/i.test(m)).sort((x, y) => y.localeCompare(x, 'en', { numeric: true }));
  return f[0] || list[0] || '';
}

/* ───── что видит модель ───── */
export function snapshot() {
  const a = cfg().sees, t = D.todayISO();
  const vis = St.items().filter(it => a.priv || !it.priv);
  const tasks = a.tasks ? vis.filter(i => i.kind === 'task').sort((x, y) => (x.done - y.done) || (x.due || '9').localeCompare(y.due || '9')).slice(0, 80)
    .map(i => ({ id: i.id, title: i.title, due: i.due, time: i.time, done: i.done, tail: St.isTail(i, t), daysLeft: i.due ? D.diffDays(t, i.due) : null, subject: i.subject || undefined, estHours: i.est || undefined, firstStep: i.step || undefined })) : [];
  const notes = a.notes ? vis.filter(i => i.kind === 'note').slice(0, 40).map(i => ({ id: i.id, title: i.title, subject: i.subject || undefined })) : [];
  return { today: t, weekday: D.WD[D.dow(t)], tasks, notes };
}
export function counts() {
  const a = cfg().sees, t = D.todayISO(), vis = St.items().filter(it => a.priv || !it.priv);
  const open = a.tasks ? vis.filter(i => i.kind === 'task' && !i.done) : [];
  return { tasks: open.length, tails: open.filter(i => St.isTail(i, t)).length, notes: a.notes ? vis.filter(i => i.kind === 'note').length : 0 };
}

const SYS = `Ты — помощник в приложении-планировщике «Тень». Отвечай по-русски, коротко и по делу (до 4 предложений), без вступлений и воды.
Ты видишь актуальный снимок данных пользователя в JSON. Опирайся только на него, не выдумывай дела, id и даты.
Горизонт (радар): чем меньше дней до срока, тем ближе дело к центру. «Хвост» — просроченное дело (tail=true): его надо закрывать в первую очередь, самый дешёвый — первым.
Если пользователь просит добавить, перенести, отметить сделанным или удалить дело — верни это в actions; применяет их сам пользователь после подтверждения.
Формат ответа — СТРОГО один JSON без текста вне него:
{"reply":"текст ответа","actions":[{"type":"add","title":"…","due":"YYYY-MM-DD","time":"HH:MM","estHours":3,"subject":"…","kind":"task"},{"type":"done","id":"…"},{"type":"move","id":"…","due":"YYYY-MM-DD","time":"HH:MM"},{"type":"delete","id":"…"}]}
Поля due, time, estHours, subject, kind необязательны. Если действий нет — "actions":[]. Даты считай от сегодняшней. kind: "task" или "note".`;

function parse(text) {
  let s = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try { return JSON.parse(s); } catch (e) { /* ищем объект внутри */ }
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { /* текст */ } }
  return { reply: s, actions: [] };
}

/** history: [{role:'user'|'bot', text}] — предыдущие реплики, без текущей. */
export async function chat(history, userText) {
  const a = cfg(), c = cur(a), base = baseOf(a), sys = `${SYS}\n\nСНИМОК ДАННЫХ:\n${JSON.stringify(snapshot())}`;
  const hist = history.slice(-8);
  let out;
  if (PROVIDERS[a.provider].kind === 'gemini') {
    const contents = [...hist.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: userText }] }];
    const j = await http(`${base}/models/${encodeURIComponent(c.model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } }),
    });
    out = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!out) throw new Error(j?.promptFeedback?.blockReason ? 'Ответ заблокирован провайдером' : 'Пустой ответ модели');
  } else {
    const messages = [{ role: 'system', content: sys }, ...hist.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })), { role: 'user', content: userText }];
    const call = rf => http(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` }, body: JSON.stringify({ model: c.model, messages, temperature: 0.4, ...(rf ? { response_format: { type: 'json_object' } } : {}) }) });
    let j; try { j = await call(true); } catch (e) { if (e.status === 400) j = await call(false); else throw e; }
    out = j?.choices?.[0]?.message?.content || '';
    if (!out) throw new Error('Пустой ответ модели');
  }
  const r = parse(out);
  return { reply: String(r.reply ?? '').trim() || 'Готово.', actions: cleanActions(r.actions) };
}

/* ───── действия, которые предлагает модель ───── */
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function cleanActions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list.slice(0, 12)) {
    if (!x || typeof x !== 'object') continue;
    if (x.type === 'add' && typeof x.title === 'string' && x.title.trim()) {
      const kind = x.kind === 'note' ? 'note' : 'task';
      out.push({ type: 'add', title: x.title.trim().slice(0, 200), kind, due: kind === 'task' && isDate(x.due) ? x.due : null, time: kind === 'task' && isTime(x.time) ? x.time : null, est: Number(x.estHours) > 0 ? Number(x.estHours) : null, subject: typeof x.subject === 'string' ? x.subject.slice(0, 60) : '' });
    } else if (['done', 'move', 'delete'].includes(x.type) && St.get_(x.id)) {
      const a = { type: x.type, id: x.id };
      if (x.type === 'move') { if (!isDate(x.due)) continue; a.due = x.due; a.time = isTime(x.time) ? x.time : null; }
      out.push(a);
    }
  }
  return out;
}
export function describe(a) {
  const it = a.id ? St.get_(a.id) : null;
  if (a.type === 'add') return { sign: '+', text: `${a.title}${a.due ? ' · ' + D.fmtDay(a.due) : ''}${a.time ? ' ' + a.time : ''}`, kind: a.kind };
  if (a.type === 'done') return { sign: '✓', text: it?.title || '' };
  if (a.type === 'move') return { sign: '→', text: `${it?.title || ''}: ${D.fmtDay(a.due)}${a.time ? ' ' + a.time : ''}` };
  return { sign: '×', text: it?.title || '' };
}
export function apply(list) {
  let n = 0;
  for (const a of list) {
    if (a.type === 'add') { St.addItem({ title: a.title, kind: a.kind, due: a.due, time: a.time, est: a.est, subject: a.subject, source: 'ai' }); n++; }
    else if (a.type === 'done') { const it = St.get_(a.id); if (it && !it.done) { St.toggleDone(a.id); n++; } }
    else if (a.type === 'move') { if (St.updateItem(a.id, { due: a.due, time: a.time })) n++; }
    else if (a.type === 'delete') { St.removeItem(a.id); n++; }
  }
  return n;
}
