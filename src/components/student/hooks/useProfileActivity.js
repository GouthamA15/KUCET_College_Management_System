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
    if (!rollno) {
      setLatestRequest(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/student/latest-request?rollno=${encodeURIComponent(rollno)}`);
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const req = data && data.latestRequest ? data.latestRequest : null;

          // Reset dismiss count if request_id or status changed
          try {
            const incomingId = req && req.request_id ? String(req.request_id) : null;
            const incomingStatus = req && req.status ? String(req.status) : null;
            if ((incomingId && incomingId !== seenRequestId) || (incomingStatus && incomingStatus !== seenStatus)) {
              setDismissCount(0);
              localStorage.setItem(STORAGE_COUNT_KEY, '0');
              setSeenRequestId(incomingId);
              setSeenStatus(incomingStatus);
              try { localStorage.setItem(STORAGE_SEEN_ID_KEY, incomingId || ''); } catch (e) {}
              try { localStorage.setItem(STORAGE_SEEN_STATUS_KEY, incomingStatus || ''); } catch (e) {}
            }
          } catch (e) {}

          setLatestRequest(req);
        } else {
          setLatestRequest(null);
        }
      } catch (e) {
        setLatestRequest(null);
      }
    })();
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
