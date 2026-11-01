'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { deriveDefaultAcademicYear } from '@/lib/academic-constants';
import AcademicOverviewCards from './AcademicOverviewCards';
import AcademicMonitoringFilters from './AcademicMonitoringFilters';
import AttendanceMonitoringGrid from './AttendanceMonitoringGrid';
import MarksMonitoringGrid from './MarksMonitoringGrid';
import CombinedAcademicOverview from './CombinedAcademicOverview';
import StudentAcademicDetailDrawer from './StudentAcademicDetailDrawer';

export default function AcademicMonitoringConsole({
  initialBranch = 'CSE',
  initialSemester = 1,
  initialAcademicYear = null,
  restrictSemesters = null, // e.g. [1, 2] for First-Year Coordinator
  restrictBranches = null,   // e.g. ['CSE'] for HOD
  title = 'Centralized Academic Monitoring Console',
  subtitle = 'Cohort-level attendance compliance, CIE assessment tracking, and student academic risk intervention.'
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'attendance' | 'marks' | 'combined'

  // Filter state
  const [academicYear, setAcademicYear] = useState(initialAcademicYear || deriveDefaultAcademicYear());
  const [branch, setBranch] = useState(initialBranch);
  const [semester, setSemester] = useState(initialSemester);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [prevFilterKey, setPrevFilterKey] = useState('');

  const filterKey = `${search}_${activeTab}_${branch}_${semester}_${academicYear}`;
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // Data states
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [marksData, setMarksData] = useState(null);
  const [combinedData, setCombinedData] = useState(null);

  // Selected student for drill-down drawer
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Allowed branches & semesters from server scope response
  const [allowedBranches, setAllowedBranches] = useState(restrictBranches || ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH']);
  const [allowedSemesters, setAllowedSemesters] = useState(restrictSemesters || [1, 2, 3, 4, 5, 6, 7, 8]);

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        branch,
        semester: String(semester),
        academic_year: academicYear
      });
      const res = await fetch(`/api/staff/academic-monitoring/overview?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load overview data');
      }
      const json = await res.json();
      setOverviewData(json.data);
      if (json.data?.scope?.allowed_branches && !restrictBranches) {
        setAllowedBranches(json.data.scope.allowed_branches);
      }
      if (json.data?.scope?.allowed_semesters && !restrictSemesters) {
        setAllowedSemesters(json.data.scope.allowed_semesters);
      }
    } catch (err) {
      toast.error(err.message || 'Error fetching overview');
    }
  }, [branch, semester, academicYear, restrictBranches, restrictSemesters]);

  // Fetch Attendance Data
  const fetchAttendance = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        branch,
        semester: String(semester),
        academic_year: academicYear,
        page: String(page),
        limit: '50'
      });
      if (search) q.set('search', search);

      const res = await fetch(`/api/staff/academic-monitoring/attendance?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load attendance records');
      }
      const json = await res.json();
      setAttendanceData(json.data);
    } catch (err) {
      toast.error(err.message || 'Error fetching attendance grid');
    }
  }, [branch, semester, academicYear, page, search]);

  // Fetch Marks Data
  const fetchMarks = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        branch,
        semester: String(semester),
        academic_year: academicYear,
        page: String(page),
        limit: '50'
      });
      if (search) q.set('search', search);

      const res = await fetch(`/api/staff/academic-monitoring/marks?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load marks records');
      }
      const json = await res.json();
      setMarksData(json.data);
    } catch (err) {
      toast.error(err.message || 'Error fetching marks grid');
    }
  }, [branch, semester, academicYear, page, search]);

  // Fetch Combined Data
  const fetchCombined = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        branch,
        semester: String(semester),
        academic_year: academicYear,
        page: String(page),
        limit: '50'
      });
      if (search) q.set('search', search);

      const res = await fetch(`/api/staff/academic-monitoring/combined?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load combined performance data');
      }
      const json = await res.json();
      setCombinedData(json.data);
    } catch (err) {
      toast.error(err.message || 'Error fetching combined matrix');
    }
  }, [branch, semester, academicYear, page, search]);

  // Unified load trigger
  const loadActiveTabData = useCallback(async () => {
    setLoading(true);
    if (activeTab === 'overview') {
      await fetchOverview();
    } else if (activeTab === 'attendance') {
      await fetchAttendance();
    } else if (activeTab === 'marks') {
      await fetchMarks();
    } else if (activeTab === 'combined') {
      await fetchCombined();
    }
    setLoading(false);
  }, [activeTab, fetchOverview, fetchAttendance, fetchMarks, fetchCombined]);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        loadActiveTabData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [loadActiveTabData]);

  // Export CSV
  const handleExportCsv = () => {
    const q = new URLSearchParams({
      type: activeTab === 'overview' ? 'combined' : activeTab,
      branch,
      semester: String(semester),
      academic_year: academicYear
    });
    window.open(`/api/staff/academic-monitoring/export/csv?${q.toString()}`, '_blank');
  };

  // Export PDF
  const handleExportPdf = () => {
    const q = new URLSearchParams({
      type: activeTab === 'overview' ? 'combined' : activeTab,
      branch,
      semester: String(semester),
      academic_year: academicYear
    });
    window.open(`/api/staff/academic-monitoring/export/pdf?${q.toString()}`, '_blank');
  };

  const handleOpenStudentDrawer = (st) => {
    setSelectedStudent(st);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 bg-[#0b3578] rounded-full inline-block" />
            {title}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">{subtitle}</p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'overview' ? 'bg-white text-[#0b3578] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'attendance' ? 'bg-white text-[#0b3578] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('marks')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'marks' ? 'bg-white text-[#0b3578] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            CIE Marks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('combined')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'combined' ? 'bg-white text-[#0b3578] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Combined Matrix
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <AcademicMonitoringFilters
        academicYear={academicYear}
        setAcademicYear={setAcademicYear}
        branch={branch}
        setBranch={setBranch}
        semester={semester}
        setSemester={setSemester}
        search={search}
        setSearch={setSearch}
        allowedBranches={allowedBranches}
        allowedSemesters={allowedSemesters}
        loading={loading}
        onRefresh={loadActiveTabData}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />

      {/* Tab 1: Overview Dashboard */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <AcademicOverviewCards
            summary={overviewData?.summary || {}}
            loading={loading}
          />

          {/* Subjects Readiness Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0b3578]" />
              Cohort Subjects Attendance Compliance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(overviewData?.subjects || []).map(sub => (
                <div key={sub.subject_code} className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#0b3578]">{sub.subject_code}</span>
                      <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">{sub.subject_name}</h4>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-200/80 text-slate-700">
                      {sub.subject_type?.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 font-mono">
                    <span className="text-slate-500 font-sans text-[11px]">Conducted: <strong>{sub.conducted_sessions}</strong> classes</span>
                    <span className={`font-bold ${sub.average_attendance_pct < 75 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {sub.average_attendance_pct}% Avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Attendance Grid */}
      {activeTab === 'attendance' && (
        <AttendanceMonitoringGrid
          students={attendanceData?.students || []}
          subjects={attendanceData?.subjects || []}
          pagination={attendanceData?.pagination || {}}
          loading={loading}
          onPageChange={(p) => setPage(p)}
          onSelectStudent={handleOpenStudentDrawer}
        />
      )}

      {/* Tab 3: Marks Grid */}
      {activeTab === 'marks' && (
        <MarksMonitoringGrid
          students={marksData?.students || []}
          subjects={marksData?.subjects || []}
          pagination={marksData?.pagination || {}}
          loading={loading}
          onPageChange={(p) => setPage(p)}
          onSelectStudent={handleOpenStudentDrawer}
        />
      )}

      {/* Tab 4: Combined Matrix */}
      {activeTab === 'combined' && (
        <CombinedAcademicOverview
          students={combinedData?.students || []}
          pagination={combinedData?.pagination || {}}
          loading={loading}
          onPageChange={(p) => setPage(p)}
          onSelectStudent={handleOpenStudentDrawer}
        />
      )}

      {/* Slide-out Student Detail Drawer */}
      <StudentAcademicDetailDrawer
        studentId={selectedStudent?.id}
        branch={branch}
        semester={semester}
        academicYear={academicYear}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedStudent(null);
        }}
      />
    </div>
  );
}
