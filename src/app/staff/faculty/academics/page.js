'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import SubjectInterestForm from '@/components/staff/faculty/SubjectInterestForm';
import InterestStatusList from '@/components/staff/faculty/InterestStatusList';
import HodAccessManager from '@/components/staff/faculty/HodAccessManager';
import StudentsLookupPanel from '@/components/staff/faculty/StudentsLookupPanel';
import { Info, X, Search, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

// ─── Compact Subject Card ───────────────────────────────────────────────────
function SubjectCard({ asgn, onAction }) {
  const isActive = asgn.is_active;
  return (
    <div className={`group bg-white border border-gray-200 rounded-sm shadow-sm relative overflow-hidden transition-shadow hover:shadow ${!isActive ? 'opacity-70' : ''}`}>
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] z-10 ${isActive ? 'bg-[#0b3578]' : 'bg-gray-300'}`} />

      {/* Bubble decoration */}
      <div className={`absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 rounded-bl-full -mr-4 -mt-4 sm:-mr-5 sm:-mt-5 transition-transform group-hover:scale-110 ${isActive ? 'bg-blue-50/70' : 'bg-gray-50'}`}></div>

      <div className="pl-4 pr-4 pt-3 pb-3 relative z-10">
        {/* Header row: code + status badge */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{asgn.subject_code}</span>
          {!isActive && (
            <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wide">Archived</span>
          )}
        </div>

        {/* Subject name — primary text */}
        <h3 className={`text-sm font-semibold leading-snug mb-2 ${isActive ? 'text-gray-800' : 'text-gray-500'}`}>
          {asgn.subject_name}
        </h3>

        {/* Compact metadata row */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mb-3">
          <span>{asgn.branch}</span>
          <span className="text-gray-300">·</span>
          <span>Sem {asgn.course_semester}</span>
          <span className="text-gray-300">·</span>
          <span>{asgn.academic_year}</span>
          {asgn.subject_type && (
            <>
              <span className="text-gray-300">·</span>
              <span className="capitalize">{asgn.subject_type}</span>
            </>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-3 pt-2.5 border-t border-gray-100">
          <button
            onClick={() => isActive && onAction(asgn, 'attendance')}
            disabled={!isActive}
            className={`text-xs font-medium transition-colors ${isActive ? 'text-[#0b3578] hover:text-blue-900 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
          >
            Attendance
          </button>
          <span className="text-gray-200">|</span>
          <button
            onClick={() => isActive && onAction(asgn, 'marks')}
            disabled={!isActive}
            className={`text-xs font-medium transition-colors ${isActive ? 'text-[#0b3578] hover:text-blue-900 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
          >
            Evaluation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SubjectCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm relative overflow-hidden animate-pulse">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gray-200" />
      <div className="pl-4 pr-4 pt-3 pb-3">
        <div className="h-2.5 w-16 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-4/5 bg-gray-200 rounded mb-1.5" />
        <div className="h-3 w-3/5 bg-gray-100 rounded mb-3" />
        <div className="flex gap-3 pt-2.5 border-t border-gray-100">
          <div className="h-3 w-14 bg-gray-200 rounded" />
          <div className="h-3 w-14 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── Compact Filter/Search Bar ─────────────────────────────────────────────
function SubjectFilters({ search, onSearch, semFilter, onSemFilter, yearFilter, onYearFilter, semesters, academicYears }) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-4">
      {/* Search */}
      <div className="relative w-full sm:flex-1 sm:max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search subjects…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#0b3578]/40 focus:ring-1 focus:ring-[#0b3578]/10 transition"
        />
      </div>

      <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
        {/* Semester filter */}
        <div className="relative flex-1 sm:flex-none">
          <select
            value={semFilter}
            onChange={e => onSemFilter(e.target.value)}
            className="w-full sm:w-auto appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:border-[#0b3578]/40 focus:ring-1 focus:ring-[#0b3578]/10 transition cursor-pointer"
          >
            <option value="">All Semesters</option>
            {semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Academic Year filter */}
        <div className="relative flex-1 sm:flex-none">
          <select
            value={yearFilter}
            onChange={e => onYearFilter(e.target.value)}
            className="w-full sm:w-auto appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:border-[#0b3578]/40 focus:ring-1 focus:ring-[#0b3578]/10 transition cursor-pointer"
          >
            <option value="">All Years</option>
            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Clear Button (Mobile compact) */}
        {(search || semFilter || yearFilter) && (
          <button
            onClick={() => { onSearch(''); onSemFilter(''); onYearFilter(''); }}
            className="text-xs font-medium text-[#0b3578] hover:text-blue-900 transition-colors cursor-pointer sm:hidden whitespace-nowrap px-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Clear Button (Desktop) */}
      {(search || semFilter || yearFilter) && (
        <button
          onClick={() => { onSearch(''); onSemFilter(''); onYearFilter(''); }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer hidden sm:block"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Main Page Content ───────────────────────────────────────────────────────
function AcademicsContent() {
  const router = useRouter();
  const { loading, isLoadingFaculty, facultyAssignments, staffData, refreshFaculty, hasFetchedFaculty } = useStaff();

  const tabs = [
    { id: 'subjects', label: 'My Subjects' },
    ...(!staffData?.is_hod ? [{ id: 'requests', label: 'Request Subjects' }] : []),
    { id: 'roster', label: 'Students' },
    { id: 'hod', label: 'HOD Access' },
  ];

  const [activeTab, setActiveTab] = useState('subjects');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

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

  // Lazy-load faculty data once when page mounts
  useEffect(() => {
    if (!loading && staffData && !hasFetchedFaculty && !isLoadingFaculty && refreshFaculty) {
      refreshFaculty();
    }
  }, [loading, staffData, hasFetchedFaculty, isLoadingFaculty, refreshFaculty]);

  const assignmentsList = useMemo(() => facultyAssignments || [], [facultyAssignments]);
  const isDataLoading = loading || !hasFetchedFaculty || isLoadingFaculty;

  // Derived filter options from loaded data
  const semesters = useMemo(() =>
    [...new Set(assignmentsList.map(a => a.course_semester).filter(Boolean))].sort((a, b) => a - b),
    [assignmentsList]
  );
  const academicYears = useMemo(() =>
    [...new Set(assignmentsList.map(a => a.academic_year).filter(Boolean))].sort().reverse(),
    [assignmentsList]
  );

  // Client-side filtering
  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignmentsList.filter(a => {
      if (q && !(
        a.subject_name?.toLowerCase().includes(q) ||
        a.subject_code?.toLowerCase().includes(q) ||
        a.branch?.toLowerCase().includes(q)
      )) return false;
      if (semFilter && String(a.course_semester) !== semFilter) return false;
      if (yearFilter && a.academic_year !== yearFilter) return false;
      return true;
    });
  }, [assignmentsList, search, semFilter, yearFilter]);

  const handleSelectAssignment = (assignment, mode) => {
    if (mode === 'attendance') {
      router.push(`/staff/faculty/attendance/${assignment.id}`);
    } else if (mode === 'marks') {
      router.push(`/staff/faculty/evaluation/${assignment.id}`);
    }
  };

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
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Academics Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            This module provides a comprehensive overview of your assigned subjects and teaching requests.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>My Subjects:</strong> Your current and past subject assignments with attendance and evaluation access.</li>
            <li><strong>Request Subjects:</strong> Express interest in subjects for upcoming terms. Sent to your HOD for approval.</li>
            <li><strong>Students:</strong> View student rosters for your assigned classes.</li>
            <li><strong>HOD Access:</strong> View your HOD status or request HOD designation for your department.</li>
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
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">

      {/* Page Header — identical pattern to StudentFinancesClient */}
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Academics Hub</h1>

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
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">Academics Information</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  This module provides a comprehensive overview of your assigned subjects and teaching requests.
                </p>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>My Subjects:</strong> Your current and past subject assignments with attendance and evaluation access.</li>
                  <li><strong>Request Subjects:</strong> Express interest in subjects for upcoming terms. Sent to your HOD for approval.</li>
                  <li><strong>Students:</strong> View student rosters for your assigned classes.</li>
                  <li><strong>HOD Access:</strong> View your HOD status or request HOD designation for your department.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Manage your active instructional assignments, record attendance, input evaluations, and track your subject requests seamlessly.</p>

        {/* Mobile tabs (rendered inline with header, matching Finance page pattern) */}
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

      {/* Desktop tabs (matching Finance page pattern — rendered below header section) */}
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

      {/* ── My Subjects ── */}
      {activeTab === 'subjects' && (
        <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm">
          {isDataLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <SubjectCardSkeleton key={i} />)}
            </div>
          ) : assignmentsList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-gray-500">No subjects assigned</p>
              <p className="text-xs text-gray-400 mt-1">Use the &quot;Request Subjects&quot; tab to express interest in subjects.</p>
            </div>
          ) : (
            <>
              <SubjectFilters
                search={search} onSearch={setSearch}
                semFilter={semFilter} onSemFilter={setSemFilter}
                yearFilter={yearFilter} onYearFilter={setYearFilter}
                semesters={semesters}
                academicYears={academicYears}
              />

              {filteredAssignments.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-gray-500">No subjects match your search.</p>
                  <button
                    onClick={() => { setSearch(''); setSemFilter(''); setYearFilter(''); }}
                    className="mt-2 text-xs text-[#0b3578] hover:underline cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredAssignments.map(asgn => (
                    <SubjectCard key={asgn.id} asgn={asgn} onAction={handleSelectAssignment} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Request Subjects ── */}
      {!staffData?.is_hod && activeTab === 'requests' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-800">Subject Request Workflow</h2>
              <p className="text-xs text-gray-500 mt-1">Submit teaching preferences below. Requests are routed to the department HOD for approval and formal assignment.</p>
            </div>
            <SubjectInterestForm />
          </div>

          <div id="request-history-section" className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Request History</h2>
            <div className="border-t border-gray-100 pt-4">
              <InterestStatusList />
            </div>
          </div>
        </div>
      )}

      {/* ── Students ── */}
      {activeTab === 'roster' && (
        <StudentsLookupPanel />
      )}

      {/* ── HOD Access ── */}
      {activeTab === 'hod' && (
        <HodAccessManager />
      )}

      {typeof document !== 'undefined' && isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
    </div>
  );
}

export default function FacultyAcademicsPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-6xl mx-auto space-y-6 text-sm text-center text-slate-500 pt-10">Loading Academics…</div>}>
      <AcademicsContent />
    </Suspense>
  );
}
