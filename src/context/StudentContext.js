'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';
import { getNowSync } from '@/lib/clock';

export const StudentContext = createContext();

export function StudentProvider({ children }) {
  const [studentData, setStudentData] = useState(null);
  const [collegeInfo, setCollegeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [certificateRequests, setCertificateRequests] = useState(null);
  const [certificateRequestsLoaded, setCertificateRequestsLoaded] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [academicPerformance, setAcademicPerformance] = useState(null);
  const [isLoadingAcademic, setIsLoadingAcademic] = useState(false);
  const [latestProfileRequest, setLatestProfileRequest] = useState(null);
  const [latestCertificateRequest, setLatestCertificateRequest] = useState(null);

  const isInitializingRef = React.useRef(false);

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

  const fetchAcademicPerformance = useCallback(async () => {
    setIsLoadingAcademic(true);
    try {
      const res = await fetch('/api/student/academic-info');
      if (res.ok) {
        const json = await res.json();
        setAcademicPerformance(json.data || []);
        return json.data;
      }
    } catch (e) {
      console.error('Failed to fetch academic performance', e);
    } finally {
      setIsLoadingAcademic(false);
    }
    return null;
  }, []);

  const fetchProfile = useCallback(async (rollno) => {
    try {
      const [profileRes, sigRes, reqRes] = await Promise.all([
        fetch(`/api/student/${rollno}`),
        fetch('/api/student/signature'),
        fetch(`/api/student/latest-request?rollno=${rollno}`)
      ]);
      
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.student && data.student.pfp) {
          data.student.pfp = `${data.student.pfp}?t=${getNowSync().getTime()}`;
        }
        setStudentData(data);
        
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          setLatestProfileRequest(sigData.latestRequest);
        }

        if (reqRes.ok) {
          const reqData = await reqRes.json();
          setLatestCertificateRequest(reqData.latestRequest);
        }
        
        return data;
      } else {
        try {
          const data = await profileRes.json();
          setError(data.message || 'Failed to fetch profile');
        } catch {
          setError('Failed to fetch profile');
        }
      }
    } catch (_e) {
      setError('Network error');
    }
    return null;
  }, []);

  const lastFetchTimeRef = useRef(0);
  const activePromiseRef = useRef(null);

  const refreshData = useCallback(async () => {
    if (activePromiseRef.current) {
      return activePromiseRef.current;
    }

    const promise = (async () => {
      try {
        const me = await fetch('/api/student/me');
        if (me.ok) {
          const user = await me.json();
          await fetchCollegeInfo();
          const profilePromise = fetchProfile(user.roll_no);
          const academicPromise = fetchAcademicPerformance();
          const [profile] = await Promise.all([profilePromise, academicPromise]);
          lastFetchTimeRef.current = Date.now();
          return profile;
        }
      } catch (_e) {
        setError('Failed to refresh data');
      } finally {
        activePromiseRef.current = null;
      }
      return null;
    })();

    activePromiseRef.current = promise;
    return promise;
  }, [fetchProfile, fetchCollegeInfo, fetchAcademicPerformance]);

  const handleResume = useCallback(async (event) => {
    const now = Date.now();
    const isBfcacheRestore = event?.type === 'pageshow' && event.persisted;
    const isStuck = loading && !studentData;

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
      await refreshData();
    } catch (e) {
      console.error('Failed to revalidate student data on resume', e);
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  }, [loading, studentData, refreshData]);

  useEffect(() => {
    // Avoid a refresh loop: refreshData() sets studentData,
    // so we only initialize when there is no cached data.
    if (studentData || isInitializingRef.current) return;

    let cancelled = false;
    isInitializingRef.current = true;

    const id = setTimeout(() => {
      const init = async () => {
        setLoading(true);
        try {
          await refreshData();
        } finally {
          if (!cancelled) {
            setLoading(false);
            isInitializingRef.current = false;
          }
        }
      };
      init();
    }, 0);

    return () => {
      cancelled = true;
      isInitializingRef.current = false;
      clearTimeout(id);
    };
  }, [refreshData, studentData]);

  useEffect(() => {
    const onResume = (e) => {
      if (e && e.type === 'visibilitychange' && document.visibilityState !== 'visible') {
        return;
      }
      handleResume(e);
    };

    window.addEventListener('pageshow', onResume);
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);

    if (loading && !studentData && !isInitializingRef.current) {
      handleResume();
    }

    return () => {
      window.removeEventListener('pageshow', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [handleResume, loading, studentData]);

  const resetCertificateRequests = () => {
    setCertificateRequests(null);
    setCertificateRequestsLoaded(false);
  };

  return (
    <StudentContext.Provider value={{
      studentData,
      collegeInfo,
      setStudentData,
      loading,
      error,
      refreshData,
      certificateRequests,
      setCertificateRequests,
      certificateRequestsLoaded,
      setCertificateRequestsLoaded,
      isLoadingRequests,
      setIsLoadingRequests,
      resetCertificateRequests,
      academicPerformance,
      isLoadingAcademic,
      refreshAcademic: fetchAcademicPerformance,
      latestProfileRequest,
      latestCertificateRequest,
      refreshProfile: async () => {
        const me = await fetch('/api/student/me');
        if (me.ok) {
          const user = await me.json();
          return fetchProfile(user.roll_no);
        }
      }
    }}>
      <RealtimeListener enableNotifications />
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
}
