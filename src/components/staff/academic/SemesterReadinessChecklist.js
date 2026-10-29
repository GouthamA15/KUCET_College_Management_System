'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ChevronRight
} from 'lucide-react';
import { useStaff } from '@/context/StaffContext';
import { 
  INSTITUTIONAL_BRANCHES as CANONICAL_BRANCHES, 
  deriveDefaultAcademicYear, 
  getCanonicalAcademicYears 
} from '@/lib/academic-constants';

export default function SemesterReadinessChecklist({ 
  onNavigateToTab = null,
  isCoordinatorView = false,
  initialAcademicYear = null,
  initialBranch = null,
  initialSemester = null
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

  const resolvedDefaultYear = initialAcademicYear || staffData?.coordinator_assignment?.academic_year || staffData?.academic_year || deriveDefaultAcademicYear();
  const academicYearsList = React.useMemo(() => getCanonicalAcademicYears(resolvedDefaultYear), [resolvedDefaultYear]);

  const [selectedBranch, setSelectedBranch] = useState(initialBranch || 'CSE');
  const [selectedSemester, setSelectedSemester] = useState(initialSemester ? String(initialSemester) : '1');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(resolvedDefaultYear);

  // Derived effective state within valid bounds - zero cascading set-state loops or race conditions
  const effectiveBranch = availableBranches.includes(selectedBranch) ? selectedBranch : (availableBranches[0] || 'CSE');
  const effectiveSemester = availableSemesters.includes(Number(selectedSemester)) ? selectedSemester : String(availableSemesters[0] || 1);
  const effectiveAcademicYear = selectedAcademicYear || resolvedDefaultYear;

  // Preserve manual user selection: only update if user hasn't explicitly selected a year
  const userSelectedYearRef = React.useRef(false);
  useEffect(() => {
    if (!userSelectedYearRef.current && resolvedDefaultYear && resolvedDefaultYear !== selectedAcademicYear) {
      setSelectedAcademicYear(resolvedDefaultYear);
    }
  }, [resolvedDefaultYear, selectedAcademicYear]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReadiness = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        branch: effectiveBranch,
        semester: effectiveSemester,
        academic_year: effectiveAcademicYear
      });
      const res = await fetch(`/api/staff/hod/semester-readiness?${params.toString()}`, { signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load semester readiness');
      setData(json.data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Could not load semester readiness audit. Please retry.');
      toast.error(err.message || 'Failed to load semester readiness');
    } finally {
      setLoading(false);
    }
  }, [effectiveBranch, effectiveSemester, effectiveAcademicYear]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchReadiness(controller.signal);
      }
    });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [fetchReadiness]);

  return (
    <div className="space-y-6 w-full text-sm">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Semester Readiness Audit</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0b3578]/10 text-[#0b3578] border border-[#0b3578]/20">
              Institutional Governance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative pre-term checklist evaluating syllabus configuration, faculty allocation completeness, timetable publishing, and request resolution.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <select
            value={effectiveBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800"
          >
            {availableBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={effectiveSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="h-9 px-3 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800"
          >
            {availableSemesters.map(s => (
              <option key={s} value={String(s)}>Sem {s}</option>
            ))}
          </select>

          <select
            value={effectiveAcademicYear}
            onChange={(e) => {
              userSelectedYearRef.current = true;
              setSelectedAcademicYear(e.target.value);
            }}
            className="h-9 px-3 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800 font-mono"
          >
            {academicYearsList.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={fetchReadiness}
            className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="Refresh Audit"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin" />
          <span>Evaluating semester readiness checklist...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <div className="text-sm font-bold text-rose-800">{error}</div>
          <p className="text-xs text-rose-600">Could not evaluate readiness for {selectedBranch} Semester {selectedSemester} ({selectedAcademicYear}).</p>
          <button 
            type="button"
            onClick={() => fetchReadiness()} 
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Retry Audit
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* ── Progress Score Card ──────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-slate-900 to-[#0b3578] text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-sky-200">
                  {selectedBranch} · Semester {selectedSemester} · {selectedAcademicYear}
                </span>
                <h3 className="text-2xl font-bold mt-1">
                  Overall Readiness Score: {data.readiness_score}%
                </h3>
                <p className="text-xs text-sky-100/80 mt-1 max-w-xl">
                  {data.is_ready 
                    ? 'All prerequisites verified. The semester curriculum, faculty assignments, and schedule are ready for instructional delivery.'
                    : 'Action items require attention before academic sessions commence.'}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center font-bold text-xl font-mono">
                  {data.readiness_score}%
                </div>
              </div>
            </div>

            <div className="mt-4 w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  data.readiness_score >= 90 ? 'bg-emerald-400' : data.readiness_score >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                }`}
                style={{ width: `${data.readiness_score}%` }}
              />
            </div>
          </div>

          {/* ── 4 Pillars Checklist ──────────────────────────────────────────── */}
          <div className="space-y-3">
            {data.checklist.map((item) => {
              const isReady = item.status === 'READY';
              const isWarning = item.status === 'WARNING';

              return (
                <div 
                  key={item.id}
                  className={`bg-white border rounded-xl p-5 shadow-xs transition-all ${
                    isReady ? 'border-emerald-200' : isWarning ? 'border-amber-200' : 'border-rose-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isReady ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                          <span 
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                              isReady 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : isWarning 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{item.message}</p>
                      </div>
                    </div>

                    <div className="self-end sm:self-center shrink-0">
                      {item.id === 'allocations' && !isReady && (
                        <button
                          onClick={() => onNavigateToTab && onNavigateToTab(isCoordinatorView ? 'allocations' : 'directory')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          <span>Manage Allocations</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {item.id === 'requests' && !isReady && (
                        <button
                          onClick={() => onNavigateToTab && onNavigateToTab(isCoordinatorView ? 'requests' : 'interests')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          <span>Review Requests</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
