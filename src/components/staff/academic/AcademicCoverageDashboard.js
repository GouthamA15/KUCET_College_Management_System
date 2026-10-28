'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  AlertCircle
} from 'lucide-react';
import { useStaff } from '@/context/StaffContext';

const CANONICAL_BRANCHES = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];
const ACADEMIC_YEARS = ['2026-27', '2025-26', '2024-25', '2023-24'];

export default function AcademicCoverageDashboard({ 
  onSelectSubject = null, 
  onNavigateToTab = null,
  isCoordinatorView = false 
}) {
  const { staffData } = useStaff();

  const isCoordinator = isCoordinatorView || Boolean(staffData?.is_first_year_coordinator);
  const isHod = Boolean(staffData?.is_hod);
  const isAdmin = staffData?.role === 'admin' || Boolean(staffData?.is_principal);

  const availableBranches = React.useMemo(() => {
    if (isCoordinator && !isHod && !isAdmin) return CANONICAL_BRANCHES;
    if (isAdmin) return CANONICAL_BRANCHES;
    if (isHod && staffData?.authorized_branches?.length > 0) {
      return staffData.authorized_branches;
    }
    const userBranches = Array.from(new Set([...(staffData?.branches || []), staffData?.branch, staffData?.hod_department_code].filter(Boolean)));
    return userBranches.length > 0 ? userBranches : ['CSE'];
  }, [isCoordinator, isHod, isAdmin, staffData]);

  const availableSemesters = React.useMemo(() => {
    if (isCoordinator && !isHod && !isAdmin) return [1, 2];
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [isCoordinator, isHod, isAdmin]);

  const [selectedBranch, setSelectedBranch] = useState(availableBranches[0] || 'CSE');
  const [selectedSemester, setSelectedSemester] = useState(availableSemesters[0] ? String(availableSemesters[0]) : '1');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025-26');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCoverage = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        branch: selectedBranch,
        semester: selectedSemester,
        academic_year: selectedAcademicYear
      });
      const res = await fetch(`/api/staff/hod/academic-coverage?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load coverage analysis');
      setData(json.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedSemester, selectedAcademicYear]);

  useEffect(() => {
    let ignore = false;
    const id = setTimeout(() => {
      if (!ignore) fetchCoverage();
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(id);
    };
  }, [fetchCoverage]);

  return (
    <div className="space-y-6 w-full text-sm">
      {/* ── Top Header & Context ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Academic Coverage &amp; Workload Intelligence</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0b3578]/10 text-[#0b3578] border border-[#0b3578]/20">
              {isCoordinator ? 'First-Year Cohort Oversight' : `Department Oversight (${selectedBranch})`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time verification of curriculum coverage, timetable scheduling readiness, and faculty instructional load.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800"
          >
            {availableBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800"
          >
            {availableSemesters.map(s => (
              <option key={s} value={String(s)}>Sem {s}</option>
            ))}
          </select>

          <select
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800 font-mono"
          >
            {ACADEMIC_YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={fetchCoverage}
            className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="Refresh Analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Calculating academic coverage &amp; load metrics...
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* ── KPI METRICS CARDS ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              onClick={() => onNavigateToTab && onNavigateToTab('directory')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-[#0b3578]/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Curriculum Subjects</span>
                <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578]" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{data.summary.total_syllabus_subjects}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {selectedBranch} Semester {selectedSemester}
              </div>
            </div>

            <div 
              onClick={() => onNavigateToTab && onNavigateToTab('directory')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-emerald-600 text-xs font-bold uppercase tracking-wider">
                <span>Assigned Coverage</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2">
                {data.summary.coverage_percentage}%
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5">
                {data.summary.covered_subjects_count} of {data.summary.total_syllabus_subjects} subjects covered
              </div>
            </div>

            <div 
              onClick={() => onNavigateToTab && onNavigateToTab('directory')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-rose-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-rose-600 text-xs font-bold uppercase tracking-wider">
                <span>Unassigned Subjects</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold text-rose-700 mt-2">
                {data.summary.unassigned_subjects_count}
              </div>
              <div className="text-[11px] text-rose-600 mt-0.5 font-medium">
                {data.summary.unassigned_subjects_count === 0 ? 'Full teaching coverage' : 'Missing faculty allocation'}
              </div>
            </div>

            <div 
              onClick={() => onNavigateToTab && onNavigateToTab('interests')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-indigo-600 text-xs font-bold uppercase tracking-wider">
                <span>Pending Requests</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-700 mt-2">
                {data.summary.pending_requests_count}
              </div>
              <div className="text-[11px] text-indigo-600 mt-0.5 font-medium">
                Teaching interest submissions
              </div>
            </div>
          </div>

          {/* ── ACTIONABLE ALERTS BANNER ─────────────────────────────────────── */}
          {data.alerts?.length > 0 ? (
            <div className="space-y-2.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Actionable Academic Alerts ({data.alerts.length})</span>
              </h3>

              <div className="space-y-2">
                {data.alerts.map((alert, idx) => (
                  <div 
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                      alert.severity === 'HIGH' 
                        ? 'bg-rose-50/80 border-rose-200 text-rose-900' 
                        : alert.severity === 'WARNING'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-sky-50/80 border-sky-200 text-sky-900'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 text-xs">
                      {alert.severity === 'HIGH' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">{alert.message}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          {selectedBranch} · Semester {selectedSemester} · Academic Year {selectedAcademicYear}
                        </div>
                      </div>
                    </div>

                    {alert.subject_code && (
                      <button
                        onClick={() => onSelectSubject && onSelectSubject(alert.subject_code)}
                        className="px-3 py-1 bg-white border border-current rounded text-[11px] font-bold hover:bg-white/80 transition-colors shrink-0 cursor-pointer"
                      >
                        Assign Now
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Academic Health Verified:</strong> Full faculty teaching coverage and timetable scheduling synchronized for {selectedBranch} Semester {selectedSemester}.
              </span>
            </div>
          )}

          {/* ── FACULTY TEACHING WORKLOAD DISTRIBUTION ───────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Faculty Teaching Load Distribution</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Assigned subject counts and weekly scheduled periods for {selectedBranch} faculty.</p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {data.workload_distribution.length} Active Instructors
              </span>
            </div>

            {data.workload_distribution.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No active faculty teaching allocations recorded for this semester.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.workload_distribution.map(fac => {
                  const maxStandardPeriods = 16;
                  const pct = Math.min(100, Math.round((fac.total_periods / maxStandardPeriods) * 100));

                  return (
                    <div key={fac.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="sm:w-1/3">
                        <div className="font-bold text-slate-900 text-xs">{fac.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          ID: {fac.employee_id} {fac.designation ? `· ${fac.designation}` : ''}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-600 font-medium">
                            {fac.assigned_subjects.length} course(s): {fac.assigned_subjects.map(s => s.subject_code).join(', ')}
                          </span>
                          <span className="font-bold text-slate-800 font-mono">{fac.total_periods} periods/wk</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              fac.total_periods >= 14 ? 'bg-amber-500' : 'bg-[#0b3578]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
