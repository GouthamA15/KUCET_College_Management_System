'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export const ClerkContext = createContext();

export function ClerkProvider({ children }) {
  // ... rest of state

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
    } catch (e) {
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

  useEffect(() => {
    const init = async () => {
      // Only set loading if we don't have clerk data yet
      if (!clerkData) setLoading(true);

      const clerk = await fetchClerk();
      const promises = [fetchCollegeInfo()];
      if (clerk?.role === 'faculty') {
        promises.push(fetchFacultyData());
        if (clerk?.is_hod) {
          promises.push(fetchHODData());
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
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchClerk, fetchCollegeInfo, fetchFacultyData, fetchPendingProfileRequests, fetchPendingCertificateRequests, fetchAdmissionDrafts, fetchHODData, fetchStudentHistory]);

  const handleRealtimeUpdate = useCallback((data) => {
    if (clerkData?.is_hod && data.payload.branch === clerkData.branch) {
      if (['TIMETABLE_CHANGED', 'ATTENDANCE_SAVED', 'SESSION_STARTED', 'SESSION_ENDED'].includes(data.type)) {
        console.log(`[HODSync] ${data.type} detected, refreshing...`);
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
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
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
