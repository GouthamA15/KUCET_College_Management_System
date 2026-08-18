// Bump version when SW changes to force old SW to be replaced and old caches cleared.
const CACHE_NAME = 'kucet-cms-v3';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/offline',
  '/favicon.ico',
  '/manifest.json'
  // NOTE: Do NOT precache '/' — it redirects based on auth state (middleware)
  // and caching a stale redirect would break the login flow.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Explicit cache purge handler on logout / account switch
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'CLEAR_ALL_CACHES' || event.data.type === 'LOGOUT')) {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. CRITICAL INVARIANT: ALL /api/* requests MUST BYPASS the Service Worker cache completely.
  // Dynamic API routes represent authenticated user session data and must NEVER be cached
  // across users or sessions by the Service Worker.
  if (url.pathname.startsWith('/api/') || request.method !== 'GET') {
    return;
  }

  // 2. Navigation requests (HTML page loads) MUST always go to the network.
  // The auth middleware returns different responses (redirects vs. 200) based on cookie state.
  // Serving a stale cached navigation response causes the browser to hydrate with stale auth state.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        // Network is offline — serve cached version or offline fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        const offlineResponse = await caches.match(OFFLINE_URL);
        if (offlineResponse) return offlineResponse;
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
    );
    return;
  }

  // 3. Stale-While-Revalidate ONLY for static web assets (_next/static, images, CSS, fonts)
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);

      const fetchPromise = (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const responseForCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, responseForCache);
          }
          return networkResponse;
        } catch (_error) {
          return null;
        }
      })();

      if (cachedResponse) {
        // Trigger background revalidation safely
        fetchPromise.catch(() => {});
        return cachedResponse;
      }

      const networkRes = await fetchPromise;
      if (networkRes) {
        return networkRes;
      }

      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })()
  );
});

// Web Push Notification Support
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'KUCET CMS Notification';
    const options = {
      body: data.body || '',
      icon: data.icon || '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        url: data.url || '/',
        ...data.data
      },
      tag: data.category || 'general',
      renotify: true
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_e) {
    const rawText = event.data.text();
    event.waitUntil(
      self.registration.showNotification('KUCET CMS', {
        body: rawText,
        icon: '/favicon.ico'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
