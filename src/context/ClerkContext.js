'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export const ClerkContext = createContext();

export function ClerkProvider({ children }) {
  // ... rest of state
  const lastFetchTimeRef = useRef(0);
  const activePromiseRef = useRef(null);
  const isInitializingRef = useRef(false);

  const [clerkData, setClerkData] = useState(null);
  const [collegeInfo, setCollegeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facultyAssignments, setFacultyAssignments] = useState([]);
  const [facultyInterests, setFacultyInterests] = useState([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [pendingProfileRequests, setPendingProfileRequests] = useState([]);
  const [pendingCertificateRequests, setPendingCertificateRequests] = useState([]);
  const [admissionDrafts, setAdmissionDrafts] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [areRequestsBootstrapping, setAreRequestsBootstrapping] = useState(true);
  const [hodBranchData, setHodBranchData] = useState(null);
  const [isLoadingHOD, setIsLoadingHOD] = useState(false);
  const [studentHistory, setStudentHistory] = useState({ records: [], myCount: 0, allCount: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

  const fetchClerk = useCallback(async () => {
    try {
      const res = await fetch('/api/clerk/me');
      if (res.ok) {
        const data = await res.json();
        setClerkData(data.data);
        return data.data;
      } else {
        try {
          const data = await res.json();
          setError(data.error || 'Failed to fetch clerk data');
        } catch {
          setError('Failed to fetch clerk data');
        }
      }
    } catch (_e) {
      setError('Network error');
    }
    return null;
  }, []);

  const fetchFacultyData = useCallback(async () => {
    setIsLoadingFaculty(true);
    try {
      const [asgnRes, intRes] = await Promise.all([
        fetch('/api/clerk/faculty/assignments'),
        fetch('/api/clerk/faculty/interests')
      ]);

      if (asgnRes.ok) {
        const asgnJson = await asgnRes.json();
        setFacultyAssignments(asgnJson.data || []);
      }
      if (intRes.ok) {
        const intJson = await intRes.json();
        setFacultyInterests(intJson.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch faculty data', e);
    } finally {
      setIsLoadingFaculty(false);
    }
  }, []);

  const fetchHODData = useCallback(async () => {
    setIsLoadingHOD(true);
    try {
      const [configRes, facultyRes, ttRes, subjectsRes, assignmentsRes] = await Promise.all([
        fetch('/api/clerk/hod/branch-config'),
        fetch('/api/clerk/hod/faculty-load'),
        fetch('/api/clerk/hod/timetable'),
        fetch('/api/clerk/hod/branch-subjects'),
        fetch('/api/clerk/hod/subject-assignments')
      ]);

      if (configRes.ok && facultyRes.ok && ttRes.ok && subjectsRes.ok && assignmentsRes.ok) {
        const configJson = await configRes.json();
        const facultyJson = await facultyRes.json();
        const ttJson = await ttRes.json();
        const subjectsJson = await subjectsRes.json();
        const assignmentsJson = await assignmentsRes.json();

        setHodBranchData({
          config: configJson.data,
          faculty: facultyJson.data,
          timetable: ttJson.data,
          allSubjects: subjectsJson.data,
          officialAssignments: assignmentsJson.data
        });
      }
    } catch (e) {
      console.error('Failed to fetch HOD data', e);
    } finally {
      setIsLoadingHOD(false);
    }
  }, []);

  const fetchPendingProfileRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const res = await fetch('/api/clerk/admission/student-requests');
      if (res.ok) {
        const json = await res.json();
        setPendingProfileRequests(json.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch pending profile requests', e);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchPendingCertificateRequests = useCallback(async (role) => {
    if (!role) return;
    setIsLoadingRequests(true);
    try {
      const res = await fetch(`/api/clerk/requests?clerkType=${role}`);
      if (res.ok) {
        const json = await res.json();
        setPendingCertificateRequests(json.records || []);
      }
    } catch (e) {
      console.error('Failed to fetch pending certificate requests', e);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchAdmissionDrafts = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const res = await fetch('/api/clerk/admission/drafts?status=DRAFT');
      const data = await res.json();
      if (res.ok) {
        setAdmissionDrafts(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch admission drafts', e);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchStudentHistory = useCallback(async (scope = 'my') => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/clerk/student-history?scope=${scope}`);
      if (res.ok) {
        const json = await res.json();
        setStudentHistory({
          records: json.records || [],
          myCount: json.myCount || 0,
          allCount: json.allCount || 0
        });
      }
    } catch (e) {
      console.error('Failed to fetch student history', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const refreshAllRequests = useCallback(async (role) => {
    const promises = [];
    if (role === 'admission') {
      promises.push(fetchPendingProfileRequests());
      promises.push(fetchPendingCertificateRequests('admission'));
      promises.push(fetchAdmissionDrafts());
      promises.push(fetchStudentHistory('my'));
    } else if (role === 'scholarship') {
      promises.push(fetchPendingCertificateRequests('scholarship'));
    }
    await Promise.all(promises);
  }, [fetchPendingProfileRequests, fetchPendingCertificateRequests, fetchAdmissionDrafts, fetchStudentHistory]);

  const refreshAllData = useCallback(async () => {
    if (activePromiseRef.current) {
      return activePromiseRef.current;
    }

    const promise = (async () => {
      try {
        const clerk = await fetchClerk();
        const promises = [fetchCollegeInfo()];
        if (clerk?.role === 'faculty') {
          promises.push(fetchFacultyData());
          if (clerk?.is_hod) {
            // Trigger HOD data fetch in the background without blocking initial dashboard rendering
            fetchHODData();
          }
        }
        if (clerk?.role === 'admission') {
          promises.push(fetchPendingProfileRequests());
          promises.push(fetchPendingCertificateRequests('admission'));
          promises.push(fetchAdmissionDrafts());
          promises.push(fetchStudentHistory('my'));
        }
        if (clerk?.role === 'scholarship') {
          promises.push(fetchPendingCertificateRequests('scholarship'));
        }
        await Promise.all(promises);
        lastFetchTimeRef.current = Date.now();
      } catch (e) {
        console.error('Failed to refresh clerk data', e);
      } finally {
        activePromiseRef.current = null;
      }
    })();

    activePromiseRef.current = promise;
    return promise;
  }, [fetchClerk, fetchCollegeInfo, fetchFacultyData, fetchPendingProfileRequests, fetchPendingCertificateRequests, fetchAdmissionDrafts, fetchHODData, fetchStudentHistory]);

  const handleResume = useCallback(async (event) => {
    const now = Date.now();
    const isBfcacheRestore = event?.type === 'pageshow' && event.persisted;
    const isStuck = loading && !clerkData;

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
        setAreRequestsBootstrapping(true);
      }
      try {
        await activePromiseRef.current;
      } finally {
        setLoading(false);
        setAreRequestsBootstrapping(false);
      }
      return;
    }

    isInitializingRef.current = true;
    if (shouldReinit) {
      setLoading(true);
      setAreRequestsBootstrapping(true);
    }

    try {
      await refreshAllData();
    } catch (e) {
      console.error('Failed to revalidate clerk data on resume', e);
    } finally {
      setLoading(false);
      setAreRequestsBootstrapping(false);
      isInitializingRef.current = false;
    }
  }, [loading, clerkData, refreshAllData]);

  useEffect(() => {
    if (clerkData || isInitializingRef.current) return;

    let cancelled = false;
    isInitializingRef.current = true;

    const id = setTimeout(() => {
      const init = async () => {
        if (!clerkData) setLoading(true);
        setAreRequestsBootstrapping(true);
        try {
          await refreshAllData();
        } finally {
          if (!cancelled) {
            setLoading(false);
            setAreRequestsBootstrapping(false);
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
  }, [refreshAllData, clerkData]);

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

    if (loading && !clerkData && !isInitializingRef.current) {
      handleResume();
    }

    return () => {
      window.removeEventListener('pageshow', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [handleResume, loading, clerkData]);

  const handleRealtimeUpdate = useCallback((data) => {
    if (clerkData?.is_hod && data.payload.branch === clerkData.branch) {
      if (['TIMETABLE_CHANGED', 'ATTENDANCE_SAVED', 'SESSION_STARTED', 'SESSION_ENDED'].includes(data.type)) {
        console.info(`[HODSync] ${data.type} detected, refreshing...`);
        fetchHODData();
      }
    }
  }, [clerkData, fetchHODData]);

  return (
    <ClerkContext.Provider value={{
      clerkData,
      collegeInfo,
      setClerkData,
      loading,
      error,
      refreshClerkData: fetchClerk,
      facultyAssignments,
      facultyInterests,
      isLoadingFaculty,
      refreshFaculty: fetchFacultyData,
      pendingProfileRequests,
      pendingCertificateRequests,
      admissionDrafts,
      isLoadingRequests,
      areRequestsBootstrapping,
      refreshProfileRequests: fetchPendingProfileRequests,
      refreshCertificateRequests: fetchPendingCertificateRequests,
      refreshAdmissionDrafts: fetchAdmissionDrafts,
      refreshAllRequests,
      hodBranchData,
      isLoadingHOD,
      refreshHOD: fetchHODData,
      studentHistory,
      isLoadingHistory,
      refreshStudentHistory: fetchStudentHistory
    }}>
      <RealtimeListener onUpdate={handleRealtimeUpdate} enableNotifications />
      {children}
    </ClerkContext.Provider>
  );
}

export function useClerk() {
  const context = useContext(ClerkContext);
  if (context === undefined) {
    throw new Error('useClerk must be used within a ClerkProvider');
  }
  return context;
}
