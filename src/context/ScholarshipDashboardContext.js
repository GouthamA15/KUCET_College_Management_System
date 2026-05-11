'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const ScholarshipDashboardContext = createContext(undefined);

const STORAGE_KEY = 'scholarship_dashboard_state_v1';

const initialState = {
  roll: '',
  searchMode: 'roll',
  applicationNoInput: '',
  nameInput: '',
  nameResults: [],
  rollError: '',
  student: null,
  feeSummary: null,
  scholarshipProceedings: [],
  studentPayments: [],
  yearList: [],
  summariesByYear: {},
  expandedByYear: {},
};

export function ScholarshipDashboardProvider({ children }) {
  const [state, setState] = useState(initialState);

  // Hydrate from sessionStorage once on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const timer = setTimeout(() => {
          setState((prev) => ({ ...prev, ...parsed }));
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore hydration errors
    }
  }, []);

  // Persist to sessionStorage whenever state changes
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore persistence errors
    }
  }, [state]);

  const setField = useCallback((key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetStudent = useCallback(() => {
    setState((prev) => ({
      ...prev,
      student: null,
      feeSummary: null,
      scholarshipProceedings: [],
      studentPayments: [],
      yearList: [],
      summariesByYear: {},
      expandedByYear: {},
    }));
  }, []);

  const ctxValue = useMemo(
    () => ({
      state,
      setField,
      resetStudent,
      setState,
    }),
    [state, setField, resetStudent]
  );

  return (
    <ScholarshipDashboardContext.Provider value={ctxValue}>
      {children}
    </ScholarshipDashboardContext.Provider>
  );
}

export function useScholarshipDashboard() {
  const ctx = useContext(ScholarshipDashboardContext);
  if (!ctx) {
    throw new Error('useScholarshipDashboard must be used within ScholarshipDashboardProvider');
  }
  return ctx;
}
