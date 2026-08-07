const CACHE_NAME = 'kucet-cms-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/favicon.ico',
  '/manifest.json'
];

const BYPASS_CACHE_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/student\/login/,
  /\/api\/clerk\/login/,
  /\/api\/admin\/login/,
  /\/api\/student\/finances\/pay/,
  /\/api\/auth\/reset-password/
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

  // 1. Explicitly bypass sensitive auth and payment POST requests
  if (BYPASS_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname)) || request.method !== 'GET') {
    return;
  }

  // 2. Offline Priority Routes (ID Card, Fee Receipts, Timetable)
  if (OFFLINE_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          throw error;
        }
      })
    );
    return;
  }

  // 3. Stale-While-Revalidate for standard navigation/assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
