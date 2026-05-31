import { useState, useCallback, useEffect } from 'react';

export function useSecurityEvents(userId, isEmailVerified = true) {
  const [securityEvents, setSecurityEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!userId || !isEmailVerified) return;
    setEventsLoading(true);
    try {
      const res = await fetch('/api/auth/security-events');
      if (res.ok) {
        const data = await res.json();
        setSecurityEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setEventsLoading(false);
    }
  }, [userId, isEmailVerified]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  return { securityEvents, eventsLoading, fetchEvents };
}
