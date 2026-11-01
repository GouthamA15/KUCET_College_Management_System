'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  BookOpen, 
  Search, 
  Download, 
  Users, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  History, 
  ShieldAlert, 
  X, 
  Layers,
  RefreshCw,
  Building,
  UserPlus
} from 'lucide-react';
import { useStaff } from '@/context/StaffContext';
import { 
  INSTITUTIONAL_BRANCHES as CANONICAL_BRANCHES, 
  deriveDefaultAcademicYear, 
  getCanonicalAcademicYears 
} from '@/lib/academic-constants';

export default function TeachingAssignmentDirectory({ 
  initialBranch = null,
  initialSemester = null,
  initialAcademicYear = null,
  isCoordinatorView = false 
}) {
  const { staffData, refreshFaculty } = useStaff();

  const isCoordinator = isCoordinatorView || Boolean(staffData?.is_first_year_coordinator);
  const isHod = Boolean(staffData?.is_hod);
  const isAdmin = staffData?.role === 'admin' || Boolean(staffData?.is_principal);

  // 1. Resolve Available Branches according to authoritative role scope
  const availableBranches = useMemo(() => {
    if (isCoordinator && !isHod && !isAdmin) return CANONICAL_BRANCHES;
    if (isAdmin) return CANONICAL_BRANCHES;
    if (isHod && staffData?.authorized_branches?.length > 0) {
      return staffData.authorized_branches;
    }
    const userBranches = Array.from(new Set([...(staffData?.branches || []), staffData?.branch, staffData?.hod_department_code].filter(Boolean)));
    return userBranches.length > 0 ? userBranches : ['CSE'];
  }, [isCoordinator, isHod, isAdmin, staffData]);

  // 2. Resolve Available Semesters
  const availableSemesters = useMemo(() => {
    if (isCoordinator && !isHod && !isAdmin) {
      return [1, 2];
    }
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [isCoordinator, isHod, isAdmin]);

  const resolvedDefaultYear = initialAcademicYear || staffData?.coordinator_assignment?.academic_year || staffData?.academic_year || deriveDefaultAcademicYear();
  const academicYearsList = useMemo(() => getCanonicalAcademicYears(resolvedDefaultYear), [resolvedDefaultYear]);

  // Filter state
  const [selectedBranch, setSelectedBranch] = useState(initialBranch || 'all');
  const [selectedSemester, setSelectedSemester] = useState(initialSemester ? String(initialSemester) : 'all');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(resolvedDefaultYear);
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'archived', 'all'
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeView, setActiveView] = useState('assignments'); // 'assignments', 'coverage', 'faculty', 'branch', 'subject'

  // Derived effective state within valid bounds
  const effectiveBranch = (selectedBranch === 'all' || availableBranches.includes(selectedBranch)) ? selectedBranch : (availableBranches[0] || 'all');
  const effectiveSemester = (selectedSemester === 'all' || availableSemesters.includes(Number(selectedSemester))) ? selectedSemester : String(availableSemesters[0] || 'all');
  const effectiveAcademicYear = selectedAcademicYear;

  // Preserve manual user selection
  const userSelectedYearRef = useRef(false);
  useEffect(() => {
    if (!userSelectedYearRef.current && resolvedDefaultYear && resolvedDefaultYear !== selectedAcademicYear) {
      setSelectedAcademicYear(resolvedDefaultYear);
    }
  }, [resolvedDefaultYear, selectedAcademicYear]);

  // Pagination state for Directory Table
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [paginationMeta, setPaginationMeta] = useState(null);

  // Synchronize debounced search input (300ms) to prevent keystroke network floods
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Data state
  const [assignments, setAssignments] = useState([]);
  const [coverageData, setCoverageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Selected assignment for inspect details drawer
  const [inspectedAssignment, setInspectedAssignment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [assignmentDetails, setAssignmentDetails] = useState(null);

  // New assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    subject_code: '',
    subject_name: '',
    branch: selectedBranch,
    semester: selectedSemester,
    faculty_id: '',
    override_conflict: false,
    override_reason: ''
  });
  const [conflictPrompt, setConflictPrompt] = useState(null);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [syllabusOfferings, setSyllabusOfferings] = useState([]);
  const [activeFacultyList, setActiveFacultyList] = useState([]);

  // Fetch Directory Data with AbortController and targeted coverage computation
  const fetchDirectory = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const isPagedView = activeView === 'assignments';
      const params = new URLSearchParams({
        branch: effectiveBranch || '',
        semester: effectiveSemester || '',
        academic_year: effectiveAcademicYear || '',
        status: statusFilter,
        include_coverage: activeView === 'coverage' ? 'true' : 'false'
      });
      if (debouncedSearch) params.append('search', debouncedSearch);

      if (isPagedView) {
        params.append('page', String(page));
        params.append('limit', String(pageSize));
      } else {
        params.append('limit', 'all');
      }

      const res = await fetch(`/api/staff/hod/subject-assignments?${params.toString()}`, { signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load teaching assignments');

      setAssignments(json.data || []);
      setCoverageData(json.coverage || null);
      setPaginationMeta(json.meta?.pagination || null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load teaching assignments');
      toast.error(err.message || 'Failed to load teaching assignments');
    } finally {
      setLoading(false);
    }
  }, [effectiveBranch, effectiveSemester, effectiveAcademicYear, statusFilter, debouncedSearch, activeView, page]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchDirectory(controller.signal);
      }
    });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [fetchDirectory]);

  // Load Assignment Details & History
  const handleInspect = async (assignment) => {
    setInspectedAssignment(assignment);
    setLoadingDetails(true);
    setAssignmentDetails(null);
    try {
      const res = await fetch(`/api/staff/hod/subject-assignments/${assignment.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load assignment details');
      setAssignmentDetails(json.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle Deactivate / Archive
  const handleDeactivate = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to deactivate or remove this assignment? If attendance or marks exist, the record will be safely archived.')) {
      return;
    }
    try {
      const res = await fetch(`/api/staff/hod/subject-assignments?id=${assignmentId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update assignment');
      toast.success(json.message || 'Assignment updated successfully');
      fetchDirectory();
      if (refreshFaculty) refreshFaculty();
      if (inspectedAssignment?.id === assignmentId) setInspectedAssignment(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Handle Export CSV
  const handleExport = async (type = 'assignments') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        type,
        branch: selectedBranch || 'all',
        semester: selectedSemester || 'all',
        academic_year: selectedAcademicYear || '',
        status: statusFilter
      });
      const url = `/api/staff/hod/subject-assignments/export?${params.toString()}`;
      window.open(url, '_blank');
      toast.success('Export initiated');
    } catch (_err) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Open Quick Assign Modal for a specific unassigned subject
  const openAssignForSubject = (subject) => {
    setAssignForm({
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
      branch: selectedBranch,
      semester: selectedSemester,
      faculty_id: '',
      override_conflict: false,
      override_reason: ''
    });
    setConflictPrompt(null);
    setShowAssignModal(true);
    loadAssignPrerequisites();
  };

  // Load faculty & syllabus for modal
  const loadAssignPrerequisites = async () => {
    try {
      const [facRes, sylRes] = await Promise.all([
        fetch(`/api/staff/hod/active-faculty?branch=${selectedBranch}`),
        fetch(`/api/staff/faculty/syllabus?branch=${selectedBranch}&semester=${selectedSemester}&academicYear=${selectedAcademicYear}`)
      ]);
      if (facRes.ok) {
        const j = await facRes.json();
        setActiveFacultyList(j.data || []);
      }
      if (sylRes.ok) {
        const j = await sylRes.json();
        setSyllabusOfferings(j.data || []);
      }
    } catch (_e) {
      // Non-fatal
    }
  };

  // Submit Assignment
  const submitAssignment = async (override = false, reason = '') => {
    if (!assignForm.subject_code || !assignForm.branch || !assignForm.semester) {
      toast.error('Missing subject, branch or semester');
      return;
    }

    setIsSubmittingAssign(true);
    try {
      const payload = {
        subject_code: assignForm.subject_code,
        subject_name: assignForm.subject_name || assignForm.subject_code,
        branch: assignForm.branch,
        semester: parseInt(assignForm.semester, 10),
        academic_year: selectedAcademicYear,
        faculty_id: assignForm.faculty_id ? parseInt(assignForm.faculty_id, 10) : staffData?.id,
        override_conflict: override,
        override_reason: reason
      };

      const res = await fetch('/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.status === 409 && data.canOverride) {
        setConflictPrompt({
          conflicts: data.conflicts || [],
          warnings: data.warnings || [],
          reason: ''
        });
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed to assign subject');

      toast.success(data.message || 'Subject assigned successfully');
      setShowAssignModal(false);
      setConflictPrompt(null);
      fetchDirectory();
      if (refreshFaculty) refreshFaculty();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Derived Views
  const facultyGroupedView = useMemo(() => {
    const map = new Map();
    assignments.forEach(a => {
      if (!map.has(a.faculty_id)) {
        map.set(a.faculty_id, {
          id: a.faculty_id,
          name: a.faculty_name,
          employee_id: a.employee_id,
          email: a.faculty_email,
          designation: a.faculty_designation,
          assignments: [],
          total_weekly_slots: 0,
          total_conducted: 0
        });
      }
      const f = map.get(a.faculty_id);
      f.assignments.push(a);
      f.total_weekly_slots += a.weekly_slots || 0;
      f.total_conducted += a.conducted_sessions || 0;
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [assignments]);

  const subjectGroupedView = useMemo(() => {
    const map = new Map();
    assignments.forEach(a => {
      if (!map.has(a.subject_code)) {
        map.set(a.subject_code, {
          code: a.subject_code,
          name: a.subject_name,
          type: a.subject_type || 'theory',
          branch: a.branch,
          semester: a.course_semester,
          academic_year: a.academic_year,
          instructors: []
        });
      }
      map.get(a.subject_code).instructors.push(a);
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [assignments]);

  const branchGroupedView = useMemo(() => {
    const map = new Map();
    assignments.forEach(a => {
      const key = `${a.branch}-S${a.course_semester}`;
      if (!map.has(key)) {
        map.set(key, {
          branch: a.branch,
          semester: a.course_semester,
          assignments: []
        });
      }
      map.get(key).assignments.push(a);
    });
    return Array.from(map.values()).sort((a, b) => a.semester - b.semester);
  }, [assignments]);

  return (
    <div className="space-y-6 w-full text-sm">
      {/* ── Top Header & Context Banner ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Teaching Assignment Directory</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0b3578]/10 text-[#0b3578] border border-[#0b3578]/20">
              {isCoordinator ? 'First-Year Scope (Sem 1 & 2)' : `HOD Scope (${availableBranches.join(', ')})`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Centralized academic teaching registry. Identifies which faculty member is teaching which subject across departments, semesters, and academic periods with verified coverage tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => {
              setAssignForm({
                subject_code: '',
                subject_name: '',
                branch: selectedBranch,
                semester: selectedSemester,
                faculty_id: '',
                override_conflict: false,
                override_reason: ''
              });
              setShowAssignModal(true);
              loadAssignPrerequisites();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Allocate Subject</span>
          </button>

          <button
            onClick={() => handleExport(activeView === 'coverage' ? 'coverage' : (activeView === 'faculty' ? 'workload' : 'assignments'))}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          <button
            onClick={fetchDirectory}
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Filters & Search Controls ────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Branch Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Branch</label>
            <select
              value={effectiveBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0b3578]"
            >
              <option value="all">All Branches</option>
              {availableBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Semester</label>
            <select
              value={effectiveSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0b3578]"
            >
              <option value="all">All Semesters</option>
              {availableSemesters.map(s => (
                <option key={s} value={String(s)}>Semester {s}</option>
              ))}
            </select>
          </div>

          {/* Academic Year Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Academic Year</label>
            <select
              value={effectiveAcademicYear}
              onChange={(e) => {
                userSelectedYearRef.current = true;
                setSelectedAcademicYear(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800 font-mono focus:outline-none focus:border-[#0b3578]"
            >
              <option value="">All Academic Years</option>
              {academicYearsList.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0b3578]"
            >
              <option value="active">Active Only</option>
              <option value="archived">Archived / Historical</option>
              <option value="all">All Assignments</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Code, title, faculty..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-9 pl-8 pr-3 border border-slate-300 rounded-md bg-white text-xs text-slate-800 focus:outline-none focus:border-[#0b3578]"
              />
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200">
          {[
            { id: 'assignments', label: `Teaching Directory (${paginationMeta ? paginationMeta.total_records : assignments.length})`, icon: BookOpen },
            { id: 'coverage', label: `Coverage Analysis ${coverageData ? `(${coverageData.coverage_percentage}%)` : ''}`, icon: CheckCircle2 },
            { id: 'faculty', label: `Faculty View (${facultyGroupedView.length})`, icon: Users },
            { id: 'subject', label: `Subject View (${subjectGroupedView.length})`, icon: Layers },
            { id: 'branch', label: 'Branch / Semester Matrix', icon: Building },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0b3578] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── VIEW 1: TEACHING ASSIGNMENTS TABLE ─────────────────────────────────── */}
      {activeView === 'assignments' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-16 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Loading assignments directory...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3 m-4">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <div className="text-sm font-bold text-rose-800">{error}</div>
              <p className="text-xs text-rose-600">Could not load teaching assignments. Please retry.</p>
              <button 
                type="button"
                onClick={() => fetchDirectory()} 
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Retry Loading
              </button>
            </div>
          ) : assignments.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No teaching assignments found</p>
              <p className="text-xs text-slate-400">Try adjusting the filter criteria or allocate subjects to faculty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Branch &amp; Sem</th>
                    <th className="px-4 py-3">Faculty Instructor</th>
                    <th className="px-4 py-3">Academic Period</th>
                    <th className="px-4 py-3">Weekly Slots</th>
                    <th className="px-4 py-3">Conducted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {assignments.map(asgn => (
                    <tr key={asgn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{asgn.subject_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-mono">
                          <span className="font-bold text-[#0b3578]">{asgn.subject_code}</span>
                          <span>·</span>
                          <span className="capitalize">{asgn.subject_type || 'theory'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {asgn.branch} · Sem {asgn.course_semester}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{asgn.faculty_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {asgn.employee_id} {asgn.faculty_designation ? `· ${asgn.faculty_designation}` : ''}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                        {asgn.academic_year}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {asgn.weekly_slots > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{asgn.weekly_slots} periods/wk</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>0 slots (unscheduled)</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        <span className="font-semibold text-slate-800">{asgn.conducted_sessions}</span> classes
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {asgn.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                            Archived
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleInspect(asgn)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#0b3578] hover:bg-[#0b3578]/10 rounded transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          {asgn.is_active && (
                            <button
                              onClick={() => handleDeactivate(asgn.id)}
                              className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Deactivate / Archive Assignment"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {paginationMeta && paginationMeta.total_pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                  <div className="font-medium">
                    Showing <span className="font-bold text-slate-800">{(page - 1) * pageSize + 1}</span> to <span className="font-bold text-slate-800">{Math.min(page * pageSize, paginationMeta.total_records)}</span> of <span className="font-bold text-slate-800">{paginationMeta.total_records}</span> teaching assignments
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-2 py-1 font-semibold text-slate-700">
                      Page {page} of {paginationMeta.total_pages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(paginationMeta.total_pages, p + 1))}
                      disabled={page >= paginationMeta.total_pages}
                      className="px-3 py-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: COVERAGE ANALYSIS ─────────────────────────────────────────── */}
      {activeView === 'coverage' && (
        <div className="space-y-5">
          {coverageData ? (
            <>
              {/* Coverage KPI Header */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Syllabus Subjects</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{coverageData.total_syllabus_subjects}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{selectedBranch} Semester {selectedSemester}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Covered Subjects</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{coverageData.covered_subjects_count}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">{coverageData.coverage_percentage}% teaching readiness</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Unassigned Subjects</div>
                  <div className="text-2xl font-bold text-rose-700 mt-1">{coverageData.unassigned_subjects_count}</div>
                  <div className="text-xs text-rose-600 mt-0.5">{coverageData.unassigned_subjects_count === 0 ? 'Full coverage' : 'Action required'}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-[#0b3578] uppercase tracking-wider">Academic Period</div>
                  <div className="text-2xl font-bold text-[#0b3578] mt-1 font-mono">{selectedAcademicYear}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Authoritative status</div>
                </div>
              </div>

              {/* Unassigned Subjects Action List */}
              {coverageData.unassigned_subjects_count > 0 && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                    <h3 className="font-bold text-sm">Action Required: Unassigned Syllabus Subjects</h3>
                  </div>
                  <p className="text-xs text-rose-700">
                    The following subjects are listed in the official curriculum for <strong>{selectedBranch} Semester {selectedSemester}</strong> but have no faculty allocated.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {coverageData.unassigned_subjects.map(sub => (
                      <div key={sub.subject_code} className="bg-white p-3.5 rounded-lg border border-rose-200 shadow-2xs flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-xs text-slate-900">{sub.subject_name}</div>
                          <div className="text-[11px] font-mono text-rose-600 mt-0.5 font-semibold">
                            {sub.subject_code} · <span className="capitalize">{sub.subject_type}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => openAssignForSubject(sub)}
                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                        >
                          Assign Faculty
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Covered Subjects Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Assigned Subjects Overview</h3>
                  <span className="text-xs text-slate-500">{coverageData.covered_subjects_count} subjects assigned</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="px-4 py-3">Subject Code &amp; Title</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Assigned Faculty</th>
                        <th className="px-4 py-3">Timetable Readiness</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {coverageData.covered_subjects.map(c => (
                        <tr key={c.subject_code} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{c.subject_name}</div>
                            <div className="text-[11px] font-mono font-bold text-[#0b3578]">{c.subject_code}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap capitalize text-slate-600">
                            {c.is_group ? `Elective (${c.parent_group_code || 'Group'})` : c.subject_type}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {c.assigned_faculty.map(f => (
                                <div key={f.id} className="font-semibold text-slate-800 flex items-center gap-2">
                                  <span>{f.name}</span>
                                  <span className="text-[11px] text-slate-400 font-mono">({f.employee_id})</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Scheduled ({c.assigned_faculty.reduce((acc, curr) => acc + (curr.weekly_slots || 0), 0)} periods/wk)</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              Select a specific branch and semester above to view the curriculum coverage analysis.
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: FACULTY-CENTRIC VIEW ───────────────────────────────────────── */}
      {activeView === 'faculty' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {facultyGroupedView.map(fac => (
              <div key={fac.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{fac.name}</h3>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {fac.employee_id} {fac.designation ? `· ${fac.designation}` : ''}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0b3578]/10 text-[#0b3578]">
                    {fac.assignments.length} {fac.assignments.length === 1 ? 'Course' : 'Courses'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Subjects</div>
                  {fac.assignments.map(a => (
                    <div key={a.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{a.subject_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{a.subject_code} · {a.branch} Sem {a.course_semester}</div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 font-mono">
                        {a.weekly_slots} slots
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>Weekly load: <strong>{fac.total_weekly_slots} periods</strong></span>
                  <span>Conducted: <strong>{fac.total_conducted} sessions</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VIEW 4: SUBJECT-CENTRIC VIEW ───────────────────────────────────────── */}
      {activeView === 'subject' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-4 py-3">Subject Code &amp; Title</th>
                  <th className="px-4 py-3">Branch &amp; Sem</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Assigned Faculty</th>
                  <th className="px-4 py-3">Teaching Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {subjectGroupedView.map(sub => (
                  <tr key={`${sub.code}-${sub.branch}-${sub.semester}`} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{sub.name}</div>
                      <div className="text-[11px] font-mono font-bold text-[#0b3578]">{sub.code}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">{sub.branch}</span> · Sem {sub.semester}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap capitalize text-slate-600">
                      {sub.type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {sub.instructors.map(inst => (
                          <div key={inst.id} className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{inst.faculty_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({inst.employee_id})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sub.instructors.length > 1 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          Co-Teaching ({sub.instructors.length} Faculty)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Sole Instructor
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VIEW 5: BRANCH / SEMESTER MATRIX ───────────────────────────────────── */}
      {activeView === 'branch' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branchGroupedView.map(group => (
              <div key={`${group.branch}-${group.semester}`} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{group.branch}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold">Semester {group.semester}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">{group.assignments.length} assignments</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.assignments.map(a => (
                    <div key={a.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-800">{a.subject_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{a.subject_code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{a.faculty_name}</div>
                        <div className="text-[10px] text-slate-500">{a.weekly_slots} slots/wk</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DETAILS DRAWER / MODAL ───────────────────────────────────────────── */}
      {inspectedAssignment && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teaching Assignment Details</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{inspectedAssignment.subject_name}</h3>
                <div className="text-xs font-mono font-bold text-[#0b3578]">
                  {inspectedAssignment.subject_code} · {inspectedAssignment.branch} Sem {inspectedAssignment.course_semester}
                </div>
              </div>
              <button
                onClick={() => setInspectedAssignment(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 text-center text-xs font-semibold text-slate-500">Loading details &amp; audit history...</div>
            ) : assignmentDetails ? (
              <div className="space-y-4 text-xs">
                {/* Faculty details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Faculty Member</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{assignmentDetails.faculty_name}</div>
                      <div className="text-slate-500 font-mono mt-0.5">
                        ID: {assignmentDetails.employee_id} {assignmentDetails.faculty_designation ? `· ${assignmentDetails.faculty_designation}` : ''}
                      </div>
                      <div className="text-slate-500 mt-0.5">{assignmentDetails.faculty_email}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {assignmentDetails.status}
                    </span>
                  </div>
                </div>

                {/* Timetable Schedule */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Scheduled Timetable Slots</div>
                  {assignmentDetails.timetable_slots?.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {assignmentDetails.timetable_slots.map((slot, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded p-2 text-center">
                          <div className="font-bold text-slate-800">{slot.day_of_week}</div>
                          <div className="text-slate-500 font-mono mt-0.5">Period {slot.period_number}</div>
                          {slot.room_no && <div className="text-[10px] text-slate-400 mt-0.5">Room {slot.room_no}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs">
                      No timetable slots scheduled yet for this assignment.
                    </div>
                  )}
                </div>

                {/* Conducted Class Statistics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Conducted Sessions</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{assignmentDetails.total_conducted_sessions}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Last Conducted Date</div>
                    <div className="text-sm font-semibold text-slate-700 mt-1 font-mono">
                      {assignmentDetails.last_session_date || 'None yet'}
                    </div>
                  </div>
                </div>

                {/* Audit Change History Timeline */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>Assignment Lifecycle &amp; Change History</span>
                  </div>
                  {assignmentDetails.change_history?.length > 0 ? (
                    <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                      {assignmentDetails.change_history.map((log) => (
                        <div key={log.id} className="relative text-xs">
                          <div className="font-semibold text-slate-800">
                            {log.action.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            By <strong>{log.actor_name}</strong> on {new Date(log.timestamp).toLocaleString()}
                          </div>
                          {log.override_reason && (
                            <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
                              Override reason: &quot;{log.override_reason}&quot;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs italic">
                      Created on {inspectedAssignment.created_at ? new Date(inspectedAssignment.created_at).toLocaleDateString() : 'Active session'}. No reassignment events recorded.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectedAssignment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ALLOCATE / ASSIGN MODAL ─────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0b3578]" />
                <h3 className="font-bold text-slate-900 text-base">Allocate Teaching Subject</h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Select Subject</label>
                {syllabusOfferings.length > 0 ? (
                  <select
                    value={assignForm.subject_code}
                    onChange={(e) => {
                      const selected = syllabusOfferings.find(s => s.code === e.target.value);
                      setAssignForm(prev => ({
                        ...prev,
                        subject_code: e.target.value,
                        subject_name: selected?.title || prev.subject_name
                      }));
                    }}
                    className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-xs font-semibold"
                  >
                    <option value="">-- Choose Subject from Syllabus --</option>
                    {syllabusOfferings.map(s => (
                      <option key={s.code} value={s.code}>{s.code} - {s.title}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Subject Code (e.g. CS101)"
                    value={assignForm.subject_code}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, subject_code: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-300 rounded-md font-mono"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Faculty Instructor</label>
                <select
                  value={assignForm.faculty_id}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, faculty_id: e.target.value }))}
                  className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white text-xs font-semibold"
                >
                  <option value="">-- Self-Allocate to Myself --</option>
                  {activeFacultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.employee_id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Branch</label>
                  <input
                    type="text"
                    readOnly
                    value={assignForm.branch}
                    className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Semester</label>
                  <input
                    type="text"
                    readOnly
                    value={`Semester ${assignForm.semester}`}
                    className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-semibold"
                  />
                </div>
              </div>

              {/* Conflict override prompt */}
              {conflictPrompt && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Workload or Timetable Conflict Detected</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                    {conflictPrompt.conflicts.map((c, i) => (
                      <li key={i}>{c.message}</li>
                    ))}
                  </ul>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Override Reason (minimum 5 characters)
                    </label>
                    <textarea
                      rows={2}
                      value={conflictPrompt.reason}
                      onChange={(e) => setConflictPrompt(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="e.g. Authorized co-teaching allocation approved by Department..."
                      className="w-full text-xs border border-amber-300 rounded p-2 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              {conflictPrompt ? (
                <button
                  type="button"
                  disabled={isSubmittingAssign || !conflictPrompt.reason?.trim() || conflictPrompt.reason.trim().length < 5}
                  onClick={() => submitAssignment(true, conflictPrompt.reason.trim())}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAssign ? 'Overriding...' : 'Confirm Override & Allocate'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmittingAssign || !assignForm.subject_code}
                  onClick={() => submitAssignment(false)}
                  className="px-4 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAssign ? 'Allocating...' : 'Allocate Subject'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
