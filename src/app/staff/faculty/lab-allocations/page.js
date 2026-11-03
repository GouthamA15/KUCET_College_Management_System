'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { ArrowLeft, CheckCircle, Users, RefreshCw, Send, Save, ArrowRightLeft } from 'lucide-react';

export default function LabBatchAllocationsPage() {
  const router = useRouter();
  const { staffData } = useStaff();

  const isAuthorized = !!(staffData?.is_hod || staffData?.is_first_year_coordinator || staffData?.is_principal || staffData?.role === 'admin');

  const branches = useMemo(() => {
    return staffData?.branches && staffData.branches.length > 0
      ? staffData.branches
      : (staffData?.branch ? [staffData.branch] : ['CSE']);
  }, [staffData]);

  const [selectedBranch, setSelectedBranch] = useState(branches[0] || 'CSE');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Allocation State
  const [allocationData, setAllocationData] = useState(null);
  const [loadingAllocation, setLoadingAllocation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Range Auto-allocation
  const [batch1Range, setBatch1Range] = useState('');
  const [batch2Range, setBatch2Range] = useState('');
  const [batch1Name, setBatch1Name] = useState('Batch 1');
  const [batch2Name, setBatch2Name] = useState('Batch 2');
  const [changeReason, setChangeReason] = useState('');

  // Working Student Sets
  const [batch1StudentIds, setBatch1StudentIds] = useState(new Set());
  const [batch2StudentIds, setBatch2StudentIds] = useState(new Set());
  const [allStudents, setAllStudents] = useState([]);

  // Fetch initial academic year and subjects
  useEffect(() => {
    async function initAcademicYear() {
      try {
        const res = await fetch('/api/staff/hod/timetable-instances');
        if (res.ok) {
          const json = await res.json();
          if (json.systemYear) setSelectedAcademicYear(json.systemYear);
        }
      } catch (_e) {
        // ignore
      }
    }
    initAcademicYear();
  }, []);

  // Fetch subjects for branch and semester
  const fetchSubjects = useCallback(async () => {
    if (!selectedBranch || !selectedSemester) return;
    setLoadingSubjects(true);
    try {
      const res = await fetch(`/api/staff/hod/available-subjects?branch=${selectedBranch}&semester=${selectedSemester}`);
      if (res.ok) {
        const json = await res.json();
        const subjects = json.data || [];
        setAvailableSubjects(subjects);
        // Auto-select first lab subject if available
        const labSubject = subjects.find(s => {
          const code = String(s.subject_code || '').toUpperCase();
          const name = String(s.subject_name || '').toLowerCase();
          return code.endsWith('L') || code.endsWith('LAB') || name.includes('lab') || name.includes('practical');
        });
        if (labSubject) {
          setSelectedSubject(labSubject.subject_code);
        } else if (subjects.length > 0) {
          setSelectedSubject(subjects[0].subject_code);
        } else {
          setSelectedSubject('');
        }
      }
    } catch (_e) {
      toast.error('Failed to load subjects for this semester.');
    } finally {
      setLoadingSubjects(false);
    }
  }, [selectedBranch, selectedSemester]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubjects();
  }, [fetchSubjects]);

  // Load allocation and students
  const fetchAllocation = useCallback(async () => {
    if (!selectedAcademicYear || !selectedBranch || !selectedSemester || !selectedSubject) return;
    setLoadingAllocation(true);
    try {
      const url = `/api/staff/hod/lab-batches?academic_year=${selectedAcademicYear}&branch=${selectedBranch}&semester=${selectedSemester}&subject_code=${selectedSubject}`;
      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json.data) {
        const data = json.data;
        setAllocationData(data.allocation || null);
        setBatch1Name(data.allocation?.batch_1_name || 'Batch 1');
        setBatch2Name(data.allocation?.batch_2_name || 'Batch 2');

        const b1Ids = new Set((data.batch_1_students || []).map(s => s.id));
        const b2Ids = new Set((data.batch_2_students || []).map(s => s.id));
        setBatch1StudentIds(b1Ids);
        setBatch2StudentIds(b2Ids);

        const combined = [
          ...(data.batch_1_students || []),
          ...(data.batch_2_students || []),
          ...(data.unallocated_students || [])
        ].sort((a, b) => (a.roll_no || '').localeCompare(b.roll_no || ''));
        setAllStudents(combined);
      } else {
        // Fallback: Preview empty to get cohort students
        const prevRes = await fetch('/api/staff/hod/lab-batches/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academic_year: selectedAcademicYear,
            branch: selectedBranch,
            semester: selectedSemester,
            batch_1_range: '',
            batch_2_range: ''
          })
        });
        const prevJson = await prevRes.json();
        if (prevRes.ok && prevJson.data) {
          setAllStudents(prevJson.data.unallocated_students || []);
          setBatch1StudentIds(new Set());
          setBatch2StudentIds(new Set());
          setAllocationData(null);
        }
      }
    } catch (_e) {
      toast.error('Failed to load lab batch data.');
    } finally {
      setLoadingAllocation(false);
    }
  }, [selectedAcademicYear, selectedBranch, selectedSemester, selectedSubject]);

  useEffect(() => {
    if (selectedAcademicYear && selectedSubject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAllocation();
    }
  }, [selectedAcademicYear, selectedSubject, fetchAllocation]);

  // Apply Range Preview
  const handleApplyRange = async () => {
    if (!batch1Range && !batch2Range) {
      return toast.error('Please enter at least one batch range (e.g. 1-30).');
    }
    setLoadingAllocation(true);
    try {
      const res = await fetch('/api/staff/hod/lab-batches/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: selectedAcademicYear,
          branch: selectedBranch,
          semester: selectedSemester,
          batch_1_range: batch1Range,
          batch_2_range: batch2Range
        })
      });
      const json = await res.json();
      if (res.ok && json.data) {
        const b1Ids = new Set((json.data.batch_1_students || []).map(s => s.id));
        const b2Ids = new Set((json.data.batch_2_students || []).map(s => s.id));
        setBatch1StudentIds(b1Ids);
        setBatch2StudentIds(b2Ids);
        toast.success(`Preview applied: Batch 1 (${b1Ids.size}), Batch 2 (${b2Ids.size}), Unallocated (${json.data.unallocated_count})`);
      } else {
        toast.error(json.error || 'Failed to calculate batch ranges.');
      }
    } catch (_e) {
      toast.error('Error applying ranges. Please check format.');
    } finally {
      setLoadingAllocation(false);
    }
  };

  // Quick 50/50 Split
  const handleSplitEvenly = () => {
    if (allStudents.length === 0) return;
    const mid = Math.ceil(allStudents.length / 2);
    const b1 = new Set();
    const b2 = new Set();
    allStudents.forEach((st, idx) => {
      if (idx < mid) b1.add(st.id);
      else b2.add(st.id);
    });
    setBatch1StudentIds(b1);
    setBatch2StudentIds(b2);
    toast.success(`Split evenly: Batch 1 (${b1.size} students), Batch 2 (${b2.size} students)`);
  };

  // Move student to specific batch
  const handleMoveStudent = (studentId, targetBatch) => {
    setBatch1StudentIds(prev => {
      const next = new Set(prev);
      if (targetBatch === 1) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
    setBatch2StudentIds(prev => {
      const next = new Set(prev);
      if (targetBatch === 2) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  };

  // Save Allocation (Draft or Publish)
  const handleSave = async (autoPublish = false) => {
    if (!selectedSubject) return toast.error('Please select a subject.');
    if (batch1StudentIds.size === 0 && batch2StudentIds.size === 0) {
      return toast.error('Cannot save empty batch allocation. Assign at least one student.');
    }
    if (autoPublish && allocationData?.status === 'PUBLISHED' && !changeReason.trim()) {
      return toast.error('A change reason is required when re-publishing an existing allocation.');
    }

    setSaving(true);
    try {
      const res = await fetch('/api/staff/hod/lab-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: selectedAcademicYear,
          branch: selectedBranch,
          semester: Number(selectedSemester),
          subject_code: selectedSubject,
          batch_1_name: batch1Name || 'Batch 1',
          batch_2_name: batch2Name || 'Batch 2',
          batch_1_student_ids: Array.from(batch1StudentIds),
          batch_2_student_ids: Array.from(batch2StudentIds),
          change_reason: changeReason || null,
          auto_publish: autoPublish
        })
      });

      const json = await res.json();
      if (res.ok) {
        toast.success(autoPublish ? 'Lab batch allocation published successfully!' : 'Draft allocation saved.');
        setChangeReason('');
        fetchAllocation();
      } else {
        toast.error(json.error || 'Failed to save batch allocation.');
      }
    } catch (_e) {
      toast.error('Server connection error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center text-slate-600">
        <p>You are not authorized to view or edit lab batch allocations.</p>
      </div>
    );
  }

  const batch1Students = allStudents.filter(s => batch1StudentIds.has(s.id));
  const batch2Students = allStudents.filter(s => batch2StudentIds.has(s.id));
  const unallocatedStudents = allStudents.filter(s => !batch1StudentIds.has(s.id) && !batch2StudentIds.has(s.id));

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-12">
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push('/staff/faculty/time-table')}
          className="text-[#0b3578] hover:underline font-medium text-xs cursor-pointer flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Timetables
        </button>
      </div>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">Lab Batch Allocations</h1>
            {allocationData?.status === 'PUBLISHED' && (
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Published (v{allocationData.version})
              </span>
            )}
            {allocationData?.status === 'DRAFT' && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Draft (v{allocationData.version})
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Configure independent student batches (Batch 1 / Batch 2) for laboratory sessions.
          </p>
        </div>

        {/* Global Save Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || loadingAllocation}
            className="px-3.5 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || loadingAllocation}
            className="px-4 py-2 bg-[#0b3578] text-white rounded-lg hover:bg-blue-900 font-medium text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
            <span>Publish Allocation</span>
          </button>
        </div>
      </header>

      {/* Academic Context Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-medium text-slate-800 outline-none focus:border-[#0b3578]"
          >
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Semester</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-medium text-slate-800 outline-none focus:border-[#0b3578]"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Year</label>
          <input
            type="text"
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
            placeholder="e.g. 2026-27"
            className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-medium text-slate-800 outline-none focus:border-[#0b3578]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Laboratory Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={loadingSubjects || availableSubjects.length === 0}
            className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs font-medium text-slate-800 outline-none focus:border-[#0b3578]"
          >
            {availableSubjects.length === 0 && <option value="">No subjects found</option>}
            {availableSubjects.map(s => (
              <option key={s.subject_code} value={s.subject_code}>
                {s.subject_code} - {s.subject_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Auto-Allocation Range & Quick Tools */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0b3578]" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Quick Range Allocation</span>
          </div>
          <button
            type="button"
            onClick={handleSplitEvenly}
            className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer flex items-center gap-1"
          >
            <ArrowRightLeft size={13} /> Split Cohort 50 / 50 Evenly
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Batch 1 Range (e.g. 1-30)</label>
            <input
              type="text"
              value={batch1Range}
              onChange={(e) => setBatch1Range(e.target.value)}
              placeholder="e.g. 1-30 or 01-30"
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs text-slate-800 outline-none focus:border-[#0b3578]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Batch 2 Range (e.g. 31-66)</label>
            <input
              type="text"
              value={batch2Range}
              onChange={(e) => setBatch2Range(e.target.value)}
              placeholder="e.g. 31-66"
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs text-slate-800 outline-none focus:border-[#0b3578]"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleApplyRange}
              disabled={loadingAllocation}
              className="w-full py-2 bg-blue-100 text-[#0b3578] hover:bg-blue-200 rounded-md font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} className={loadingAllocation ? 'animate-spin' : ''} />
              Calculate & Apply Ranges
            </button>
          </div>
        </div>

        {/* Change reason input */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Change Reason / Audit Note (Optional for draft, required for revision)</label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="e.g. Reassigned 3 lateral entry students to Batch 2 per departmental lab capacity"
            className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs text-slate-800 outline-none focus:border-[#0b3578]"
          />
        </div>
      </div>

      {/* Cohort Summary Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Cohort</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">{allStudents.length}</p>
        </div>
        <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-blue-700">Batch 1 Enrolled</p>
          <p className="text-xl font-bold text-blue-900 mt-0.5">{batch1Students.length}</p>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-emerald-700">Batch 2 Enrolled</p>
          <p className="text-xl font-bold text-emerald-900 mt-0.5">{batch2Students.length}</p>
        </div>
        <div className={`border rounded-lg p-3 shadow-sm ${unallocatedStudents.length > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[10px] uppercase font-bold text-slate-500">Unallocated</p>
          <p className={`text-xl font-bold mt-0.5 ${unallocatedStudents.length > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
            {unallocatedStudents.length}
          </p>
        </div>
      </div>

      {/* Tri-Column Student Allocation Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Batch 1 Column */}
        <div className="bg-white border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
          <div className="bg-blue-50/80 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-blue-900">Batch 1</span>
              <span className="ml-2 text-xs font-semibold text-blue-600">({batch1Students.length})</span>
            </div>
          </div>
          <div className="p-3 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
            {batch1Students.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No students assigned to Batch 1</p>
            ) : (
              batch1Students.map((st) => (
                <div key={st.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-slate-800">{st.roll_no}</p>
                    <p className="text-[11px] text-slate-500 truncate">{st.name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveStudent(st.id, 2)}
                      className="px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                      title="Move to Batch 2"
                    >
                      &rarr; B2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveStudent(st.id, 0)}
                      className="px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:text-red-600 rounded cursor-pointer"
                      title="Unassign"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Batch 2 Column */}
        <div className="bg-white border-2 border-emerald-200 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
          <div className="bg-emerald-50/80 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-emerald-900">Batch 2</span>
              <span className="ml-2 text-xs font-semibold text-emerald-600">({batch2Students.length})</span>
            </div>
          </div>
          <div className="p-3 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
            {batch2Students.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No students assigned to Batch 2</p>
            ) : (
              batch2Students.map((st) => (
                <div key={st.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-slate-800">{st.roll_no}</p>
                    <p className="text-[11px] text-slate-500 truncate">{st.name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveStudent(st.id, 1)}
                      className="px-2 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                      title="Move to Batch 1"
                    >
                      &larr; B1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveStudent(st.id, 0)}
                      className="px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:text-red-600 rounded cursor-pointer"
                      title="Unassign"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unallocated Column */}
        <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
          <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Unallocated</span>
              <span className="ml-2 text-xs font-semibold text-slate-500">({unallocatedStudents.length})</span>
            </div>
          </div>
          <div className="p-3 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
            {unallocatedStudents.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={20} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-xs text-slate-500 font-medium">All students allocated!</p>
              </div>
            ) : (
              unallocatedStudents.map((st) => (
                <div key={st.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-slate-700">{st.roll_no}</p>
                    <p className="text-[11px] text-slate-500 truncate">{st.name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveStudent(st.id, 1)}
                      className="px-2 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                    >
                      + B1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveStudent(st.id, 2)}
                      className="px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                    >
                      + B2
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
