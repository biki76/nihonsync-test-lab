// public/sw.js
const CACHE_NAME = 'nihonsync-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Blocked endpoints: never serve from cache, return offline error
  if (
    url.pathname.includes('/rest/v1/questions') ||
    url.pathname.includes('/functions/v1/score') ||
    url.pathname.includes('/functions/v1/score/ping')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'OFFLINE_NO_CACHE',
            message: 'An internet connection is required to load questions. Please reconnect and try again.',
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // Static assets: cache-first
  const isStaticAsset =
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|webp)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
