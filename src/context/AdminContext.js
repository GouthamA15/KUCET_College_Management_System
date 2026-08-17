'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export const AdminContext = createContext();

export function AdminProvider({ children }) {
  const lastFetchTimeRef = useRef(0);
  const activePromiseRef = useRef(null);
  const isInitializingRef = useRef(false);

  const [adminData, setAdminData] = useState(null);
  const [collegeInfo, setCollegeInfo] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [studentStats, setStudentStats] = useState(null);
  const [facultyInterests, setFacultyInterests] = useState([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState(null);

  const fetchCollegeInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/public/college-info');
      if (res.ok) {
        const data = await res.json();
        setCollegeInfo(data.collegeInfo);
      }
    } catch (e) {
      console.error('Failed to fetch college info', e);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff');
      if (res.ok) {
        const json = await res.json();
        const payload = json?.data ?? json ?? [];
        setStaffList(payload);
        return payload;
      }
    } catch (e) {
      console.error('Failed to fetch staff', e);
    }
    return [];
  }, []);

  const fetchStudentStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/student-stats');
      if (res.ok) {
        const json = await res.json();
        const payload = json?.data ?? json ?? null;
        setStudentStats(payload);
        return payload;
      }
    } catch (e) {
      console.error('Failed to fetch student stats', e);
    }
    return null;
  }, []);

  const fetchAdminMe = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verify'); // Assuming verify endpoint gives admin info
      if (res.ok) {
        const json = await res.json();
        const payload = json?.admin ?? json ?? null;
        setAdminData(payload);
        return payload;
      }
    } catch (e) {
      console.error('Failed to verify admin', e);
    }
    return null;
  }, []);

  const fetchFacultyInterests = useCallback(async () => {
    setIsLoadingFaculty(true);
    try {
      const res = await fetch('/api/admin/faculty/interests');
      if (res.ok) {
        const json = await res.json();
        setFacultyInterests(json.data || []);
        return json.data;
      }
    } catch (e) {
      console.error('Failed to fetch faculty interests', e);
    } finally {
      setIsLoadingFaculty(false);
    }
    return [];
  }, []);

  const refreshAll = useCallback(async () => {
    if (activePromiseRef.current) {
      return activePromiseRef.current;
    }

    const promise = (async () => {
      try {
        if (!adminData) setLoading(true);
        await Promise.all([
          fetchAdminMe(),
          fetchStaff(),
          fetchStudentStats(),
          fetchCollegeInfo(),
          fetchFacultyInterests()
        ]);
        lastFetchTimeRef.current = Date.now();
      } catch (e) {
        console.error('Failed to refresh admin data', e);
      } finally {
        setLoading(false);
        activePromiseRef.current = null;
      }
    })();

    activePromiseRef.current = promise;
    return promise;
  }, [fetchAdminMe, fetchStaff, fetchStudentStats, fetchCollegeInfo, fetchFacultyInterests, adminData]);

  const handleResume = useCallback(async (event) => {
    const now = Date.now();
    const isBfcacheRestore = event?.type === 'pageshow' && event.persisted;
    const isStuck = loading && !adminData;

    // Check if we should revalidate
    const shouldReinit = isBfcacheRestore || isStuck;
    const throttleTime = 5000; // 5 seconds throttle
    const isThrottled = now - lastFetchTimeRef.current < throttleTime;

    if (!shouldReinit && isThrottled) {
      return;
    }

    if (activePromiseRef.current) {
      if (shouldReinit) {
        setLoading(true);
      }
      try {
        await activePromiseRef.current;
      } finally {
        setLoading(false);
      }
      return;
    }

    isInitializingRef.current = true;
    if (shouldReinit) {
      setLoading(true);
    }

    try {
      await refreshAll();
    } catch (e) {
      console.error('Failed to revalidate admin data on resume', e);
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  }, [loading, adminData, refreshAll]);

  useEffect(() => {
    if (adminData || isInitializingRef.current) return;

    let cancelled = false;
    isInitializingRef.current = true;

    const init = async () => {
      if (!adminData) setLoading(true);
      try {
        await refreshAll();
      } finally {
        if (!cancelled) {
          setLoading(false);
          isInitializingRef.current = false;
        }
      }
    };
    init();

    return () => {
      cancelled = true;
      isInitializingRef.current = false;
    };
  }, [refreshAll, adminData]);

  // Keep a stable ref to handleResume so the event listener effect only runs once.
  const handleResumeRef = useRef(handleResume);
  useEffect(() => {
    handleResumeRef.current = handleResume;
  }, [handleResume]);

  useEffect(() => {
    const onResume = (e) => {
      if (e && e.type === 'visibilitychange' && document.visibilityState !== 'visible') {
        return;
      }
      handleResumeRef.current(e);
    };

    window.addEventListener('pageshow', onResume);
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);

    return () => {
      window.removeEventListener('pageshow', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, []);  // Empty deps — register once, never re-register on state changes

  return (
    <AdminContext.Provider value={{ 
      adminData, 
      collegeInfo,
      staffList, 
      studentStats, 
      loading, 
      error, 
      refreshAll,
      refreshStaff: fetchStaff,
      refreshStudentStats: fetchStudentStats,
      facultyInterests,
      isLoadingFaculty,
      refreshFaculty: fetchFacultyInterests
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
