'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const StudentContext = createContext();

export function StudentProvider({ children }) {
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async (rollno) => {
    try {
      const res = await fetch(`/api/student/${rollno}`);
      const data = await res.json();
      if (res.ok) {
        if (data.student && data.student.pfp) {
          // Append timestamp to avoid caching issues if pfp changes
          data.student.pfp = `${data.student.pfp}?t=${new Date().getTime()}`;
        }
        setStudentData(data);
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
        return await fetchProfile(user.roll_no);
      }
    } catch (e) {
      setError('Failed to refresh data');
    }
    return null;
  }, [fetchProfile]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await refreshData();
      setLoading(false);
    };
    init();
  }, [refreshData]);

  return (
    <StudentContext.Provider value={{ studentData, setStudentData, loading, error, refreshData }}>
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
