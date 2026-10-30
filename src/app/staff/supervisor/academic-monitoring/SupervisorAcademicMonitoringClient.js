'use client';

import React from 'react';
import { useStaff } from '@/context/StaffContext';
import AcademicMonitoringConsole from '@/components/staff/academic/monitoring/AcademicMonitoringConsole';
import { ShieldAlert } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function SupervisorAcademicMonitoringClient() {
  const { staffData, loading } = useStaff();

  if (loading) {
    return <LoadingSpinner label="Authenticating Institutional Supervisor Access..." />;
  }

  const isSupervisor = Boolean(staffData?.is_designated_supervisor);
  const isAdmin = staffData?.role === 'admin';

  if (!isSupervisor && !isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-12 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          Global Institutional Academic Monitoring requires designation as the Institutional Academic Supervisor or Administrator authorization.
        </p>
      </div>
    );
  }

  return (
    <AcademicMonitoringConsole
      initialBranch="CSE"
      initialSemester={1}
      title="Institutional Academic Performance & Attendance Monitoring"
      subtitle="Complete cross-departmental academic oversight across all 7 institutional engineering branches and 8 semesters."
    />
  );
}
