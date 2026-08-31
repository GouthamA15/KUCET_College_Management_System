'use client';

import { useEffect } from 'react';

const CHUNK_RETRY_KEY = 'kucet_chunk_retry_ts';
const CHUNK_RETRY_WINDOW_MS = 20000; // 20-second throttle window

/**
 * Determines whether an error event or rejection represents a Next.js / Webpack chunk loading failure.
 */
export function isChunkLoadError(error) {
  if (!error) return false;
  const message = error.message || (typeof error === 'string' ? error : '') || '';
  const name = error.name || '';
  
  return (
    name === 'ChunkLoadError' ||
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

/**
 * Attempts a single transparent reload to recover from a chunk load failure.
 * Returns true if reload was triggered, or false if throttled (to avoid infinite loops).
 */
export function handleChunkRecovery(error) {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  const lastRetryStr = sessionStorage.getItem(CHUNK_RETRY_KEY);
  const lastRetry = lastRetryStr ? parseInt(lastRetryStr, 10) : 0;

  if (!lastRetry || now - lastRetry > CHUNK_RETRY_WINDOW_MS) {
    sessionStorage.setItem(CHUNK_RETRY_KEY, now.toString());
    console.warn('[PWA] Stale chunk detected after deployment. Performing graceful page refresh...', error);
    window.location.reload();
    return true;
  }

  console.error('[PWA] Chunk load failure persisted across reload. Retaining error boundary.', error);
  return false;
}

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Global Window Error & Unhandled Rejection Listeners for ChunkLoadErrors
    const handleError = (event) => {
      const error = event.error || event;
      if (isChunkLoadError(error)) {
        const reloaded = handleChunkRecovery(error);
        if (reloaded) {
          event.preventDefault();
        }
      }
    };

    const handleUnhandledRejection = (event) => {
      const reason = event.reason;
      if (isChunkLoadError(reason)) {
        const reloaded = handleChunkRecovery(reason);
        if (reloaded) {
          event.preventDefault();
        }
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 2. Service Worker Lifecycle Management
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      let workerCleanup = null; // Stores cleanup returned by registerWorker

      // Handle service worker updates without reload loops
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.info('[PWA] New Service Worker activated and claimed clients.');
        }
      });

      const registerWorker = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          console.info('[PWA] ServiceWorker registered with scope:', reg.scope);

          // Check for worker updates on registration
          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('[PWA] New application version available in background.');
                }
              });
            }
          });

          // Check for worker updates when tab becomes visible
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              reg.update().catch(() => {});
            }
          };
          document.addEventListener('visibilitychange', handleVisibilityChange);

          // Periodic background check every 15 minutes
          const intervalId = setInterval(() => {
            reg.update().catch(() => {});
          }, 15 * 60 * 1000);

          // Return cleanup so the useEffect teardown can release these resources
          return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId);
          };
        } catch (err) {
          console.warn('[PWA] ServiceWorker registration failed:', err);
          return null;
        }
      };

      if (document.readyState === 'complete') {
        registerWorker().then((cleanup) => { workerCleanup = cleanup; });
      } else {
        const onLoad = () => {
          registerWorker().then((cleanup) => { workerCleanup = cleanup; });
        };
        window.addEventListener('load', onLoad);
        // Store onLoad for removal; overwrite workerCleanup to also remove the load listener
        const previousCleanup = workerCleanup;
        workerCleanup = () => {
          window.removeEventListener('load', onLoad);
          if (previousCleanup) previousCleanup();
        };
      }

      return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        if (workerCleanup) workerCleanup();
      };
    }

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
