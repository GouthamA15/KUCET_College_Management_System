'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export const AdminContext = createContext();

let cachedCollegeInfo = null;

export function AdminProvider({ children }) {
  const lastFetchTimeRef = useRef(0);
  const activePromiseRef = useRef(null);
  const isInitializingRef = useRef(false);

  const [adminData, setAdminData] = useState(null);
  const [collegeInfo, setCollegeInfo] = useState(cachedCollegeInfo);
  const [staffList, setStaffList] = useState([]);
  const [studentStats, setStudentStats] = useState(null);
  const [facultyInterests, setFacultyInterests] = useState([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState(null);

  const fetchCollegeInfo = useCallback(async () => {
    if (cachedCollegeInfo) {
      setCollegeInfo(cachedCollegeInfo);
      return cachedCollegeInfo;
    }
    try {
      const res = await fetch('/api/public/college-info');
      if (res.ok) {
        const data = await res.json();
        cachedCollegeInfo = data.collegeInfo;
        setCollegeInfo(data.collegeInfo);
        return data.collegeInfo;
      }
    } catch (e) {
      console.error('Failed to fetch college info', e);
    }
    return null;
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
      const res = await fetch('/api/admin/verify');
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
      const res = { ok: false };
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

  // Targeted in-place updaters (avoids refetching entire staff list)
  const addStaffToList = useCallback((newStaff) => {
    if (!newStaff || !newStaff.id) return;
    setStaffList((prev) => {
      const exists = prev.some((s) => s.id === newStaff.id);
      if (exists) {
        return prev.map((s) => (s.id === newStaff.id ? { ...s, ...newStaff } : s));
      }
      return [newStaff, ...prev];
    });
  }, []);

  const updateStaffInList = useCallback((updatedStaff) => {
    if (!updatedStaff || !updatedStaff.id) return;
    setStaffList((prev) =>
      prev.map((s) => {
        if (s.id === updatedStaff.id) {
          return {
            ...s,
            ...updatedStaff,
            roles: updatedStaff.roles !== undefined ? updatedStaff.roles : s.roles,
            branches: updatedStaff.branches !== undefined ? updatedStaff.branches : s.branches,
            is_hod: updatedStaff.is_hod !== undefined ? updatedStaff.is_hod : s.is_hod,
            is_active: updatedStaff.is_active !== undefined ? updatedStaff.is_active : s.is_active
          };
        }
        return s;
      })
    );
  }, []);

  const setStaffActiveStatus = useCallback((staffId, isActive) => {
    if (!staffId) return;
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, is_active: !!isActive } : s))
    );
  }, []);

  // Realtime update handler
  const handleRealtimeUpdate = useCallback((data) => {
    if (!data || !data.type) return;
    const { type, payload } = data;

    if (['STAFF_CREATED', 'staff:created'].includes(type)) {
      if (payload) addStaffToList(payload);
    } else if (['STAFF_UPDATED', 'staff:updated'].includes(type)) {
      if (payload) updateStaffInList(payload);
    } else if (['STAFF_STATUS_CHANGED', 'staff:status-changed'].includes(type)) {
      if (payload) setStaffActiveStatus(payload.id, payload.is_active);
    } else if (['STAFF_REGISTRATION_CREATED', 'staff:registration:created'].includes(type)) {
      fetchStaff();
    } else if (['STUDENT_STATS_UPDATED', 'student:stats:updated', 'ADMISSION_FINALIZED', 'admission:finalized'].includes(type)) {
      fetchStudentStats();
    }
  }, [addStaffToList, updateStaffInList, setStaffActiveStatus, fetchStaff, fetchStudentStats]);

  const adminDataRef = useRef(adminData);
  useEffect(() => {
    adminDataRef.current = adminData;
  }, [adminData]);

  const refreshAll = useCallback(async () => {
    if (activePromiseRef.current) {
      return activePromiseRef.current;
    }

    const promise = (async () => {
      try {
        if (!adminDataRef.current) setLoading(true);
        await Promise.all([
          fetchAdminMe(),
          fetchStaff(),
          fetchStudentStats(),
          fetchCollegeInfo()
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
  }, [fetchAdminMe, fetchStaff, fetchStudentStats, fetchCollegeInfo]);

  const handleResume = useCallback(async (event) => {
    const now = Date.now();
    const isBfcacheRestore = event?.type === 'pageshow' && event.persisted;
    const currentAdmin = adminDataRef.current;
    const isStuck = loading && !currentAdmin;

    // Check if we should revalidate
    const shouldReinit = isBfcacheRestore || isStuck;
    const throttleTime = 60000; // 60 seconds throttle
    const isThrottled = now - lastFetchTimeRef.current < throttleTime;

    if (!shouldReinit && isThrottled) {
      return;
    }

    if (activePromiseRef.current) {
      if (shouldReinit && !currentAdmin) {
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
    if (shouldReinit && !currentAdmin) {
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
  }, [loading, refreshAll]);

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
  }, [adminData, refreshAll]);

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
  }, []);

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
      refreshFaculty: fetchFacultyInterests,
      addStaffToList,
      updateStaffInList,
      setStaffActiveStatus
    }}>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
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
