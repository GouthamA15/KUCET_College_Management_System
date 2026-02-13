'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ClerkContext = createContext();

export function ClerkProvider({ children }) {
  const [clerkData, setClerkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClerk = useCallback(async () => {
    try {
      const res = await fetch('/api/clerk/me');
      const data = await res.json();
      if (res.ok) {
        setClerkData(data);
        return data;
      } else {
        setError(data.error || 'Failed to fetch clerk data');
      }
    } catch (e) {
      setError('Network error');
    }
    return null;
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchClerk();
      setLoading(false);
    };
    init();
  }, [fetchClerk]);

  return (
    <ClerkContext.Provider value={{ clerkData, setClerkData, loading, error, refreshClerk: fetchClerk }}>
      {children}
    </ClerkContext.Provider>
  );
}

export function useClerk() {
  const context = useContext(ClerkContext);
  if (context === undefined) {
    throw new Error('useClerk must be used within a ClerkProvider');
  }
  return context;
}
