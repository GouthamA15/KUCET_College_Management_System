'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export const StudentContext = createContext();

let cachedCollegeInfo = null;

export function StudentProvider({ children }) {
  const [studentData, setStudentData] = useState(null);
  const [collegeInfo, setCollegeInfo] = useState(cachedCollegeInfo);
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

  const fetchAcademicPerformance = useCallback(async () => {
    setIsLoadingAcademic(true);
    try {
      const res = await fetch('/api/student/academic-info', { cache: 'no-store' });
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
    if (!rollno) return null;
    try {
      const [profileRes, sigRes, reqRes] = await Promise.all([
        fetch(`/api/student/${encodeURIComponent(rollno)}`, { cache: 'no-store' }),
        fetch('/api/student/signature', { cache: 'no-store' }),
        fetch(`/api/student/latest-request?rollno=${encodeURIComponent(rollno)}`, { cache: 'no-store' })
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
        if (profileRes.status === 401 || profileRes.status === 403) {
          setStudentData(null);
        }
      }
    } catch (_e) {
      setError('Network error');
    }
    return null;
  }, []);

  const studentDataRef = useRef(studentData);
  useEffect(() => {
    studentDataRef.current = studentData;
  }, [studentData]);

  const lastFetchTimeRef = useRef(0);
  const activePromiseRef = useRef(null);

  const refreshData = useCallback(async () => {
    if (activePromiseRef.current) {
      return activePromiseRef.current;
    }

    const promise = (async () => {
      try {
        const me = await fetch('/api/student/me', { cache: 'no-store' });
        if (me.ok) {
          const user = await me.json();
          if (!user || !user.roll_no) {
            setStudentData(null);
            return null;
          }

          const current = studentDataRef.current;
          // If current in-memory student doesn't match the newly authenticated roll number, purge previous child states
          if (current && (current.student?.roll_no !== user.roll_no && current.roll_no !== user.roll_no)) {
            setStudentData(null);
            setAcademicPerformance(null);
            setLatestProfileRequest(null);
            setLatestCertificateRequest(null);
            setProfileDetails(null);
            setCertificateRequests(null);
          }

          await fetchCollegeInfo();
          const profilePromise = fetchProfile(user.roll_no);
          const academicPromise = fetchAcademicPerformance();
          const [profile] = await Promise.all([profilePromise, academicPromise]);
          lastFetchTimeRef.current = Date.now();
          return profile;
        } else if (me.status === 401 || me.status === 403) {
          setStudentData(null);
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
    const currentStudent = studentDataRef.current;
    const isStuck = loading && !currentStudent;

    // Check if we should revalidate
    const shouldReinit = isBfcacheRestore || isStuck;
    const throttleTime = 60000; // 60 seconds throttle
    const isThrottled = now - lastFetchTimeRef.current < throttleTime;

    if (!shouldReinit && isThrottled) {
      return;
    }

    if (activePromiseRef.current) {
      if (shouldReinit && !currentStudent) {
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
    if (shouldReinit && !currentStudent) {
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
  }, [loading, refreshData]);

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

  const handleRealtimeUpdate = useCallback((data) => {
    if (!data || !data.type) return;
    const { type, payload } = data;

    const isTargetStudent =
      !payload ||
      (studentData &&
        (payload.student_id === studentData.id ||
          payload.student_id === studentData.student?.id ||
          payload.roll_no === studentData.roll_no ||
          payload.roll_no === studentData.student?.roll_no));

    if (isTargetStudent) {
      if (
        [
          'REQUEST_CREATED',
          'REQUEST_UPDATED',
          'request:created',
          'request:updated',
          'request:status-changed',
          'request:completed',
          'PROFILE_PHOTO_UPDATED',
          'PROFILE_PHOTO_REMOVED',
          'student:photo:updated',
          'student:photo:removed',
        ].includes(type)
      ) {
        const rollNo = studentData?.roll_no || studentData?.student?.roll_no;
        if (rollNo) {
          fetchProfile(rollNo);
        }
      }
    }
  }, [studentData, fetchProfile]);

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
        const me = await fetch('/api/student/me', { cache: 'no-store' });
        if (me.ok) {
          const user = await me.json();
          return fetchProfile(user?.roll_no);
        }
      }
    }}>
      <RealtimeListener onUpdate={handleRealtimeUpdate} enableNotifications />
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
