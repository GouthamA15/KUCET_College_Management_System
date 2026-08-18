'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export const StaffContext = createContext();

export function StaffProvider({ children }) {
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
      const res = await fetch(`/api/staff/me?t=${Date.now()}`);
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
        fetch('/api/staff/faculty/assignments'),
        fetch('/api/staff/faculty/interests')
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
        fetch('/api/staff/hod/branch-config'),
        fetch('/api/staff/hod/faculty-load'),
        fetch('/api/staff/hod/timetable'),
        fetch('/api/staff/hod/branch-subjects'),
        fetch('/api/staff/hod/subject-assignments')
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
      const res = await fetch(`/api/staff/admission/student-requests?t=${Date.now()}`);
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
      const res = await fetch(`/api/staff/requests?clerkType=${role}&t=${Date.now()}`);
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
      const res = await fetch(`/api/staff/admission/drafts?status=DRAFT&t=${Date.now()}`);
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
      const res = await fetch(`/api/staff/student-history?scope=${scope}&t=${Date.now()}`);
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
        await fetchClerk();
        await fetchCollegeInfo();
        
        // Basic identity and config are loaded! Drop the global spinner immediately.
        setLoading(false);

        // Fetch heavy tables sequentially so we don't hammer the database pool 
        // causing 30s delays or deadlocks
        // Removed global fetches for admissionDrafts, pendingProfileRequests, etc.
        // Data fetching is now scoped to individual components/pages via useEffect
        
        lastFetchTimeRef.current = Date.now();
      } catch (e) {
        console.error('Failed to refresh clerk data', e);
      } finally {
        activePromiseRef.current = null;
      }
    })();

    activePromiseRef.current = promise;
    return promise;
  }, [fetchClerk, fetchCollegeInfo]);

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

    let isMounted = true;
    isInitializingRef.current = true;

    const init = async () => {
      if (!clerkData) setLoading(true);
      setAreRequestsBootstrapping(true);
      try {
        await refreshAllData();
      } finally {
        if (isMounted) {
          setLoading(false);
          setAreRequestsBootstrapping(false);
        }
        isInitializingRef.current = false;
      }
    };
    
    init();

    return () => {
      isMounted = false;
      isInitializingRef.current = false;
    };
  }, [clerkData, refreshAllData]);

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

  const handleRealtimeUpdate = useCallback((data) => {
    if (clerkData?.is_hod && data.payload?.branch === clerkData.branch) {
      if (['TIMETABLE_CHANGED', 'ATTENDANCE_SAVED', 'SESSION_STARTED', 'SESSION_ENDED'].includes(data.type)) {
        console.info(`[HODSync] ${data.type} detected, refreshing...`);
        fetchHODData();
      }
    }

    if (['REQUEST_CREATED', 'REQUEST_UPDATED'].includes(data.type)) {
      if (clerkData?.role) {
        console.info(`[StaffSync] ${data.type} detected, refreshing requests and history...`);
        refreshAllRequests(clerkData.role);
      }
    }
  }, [clerkData, fetchHODData, refreshAllRequests]);

  return (
    <StaffContext.Provider value={{
      staffData: clerkData,
      clerkData,
      collegeInfo,
      setStaffData: setClerkData,
      setClerkData,
      loading,
      error,
      refreshStaffData: fetchClerk,
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
    </StaffContext.Provider>
  );
}

export function useStaff() {
  const context = useContext(StaffContext);
  if (context === undefined) {
    throw new Error('useStaff must be used within a StaffProvider');
  }
  return context;
}
