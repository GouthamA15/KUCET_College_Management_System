import React, { createContext, useContext, useEffect, useState } from 'react';

const AcademicsContext = createContext(null);

export function AcademicsProvider({ children, roll }) {
  const [cache, setCache] = useState(null);

  useEffect(() => {
    if (!roll) return;
    try {
      const key = `academics_cache_${roll}`;
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (raw) {
        setCache(JSON.parse(raw));
      }
    } catch (e) {
      // ignore parse errors
      setCache(null);
    }
  }, [roll]);

  const saveCache = (payload) => {
    if (!roll) return;
    try {
      const key = `academics_cache_${roll}`;
      const data = { payload, ts: Date.now() };
      sessionStorage.setItem(key, JSON.stringify(data));
      setCache(data);
    } catch (e) {
      // ignore storage errors
    }
  };

  const clearCache = () => {
    if (!roll) return;
    try { sessionStorage.removeItem(`academics_cache_${roll}`); } catch {}
    setCache(null);
  };

  // Detect full page reloads (when available) so callers can decide to refetch
  const isReload = (() => {
    try {
      const nav = performance.getEntriesByType('navigation')?.[0];
      return nav ? nav.type === 'reload' : false;
    } catch (e) { return false; }
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
