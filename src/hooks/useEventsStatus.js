'use client';

import { useState, useEffect, useCallback } from 'react';

let globalCachedStatus = null;
let globalActiveCount = 0;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 15000; // 15 seconds cache

export function useEventsStatus() {
  const [hasActiveEvents, setHasActiveEvents] = useState(() => {
    return globalCachedStatus !== null ? globalCachedStatus : false;
  });
  const [activeCount, setActiveCount] = useState(() => globalActiveCount);
  const [loading, setLoading] = useState(globalCachedStatus === null);

  const fetchStatus = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && globalCachedStatus !== null && (now - lastFetchTimestamp) < CACHE_TTL_MS) {
      setHasActiveEvents(globalCachedStatus);
      setActiveCount(globalActiveCount);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/events/config', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        const active = Boolean(data?.hasActiveEvents);
        const count = Number(data?.activeCount || 0);

        globalCachedStatus = active;
        globalActiveCount = count;
        lastFetchTimestamp = Date.now();

        setHasActiveEvents(active);
        setActiveCount(count);
      }
    } catch (_err) {
      if (globalCachedStatus === null) {
        setHasActiveEvents(false);
        setActiveCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) {
        await fetchStatus();
      }
    })();

    const handleUpdate = () => {
      if (isMounted) {
        fetchStatus(true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('events_config_updated', handleUpdate);
      return () => {
        isMounted = false;
        window.removeEventListener('events_config_updated', handleUpdate);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [fetchStatus]);

  return {
    hasActiveEvents,
    activeCount,
    loading,
    refreshEventsStatus: () => fetchStatus(true),
  };
}

export function notifyEventConfigChanged() {
  if (typeof window !== 'undefined') {
    globalCachedStatus = null;
    lastFetchTimestamp = 0;
    window.dispatchEvent(new Event('events_config_updated'));
  }
}

export default useEventsStatus;
