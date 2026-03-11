'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

const ClerkContext = createContext();

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
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [hodBranchData, setHodBranchData] = useState(null);
  const [isLoadingHOD, setIsLoadingHOD] = useState(false);

  const fetchCollegeInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/public/college-info');
      const data = await res.json();
      if (res.ok) {
        setCollegeInfo(data.collegeInfo);
      }
    } catch (e) {
      console.error('Failed to fetch college info', e);
    }
  }, []);

  const fetchClerk = useCallback(async () => {
    try {
      const res = await fetch('/api/clerk/me');
      const data = await res.json();
      if (res.ok) {
        setClerkData(data.data);
        return data.data;
      } else {
        setError(data.error || 'Failed to fetch clerk data');
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
      const asgnJson = await asgnRes.json();
      const intJson = await intRes.json();
      
      if (asgnRes.ok) setFacultyAssignments(asgnJson.data || []);
      if (intRes.ok) setFacultyInterests(intJson.data || []);
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
      const configJson = await configRes.json();
      const facultyJson = await facultyRes.json();
      const ttJson = await ttRes.json();
      const subjectsJson = await subjectsRes.json();
      const assignmentsJson = await assignmentsRes.json();
      
      if (configRes.ok && facultyRes.ok && ttRes.ok && subjectsRes.ok && assignmentsRes.ok) {
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
      const json = await res.json();
      if (res.ok) {
        setPendingProfileRequests(json.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch pending profile requests', e);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
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
      }
      await Promise.all(promises);
      setLoading(false);
    };
    init();
  }, [fetchClerk, fetchCollegeInfo, fetchFacultyData, fetchPendingProfileRequests, fetchHODData]);

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
      refreshClerk: fetchClerk,
      facultyAssignments,
      facultyInterests,
      isLoadingFaculty,
      refreshFaculty: fetchFacultyData,
      pendingProfileRequests,
      isLoadingRequests,
      refreshProfileRequests: fetchPendingProfileRequests,
      hodBranchData,
      isLoadingHOD,
      refreshHOD: fetchHODData
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
