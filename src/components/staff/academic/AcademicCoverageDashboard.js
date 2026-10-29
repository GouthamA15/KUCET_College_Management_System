'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  AlertCircle,
  X,
  UserPlus
} from 'lucide-react';
import { useStaff } from '@/context/StaffContext';

const CANONICAL_BRANCHES = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];
const ACADEMIC_YEARS = ['2026-27', '2025-26', '2024-25', '2023-24'];

export default function AcademicCoverageDashboard({ 
  onSelectSubject = null, 
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

  const defaultYear = initialAcademicYear || staffData?.coordinator_assignment?.academic_year || staffData?.academic_year || ACADEMIC_YEARS[0];

  const [selectedBranch, setSelectedBranch] = useState(initialBranch || availableBranches[0] || 'CSE');
  const [selectedSemester, setSelectedSemester] = useState(initialSemester ? String(initialSemester) : (availableSemesters[0] ? String(availableSemesters[0]) : '1'));
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(defaultYear);

  // Synchronize academic year with staff context / coordinator assignment
  useEffect(() => {
    const id = setTimeout(() => {
      const activeYear = initialAcademicYear || staffData?.coordinator_assignment?.academic_year || staffData?.academic_year;
      if (activeYear && ACADEMIC_YEARS.includes(activeYear)) {
        setSelectedAcademicYear(activeYear);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [staffData, initialAcademicYear]);

  // Synchronize branch and semester selection with role authorization
  useEffect(() => {
    const id = setTimeout(() => {
      if (availableBranches.length > 0 && !availableBranches.includes(selectedBranch)) {
        setSelectedBranch(availableBranches[0]);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [availableBranches, selectedBranch]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (availableSemesters.length > 0 && !availableSemesters.includes(Number(selectedSemester))) {
        setSelectedSemester(String(availableSemesters[0]));
      }
    }, 0);
    return () => clearTimeout(id);
  }, [availableSemesters, selectedSemester]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State for "Assign Now" Workflow
  const [assignModal, setAssignModal] = useState({
    isOpen: false,
    subject: null,
    faculty_id: '',
    loadingFaculty: false,
    submitting: false,
    conflict: null
  });
  const [activeFacultyList, setActiveFacultyList] = useState([]);

  const fetchCoverage = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        branch: selectedBranch,
        semester: selectedSemester,
        academic_year: selectedAcademicYear
      });
      const res = await fetch(`/api/staff/hod/academic-coverage?${params.toString()}`, { signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load coverage analysis');
      setData(json.data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Could not load subject coverage. Please retry.');
      toast.error(err.message || 'Could not load subject coverage');
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedSemester, selectedAcademicYear]);

  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(() => {
      fetchCoverage(controller.signal);
    }, 0);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [fetchCoverage]);

  const targetTab = isCoordinatorView ? 'allocations' : 'directory';

  // Open "Assign Now" Workflow
  const handleOpenAssignModal = async (subjectCode) => {
    const sub = data?.unassigned_subjects?.find(s => s.subject_code === subjectCode) ||
      data?.covered_subjects?.find(s => s.subject_code === subjectCode) ||
      { subject_code: subjectCode, subject_name: subjectCode, subject_type: 'theory' };

    setAssignModal({
      isOpen: true,
      subject: sub,
      faculty_id: '',
      loadingFaculty: true,
      submitting: false,
      conflict: null
    });

    if (onSelectSubject) {
      onSelectSubject(subjectCode);
    }

    try {
      const res = await fetch(`/api/staff/hod/active-faculty?branch=${encodeURIComponent(selectedBranch)}`);
      if (res.ok) {
        const json = await res.json();
        setActiveFacultyList(json.data || []);
      }
    } catch (_e) {
      toast.error('Failed to load eligible faculty list');
    } finally {
      setAssignModal(prev => ({ ...prev, loadingFaculty: false }));
    }
  };

  const handleAssignSubmit = async (e, override = false, overrideReason = '') => {
    if (e?.preventDefault) e.preventDefault();
    if (!assignModal.subject) return;

    const targetFacultyId = assignModal.faculty_id ? Number(assignModal.faculty_id) : staffData?.id;
    if (!targetFacultyId) {
      toast.error('Please select an instructor');
      return;
    }

    setAssignModal(prev => ({ ...prev, submitting: true }));
    try {
      const payload = {
        subject_code: assignModal.subject.subject_code,
        subject_name: assignModal.subject.subject_name || assignModal.subject.subject_code,
        branch: selectedBranch,
        semester: Number(selectedSemester),
        academic_year: selectedAcademicYear,
        faculty_id: targetFacultyId,
        override_conflict: override,
        override_reason: overrideReason
      };

      const res = await fetch('/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();

      if (res.status === 409 && resJson.canOverride) {
        setAssignModal(prev => ({
          ...prev,
          submitting: false,
          conflict: {
            conflicts: resJson.conflicts || [],
            warnings: resJson.warnings || [],
            reason: ''
          }
        }));
        return;
      }

      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to save faculty assignment');
      }

      toast.success(resJson.message || 'Faculty assignment saved successfully');
      setAssignModal({
        isOpen: false,
        subject: null,
        faculty_id: '',
        loadingFaculty: false,
        submitting: false,
        conflict: null
      });
      fetchCoverage();
    } catch (err) {
      toast.error(err.message || 'Failed to save faculty assignment');
    } finally {
      setAssignModal(prev => ({ ...prev, submitting: false }));
    }
  };

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
        <div className="py-20 text-center text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin" />
          <span>Calculating academic coverage &amp; load metrics...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <div className="text-sm font-bold text-rose-800">{error}</div>
          <p className="text-xs text-rose-600">Could not load subject coverage for {selectedBranch} Semester {selectedSemester} ({selectedAcademicYear}).</p>
          <button 
            type="button"
            onClick={() => fetchCoverage()} 
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {data.summary.total_syllabus_subjects === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No Curriculum Subjects Found</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No subjects are configured in the syllabus structure for {selectedBranch} Semester {selectedSemester} ({selectedAcademicYear}).
              </p>
            </div>
          ) : (
            <>
              {/* ── KPI METRICS CARDS ────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                  onClick={() => onNavigateToTab && onNavigateToTab(targetTab)}
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
                  onClick={() => onNavigateToTab && onNavigateToTab(targetTab)}
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
                  onClick={() => onNavigateToTab && onNavigateToTab(targetTab)}
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
                  onClick={() => onNavigateToTab && onNavigateToTab(isCoordinatorView ? 'requests' : 'interests')}
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

                        {alert.type === 'UNASSIGNED_SUBJECT' && alert.subject_code ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(alert.subject_code)}
                            className="px-3 py-1 bg-white border border-current rounded text-[11px] font-bold hover:bg-white/80 transition-colors shrink-0 cursor-pointer"
                          >
                            Assign Now
                          </button>
                        ) : alert.type === 'TIMETABLE_NOT_SCHEDULED' ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab && onNavigateToTab('timetable')}
                            className="px-3 py-1 bg-white border border-current rounded text-[11px] font-bold hover:bg-white/80 transition-colors shrink-0 cursor-pointer"
                          >
                            Schedule in Timetable
                          </button>
                        ) : alert.type === 'PENDING_ALLOCATION_REQUESTS' ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab && onNavigateToTab(isCoordinatorView ? 'requests' : 'interests')}
                            className="px-3 py-1 bg-white border border-current rounded text-[11px] font-bold hover:bg-white/80 transition-colors shrink-0 cursor-pointer"
                          >
                            Review Requests
                          </button>
                        ) : alert.subject_code ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(alert.subject_code)}
                            className="px-3 py-1 bg-white border border-current rounded text-[11px] font-bold hover:bg-white/80 transition-colors shrink-0 cursor-pointer"
                          >
                            Assign Now
                          </button>
                        ) : null}
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
            </>
          )}
        </div>
      ) : null}

      {/* ── ASSIGN FACULTY MODAL WORKFLOW ────────────────────────────────────────── */}
      {assignModal.isOpen && assignModal.subject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#0b3578]" />
                  <span>Assign Teaching Faculty</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isCoordinator ? 'First-Year Cohort Oversight' : `Department Oversight (${selectedBranch})`}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setAssignModal({ isOpen: false, subject: null, faculty_id: '', loadingFaculty: false, submitting: false, conflict: null })} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subject details card */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-50 text-[#0b3578] border border-blue-200">
                  {assignModal.subject.subject_code}
                </span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{assignModal.subject.subject_name}</div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center gap-2">
                <span>{selectedBranch} · Semester {selectedSemester}</span>
                <span>•</span>
                <span className="font-mono font-semibold text-slate-700">{selectedAcademicYear}</span>
              </div>
            </div>

            {/* Conflict Override Banner */}
            {assignModal.conflict && (
              <div className="space-y-3 pt-1">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Allocation Conflicts Detected:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    {assignModal.conflict.conflicts?.map((c, i) => (
                      <li key={i}>{c.message}</li>
                    ))}
                    {assignModal.conflict.warnings?.map((w, i) => (
                      <li key={`w-${i}`} className="text-amber-800">{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Override Reason (Minimum 5 characters required)
                  </label>
                  <textarea
                    rows={2}
                    value={assignModal.conflict.reason || ''}
                    onChange={e => setAssignModal(prev => ({
                      ...prev,
                      conflict: { ...prev.conflict, reason: e.target.value }
                    }))}
                    placeholder="e.g. Co-teaching approved by First Year Academic Coordination..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-[#0b3578]"
                  />
                </div>
              </div>
            )}

            {/* Instructor Selection Form */}
            {!assignModal.conflict && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Select Faculty Instructor
                  </label>
                  {assignModal.loadingFaculty ? (
                    <div className="py-4 text-center text-xs text-slate-400">Loading eligible faculty...</div>
                  ) : (
                    <select
                      value={assignModal.faculty_id}
                      onChange={e => setAssignModal(prev => ({ ...prev, faculty_id: e.target.value }))}
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0b3578]"
                    >
                      <option value="">-- Choose Instructor --</option>
                      {staffData && (
                        <option value={staffData.id} className="font-bold text-[#0b3578] bg-blue-50">
                          ⭐ Assign to Myself: {staffData.name} ({staffData.employee_id})
                        </option>
                      )}
                      {activeFacultyList
                        .filter(f => f.id !== staffData?.id)
                        .map(fac => (
                          <option key={fac.id} value={fac.id}>
                            {fac.name} ({fac.employee_id}) {fac.designation ? `· ${fac.designation}` : ''}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Assigning will link this subject in official semester records and update timetable and evaluation eligibility for <strong>{selectedAcademicYear}</strong>.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssignModal({ isOpen: false, subject: null, faculty_id: '', loadingFaculty: false, submitting: false, conflict: null })}
                className="px-3.5 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              {assignModal.conflict ? (
                <button
                  type="button"
                  disabled={assignModal.submitting || !assignModal.conflict.reason?.trim() || assignModal.conflict.reason.trim().length < 5}
                  onClick={() => handleAssignSubmit(null, true, assignModal.conflict.reason.trim())}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {assignModal.submitting ? 'Overriding...' : 'Confirm Override & Assign'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={assignModal.submitting || !assignModal.faculty_id}
                  onClick={handleAssignSubmit}
                  className="px-4 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {assignModal.submitting ? 'Saving...' : 'Save Faculty Assignment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
