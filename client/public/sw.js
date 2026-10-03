/* Campus Coin service worker.

   Its main job is to make the app installable: Chrome/Edge only fire
   `beforeinstallprompt` (the native one-tap install) when a page controls a
   service worker that has a fetch handler. So this stays deliberately small.

   Strategy: a tiny app-shell cache so the landing + app chrome open offline,
   and network-first for everything else (API calls must always hit the server;
   stale budget data would be worse than an offline message). We never cache
   /api/* responses. */

const CACHE = 'campuscoin-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Web Push: show a system notification when the server sends one, even with the
   app closed. The payload is the JSON the server's push.js puts together. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Campus Coin', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Campus Coin';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'campuscoin',
      renotify: true,
      data: { link: data.link || '/dashboard' },
    })
  );
});

/* Tapping a notification focuses an open tab (routing it to the link) or opens a
   new one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(link).catch(() => {});
          return undefined;
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(link) : undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only GET is cacheable; never touch the API or cross-origin requests.
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigations: network first, fall back to the cached shell when offline so
  // the SPA still boots and client-side routing can take over.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: cache first, then network, and keep a copy for next time.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
