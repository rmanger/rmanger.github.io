// Caches the app so it opens offline. Bump VERSION to force an update.
const VERSION = '1794991165480';
const CACHE = 'blood-tests-' + VERSION;
const FILES = ["./","./advice.js","./app.js","./catalog.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./lib.js","./manifest.webmanifest","./style.css","./vendor/d3.min.js","./vendor/pdf.min.js","./vendor/pdf.worker.min.js"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
