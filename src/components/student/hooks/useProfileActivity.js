'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'profile_activity_dismiss_count';

export default function useProfileActivity(rollno) {
  const [latestRequest, setLatestRequest] = useState(null);
  const [dismissCount, setDismissCount] = useState(() => {
    try { return Number(localStorage.getItem(STORAGE_KEY) || '0'); } catch { return 0; }
  });

  useEffect(() => {
    if (!rollno) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/student/latest-request?rollno=${encodeURIComponent(rollno)}`);
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setLatestRequest(data || null);
        } else {
          setLatestRequest(null);
        }
      } catch (e) {
        setLatestRequest(null);
      }
    })();
    return () => { mounted = false; };
  }, [rollno]);

  const dismiss = () => {
    const next = dismissCount + 1;
    setDismissCount(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
  };

  const reset = () => {
    setDismissCount(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return { latestRequest, dismissCount, dismiss, reset };
}
