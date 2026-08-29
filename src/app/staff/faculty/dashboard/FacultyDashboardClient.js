'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';


import PersonalSchedule from '@/components/staff/faculty/PersonalSchedule';
import FacultyActivityBar from '@/components/staff/faculty/FacultyActivityBar';
import { StaffDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

import { useStaff } from '@/context/StaffContext';

export default function FacultyDashboardClient() {
  const router = useRouter();
  const { staffData: staff, loading, facultyAssignments } = useStaff();

  useEffect(() => {
    if (!loading && !staff) {
      router.push('/');
    }
  }, [staff, loading, router]);

  if (loading) {
    return <StaffDashboardSkeleton />;
  }

  const firstName = staff?.name?.split(' ')[0] || 'Faculty';
  const employeeLabel = staff?.employee_id || (staff?.role ? String(staff.role).toUpperCase() : 'FACULTY');
  const roleLabel = 'Faculty';

  const activeAssignmentsCount = facultyAssignments ? facultyAssignments.filter(a => a.is_active).length : 0;

  return (
    <>
      <FacultyActivityBar />

      <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 md:px-8 animate-fadeIn font-sans antialiased text-slate-600">
        <header className="border-b border-slate-100 pb-4" />

        <div className="mt-3 space-y-3">
          <h1 className="text-center text-3xl font-black tracking-tight text-slate-800 uppercase">Welcome, {firstName}</h1>
          <div className="flex flex-wrap items-center justify-center gap-3 text-slate-600">
            <span className="text-[12px] font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
              {employeeLabel}
            </span>
            <span className="text-slate-200">|</span>
            <span className="text-xs font-medium uppercase tracking-tight">{roleLabel}</span>
            {staff?.is_hod && (
              <>
                <span className="text-slate-200">|</span>
                <span className="text-[10px] font-bold bg-[#0b3578] text-white border border-[#0b3578] px-2 py-0.5 rounded uppercase tracking-wider">
                  HOD - {staff?.department_name || staff?.branch} Dept
                </span>
                <span className="text-slate-200">|</span>
                <span className="text-xs font-medium uppercase tracking-tight">AY: {staff?.academic_year || '2025-26'}</span>
              </>
            )}
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Dashboard Overview</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-sm border border-slate-200 border-t-4 border-t-indigo-400 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">My Subjects</h3>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tight opacity-80 mt-1">
                  {activeAssignmentsCount} assigned {activeAssignmentsCount === 1 ? 'subject' : 'subjects'}
                </p>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/staff/faculty/academics')}
                  className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-900 transition-colors"
                >
                  Open Subjects <span className="text-sm">→</span>
                </button>
              </div>
            </div>

            {staff?.is_hod && (
              <div className="bg-white p-6 rounded-sm border border-slate-200 border-t-4 border-t-blue-600 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">Department Subjects</h3>
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tight opacity-80 mt-1">
                    Manage and assign subjects for your department
                  </p>
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => router.push('/staff/faculty/academics')}
                    className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1 hover:text-blue-900 transition-colors"
                  >
                    Manage Subjects <span className="text-sm">→</span>
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-sm border border-slate-200 border-t-4 border-t-emerald-400 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">Students</h3>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tight opacity-80 mt-1">
                  Look up students in your department programs
                </p>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/staff/faculty/academics')}
                  className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-900 transition-colors"
                >
                  Lookup Students <span className="text-sm">→</span>
                </button>
              </div>
            </div>
          </div>
        </section>
        <PersonalSchedule />
      </div>
    </>
  );
}
