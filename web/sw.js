/* Service Worker Mélyia PWA — caching strategy minimaliste
   - HTML : NetworkFirst (récupère les updates)
   - JS/CSS/vendor : CacheFirst (perf max)
   - Tout le reste : Network only (Google APIs surtout)
*/

const VERSION = 'v13';
const CACHE_STATIC = 'melyia-static-' + VERSION;
const CACHE_HTML = 'melyia-html-' + VERSION;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/vendor/tailwind.js',
  '/vendor/dexie.min.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_HTML)
          .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin (Google APIs, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip OAuth callback (always live)
  if (url.pathname === '/oauth-callback' || url.pathname === '/oauth-callback.html') return;

  // HTML : NetworkFirst (récupère les updates), fallback cache offline
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_HTML).then(cache => cache.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // JS/CSS/Vendor/Icons : CacheFirst
  if (/\.(js|css|png|svg|ico|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }
});
