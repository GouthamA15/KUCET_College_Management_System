// KUCET CMS - Production Service Worker
// Version: v4 (Session 209 Reliability & Chunk Recovery Release)
const CACHE_VERSION = 'v4';
const CACHE_NAME = `kucet-cms-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/offline',
  '/favicon.ico',
  '/manifest.json',
  '/assets/ku-college-logo.png'
  // NOTE: Do NOT precache '/' — it redirects based on auth state (middleware)
  // and caching a stale redirect would break the multi-role login flow.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Explicit cache management & version query messages
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_ALL_CACHES' || event.data.type === 'LOGOUT') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
    );
  } else if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_VERSION, cacheName: CACHE_NAME });
    }
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. CRITICAL INVARIANT: ALL /api/* requests and non-GET methods MUST BYPASS SW cache completely.
  // Dynamic API routes represent authenticated user session data and must NEVER be cached by the Service Worker.
  if (url.pathname.startsWith('/api/') || request.method !== 'GET') {
    return;
  }

  // 2. Ignore non-HTTP(S) schemes (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Next.js RSC flight payloads, pre-fetches, and data chunks MUST BYPASS Service Worker cache
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1' || url.pathname.startsWith('/_next/data/')) {
    return;
  }

  // 3. Navigation requests (HTML page loads) MUST always prioritize network.
  // Auth middleware returns different responses (redirects vs. 200) based on dynamic cookie state.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        // Network request failed — try serving cached offline page
        const offlineResponse = await caches.match(OFFLINE_URL);
        if (offlineResponse) return offlineResponse;
        return new Response('Network connection failed. Please check your connectivity.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
    return;
  }

  // 4. Next.js Static Chunks (/_next/static/chunks/...)
  // Immutable hashed assets are served directly from the browser's HTTP cache.
  // Do NOT intercept and return synthetic 503s on 404s, so that Next.js client-side
  // ChunkLoadError handlers can cleanly catch missing chunks and trigger auto-reload.
  if (url.pathname.startsWith('/_next/static/chunks/')) {
    return;
  }

  // 5. Cache static web assets (images, fonts, stylesheets, icons) with Stale-While-Revalidate
  const isStaticMediaAsset =
    url.pathname.startsWith('/_next/static/media/') ||
    url.pathname.startsWith('/_next/static/css/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2|woff|ttf|ico)$/i);

  if (isStaticMediaAsset) {
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
          // Serve from cache immediately; update in background
          fetchPromise.catch(() => {});
          return cachedResponse;
        }

        const networkRes = await fetchPromise;
        if (networkRes) {
          return networkRes;
        }

        return new Response('Asset Unavailable', { status: 404, statusText: 'Not Found' });
      })()
    );
  }
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
        ...data.data,
      },
      tag: data.category || 'general',
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_e) {
    const rawText = event.data.text();
    event.waitUntil(
      self.registration.showNotification('KUCET CMS', {
        body: rawText,
        icon: '/favicon.ico',
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
