// Cotton Nest Atelier Service Worker for Web Push & Device OS Notification Bar
const CACHE_NAME = 'cotton-nest-v2';
const DEFAULT_ICON = 'https://res.cloudinary.com/ys2sgydi/image/upload/w_192,h_192,c_pad,b_rgb:FAF7F2/logo-removebg-preview.png';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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

// Also allow page clients to postMessage a SHOW_NOTIFICATION command to the service worker
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
