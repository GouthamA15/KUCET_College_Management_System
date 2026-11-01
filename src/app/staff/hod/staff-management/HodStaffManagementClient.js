'use client';

import React, { useState, useEffect } from 'react';
import { useStaff } from '@/context/StaffContext';
import HodFacultyInterests from '@/components/staff/faculty/HodFacultyInterests';
import ActiveFacultyList from '@/components/staff/faculty/ActiveFacultyList';
import TeachingAssignmentDirectory from '@/components/staff/academic/TeachingAssignmentDirectory';
import AcademicCoverageDashboard from '@/components/staff/academic/AcademicCoverageDashboard';
import SemesterReadinessChecklist from '@/components/staff/academic/SemesterReadinessChecklist';
import { GenericPageSkeleton } from '@/components/ui/DashboardSkeleton';
import { Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { deriveDefaultAcademicYear } from '@/lib/academic-constants';

export default function HodStaffManagementClient() {
  const { loading, staffData, hasFetchedFaculty, isLoadingFaculty, refreshFaculty } = useStaff();
  
  const tabs = [
    { id: 'directory', label: 'Teaching Directory' },
    { id: 'coverage', label: 'Coverage & Workload' },
    { id: 'readiness', label: 'Readiness Checklist' },
    { id: 'interests', label: 'Faculty Requests' },
    { id: 'faculty', label: 'Active Faculty' },
  ];

  const [activeTab, setActiveTab] = useState('directory');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isBottomSheetOpen && isMobileDevice) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isBottomSheetOpen, isMobileDevice]);

  useEffect(() => {
    if (!loading && staffData?.is_hod && !hasFetchedFaculty && !isLoadingFaculty && refreshFaculty) {
      refreshFaculty();
    }
  }, [loading, staffData, hasFetchedFaculty, isLoadingFaculty, refreshFaculty]);

  // Verify HOD status
  if (!loading && staffData && !staffData.is_hod && staffData.role !== 'admin' && !staffData.is_principal) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <p className="text-red-500 font-medium">Unauthorized Access. You must be an HOD to view this page.</p>
      </div>
    );
  }

  if (loading || !staffData) {
    return <GenericPageSkeleton />;
  }

  const bottomSheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-sheet-title"
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Academic Management Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            Comprehensive departmental academic leadership console.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Teaching Directory:</strong> Complete registry of who is teaching which subject, active vs archived allocations, and change history.</li>
            <li><strong>Coverage &amp; Workload:</strong> Identifies unassigned syllabus subjects, timetable readiness, and faculty workload distribution.</li>
            <li><strong>Readiness Checklist:</strong> Verification of curriculum, allocations, timetable, and pending requests.</li>
            <li><strong>Faculty Requests:</strong> Review and approve/reject subject preference requests submitted by department faculty.</li>
            <li><strong>Active Faculty:</strong> View the roster of all faculty members assigned to your department.</li>
          </ul>
        </div>
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors focus:outline-none cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-sm">
      {isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
      
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Department Academic Management</h1>
          
          <div
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) setIsBottomSheetOpen(true);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Help Information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">Academic Leadership Console</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Manage department faculty, curriculum coverage, teaching assignments, and semester readiness.
                </p>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>Teaching Directory:</strong> Active and archived assignments, sections, co-instructors.</li>
                  <li><strong>Coverage &amp; Workload:</strong> Unassigned subjects, scheduled periods, and load distribution.</li>
                  <li><strong>Readiness Checklist:</strong> Automated pre-term prerequisite audit.</li>
                  <li><strong>Faculty Requests:</strong> Review subject preferences.</li>
                  <li><strong>Active Faculty:</strong> Departmental faculty roster.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Oversight of teaching assignments, subject coverage, faculty workload, and semester readiness for your authorized department.
        </p>
        
        {/* Mobile tabs */}
        <div className="md:hidden flex flex-wrap items-center gap-2 mt-3.5 pb-1">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${activeTab === t.id ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Desktop tabs */}
      <div className="hidden md:flex items-center gap-2 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors cursor-pointer ${activeTab === t.id ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[50vh]">
        {activeTab === 'directory' && (
          <TeachingAssignmentDirectory initialAcademicYear={staffData?.academic_year || deriveDefaultAcademicYear()} />
        )}

        {activeTab === 'coverage' && (
          <AcademicCoverageDashboard 
            initialAcademicYear={staffData?.academic_year || deriveDefaultAcademicYear()} 
            onNavigateToTab={setActiveTab} 
          />
        )}

        {activeTab === 'readiness' && (
          <SemesterReadinessChecklist 
            initialAcademicYear={staffData?.academic_year || deriveDefaultAcademicYear()} 
            onNavigateToTab={setActiveTab} 
          />
        )}

        {activeTab === 'interests' && (
          <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm">
            <HodFacultyInterests />
          </div>
        )}

        {activeTab === 'faculty' && (
          <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm">
            <ActiveFacultyList />
          </div>
        )}
      </div>
    </div>
  );
}
