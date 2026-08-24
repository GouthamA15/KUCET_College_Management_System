'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import ClassList from '@/components/staff/faculty/ClassList';
import PersonalSchedule from '@/components/staff/faculty/PersonalSchedule';
import FacultyActivityBar from '@/components/staff/faculty/FacultyActivityBar';
import { StaffDashboardSkeleton } from '@/components/ui/DashboardSkeleton';

import { useStaff } from '@/context/StaffContext';

export default function FacultyDashboardClient() {
  const router = useRouter();
  const { staffData: staff, loading, facultyAssignments, refreshFaculty, refreshHOD } = useStaff();

  const [activeSection, setActiveSection] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  useEffect(() => {
    if (!loading && !staff) {
      router.push('/');
    }
  }, [staff, loading, router]);

  const handleInterestSubmitted = useCallback(() => {
    // Optional: refresh logic
  }, []);

  const handleSelectAssignment = (asgn, mode) => {
    setSelectedAssignment(asgn);
    setActiveSection(mode === 'attendance' ? 'attendance' : 'marks');
  };

  const handleOpenWorkstream = (id) => {
    setSelectedAssignment(null);
    setActiveSection(id);
  };

  const handleBackToDashboard = () => {
    setActiveSection(null);
    setSelectedAssignment(null);
  };

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
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Dashboard Overview</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-sm border border-slate-200 border-t-4 border-t-indigo-400 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">Subjects</h3>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tight opacity-80 mt-1">
                  {activeAssignmentsCount} assigned {activeAssignmentsCount === 1 ? 'subject' : 'subjects'}
                </p>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/staff/faculty/subjects')}
                  className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-900 transition-colors"
                >
                  Open Subjects <span className="text-sm">→</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-sm border border-slate-200 border-t-4 border-t-emerald-400 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">Class Lists</h3>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tight opacity-80 mt-1">
                  Review rosters for your classes
                </p>
              </div>
              <div className="mt-6">
                {/* For now, just rendering a button that does nothing or opens a modal if needed, but the instructions said "Do NOT redesign Class Lists in this task. If it currently has no dedicated page, leave its existing behavior intact." Wait, ClassList used to be rendered IN the dashboard! */}
                <button
                  type="button"
                  onClick={() => setActiveSection('classList')}
                  className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-900 transition-colors"
                >
                  View Class Lists <span className="text-sm">→</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {activeSection === 'classList' && (
          <section className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight uppercase">Class Lists</h2>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight mt-1">Download and review rosters for your assigned classes.</p>
              </div>
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="text-[10px] font-black text-[#0b3578] hover:text-blue-900 flex items-center gap-2 uppercase tracking-widest border border-slate-200 px-3 py-2 bg-white rounded-sm w-fit cursor-pointer"
              >
                ← Close Class Lists
              </button>
            </div>
            <div className="p-4 md:p-6">
              <ClassList />
            </div>
          </section>
        )}

        {!activeSection && <PersonalSchedule />}
      </div>
    </>
  );
}
