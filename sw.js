// Офлайн: сначала сеть (чтобы обновления доходили сразу), без сети — из кэша.
const CACHE = 'ten-v7';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/fonts.css', 'js/app.js', 'js/ui.js', 'js/sfx.js', 'js/dates.js', 'js/store.js', 'js/mem.js', 'js/radar.js', 'js/ai.js', 'js/fb.js', 'js/auth.js', 'js/gate.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'fonts/oswald-cyrillic-wght-normal.woff2', 'fonts/oswald-latin-wght-normal.woff2', 'fonts/rubik-cyrillic-wght-normal.woff2', 'fonts/rubik-latin-wght-normal.woff2', 'fonts/martian-mono-cyrillic-wght-normal.woff2', 'fonts/martian-mono-latin-wght-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isFont = /\.(woff2?|png|svg)$/.test(req.url);
  e.respondWith(
    isFont
      ? caches.match(req).then(hit => hit || fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }))
      : fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; })
          .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
