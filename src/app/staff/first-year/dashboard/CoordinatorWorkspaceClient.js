'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff } from '@/context/StaffContext';
import SyllabusManager from '@/components/staff/faculty/SyllabusManager';
import IDCardManagementHub from '@/components/staff/id-cards/IDCardManagementHub';
import CoordinatorApaarDashboard from '@/components/staff/first-year/CoordinatorApaarDashboard';
import SubjectAssignmentsList from '@/components/staff/faculty/SubjectAssignmentsList';
import toast from 'react-hot-toast';
import { 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  Users, 
  CreditCard, 
  Clock, 
  Building2, 
  AlertCircle,
  Plus, 
  X,
  Layers,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

const INSTITUTIONAL_BRANCHES = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];

export default function CoordinatorWorkspaceClient() {
  const router = useRouter();
  const { staffData, loading } = useStaff();

  const [activeTab, setActiveTab] = useState('overview');

  // Overview stats & data
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [idCardStats, setIdCardStats] = useState(null);

  // Timetable State
  const [ttBranch, setTtBranch] = useState('CSE');
  const [ttSemester, setTtSemester] = useState(1);
  const [timetableData, setTimetableData] = useState([]);
  const [timetableInstances, setTimetableInstances] = useState([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  const [newInstanceBranch, setNewInstanceBranch] = useState('CSE');
  const [newInstanceSem, setNewInstanceSem] = useState(1);
  const [newInstanceYear, setNewInstanceYear] = useState('');
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  // Faculty Requests State
  const [interests, setInterests] = useState([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    interest: null,
    action: 'APPROVED',
    reason: ''
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Verify access
  useEffect(() => {
    if (!loading && staffData) {
      if (!staffData.is_first_year_coordinator && staffData.role !== 'admin' && !staffData.is_principal) {
        toast.error('First Year Coordinator authorization required');
        router.push('/staff/faculty/dashboard');
      }
    }
  }, [loading, staffData, router]);

  // Fetch overview KPI numbers
  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const [reqRes, idRes] = await Promise.allSettled([
          fetch('/api/staff/hod/faculty-interests'),
          fetch('/api/staff/id-cards')
        ]);

        if (reqRes.status === 'fulfilled' && reqRes.value.ok) {
          const json = await reqRes.value.json();
          const p = (json.data || []).filter(r => r.status === 'PENDING' && [1, 2].includes(r.semester));
          if (isMounted) setPendingRequestsCount(p.length);
        }

        if (idRes.status === 'fulfilled' && idRes.value.ok) {
          const json = await idRes.value.json();
          if (isMounted) setIdCardStats(json.stats || json.summary || null);
        }
      } catch (_e) {
        // Soft fail
      }
    }

    if (staffData?.is_first_year_coordinator || staffData?.role === 'admin' || staffData?.is_principal) {
      loadStats();
    }

    return () => { isMounted = false; };
  }, [staffData]);

  // Fetch Timetable when in timetable tab
  const fetchTimetable = useCallback(async () => {
    setLoadingTimetable(true);
    try {
      const [ttRes, instRes] = await Promise.all([
        fetch(`/api/staff/hod/timetable?branch=${ttBranch}&semester=${ttSemester}`),
        fetch('/api/staff/hod/timetable-instances')
      ]);

      if (ttRes.ok) {
        const json = await ttRes.json();
        setTimetableData(json.data || []);
      }
      if (instRes.ok) {
        const json = await instRes.json();
        setTimetableInstances((json.data || []).filter(i => [1, 2].includes(i.semester || i.course_semester)));
        if (json.systemYear && !newInstanceYear) setNewInstanceYear(json.systemYear);
      }
    } catch (_e) {
      toast.error('Failed to load timetable');
    } finally {
      setLoadingTimetable(false);
    }
  }, [ttBranch, ttSemester, newInstanceYear]);

  useEffect(() => {
    let ignore = false;
    if (activeTab === 'timetable') {
      const timer = setTimeout(() => {
        if (!ignore) fetchTimetable();
      }, 0);
      return () => { ignore = true; clearTimeout(timer); };
    }
  }, [activeTab, fetchTimetable]);

  // Fetch Faculty Interests when in requests tab
  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/hod/faculty-interests');
      if (res.ok) {
        const json = await res.json();
        setInterests((json.data || []).filter(i => [1, 2].includes(i.semester)));
      }
    } catch (_e) {
      toast.error('Failed to load faculty subject requests');
    } finally {
      setLoadingInterests(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (activeTab === 'requests') {
      const timer = setTimeout(() => {
        if (!ignore) fetchInterests();
      }, 0);
      return () => { ignore = true; clearTimeout(timer); };
    }
  }, [activeTab, fetchInterests]);

  const handleCreateInstanceSubmit = async (e) => {
    e.preventDefault();
    setIsCreatingInstance(true);
    try {
      const res = await fetch('/api/staff/hod/timetable-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: newInstanceBranch,
          semester: parseInt(newInstanceSem),
          academic_year: newInstanceYear
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create instance');
      toast.success('Timetable instance created');
      setShowCreateInstance(false);
      fetchTimetable();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const handleReviewSubmit = async (e, override = false, overrideReason = '') => {
    if (e?.preventDefault) e.preventDefault();
    if (!reviewModal.interest) return;

    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/staff/hod/faculty-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_id: reviewModal.interest.id,
          status: reviewModal.action,
          rejection_reason: reviewModal.action === 'REJECTED' ? reviewModal.reason : undefined,
          override_conflict: override,
          override_reason: overrideReason
        })
      });
      const json = await res.json();

      if (res.status === 409 && json.canOverride) {
        setReviewModal(prev => ({
          ...prev,
          hasConflict: true,
          conflicts: json.conflicts || [],
          overrideReason: ''
        }));
        return;
      }

      if (!res.ok) throw new Error(json.error || 'Failed to submit review');
      toast.success(json.message || `Request ${reviewModal.action.toLowerCase()} successfully`);
      setReviewModal({ isOpen: false, interest: null, action: 'APPROVED', reason: '', hasConflict: false, conflicts: [], overrideReason: '' });
      fetchInterests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading || !staffData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center items-center">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <div className="w-5 h-5 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin" />
          Loading Coordinator Workspace...
        </div>
      </div>
    );
  }

  const assignment = staffData.coordinator_assignment || {};

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-sm pb-12">
      {/* ─── Institutional Scope Banner ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0b2447] via-[#0b3578] to-[#1e40af] text-white rounded-xl shadow-md p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white/5 transform skew-x-12 translate-x-12 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-400/20 text-sky-200 text-xs font-semibold mb-2 border border-sky-300/30">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Institutional Sub-Role Responsibility</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">First Year Academic Coordination</h1>
            <p className="text-sky-100/90 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Institutional academic oversight for <strong>Semesters 1 and 2</strong> across all 7 institutional engineering branches. Retains standard Faculty duties and teaching appointments.
            </p>
          </div>
          <div className="flex flex-col sm:items-end text-xs text-sky-200 font-mono bg-black/20 p-3 rounded-lg border border-white/10 shrink-0">
            <div>Scope: <span className="font-bold text-white">All Branches (Sem 1 & 2)</span></div>
            <div>Academic Year: <span className="font-bold text-white">{assignment.academic_year || 'Current'}</span></div>
            <div>Period: <span className="text-white">{assignment.start_date || 'Active'} {assignment.end_date ? `to ${assignment.end_date}` : '(Ongoing)'}</span></div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-1.5 flex flex-wrap gap-1.5">
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'allocations', label: 'Subject Allocations', icon: GraduationCap },
          { id: 'apaar', label: 'APAAR Monitoring & Reports', icon: ShieldCheck },
          { id: 'syllabus', label: 'Subjects & Syllabus', icon: BookOpen },
          { id: 'timetable', label: 'First-Year Timetables', icon: Calendar },
          { id: 'requests', label: `Faculty Requests ${pendingRequestsCount > 0 ? `(${pendingRequestsCount})` : ''}`, icon: Users },
          { id: 'id-cards', label: 'Student ID Cards', icon: CreditCard },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0b3578] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: OVERVIEW ───────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center text-[#0b3578] mb-2">
                <Building2 className="w-5 h-5 mr-2" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-600">Institutional Scope</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">7 Branches</p>
              <p className="text-[11px] text-slate-500 mt-1">CSE, IT, CSD, ECE, EEE, CIVIL, MECH</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center text-indigo-600 mb-2">
                <Calendar className="w-5 h-5 mr-2" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-600">Semesters</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">Sem 1 & 2</p>
              <p className="text-[11px] text-slate-500 mt-1">Semesters 3–8 reserved exclusively to HODs</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center text-amber-600 mb-2">
                <Clock className="w-5 h-5 mr-2" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-600">Pending Requests</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{pendingRequestsCount}</p>
              <p className="text-[11px] text-slate-500 mt-1">Faculty interest requests for Sem 1 & 2</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center text-emerald-600 mb-2">
                <CreditCard className="w-5 h-5 mr-2" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-600">ID Cards Eligible</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{idCardStats?.totalEligible ?? '—'}</p>
              <p className="text-[11px] text-slate-500 mt-1">First-year finalized admissions across all branches</p>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              onClick={() => setActiveTab('allocations')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#0b3578]/50 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-[#0b3578] transition-colors">
                    🎓 Direct Subject Allocations
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Directly assign faculty members or self-allocate Semesters 1 and 2 subjects across all 7 institutional engineering branches.
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578] shrink-0" />
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('syllabus')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#0b3578]/50 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-[#0b3578] transition-colors">
                    📖 Subjects & Syllabus Management
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Configure first-year core subjects, professional electives, and open electives for Semesters 1 and 2 across all 7 institutional branches.
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578] shrink-0" />
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('timetable')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#0b3578]/50 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-[#0b3578] transition-colors">
                    🕒 Timetable Instances & Matrix
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Review and establish weekly class periods (Periods 1–7), short breaks, and lunch breaks for first-year cohorts.
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578] shrink-0" />
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('requests')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#0b3578]/50 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-[#0b3578] transition-colors">
                    📝 Faculty Subject-Interest Review
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Review and approve teaching interest submissions for first-year subjects across all departments. Approvals automatically create active teaching assignments.
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578] shrink-0" />
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('apaar')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#0b3578]/50 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-[#0b3578] transition-colors">
                    🛡️ APAAR ID Monitoring &amp; Cohort Exports
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Track APAAR ID submission statuses across all 7 institutional engineering branches. Filter by branch or pending status, and generate formula-safe Excel reports.
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578] shrink-0" />
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('id-cards')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#0b3578]/50 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-[#0b3578] transition-colors">
                    🪪 First-Year Student ID Cards
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Preview, single/bulk PDF generation, Excel export with embedded photos, and ZIP export strictly restricted to eligible first-year students.
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578] shrink-0" />
              </div>
            </div>
          </div>

          {/* Institutional Governance Box */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Governance & Security Invariants
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>HOD Non-Interference:</strong> Department HODs retain exclusive authority over Semesters 3 through 8 for their assigned departments. First Year Coordinator cannot modify upper-year curricula or timetables.</li>
              <li><strong>Dual-Role Protection:</strong> Holding both an HOD appointment and First Year Coordinator sub-role grants a harmonious union of authorities without degradation.</li>
              <li><strong>Self-Allocation Governance:</strong> Coordinators and HODs may directly allocate or self-approve subject requests within their authorized scope. Direct self-allocations automatically trigger Principal leadership notifications and audit logging.</li>
              <li><strong>ID Card Scoping:</strong> ID card access is dynamically constrained to first-year students using authoritative student semester calculation.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ─── TAB: SUBJECT ALLOCATIONS ─────────────────────────────────────────── */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4 flex items-center justify-between text-xs text-indigo-900">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-4 h-4 text-indigo-700 shrink-0" />
              <span>
                <strong>First-Year Subject Allocation Authority:</strong> Directly assign faculty members (or self-allocate) to Semester 1 and 2 subjects across all 7 institutional branches.
              </span>
            </div>
          </div>
          <SubjectAssignmentsList />
        </div>
      )}

      {/* ─── TAB 2: APAAR ID MONITORING & EXPORTS ────────────────────────────── */}
      {activeTab === 'apaar' && (
        <CoordinatorApaarDashboard />
      )}

      {/* ─── TAB 3: SUBJECTS & SYLLABUS ────────────────────────────────────────── */}
      {activeTab === 'syllabus' && (
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-700" />
              <span>Managing first-year curriculum across all institutional branches. Scope restricted to <strong>Semesters 1 & 2</strong>.</span>
            </div>
          </div>
          <SyllabusManager allowedSemesters={[1, 2]} />
        </div>
      )}

      {/* ─── TAB 3: TIMETABLE ──────────────────────────────────────────────────── */}
      {activeTab === 'timetable' && (() => {
        const activeInstance = timetableInstances.find(i => i.branch === ttBranch && Number(i.semester || i.course_semester) === Number(ttSemester));
        const DAYS = [
          { key: 'MON', label: 'Monday' },
          { key: 'TUE', label: 'Tuesday' },
          { key: 'WED', label: 'Wednesday' },
          { key: 'THU', label: 'Thursday' },
          { key: 'FRI', label: 'Friday' },
          { key: 'SAT', label: 'Saturday' },
        ];

        return (
          <div className="space-y-6">
            {/* Controls Bar */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Branch</label>
                  <select
                    value={ttBranch}
                    onChange={(e) => setTtBranch(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#0b3578]"
                  >
                    {INSTITUTIONAL_BRANCHES.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Semester</label>
                  <select
                    value={ttSemester}
                    onChange={(e) => setTtSemester(parseInt(e.target.value))}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#0b3578]"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {activeInstance && (
                  <button
                    type="button"
                    onClick={() => router.push(`/staff/faculty/time-table/${activeInstance.id}`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#0b3578] rounded-lg text-xs font-semibold border border-slate-300 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Open Timetable Editor</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeInstance.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' :
                      activeInstance.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {activeInstance.status}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setNewInstanceBranch(ttBranch);
                    setNewInstanceSem(ttSemester);
                    setShowCreateInstance(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Timetable Instance</span>
                </button>
              </div>
            </div>

            {/* Timetable Matrix Grid */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {ttBranch} — Semester {ttSemester} Timetable
                  </h3>
                  <p className="text-xs text-slate-500">
                    Weekly class periods Monday through Saturday {timetableInstances.length > 0 && `(${timetableInstances.length} configured instances for Sem 1-2)`}
                  </p>
                </div>
              </div>

              {loadingTimetable ? (
                <div className="py-16 text-center text-xs text-slate-500">Loading timetable schedule...</div>
              ) : timetableData.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 italic">
                  No timetable entries configured for {ttBranch} Sem {ttSemester}.
                </div>
              ) : (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-xs text-slate-700 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5 text-left">Day</th>
                        {[1, 2, 3, 4, 5, 6, 7].map(p => (
                          <th key={p} className="p-2.5 text-center">Period {p}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {DAYS.map(d => {
                        const dayEntries = timetableData.filter(e => e.day_of_week === d.key || e.day_of_week === d.label);
                        return (
                          <tr key={d.key} className="hover:bg-slate-50/70">
                            <td className="p-2.5 font-bold text-slate-900 bg-slate-50/50">{d.label}</td>
                            {[1, 2, 3, 4, 5, 6, 7].map(p => {
                              const entry = dayEntries.find(e => Number(e.period_number) === Number(p));
                              return (
                                <td key={p} className="p-2 text-center border-l border-slate-100">
                                  {entry ? (
                                    <div className="bg-blue-50 border border-blue-200 rounded p-1 text-[11px]">
                                      <div className="font-bold text-[#0b3578] truncate">{entry.subject_code}</div>
                                      <div className="text-[10px] text-slate-500 truncate" title={entry.faculty_name}>{entry.faculty_name}</div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Create Instance Modal */}
          {showCreateInstance && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800">Create Timetable Instance</h3>
                  <button onClick={() => setShowCreateInstance(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleCreateInstanceSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Branch</label>
                    <select
                      value={newInstanceBranch}
                      onChange={e => setNewInstanceBranch(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                    >
                      {INSTITUTIONAL_BRANCHES.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Semester</label>
                    <select
                      value={newInstanceSem}
                      onChange={e => setNewInstanceSem(parseInt(e.target.value))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                    >
                      <option value={1}>Semester 1</option>
                      <option value={2}>Semester 2</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Academic Year</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2025-26 or 2025-2026"
                      value={newInstanceYear}
                      onChange={e => setNewInstanceYear(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateInstance(false)}
                      className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingInstance}
                      className="px-4 py-1.5 bg-[#0b3578] text-white rounded font-semibold hover:bg-[#0a2d66] disabled:opacity-50"
                    >
                      {isCreatingInstance ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    })()}

      {/* ─── TAB 4: FACULTY REQUESTS ───────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Faculty Subject Interests (Semesters 1 & 2)</h3>
                <p className="text-xs text-slate-500">Review, approve, or reject teaching preference requests across all branches</p>
              </div>
            </div>

            {loadingInterests ? (
              <div className="py-16 text-center text-xs text-slate-500">Loading faculty interests...</div>
            ) : interests.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 italic">
                No faculty subject interest requests for Semesters 1 and 2.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Faculty</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Branch & Sem</th>
                      <th className="px-4 py-3">Academic Year</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interests.map(item => {
                      const isOwn = item.staff_account_id === staffData.id;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.faculty_name}</div>
                            <div className="text-[10px] text-slate-400">{item.employee_id} {isOwn && '(You)'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{item.subject_name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.subject_code}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {item.branch} — Sem {item.semester}
                          </td>
                          <td className="px-4 py-3 font-mono">{item.academic_year}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReviewModal({ isOpen: true, interest: item, action: 'APPROVED', reason: '', isSelfAllocation: isOwn })}
                                  className={`px-2.5 py-1 text-white rounded text-[11px] font-semibold cursor-pointer ${
                                    isOwn ? 'bg-[#0b3578] hover:bg-[#0a2d66]' : 'bg-emerald-600 hover:bg-emerald-700'
                                  }`}
                                >
                                  {isOwn ? 'Self-Allocate' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReviewModal({ isOpen: true, interest: item, action: 'REJECTED', reason: '' })}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">Reviewed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Review Confirmation Modal */}
          {reviewModal.isOpen && reviewModal.interest && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">
                    {reviewModal.action === 'APPROVED' ? 'Approve Subject Interest' : 'Reject Subject Interest'}
                  </h3>
                  <button onClick={() => setReviewModal({ isOpen: false, interest: null, action: 'APPROVED', reason: '' })} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div><strong>Faculty:</strong> {reviewModal.interest.faculty_name}</div>
                  <div><strong>Subject:</strong> {reviewModal.interest.subject_name} ({reviewModal.interest.subject_code})</div>
                  <div><strong>Cohort:</strong> {reviewModal.interest.branch} Sem {reviewModal.interest.semester}</div>
                  {reviewModal.action === 'APPROVED' && !reviewModal.hasConflict && (
                    <p className="text-[11px] text-emerald-700 pt-1 border-t border-slate-200 mt-2 font-medium">
                      ✓ {reviewModal.isSelfAllocation ? 'Self-allocation will directly assign this subject to you.' : 'Approval will create an active teaching assignment for this faculty member.'}
                    </p>
                  )}
                </div>

                {reviewModal.hasConflict && (
                  <div className="space-y-3 pt-2">
                    <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Detected Conflicts:
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {reviewModal.conflicts?.map((c, i) => (
                          <li key={i}>{c.message}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Override Reason (min 5 characters)
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={reviewModal.overrideReason || ''}
                        onChange={e => setReviewModal({ ...reviewModal, overrideReason: e.target.value })}
                        placeholder="e.g. Co-teaching approved by First Year Coordinator..."
                        className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none focus:border-[#0b3578]"
                      />
                    </div>
                  </div>
                )}

                {reviewModal.action === 'REJECTED' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Reason for Rejection (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={reviewModal.reason}
                      onChange={e => setReviewModal({ ...reviewModal, reason: e.target.value })}
                      placeholder="e.g. Workload quota full, alternative faculty allocated..."
                      className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none focus:border-[#0b3578]"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModal({ isOpen: false, interest: null, action: 'APPROVED', reason: '', hasConflict: false, conflicts: [], overrideReason: '' })}
                    className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 text-xs"
                  >
                    Cancel
                  </button>
                  {reviewModal.hasConflict ? (
                    <button
                      type="button"
                      disabled={isSubmittingReview || !reviewModal.overrideReason?.trim() || reviewModal.overrideReason.trim().length < 5}
                      onClick={() => handleReviewSubmit(null, true, reviewModal.overrideReason.trim())}
                      className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-semibold text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingReview ? 'Overriding...' : 'Confirm Override & Approve'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmittingReview}
                      onClick={handleReviewSubmit}
                      className={`px-4 py-1.5 text-white rounded font-semibold text-xs disabled:opacity-50 cursor-pointer ${
                        reviewModal.action === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {isSubmittingReview ? 'Submitting...' : (reviewModal.isSelfAllocation ? 'Confirm Self-Allocation' : `Confirm ${reviewModal.action === 'APPROVED' ? 'Approval' : 'Rejection'}`)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: STUDENT ID CARDS ───────────────────────────────────────────── */}
      {activeTab === 'id-cards' && (
        <div className="space-y-4">
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-4 flex items-center justify-between text-xs text-sky-950">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4 text-sky-700 shrink-0" />
              <span>
                <strong>First-Year Coordinator ID Card Jurisdiction:</strong> Preview, generate single/bulk PDFs, export branch Excel reports with photos, and download ZIP archives for <strong>finalized first-year students</strong> across all branches.
              </span>
            </div>
          </div>
          <IDCardManagementHub initialBranch="ALL" />
        </div>
      )}
    </div>
  );
}
