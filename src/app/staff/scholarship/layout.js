"use client";

import { ScholarshipDashboardProvider } from '@/context/ScholarshipDashboardContext';

export default function ScholarshipLayout({ children }) {
  return (
    <ScholarshipDashboardProvider>
      {children}
    </ScholarshipDashboardProvider>
  );
}
