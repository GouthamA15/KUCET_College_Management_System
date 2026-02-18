'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const StudentContext = createContext();

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

  const fetchAcademicPerformance = useCallback(async () => {
    setIsLoadingAcademic(true);
    try {
      const res = await fetch('/api/student/academic-info');
      const json = await res.json();
      if (res.ok) {
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
      const [profileRes, sigRes] = await Promise.all([
        fetch(`/api/student/${rollno}`),
        fetch('/api/student/signature')
      ]);
      
      const data = await profileRes.json();
      if (profileRes.ok) {
        if (data.student && data.student.pfp) {
          data.student.pfp = `${data.student.pfp}?t=${new Date().getTime()}`;
        }
        setStudentData(data);
        
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          setLatestProfileRequest(sigData.latestRequest);
        }
        
        return data;
      } else {
        setError(data.message || 'Failed to fetch profile');
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
  }, [fetchProfile, fetchCollegeInfo]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await refreshData();
      setLoading(false);
    };
    init();
  }, [refreshData]);

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
      refreshProfile: async () => {
        const me = await fetch('/api/student/me');
        if (me.ok) {
          const user = await me.json();
          return fetchProfile(user.roll_no);
        }
      }
    }}>
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
