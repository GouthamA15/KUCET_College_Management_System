import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import Link from 'next/link';

const INSTITUTIONAL_ACTIVITIES = [
  { code: 'SPORTS', name: 'Sports & Athletics' },
  { code: 'MINI_PROJECT', name: 'Mini Projects' },
  { code: 'EXTRA_CURRICULAR', name: 'Extra Curricular Activities' },
  { code: 'SEMINAR', name: 'Seminars / Workshops' },
  { code: 'LIB', name: 'Library Period' }
];

export default function SlotEditorModal({
  instanceId,
  instance, // { branch, semester, academic_year, status }
  editingSlot, // { day, period, current: slot or null }
  onClose,
  onSaved,
  isEditable = true,
  entries = []
}) {
  const { hodBranchData } = useStaff();
  const [isSaving, setIsSaving] = useState(false);

  // Existing slots for this day and period
  const existingSlotsForPeriod = useMemo(() => {
    if (!editingSlot?.day || !editingSlot?.period) return [];
    return entries.filter(
      s => s.day_of_week === editingSlot.day && Number(s.period_number) === Number(editingSlot.period)
    );
  }, [entries, editingSlot]);

  // Initial active batch tab (0 = Whole Class, 1 = Batch 1, 2 = Batch 2)
  const initialBatch = editingSlot?.current?.batch_number ?? (existingSlotsForPeriod[0]?.batch_number || 0);
  const [activeBatchTab, setActiveBatchTab] = useState(initialBatch);

  // Current slot for the active batch tab
  const currentSlotForActiveBatch = useMemo(() => {
    return existingSlotsForPeriod.find(s => (s.batch_number || 0) === activeBatchTab) || null;
  }, [existingSlotsForPeriod, activeBatchTab]);

  const [modalSelectedSubject, setModalSelectedSubject] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedRoomNo, setSelectedRoomNo] = useState('');
  const [additionalFacultyIds, setAdditionalFacultyIds] = useState([]);
  const [selectedPeriods, setSelectedPeriods] = useState([editingSlot?.period]);

  const [fallbackSubjects, setFallbackSubjects] = useState([]);
  const [fallbackFaculty, setFallbackFaculty] = useState([]);
  const formRef = useRef(null);

  // Sync fields whenever active batch tab or slot changes
  useEffect(() => {
    const slot = currentSlotForActiveBatch;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModalSelectedSubject(slot?.subject_code || '');
    setSelectedFacultyId(slot?.faculty_id ? String(slot.faculty_id) : '');
    setSelectedRoomNo(slot?.room_no || '');
    setSelectedPeriods([editingSlot?.period]);
    setAdditionalFacultyIds([]);
  }, [currentSlotForActiveBatch, editingSlot?.period]);

  useEffect(() => {
    let active = true;
    async function loadFallbackData() {
      if ((!hodBranchData?.allSubjects || hodBranchData.allSubjects.length === 0) && instance?.branch && instance?.semester) {
        try {
          const res = await fetch(`/api/staff/hod/available-subjects?branch=${instance.branch}&semester=${instance.semester}`);
          if (res.ok) {
            const json = await res.json();
            if (active) setFallbackSubjects(json.data || []);
          }
        } catch (_e) {
          // ignore error
        }
      }
      if (!hodBranchData?.faculty || hodBranchData.faculty.length === 0) {
        try {
          const res = await fetch('/api/staff/hod/faculty-load');
          if (res.ok) {
            const json = await res.json();
            if (active) setFallbackFaculty(json.data || []);
          }
        } catch (_e) {
          // ignore error
        }
      }
    }
    loadFallbackData();
    return () => { active = false; };
  }, [hodBranchData, instance?.branch, instance?.semester]);

  const branchSubjects = useMemo(() => {
    const subjects = (hodBranchData?.allSubjects && hodBranchData.allSubjects.length > 0)
      ? hodBranchData.allSubjects
      : fallbackSubjects;
    const seen = new Set();
    return subjects
      .filter(s => Number(s.semester) === Number(instance.semester) && s.branch === instance.branch)
      .filter(s => {
        if (seen.has(s.subject_code)) return false;
        seen.add(s.subject_code);
        return true;
      });
  }, [hodBranchData, fallbackSubjects, instance]);

  const collegeFaculty = useMemo(() => {
    return (hodBranchData?.faculty && hodBranchData.faculty.length > 0)
      ? hodBranchData.faculty
      : fallbackFaculty;
  }, [hodBranchData, fallbackFaculty]);
  const officialAssignments = hodBranchData?.officialAssignments || [];

  const isLabSubject = useMemo(() => {
    if (!modalSelectedSubject) return false;
    const s = branchSubjects.find(sub => sub.subject_code === modalSelectedSubject);
    const code = modalSelectedSubject.toUpperCase();
    const name = (s?.subject_name || '').toLowerCase();
    return code.endsWith('L') || code.endsWith('LAB') || name.includes('lab') || name.includes('practical');
  }, [modalSelectedSubject, branchSubjects]);

  const handleCopyPrevious = () => {
    if (!editingSlot || editingSlot.period === 1) return;
    const prevSlot = entries.find(
      s => s.day_of_week === editingSlot.day && s.period_number === editingSlot.period - 1 && (s.batch_number || 0) === activeBatchTab
    ) || entries.find(
      s => s.day_of_week === editingSlot.day && s.period_number === editingSlot.period - 1
    );

    if (!prevSlot) return toast.error('No data found in the previous period to copy.');
    setModalSelectedSubject(prevSlot.subject_code || '');
    setSelectedFacultyId(prevSlot.faculty_id ? String(prevSlot.faculty_id) : '');
    setSelectedRoomNo(prevSlot.room_no || '');
    toast.success('Details copied from previous period');
  };

  const handlePeriodToggle = (p) => {
    setSelectedPeriods(prev => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(x => x !== p);
      } else {
        return [...prev, p].sort((a, b) => a - b);
      }
    });
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!isEditable) return;

    if (!modalSelectedSubject) return toast.error('Please select a subject or activity');
    setIsSaving(true);

    try {
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: editingSlot.day,
          period_number: editingSlot.period,
          period_numbers: selectedPeriods,
          batch_number: activeBatchTab,
          subject_code: modalSelectedSubject,
          faculty_id: selectedFacultyId ? parseInt(selectedFacultyId) : null,
          additional_faculty_ids: additionalFacultyIds,
          room_no: selectedRoomNo || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Slot updated successfully`);
        onSaved();
      } else {
        toast.error(data.error || data.message || 'Unable to update timetable slot.');
      }
    } catch (_e) {
      toast.error('Unable to connect to the server while updating slot.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!currentSlotForActiveBatch) return;
    if (!isEditable) return;
    if (!confirm('Are you sure you want to delete this lecture from the timetable?')) return;

    setIsSaving(true);
    try {
      const entryId = currentSlotForActiveBatch.id;
      const res = await fetch(`/api/staff/hod/timetable-instances/${instanceId}/entries?entryId=${entryId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Class removed');
        onSaved();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || 'Unable to delete slot.');
      }
    } catch (_e) {
      toast.error('Unable to connect to the server while deleting slot.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg animate-in zoom-in-95 flex flex-col overflow-hidden max-h-[calc(100vh-4rem)]">

        {/* Modal Header */}
        <div className="p-4 px-5 flex justify-between items-start border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-lg text-slate-800">Academic Schedule Slot</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Sem {instance?.semester} &bull; {editingSlot.day} &bull; Period {editingSlot.period}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Batch Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveBatchTab(0)}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeBatchTab === 0
                ? 'border-[#0b3578] text-[#0b3578] bg-white rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Whole Class (All)
          </button>
          <button
            type="button"
            onClick={() => setActiveBatchTab(1)}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeBatchTab === 1
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Batch 1 (Lab)
          </button>
          <button
            type="button"
            onClick={() => setActiveBatchTab(2)}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeBatchTab === 2
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Batch 2 (Lab)
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSaveSlot} className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Copy from previous period */}
          {editingSlot.period > 1 && isEditable && (
            <button
              type="button"
              onClick={handleCopyPrevious}
              className="w-full py-2 bg-blue-50/50 text-blue-700 text-xs font-medium rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
              Copy details from Period {editingSlot.period - 1}
            </button>
          )}

          {/* Lab subject reminder */}
          {(isLabSubject || activeBatchTab > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-center justify-between">
              <div>
                <span className="font-bold">Lab Session:</span> {activeBatchTab > 0 ? `Configuring Batch ${activeBatchTab}` : 'Configuring Whole Class'}
              </div>
              <Link
                href="/staff/faculty/lab-allocations"
                className="text-blue-700 font-semibold hover:underline text-[11px]"
                target="_blank"
              >
                Manage Student Batches &rarr;
              </Link>
            </div>
          )}

          {/* Subject / Activity Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Activity</label>
            <select
              value={modalSelectedSubject}
              onChange={(e) => setModalSelectedSubject(e.target.value)}
              disabled={!isEditable}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-[#0b3578] transition-all disabled:opacity-60 disabled:bg-slate-50"
            >
              <option value="" disabled>Select a subject...</option>
              <optgroup label={`Core Syllabus (Sem ${instance?.semester})`}>
                {branchSubjects.map(s => (
                  <option key={s.subject_code} value={s.subject_code}>{s.subject_code} - {s.subject_name}</option>
                ))}
              </optgroup>
              <optgroup label="Institutional Activities">
                {INSTITUTIONAL_ACTIVITIES.map(a => (
                  <option key={a.code} value={a.code}>{a.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Assigned Primary Faculty */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Instructor</label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              disabled={!isEditable}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-[#0b3578] transition-all disabled:opacity-60 disabled:bg-slate-50"
            >
              <option value="">No faculty assigned</option>

              {modalSelectedSubject && (
                <optgroup label="Officially Assigned">
                  {collegeFaculty
                    .filter(f => officialAssignments.some(oa => oa.faculty_id === f.id && oa.subject_code === modalSelectedSubject))
                    .map(f => (
                      <option key={`assigned-${f.id}`} value={f.id} className="font-semibold text-blue-700 bg-blue-50/50">
                        ★ {f.name} (Primary Instructor)
                      </option>
                    ))
                  }
                </optgroup>
              )}

              <optgroup label="All Faculty">
                {collegeFaculty
                  .filter(f => !modalSelectedSubject || !officialAssignments.some(oa => oa.faculty_id === f.id && oa.subject_code === modalSelectedSubject))
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.home_branch ? `(${f.home_branch})` : ''}
                    </option>
                  ))
                }
              </optgroup>
            </select>
          </div>

          {/* Room / Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Lab Location</label>
            <input
              type="text"
              placeholder="e.g. LH-113 or Systems Lab 2"
              value={selectedRoomNo}
              onChange={(e) => setSelectedRoomNo(e.target.value)}
              disabled={!isEditable}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-[#0b3578] transition-all disabled:opacity-60 disabled:bg-slate-50"
            />
          </div>

          {/* Multi-Period Lab Span */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">Apply to Contiguous Periods (e.g. 3-Period Lab):</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map(p => (
                <label key={p} className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPeriods.includes(p)}
                    onChange={() => handlePeriodToggle(p)}
                    disabled={!isEditable}
                    className="rounded border-slate-300 text-[#0b3578] focus:ring-[#0b3578]"
                  />
                  <span>P{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Modal Footer Actions */}
          {isEditable && (
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              {currentSlotForActiveBatch && (
                <button
                  type="button"
                  onClick={handleDeleteSlot}
                  disabled={isSaving}
                  className="px-4 py-2 bg-white text-red-600 font-medium rounded-lg text-xs hover:bg-red-50 transition-colors disabled:opacity-50 border border-red-200 shadow-sm cursor-pointer"
                >
                  Remove Slot
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2 bg-[#0b3578] text-white font-medium rounded-lg text-xs hover:bg-blue-900 transition-colors disabled:opacity-70 shadow-sm cursor-pointer"
              >
                {isSaving ? 'Saving...' : activeBatchTab > 0 ? `Save Batch ${activeBatchTab} Slot` : 'Save Class Slot'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
