'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    } catch (e) {
      setError('Network error');
    }
    return null;
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const me = await fetch('/api/student/me');
      if (me.ok) {
        const user = await me.json();
        await fetchCollegeInfo();
        const profilePromise = fetchProfile(user.roll_no);
        const academicPromise = fetchAcademicPerformance();
        const [profile] = await Promise.all([profilePromise, academicPromise]);
        return profile;
      }
    } catch (e) {
      setError('Failed to refresh data');
    }
    return null;
  }, [fetchProfile, fetchCollegeInfo, fetchAcademicPerformance]);

  useEffect(() => {
    // Avoid a refresh loop: refreshData() sets studentData,
    // so we only initialize when there is no cached data.
    if (studentData) return;

    let cancelled = false;
    const id = setTimeout(() => {
      const init = async () => {
        setLoading(true);
        await refreshData();
        if (!cancelled) setLoading(false);
      };
      init();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [refreshData, studentData]);

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
