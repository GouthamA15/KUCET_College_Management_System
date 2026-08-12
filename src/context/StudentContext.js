'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

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
  const [profileDetails, setProfileDetails] = useState(null);

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
    } finally {
      if (process.env.NODE_ENV === 'development') {
        console.info('[StudentContext] fetchCollegeInfo() completed');
      }
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
      if (process.env.NODE_ENV === 'development') {
        console.info('[StudentContext] fetchAcademicPerformance() completed');
      }
    }
    return null;
  }, []);

  const fetchProfile = useCallback(async (rollno) => {
    try {
      const [profileRes, sigRes, reqRes] = await Promise.all([
        fetch(`/api/student/${rollno}`, { cache: 'no-store' }),
        fetch('/api/student/signature', { cache: 'no-store' }),
        fetch(`/api/student/latest-request?rollno=${rollno}`, { cache: 'no-store' })
      ]);
      
      if (profileRes.ok) {
        const data = await profileRes.json();
        setStudentData(data);
        
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          setLatestProfileRequest(sigData.latestRequest);
          setProfileDetails(sigData);
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
    } finally {
      if (process.env.NODE_ENV === 'development') {
        console.info('[StudentContext] fetchProfile() completed');
      }
    }
    return null;
  }, []);

  const lastFetchTimeRef = useRef(0);
  const activePromiseRef = useRef(null);

  const refreshData = useCallback(async () => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[StudentContext] refreshData() started');
    }
    if (activePromiseRef.current) {
      return activePromiseRef.current;
    }

    const promise = (async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.info('[StudentContext] /api/student/me request started');
        }
        const me = await fetch('/api/student/me', { cache: 'no-store' });
        if (process.env.NODE_ENV === 'development') {
          console.info('[StudentContext] /api/student/me request completed');
        }
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
    if (process.env.NODE_ENV === 'development') {
      const trigger = event?.type || 'initial mount';
      console.info(`[StudentContext] handleResume() invoked. Triggered by: ${trigger}`);
    }
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

  // Keep a stable ref to handleResume so the event listener effect only runs once.
  // Without this pattern, the effect would re-run on every loading/studentData change,
  // tearing down and re-registering listeners mid-refresh and potentially firing duplicate calls.
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

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[StudentContext] StudentContext mounted');
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[StudentContext] loading=${loading}`);
    }
  }, [loading]);

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
      profileDetails,
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
