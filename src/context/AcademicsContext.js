import React, { createContext, useContext, useEffect, useState } from 'react';
import { safeJsonParse } from '@/lib/json-utils';

const AcademicsContext = createContext(null);

export function AcademicsProvider({ children, roll }) {
  const [cache, setCache] = useState(null);

  useEffect(() => {
    if (!roll) return;
    const key = `academics_cache_${roll}`;
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (raw) {
      // Defer setState to avoid synchronous setState inside effect
      const parsed = safeJsonParse(raw, null);
      setTimeout(() => setCache(parsed), 0);
    }
  }, [roll]);

  const saveCache = React.useCallback((payload) => {
    if (!roll) return;
    try {
      const key = `academics_cache_${roll}`;
      const data = { payload, ts: Date.now() };
      sessionStorage.setItem(key, JSON.stringify(data));
      setCache(data);
    } catch (_e) {
      // ignore storage errors
    }
  }, [roll]);

  const clearCache = React.useCallback(() => {
    if (!roll) return;
    try { sessionStorage.removeItem(`academics_cache_${roll}`); } catch { /* empty */ }
    setCache(null);
  }, [roll]);

  // Detect full page reloads (when available) so callers can decide to refetch
  const isReload = (() => {
    try {
      const nav = performance.getEntriesByType('navigation')?.[0];
      return nav ? nav.type === 'reload' : false;
    } catch (_e) { return false; }
  })();

  return (
    <AcademicsContext.Provider value={{ cache, saveCache, clearCache, isReload }}>
      {children}
    </AcademicsContext.Provider>
  );
}

export function useAcademicsCache() {
  return useContext(AcademicsContext);
}

export default AcademicsContext;
