'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ClerkContext = createContext();

export function ClerkProvider({ children }) {
  const [clerkData, setClerkData] = useState(null);
  const [collegeInfo, setCollegeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facultyAssignments, setFacultyAssignments] = useState([]);
  const [facultyInterests, setFacultyInterests] = useState([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);

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
        setClerkData(data);
        return data;
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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const clerk = await fetchClerk();
      const promises = [fetchCollegeInfo()];
      if (clerk?.role === 'faculty') {
        promises.push(fetchFacultyData());
      }
      await Promise.all(promises);
      setLoading(false);
    };
    init();
  }, [fetchClerk, fetchCollegeInfo, fetchFacultyData]);

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
      refreshFaculty: fetchFacultyData
    }}>
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
