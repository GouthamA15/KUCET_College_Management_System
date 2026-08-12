// Bump version when SW changes to force old SW to be replaced and old caches cleared.
const CACHE_NAME = 'kucet-cms-v2';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/offline',
  '/favicon.ico',
  '/manifest.json'
  // NOTE: Do NOT precache '/' — it redirects based on auth state (middleware)
  // and caching a stale redirect would break the login flow.
];

const BYPASS_CACHE_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/student\/login/,
  /\/api\/clerk\/login/,
  /\/api\/admin\/login/,
  /\/api\/student\/finances\/pay/,
  /\/api\/auth\/reset-password/,
  /\/api\/assets\/view\//,
  /\/uploads\//,
  /\/api\/student\/image\//,
  /\/api\/student\/requests\/image\//
];

const OFFLINE_CACHE_PATTERNS = [
  /\/student\/requests\/id-card/,
  /\/api\/student\/requests\/id-card/,
  /\/student\/finances/,
  /\/api\/student\/finances\/receipts/,
  /\/student\/academics/,
  /\/api\/student\/academics\/timetable/
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Explicitly bypass sensitive auth and payment POST requests (and all non-GET)
  if (BYPASS_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname)) || request.method !== 'GET') {
    return;
  }

  // 2. CRITICAL FIX: Navigation requests (HTML page loads) MUST always go to the
  // network. The auth middleware returns different responses (redirects vs. 200) based
  // on cookie state. Serving a stale cached navigation response causes the browser to
  // hydrate with auth state that no longer matches the server, leading to redirect loops
  // and ERR_FAILED after the session expires.
  //
  // We only fall back to cache/offline if the network request fails entirely.
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

  // 3. Offline Priority Routes (ID Card, Fee Receipts, Timetable) — network-first with cache fallback
  if (OFFLINE_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
        }
      })()
    );
    return;
  }

  // 4. Stale-While-Revalidate for static assets (JS, CSS, images, fonts)
  // Navigation requests have already been handled above — this only covers assets.
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
        } catch (error) {
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
