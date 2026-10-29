'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { AlertCircle, ShieldAlert, UserPlus } from 'lucide-react';
import { 
  INSTITUTIONAL_BRANCHES as CANONICAL_BRANCHES, 
  deriveDefaultAcademicYear, 
  getCanonicalAcademicYears 
} from '@/lib/academic-constants';

export default function SubjectAssignmentsList() {
  const { staffData, refreshFaculty } = useStaff();

  const isCoordinator = Boolean(staffData?.is_first_year_coordinator);
  const isHod = Boolean(staffData?.is_hod);

  // Available branches: HOD gets authorized branches, Coordinator gets all 7 branches
  const availableBranches = useMemo(() => {
    if (isCoordinator) return CANONICAL_BRANCHES;
    if (isHod && staffData?.authorized_branches?.length > 0) {
      return staffData.authorized_branches;
    }
    return Array.from(new Set([...(staffData?.branches || []), staffData?.branch].filter(Boolean)));
  }, [isCoordinator, isHod, staffData]);

  const defaultYear = staffData?.academic_year || deriveDefaultAcademicYear();
  const academicYearsList = useMemo(() => getCanonicalAcademicYears(defaultYear), [defaultYear]);

  const [selectedBranch, setSelectedBranch] = useState(availableBranches[0] || 'CSE');
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(defaultYear);

  const userSelectedYearRef = useRef(false);
  useEffect(() => {
    if (!userSelectedYearRef.current && staffData?.academic_year && staffData.academic_year !== selectedAcademicYear) {
      setSelectedAcademicYear(staffData.academic_year);
    }
  }, [staffData?.academic_year, selectedAcademicYear]);
  const [selectedType, setSelectedType] = useState('');
  const [assignMode, setAssignMode] = useState('SELF'); // 'SELF' or 'OTHER'
  const [targetFacultyId, setTargetFacultyId] = useState('');

  const [syllabus, setSyllabus] = useState([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);

  // Conflict modal state
  const [conflictModal, setConflictModal] = useState({
    isOpen: false,
    subject: null,
    conflicts: [],
    warnings: [],
    overrideReason: ''
  });

  const availableSemesters = useMemo(() => {
    if (isCoordinator && !isHod && staffData?.role !== 'admin') {
      return [1, 2];
    }
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [isCoordinator, isHod, staffData]);

  const fetchSyllabus = useCallback(async () => {
    if (!selectedBranch || !selectedSemester) return;
    setLoadingSyllabus(true);
    try {
      const res = await fetch(`/api/staff/faculty/syllabus?branch=${selectedBranch}&semester=${selectedSemester}&academicYear=${selectedAcademicYear}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch syllabus');
      setSyllabus(data.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingSyllabus(false);
    }
  }, [selectedBranch, selectedSemester, selectedAcademicYear]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchSyllabus();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchSyllabus]);

  const handleSubmitAssign = async (subject, override = false, reason = '') => {
    setSubmittingId(subject.code);
    try {
      const payload = {
        subject_code: subject.code,
        subject_name: subject.title,
        branch: selectedBranch,
        semester: parseInt(selectedSemester, 10),
        academic_year: selectedAcademicYear,
        override_conflict: override,
        override_reason: reason
      };

      if (assignMode === 'OTHER' && targetFacultyId) {
        payload.faculty_id = parseInt(targetFacultyId, 10);
      }

      const res = await fetch('/api/staff/hod/subject-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.status === 409 && data.canOverride) {
        setConflictModal({
          isOpen: true,
          subject,
          conflicts: data.conflicts || [],
          warnings: data.warnings || [],
          overrideReason: ''
        });
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed to assign subject');

      toast.success(data.message || `Successfully assigned ${subject.title}`);
      if (data.warnings?.length > 0) {
        data.warnings.forEach(w => toast(w, { icon: '⚠️' }));
      }

      setConflictModal({ isOpen: false, subject: null, conflicts: [], warnings: [], overrideReason: '' });
      fetchSyllabus();
      if (refreshFaculty) refreshFaculty();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredSyllabus = useMemo(() => {
    let result = [];
    syllabus.forEach(item => {
      if (item.isGroup || item.variants) {
         (item.variants || []).forEach(variant => {
            result.push({
               ...variant,
               isElective: true,
               groupName: item.title,
               is_allocated: variant.is_allocated,
               allocated_to_me: variant.allocated_to_me
            });
         });
      } else {
         result.push({ ...item, isElective: false });
      }
    });

    if (selectedType) {
       result = result.filter(subject => {
          if (selectedType === 'theory') return subject.subject_type === 'theory';
          if (selectedType === 'lab') return subject.subject_type === 'lab';
          if (selectedType === 'core') return !subject.isElective;
          if (selectedType === 'elective') return subject.isElective;
          return true;
       });
    }

    return result;
  }, [syllabus, selectedType]);

  return (
    <div className="space-y-6 w-full">
      {/* Scope banner */}
      <div className="bg-sky-50 border border-sky-200 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-sky-900">
        <div>
          <span className="font-bold">Authorized Subject Allocation: </span>
          {isCoordinator && 'First-Year Coordinator (Sem 1 & 2 across 7 branches). '}
          {isHod && `Head of Department for ${availableBranches.join(', ')}.`}
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setAssignMode('SELF')}
            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
              assignMode === 'SELF' ? 'bg-[#0b3578] text-white' : 'bg-white border text-slate-700 hover:bg-slate-100'
            }`}
          >
            Assign to Myself
          </button>
          <button
            type="button"
            onClick={() => setAssignMode('OTHER')}
            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
              assignMode === 'OTHER' ? 'bg-[#0b3578] text-white' : 'bg-white border text-slate-700 hover:bg-slate-100'
            }`}
          >
            Assign to Other Faculty
          </button>
        </div>
      </div>

      {/* Target Faculty ID input when assigning to someone else */}
      {assignMode === 'OTHER' && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs flex items-center gap-3">
          <UserPlus className="w-4 h-4 text-slate-500" />
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Target Faculty Staff ID / Account ID
            </label>
            <input
              type="number"
              placeholder="Enter Staff Account ID (e.g. 102)"
              value={targetFacultyId}
              onChange={(e) => setTargetFacultyId(e.target.value)}
              className="w-full sm:w-64 h-8 px-2 border border-slate-300 rounded bg-white text-xs font-mono"
            />
          </div>
        </div>
      )}

      {/* Filter controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700"
          >
            {availableBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Semester</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700"
          >
            {availableSemesters.map(s => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Academic Year</label>
          <select
            value={selectedAcademicYear}
            onChange={(e) => {
              userSelectedYearRef.current = true;
              setSelectedAcademicYear(e.target.value);
            }}
            className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700 font-mono"
          >
            {academicYearsList.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type Filter</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700"
          >
            <option value="">All Types</option>
            <option value="theory">Theory Only</option>
            <option value="lab">Lab Only</option>
            <option value="core">Core Only</option>
            <option value="elective">Electives Only</option>
          </select>
        </div>
      </div>

      {/* Syllabus Table */}
      {loadingSyllabus ? (
        <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Loading subjects…</div>
      ) : filteredSyllabus.length > 0 ? (
        <div className="overflow-x-auto max-h-130 overflow-y-auto">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gray-200 text-left text-[13px] font-semibold text-gray-700 uppercase tracking-[0.6px] border-b-2 border-gray-300">
                <th className="px-3 py-2 w-1/5">Type</th>
                <th className="px-3 py-2 w-1/5">Code</th>
                <th className="px-3 py-2 w-2/5">Title</th>
                <th className="px-3 py-2 w-1/5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSyllabus.map((subject, idx) => (
                <tr key={`${subject.code}-${idx}`} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${subject.isElective ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-3 py-2 text-sm text-gray-800 align-middle">
                    {subject.isElective ? (
                      <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-sm border border-amber-200 text-[10px] font-bold uppercase tracking-widest">
                        Elective ({subject.groupName})
                      </span>
                    ) : (
                      <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200 text-[10px] font-bold uppercase tracking-widest">
                        Core ({subject.subject_type})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-800 align-middle font-mono font-bold">{subject.code}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 align-middle whitespace-normal">
                    <div className="flex flex-col">
                      <span>{subject.title}</span>
                      {subject.is_allocated && (
                        <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          Allocated in this term. Multi-instructor allowed.
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-right align-middle">
                    <button
                      onClick={() => handleSubmitAssign(subject)}
                      disabled={submittingId === subject.code || (assignMode === 'OTHER' && !targetFacultyId)}
                      className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#0b3578] text-white hover:bg-[#0a2d66] transition-colors disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      {submittingId === subject.code 
                        ? 'Assigning...' 
                        : (assignMode === 'SELF' ? 'Self-Allocate' : 'Assign Faculty')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">
          No subjects found for this selection.
        </div>
      )}

      {/* Conflict Override Modal */}
      {conflictModal.isOpen && conflictModal.subject && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Timetable / Schedule Conflict Detected</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Conflict detected for <strong>{conflictModal.subject.title} ({conflictModal.subject.code})</strong>. As an authorized academic leader, you may override this conflict with an auditable reason.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 space-y-1">
              <div className="font-bold">Conflicts:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {conflictModal.conflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Mandatory Override Reason (min 5 characters)
              </label>
              <textarea
                rows={3}
                required
                value={conflictModal.overrideReason}
                onChange={(e) => setConflictModal(prev => ({ ...prev, overrideReason: e.target.value }))}
                placeholder="e.g. Authorized co-teaching allocation approved by Academic Council..."
                className="w-full text-xs border border-slate-300 rounded p-2.5 focus:border-[#0b3578] outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflictModal({ isOpen: false, subject: null, conflicts: [], warnings: [], overrideReason: '' })}
                className="px-3.5 py-1.5 border border-slate-300 rounded text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!conflictModal.overrideReason.trim() || conflictModal.overrideReason.trim().length < 5}
                onClick={() => handleSubmitAssign(conflictModal.subject, true, conflictModal.overrideReason.trim())}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                Confirm Conflict Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
