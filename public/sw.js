// Cotton Nest Atelier Service Worker for PWA Installability, Offline Support & Device OS Notification Bar
const CACHE_NAME = 'cotton-nest-pwa-v3';
const DEFAULT_ICON = '/pwa-192x192.png';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler required by Chrome for PWA installability & offline support
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Skip API and Firestore/Google auth calls so live data is always fresh
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('accounts.google.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          url.origin === self.location.origin
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// Handle incoming Web Push events
self.addEventListener('push', (event) => {
  let data = {
    title: 'Cotton Nest Atelier',
    body: 'You have a new update on your bedsheet order.',
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
    tag: data.tag || `cotton-nest-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'View Update' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Also allow page clients to postMessage a SHOW_OS_NOTIFICATION command to the service worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_OS_NOTIFICATION') {
    const { title, body, url, tag, icon } = event.data.payload || {};
    if (title) {
      event.waitUntil(
        self.registration.showNotification(title, {
          body: body || '',
          icon: icon || DEFAULT_ICON,
          badge: DEFAULT_ICON,
          tag: tag || `cn-notif-${Date.now()}`,
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url: url || '/' },
        })
      );
    }
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICKED', data: event.notification.data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
