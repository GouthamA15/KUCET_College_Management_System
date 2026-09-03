'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useStudent } from '@/context/StudentContext';

const STORAGE_COUNT_KEY = 'profileStatusBarCount';
const STORAGE_SEEN_ID_KEY = 'profileStatusBarSeenRequestId';
const STORAGE_SEEN_STATUS_KEY = 'profileStatusBarSeenStatus';

const getStorageKey = (baseKey, roll) => (roll ? `${baseKey}_${roll}` : baseKey);

export const ProfileActivityContext = createContext(null);

export function ProfileActivityProvider({ children }) {
  const { studentData } = useStudent();
  const rollno = studentData?.student?.roll_no || studentData?.roll_no;

  const [latestRequest, setLatestRequest] = useState(null);
  const [scholarshipThumbUpdate, setScholarshipThumbUpdate] = useState({ active: false });
  const [scholarshipHardcopyPending, setScholarshipHardcopyPending] = useState({ active: false });
  const [scholarshipApplicationReceived, setScholarshipApplicationReceived] = useState({ active: false });
  const [scholarshipApplicationsOpen, setScholarshipApplicationsOpen] = useState({ active: false });
  const [dismissCount, setDismissCount] = useState(0);
  const [seenRequestId, setSeenRequestId] = useState(null);
  const [seenStatus, setSeenStatus] = useState(null);
  const seenRequestIdRef = useRef(seenRequestId);
  const seenStatusRef = useRef(seenStatus);

  useEffect(() => {
    seenRequestIdRef.current = seenRequestId;
    seenStatusRef.current = seenStatus;
  }, [seenRequestId, seenStatus]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!rollno) {
        setDismissCount(0);
        setSeenRequestId(null);
        setSeenStatus(null);
        return;
      }
      try {
        setDismissCount(Number(localStorage.getItem(getStorageKey(STORAGE_COUNT_KEY, rollno)) || '0'));
        const storedId = localStorage.getItem(getStorageKey(STORAGE_SEEN_ID_KEY, rollno)) || null;
        const storedStatus = localStorage.getItem(getStorageKey(STORAGE_SEEN_STATUS_KEY, rollno)) || null;
        setSeenRequestId(storedId);
        setSeenStatus(storedStatus);
      } catch (error) {
        console.error('Profile activity storage hydrate error:', error);
      }
    }, 0);

    return () => clearTimeout(id);
  }, [rollno]);

  // Latest certificate request (fetch once per rollno)
  useEffect(() => {
    let mounted = true;

    if (!rollno) {
      const id = setTimeout(() => {
        setLatestRequest(null);
      }, 0);
      return () => {
        mounted = false;
        clearTimeout(id);
      };
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/student/latest-request?rollno=${encodeURIComponent(rollno)}`, { cache: 'no-store' });
        if (!mounted) return;

        if (res.ok) {
          const data = await res.json();
          const req = data?.latestRequest || null;

          if (mounted) {
            setLatestRequest(req);

            const incomingId = req?.request_id ? String(req.request_id) : null;
            const incomingStatus = req?.status ? String(req.status) : null;

            if ((incomingId && incomingId !== seenRequestIdRef.current) || (incomingStatus && incomingStatus !== seenStatusRef.current)) {
              setDismissCount(0);
              setSeenRequestId(incomingId);
              setSeenStatus(incomingStatus);

              try {
                localStorage.setItem(getStorageKey(STORAGE_COUNT_KEY, rollno), '0');
                if (incomingId) localStorage.setItem(getStorageKey(STORAGE_SEEN_ID_KEY, rollno), incomingId);
                if (incomingStatus) localStorage.setItem(getStorageKey(STORAGE_SEEN_STATUS_KEY, rollno), incomingStatus);
              } catch (e) {
                console.error('Storage error:', e);
              }
            }
          }
        } else {
          if (mounted) setLatestRequest(null);
        }
      } catch (_e) {
        if (mounted) setLatestRequest(null);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [rollno]);

  // Student activity (scholarship thumb + hardcopy notifications)
  useEffect(() => {
    let mounted = true;
    if (!rollno) return () => {
      mounted = false;
    };

    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/student/activity', { cache: 'no-store' });
        if (!mounted) return;
        if (!res.ok) {
          setScholarshipThumbUpdate({ active: false });
          setScholarshipHardcopyPending({ active: false });
          setScholarshipApplicationReceived({ active: false });
          setScholarshipApplicationsOpen({ active: false });
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        setScholarshipThumbUpdate(data?.scholarshipThumbUpdate || { active: false });
        setScholarshipHardcopyPending(data?.scholarshipHardcopyPending || { active: false });
        setScholarshipApplicationReceived(data?.scholarshipApplicationReceived || { active: false });
        setScholarshipApplicationsOpen(data?.scholarshipApplicationsOpen || { active: false });
      } catch (_e) {
        if (mounted) {
          setScholarshipThumbUpdate({ active: false });
          setScholarshipHardcopyPending({ active: false });
          setScholarshipApplicationReceived({ active: false });
          setScholarshipApplicationsOpen({ active: false });
        }
      }
    };

    fetchActivity();
    return () => {
      mounted = false;
    };
  }, [rollno]);

  const incrementVisit = () => {
    try {
      const next = Number(localStorage.getItem(getStorageKey(STORAGE_COUNT_KEY, rollno)) || '0') + 1;
      localStorage.setItem(getStorageKey(STORAGE_COUNT_KEY, rollno), String(next));
      setDismissCount(next);
    } catch (_e) { /* empty */ }
  };

  const dismiss = () => {
    try {
      const next = Number(localStorage.getItem(getStorageKey(STORAGE_COUNT_KEY, rollno)) || '0') + 1;
      localStorage.setItem(getStorageKey(STORAGE_COUNT_KEY, rollno), String(next));
      setDismissCount(next);
    } catch (_e) { /* empty */ }
  };

  const reset = () => {
    try {
      localStorage.removeItem(getStorageKey(STORAGE_COUNT_KEY, rollno));
      localStorage.removeItem(getStorageKey(STORAGE_SEEN_ID_KEY, rollno));
      localStorage.removeItem(getStorageKey(STORAGE_SEEN_STATUS_KEY, rollno));
    } catch (_e) { /* empty */ }
    setDismissCount(0);
    setSeenRequestId(null);
    setSeenStatus(null);
  };

  const value = {
    latestRequest,
    dismissCount,
    incrementVisit,
    dismiss,
    reset,
    scholarshipThumbUpdate,
    scholarshipHardcopyPending,
    scholarshipApplicationReceived,
    scholarshipApplicationsOpen,
  };

  return (
    <ProfileActivityContext.Provider value={value}>
      {children}
    </ProfileActivityContext.Provider>
  );
}

export function useProfileActivityContext() {
  return useContext(ProfileActivityContext);
}
