const CACHE = 'fieldops-shell-v9';
const APP_SHELL = ['/', '/index.html', '/styles.css?v=20260901-location-readings-2', '/app.js?v=20260901-location-readings-2', '/firebase-config.js?v=20260901-location-readings-2', '/manifest.webmanifest?v=20260901-location-readings-2', '/icons/fieldops.svg', '/ops-fracplotter-qr.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('/index.html');
        return Response.error();
      }),
  );
});
