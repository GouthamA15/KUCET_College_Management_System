// KUCET CMS - Production Service Worker
// Version: v5 (Auto-Reconnection & Resilient Pre-Cache Release)
const CACHE_VERSION = 'v5';
const CACHE_NAME = `kucet-cms-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/offline',
  '/favicon.ico',
  '/manifest.json',
  '/manifest.webmanifest',
  '/assets/ku-college-logo.png'
  // NOTE: Do NOT precache '/' — it redirects based on auth state (middleware)
  // and caching a stale redirect would break the multi-role login flow.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        for (const asset of PRECACHE_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            // Non-fatal: individual asset failure should not break service worker registration
            console.warn('[SW] Precache item failed:', asset, err?.message || err);
          }
        }
      })
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

        // Auto-reconnecting HTML fallback with background health polling
        const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>KUCET CMS - Reconnecting</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b192c; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px 28px; max-width: 440px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); }
    .icon { width: 56px; height: 56px; margin: 0 auto 20px; background: rgba(234, 179, 8, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #eab308; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #f8fafc; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    .status { font-size: 12px; color: #38bdf8; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
    .btn { display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: none; cursor: pointer; transition: background 0.15s; width: 100%; }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
    </div>
    <h1>Reconnecting to Campus Portal</h1>
    <p>Network connectivity was briefly interrupted. The system is continuously monitoring the connection and will automatically return to the portal once restored.</p>
    <div class="status"><span class="dot"></span> <span>Checking campus server status...</span></div>
    <button class="btn" onclick="checkNow()">Retry Now</button>
  </div>
  <script>
    async function checkNow() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          window.location.replace('/');
          return;
        }
      } catch (e) {}
      window.location.reload();
    }
    setInterval(async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          window.location.replace('/');
        }
      } catch (e) {}
    }, 3000);
  </script>
</body>
</html>`;

        return new Response(fallbackHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      })
    );
    return;
  }

  // 4. Next.js Static Assets & Chunks (/_next/static/...)
  // Immutable hashed assets are served directly from the browser's HTTP cache.
  // Do NOT intercept and return synthetic 503s on 404s, so that Next.js client-side
  // ChunkLoadError handlers can cleanly catch missing chunks and trigger auto-reload.
  if (url.pathname.startsWith('/_next/static/chunks/') || url.pathname.startsWith('/_next/static/')) {
    return;
  }

  // 5. Cache static web assets (images, fonts, stylesheets, icons) with Stale-While-Revalidate
  const isStaticMediaAsset =
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
