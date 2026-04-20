const CACHE = 'ls-inventory-v9';
const STATIC = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/css/style.css?v=9',
  '/css/skeu.css?v=9',
  '/js/storage.js?v=9',
  '/js/api.js?v=9',
  '/js/ui.js?v=9',
  '/js/app.js?v=9',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Never intercept API calls — always go to the network
  if (new URL(e.request.url).pathname.startsWith('/api/')) return;

  // Static assets: network first, fall back to cache so the UI loads offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
