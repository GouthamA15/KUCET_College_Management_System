'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useStaff } from '@/context/StaffContext';
import { AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { 
  INSTITUTIONAL_BRANCHES as CANONICAL_BRANCHES, 
  deriveDefaultAcademicYear, 
  getCanonicalAcademicYears 
} from '@/lib/academic-constants';

export default function SubjectInterestForm({ onInterestSubmitted }) {
  const { staffData, facultyInterests = [], refreshFaculty } = useStaff();

  const defaultYear = staffData?.academic_year || deriveDefaultAcademicYear();
  const academicYearsList = useMemo(() => getCanonicalAcademicYears(defaultYear), [defaultYear]);

  const [selectedBranch, setSelectedBranch] = useState(staffData?.branch || staffData?.branches?.[0] || 'CSE');
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(defaultYear);

  const userSelectedYearRef = useRef(false);
  useEffect(() => {
    if (!userSelectedYearRef.current && staffData?.academic_year && staffData.academic_year !== selectedAcademicYear) {
      setSelectedAcademicYear(staffData.academic_year);
    }
  }, [staffData?.academic_year, selectedAcademicYear]);
  const [syllabus, setSyllabus] = useState([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Conflict override state
  const [conflictModal, setConflictModal] = useState({
    isOpen: false,
    subject: null,
    conflicts: [],
    warnings: [],
    overrideReason: ''
  });

  const effectiveInterests = facultyInterests || [];

  const branches = Array.from(new Set([...CANONICAL_BRANCHES, ...(staffData?.branches || [])]));

  const canSelfAllocate = Boolean(
    (staffData?.is_first_year_coordinator && [1, 2].includes(Number(selectedSemester))) ||
    (staffData?.is_hod && (staffData?.authorized_branches || [staffData?.branch]).map(b => b?.toUpperCase()).includes(selectedBranch?.toUpperCase())) ||
    staffData?.is_principal ||
    staffData?.role === 'admin'
  );

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

  const handleSubmitInterest = async (subject) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/faculty/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_code: subject.code,
          subject_name: subject.title,
          branch: selectedBranch,
          department_code: selectedBranch,
          semester: selectedSemester,
          academic_year: selectedAcademicYear
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit interest');
      toast.success('Interest submitted successfully');
      if (refreshFaculty) refreshFaculty();
      if (onInterestSubmitted) onInterestSubmitted();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelfAllocate = async (subject, override = false, reason = '') => {
    setSubmitting(true);
    try {
      const payload = {
        subject_code: subject.code,
        subject_name: subject.title,
        branch: selectedBranch,
        semester: selectedSemester,
        academic_year: selectedAcademicYear,
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
        setConflictModal({
          isOpen: true,
          subject,
          conflicts: data.conflicts || [],
          warnings: data.warnings || [],
          overrideReason: ''
        });
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed to self-allocate subject');

      toast.success(data.message || `Successfully allocated ${subject.title} to yourself`);
      setConflictModal({ isOpen: false, subject: null, conflicts: [], warnings: [], overrideReason: '' });

      fetchSyllabus();
      if (refreshFaculty) refreshFaculty();
      if (onInterestSubmitted) onInterestSubmitted();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getInterestStatus = (subjectCode) => {
    return effectiveInterests.find(i => 
      i.subject_code === subjectCode && 
      i.branch === selectedBranch && 
      i.semester === parseInt(selectedSemester) &&
      (!i.academic_year || i.academic_year === selectedAcademicYear)
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* Scope / Role Badge */}
      {canSelfAllocate && (
        <div className="bg-sky-50 border border-sky-200 rounded p-3 flex items-center justify-between text-xs text-sky-900">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              <strong>Direct Self-Allocation Active:</strong> You have authority to allocate subjects directly for {selectedBranch} Semester {selectedSemester} ({staffData?.is_first_year_coordinator ? 'First-Year Coordinator' : 'HOD Scope'}).
            </span>
          </div>
        </div>
      )}

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700"
          >
            {branches.map(b => (
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
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
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
      </div>

      {loadingSyllabus ? (
        <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Loading subjects…</div>
      ) : syllabus.length > 0 ? (
        <>
          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto max-h-130 overflow-y-auto">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-gray-200 text-left text-[13px] font-semibold text-gray-700 uppercase tracking-[0.6px] border-b-2 border-gray-300">
                  <th className="px-3 py-2 w-1/5">Type</th>
                  <th className="px-3 py-2 w-1/5">Code</th>
                  <th className="px-3 py-2 w-2/5">Title</th>
                  <th className="px-3 py-2 w-1/5 text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody>
              {syllabus.flatMap((item) => {
                if (item.isGroup || item.variants) {
                  return (item.variants || []).map(variant => ({
                    ...variant,
                    isElective: true,
                    groupName: item.title,
                    is_allocated: variant.is_allocated,
                    allocated_to_me: variant.allocated_to_me
                  }));
                }
                return [item];
              }).map((subject, idx) => {
                const interest = getInterestStatus(subject.code);
                return (
                  <tr key={`${subject.code}-${idx}`} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150 ${subject.isElective ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-3 py-2 text-sm text-gray-800 align-middle">
                      {subject.isElective ? (
                        <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-sm border border-amber-200 text-[10px] font-bold uppercase tracking-widest">
                          Elective ({subject.groupName})
                        </span>
                      ) : (
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200 text-[10px] font-bold uppercase tracking-widest">Core</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-800 align-middle font-mono font-bold">{subject.code}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 align-middle whitespace-normal">
                      <div className="flex flex-col">
                        <span>{subject.title}</span>
                        {subject.is_allocated && !subject.allocated_to_me && (
                          <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            Allocated to another faculty. Co-teaching / multiple instructors supported.
                          </span>
                        )}
                        {subject.allocated_to_me && (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                            <CheckCircle className="w-3 h-3 shrink-0" />
                            You are teaching this subject.
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-right align-middle">
                      {subject.allocated_to_me ? (
                        <span className="inline-flex px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Active Allocation
                        </span>
                      ) : interest && interest.status === 'PENDING' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-800 border border-indigo-200">
                            Applied (Pending)
                          </span>
                          {canSelfAllocate && (
                            <button
                              onClick={() => handleSelfAllocate(subject)}
                              disabled={submitting}
                              className="text-[10px] text-blue-700 hover:underline font-bold"
                            >
                              Self-Allocate Now
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {canSelfAllocate && (
                            <button
                              onClick={() => handleSelfAllocate(subject)}
                              disabled={submitting}
                              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-xs"
                            >
                              Self-Allocate
                            </button>
                          )}
                          <button
                            onClick={() => handleSubmitInterest(subject)}
                            disabled={submitting}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                              canSelfAllocate ? 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200' : 'bg-[#0b3578] text-white hover:bg-[#0a2d66]'
                            }`}
                          >
                            Express Interest
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden flex flex-col gap-3">
          {syllabus.flatMap((item) => {
            if (item.isGroup || item.variants) {
              return (item.variants || []).map(variant => ({
                ...variant,
                isElective: true,
                groupName: item.title,
                is_allocated: variant.is_allocated,
                allocated_to_me: variant.allocated_to_me
              }));
            }
            return [item];
          }).map((subject, idx) => {
            const interest = getInterestStatus(subject.code);
            return (
              <div key={`${subject.code}-${idx}`} className={`border p-4 rounded-lg shadow-sm flex flex-col gap-3 ${subject.isElective ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded w-fit border border-slate-200">{subject.code}</span>
                    <span className="font-bold text-sm text-slate-800 leading-tight">{subject.title}</span>
                  </div>
                  {subject.isElective ? (
                    <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
                      Elective
                    </span>
                  ) : (
                    <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">Core</span>
                  )}
                </div>

                <div className="mt-2 border-t border-slate-100 pt-3">
                  {subject.allocated_to_me ? (
                    <div className="w-full text-center py-1.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded border border-emerald-200">
                      Active Allocation (Teaching)
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {canSelfAllocate && (
                        <button
                          onClick={() => handleSelfAllocate(subject)}
                          disabled={submitting}
                          className="w-full py-2 bg-emerald-700 text-white rounded font-semibold text-xs hover:bg-emerald-800 cursor-pointer"
                        >
                          Self-Allocate
                        </button>
                      )}
                      <button
                        onClick={() => handleSubmitInterest(subject)}
                        disabled={submitting}
                        className={`w-full py-2 rounded text-xs font-semibold cursor-pointer ${
                          canSelfAllocate ? 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200' : 'bg-[#0b3578] text-white hover:bg-[#0a2d66]'
                        }`}
                      >
                        {interest?.status === 'PENDING' ? 'Request Submitted (Pending)' : 'Express Interest'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      ) : (selectedBranch && selectedSemester) ? (
        <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">No subjects found for this selection.</div>
      ) : (
        <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Select branch and semester to view subjects.</div>
      )}

      {/* Conflict Override Modal */}
      {conflictModal.isOpen && conflictModal.subject && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Schedule Conflict Detected</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              An instructional or schedule conflict was detected for <strong>{conflictModal.subject.title} ({conflictModal.subject.code})</strong>. As an authorized academic officer, you may override this conflict with an auditable justification.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 space-y-1">
              <div className="font-bold">Detected Conflicts:</div>
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
                disabled={submitting || !conflictModal.overrideReason.trim() || conflictModal.overrideReason.trim().length < 5}
                onClick={() => handleSelfAllocate(conflictModal.subject, true, conflictModal.overrideReason.trim())}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Applying Override...' : 'Confirm Conflict Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
