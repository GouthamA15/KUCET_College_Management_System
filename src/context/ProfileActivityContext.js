'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useStudent } from '@/context/StudentContext';

const STORAGE_COUNT_KEY = 'profileStatusBarCount';
const STORAGE_SEEN_ID_KEY = 'profileStatusBarSeenRequestId';
const STORAGE_SEEN_STATUS_KEY = 'profileStatusBarSeenStatus';

export const ProfileActivityContext = createContext(null);

export function ProfileActivityProvider({ children }) {
  const { studentData } = useStudent();
  const rollno = studentData?.student?.roll_no;

  const [latestRequest, setLatestRequest] = useState(null);
  const [scholarshipThumbUpdate, setScholarshipThumbUpdate] = useState({ active: false });
  const [scholarshipHardcopyPending, setScholarshipHardcopyPending] = useState({ active: false });
  const [scholarshipApplicationReceived, setScholarshipApplicationReceived] = useState({ active: false });
  const [scholarshipApplicationsOpen, setScholarshipApplicationsOpen] = useState({ active: false });
  const [dismissCount, setDismissCount] = useState(0);
  const [seenRequestId, setSeenRequestId] = useState(null);
  const [seenStatus, setSeenStatus] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setDismissCount(Number(localStorage.getItem(STORAGE_COUNT_KEY) || '0'));
        setSeenRequestId(localStorage.getItem(STORAGE_SEEN_ID_KEY) || null);
        setSeenStatus(localStorage.getItem(STORAGE_SEEN_STATUS_KEY) || null);
      } catch (error) {
        console.error('Profile activity storage hydrate error:', error);
      }
    }, 0);

    return () => clearTimeout(id);
  }, []);

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
        const res = await fetch(`/api/student/latest-request?rollno=${encodeURIComponent(rollno)}`);
        if (!mounted) return;

        if (res.ok) {
          const data = await res.json();
          const req = data?.latestRequest || null;

          if (mounted) {
            setLatestRequest(req);

            const incomingId = req?.request_id ? String(req.request_id) : null;
            const incomingStatus = req?.status ? String(req.status) : null;

            if ((incomingId && incomingId !== seenRequestId) || (incomingStatus && incomingStatus !== seenStatus)) {
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

    return () => {
      mounted = false;
    };
    // We intentionally depend only on rollno so this fetch runs once per student session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollno]);

  // Student activity (scholarship thumb + hardcopy notifications)
  useEffect(() => {
    let mounted = true;
    if (!rollno) return () => {
      mounted = false;
    };

    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/student/activity');
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
      } catch (e) {
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
