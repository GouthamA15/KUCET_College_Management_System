'use client';
import { useState, useEffect } from 'react';

const STORAGE_COUNT_KEY = 'profileStatusBarCount';
const STORAGE_SEEN_ID_KEY = 'profileStatusBarSeenRequestId';
const STORAGE_SEEN_STATUS_KEY = 'profileStatusBarSeenStatus';

export default function useProfileActivity(rollno) {
  const [latestRequest, setLatestRequest] = useState(null);
  const [dismissCount, setDismissCount] = useState(() => {
    try { return Number(localStorage.getItem(STORAGE_COUNT_KEY) || '0'); } catch { return 0; }
  });
  const [seenRequestId, setSeenRequestId] = useState(() => {
    try { return localStorage.getItem(STORAGE_SEEN_ID_KEY) || null; } catch { return null; }
  });
  const [seenStatus, setSeenStatus] = useState(() => {
    try { return localStorage.getItem(STORAGE_SEEN_STATUS_KEY) || null; } catch { return null; }
  });

  useEffect(() => {
    let mounted = true;

    if (!rollno) {
      if (latestRequest !== null) {
        // Defer state update to avoid synchronous set warning
        const timer = setTimeout(() => setLatestRequest(null), 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/student/latest-request?rollno=${encodeURIComponent(rollno)}`);
        if (!mounted) return;
        
        if (res.ok) {
          const data = await res.json();
          const req = data?.latestRequest || null;
          
          if (mounted) {
            setLatestRequest(req);
            
            // Handle local storage logic for tracking seen status
            const incomingId = req?.request_id ? String(req.request_id) : null;
            const incomingStatus = req?.status ? String(req.status) : null;

            if ((incomingId && incomingId !== seenRequestId) || (incomingStatus && incomingStatus !== seenStatus)) {
              // Reset dismiss count for new request or status change
              setDismissCount(0);
              setSeenRequestId(incomingId);
              setSeenStatus(incomingStatus);
              
              try {
                localStorage.setItem(STORAGE_COUNT_KEY, '0');
                if (incomingId) localStorage.setItem(STORAGE_SEEN_ID_KEY, incomingId);
                if (incomingStatus) localStorage.setItem(STORAGE_SEEN_STATUS_KEY, incomingStatus);
              } catch (e) {
                console.error('Storage error:', e);
              }
            }
          }
        } else {
          if (mounted) setLatestRequest(null);
        }
      } catch (e) {
        if (mounted) setLatestRequest(null);
      }
    };

    fetchData();

    return () => { mounted = false; };
  }, [rollno]);

  const incrementVisit = () => {
    try {
      const next = Number(localStorage.getItem(STORAGE_COUNT_KEY) || '0') + 1;
      localStorage.setItem(STORAGE_COUNT_KEY, String(next));
      setDismissCount(next);
    } catch (e) {}
  };

  const dismiss = () => {
    try {
      const next = Number(localStorage.getItem(STORAGE_COUNT_KEY) || '0') + 1;
      localStorage.setItem(STORAGE_COUNT_KEY, String(next));
      setDismissCount(next);
    } catch (e) {}
  };

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_COUNT_KEY);
      localStorage.removeItem(STORAGE_SEEN_ID_KEY);
      localStorage.removeItem(STORAGE_SEEN_STATUS_KEY);
    } catch (e) {}
    setDismissCount(0);
    setSeenRequestId(null);
    setSeenStatus(null);
  };

  return { latestRequest, dismissCount, incrementVisit, dismiss, reset };
}
