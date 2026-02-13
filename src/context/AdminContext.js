'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AdminContext = createContext();

export function AdminProvider({ children }) {
  const [adminData, setAdminData] = useState(null);
  const [clerks, setClerks] = useState([]);
  const [studentStats, setStudentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClerks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clerks');
      if (res.ok) {
        const data = await res.json();
        setClerks(data);
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch clerks', e);
    }
    return [];
  }, []);

  const fetchStudentStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/student-stats');
      if (res.ok) {
        const data = await res.json();
        setStudentStats(data);
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch student stats', e);
    }
    return null;
  }, []);

  const fetchAdminMe = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verify'); // Assuming verify endpoint gives admin info
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
        return data;
      }
    } catch (e) {
      console.error('Failed to verify admin', e);
    }
    return null;
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchAdminMe(),
      fetchClerks(),
      fetchStudentStats()
    ]);
    setLoading(false);
  }, [fetchAdminMe, fetchClerks, fetchStudentStats]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminContext.Provider value={{ 
      adminData, 
      clerks, 
      studentStats, 
      loading, 
      error, 
      refreshAll,
      refreshClerks: fetchClerks,
      refreshStudentStats: fetchStudentStats
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
