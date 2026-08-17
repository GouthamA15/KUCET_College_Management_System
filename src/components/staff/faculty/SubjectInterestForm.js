'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { getNowSync } from '@/lib/clock';
import { useStaff } from '@/context/StaffContext';

export default function SubjectInterestForm({ onInterestSubmitted }) {
  const { facultyInterests = [], isLoadingFaculty, refreshFaculty } = useStaff();
  const [branches] = useState(COLLEGE_CONFIG.branches);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [syllabus, setSyllabus] = useState([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [academicYear, setAcademicYear] = useState('');
  const [localInterests, setLocalInterests] = useState(null);
  const [isFetchingLocal, setIsFetchingLocal] = useState(false);

  useEffect(() => {
    if ((!facultyInterests || facultyInterests.length === 0) && !isLoadingFaculty && localInterests === null && !isFetchingLocal) {
      const fetchExistingInterests = async () => {
        setIsFetchingLocal(true);
        try {
          const res = await fetch('/api/staff/faculty/interests');
          const data = await res.json();
          if (res.ok) {
            setLocalInterests(data.data || []);
          } else {
            setLocalInterests([]);
          }
        } catch (error) {
          console.error('Failed to fetch existing interests:', error);
          setLocalInterests([]);
        } finally {
          setIsFetchingLocal(false);
        }
      };
      fetchExistingInterests();
    }
  }, [facultyInterests, isLoadingFaculty, localInterests, isFetchingLocal]);

  const effectiveInterests = (facultyInterests && facultyInterests.length > 0) ? facultyInterests : (localInterests || []);

  // Set default academic year (current)
  useEffect(() => {
    const id = setTimeout(() => {
      const now = getNowSync();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      let yearStr = '';
      if (currentMonth >= 6) {
        yearStr = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      } else {
        yearStr = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      }
      setAcademicYear(yearStr);
    }, 0);

    return () => clearTimeout(id);
  }, []);


  const fetchSyllabus = useCallback(async () => {
    if (!selectedBranch || !selectedSemester) return;
    setLoadingSyllabus(true);
    try {
      const res = await fetch(`/api/staff/faculty/syllabus?branch=${selectedBranch}&semester=${selectedSemester}&academicYear=${academicYear}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch syllabus');
      setSyllabus(data.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingSyllabus(false);
    }
  }, [selectedBranch, selectedSemester, academicYear]);

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
          semester: selectedSemester,
          academic_year: academicYear
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

  const getInterestStatus = (subjectCode) => {
    return effectiveInterests.find(i => 
      i.subject_code === subjectCode && 
      i.branch === selectedBranch && 
      i.semester === parseInt(selectedSemester) &&
      i.academic_year === academicYear
    );
  };

  return (
    <section className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-4">
        <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">Express Interest</h2>
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight mt-1">Select a branch and semester to view syllabus and submit preferences.</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700"
          >
            <option value="">Select Branch</option>
            {branches.map(b => (
              <option key={b.code} value={b.name}>{b.name}</option>
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
            <option value="">Select Semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-slate-50 text-sm font-medium text-slate-700"
            placeholder="e.g. 2025-26"
          />
          </div>
        </div>

        {/* Removed semester restriction warning */}
        {loadingSyllabus ? (
          <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Loading subjects…</div>
        ) : syllabus.length > 0 ? (
          <>
            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Code</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Title</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status / Action</th>
                </tr>
              </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                {syllabus.flatMap((item) => {
                  if (item.isGroup || item.variants) {
                    return (item.variants || []).map(variant => ({
                      ...variant,
                      isElective: true,
                      groupName: item.title,
                      // The flags are now directly on the variant from the API
                      is_allocated: variant.is_allocated,
                      allocated_to_me: variant.allocated_to_me
                    }));
                  }
                  return [item];
                }).map((subject, idx) => {
                  const interest = getInterestStatus(subject.code);
                  return (
                    <tr key={`${subject.code}-${idx}`} className={subject.isElective ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap text-[11px] font-semibold">
                        {subject.isElective ? (
                          <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-sm border border-amber-200 text-[10px] font-bold uppercase tracking-widest">
                            Elective ({subject.groupName})
                          </span>
                        ) : (
                          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200 text-[10px] font-bold uppercase tracking-widest">Core</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[11px] font-mono font-bold text-slate-800">{subject.code}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-600">
                        <div className="flex flex-col">
                          <span>{subject.title}</span>
                          {subject.is_allocated && !subject.allocated_to_me && (
                            <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Allocated to another faculty. You can still express interest.
                            </span>
                          )}
                          {subject.allocated_to_me && (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              You are already teaching this subject.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {interest ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest border ${
                            interest.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            interest.status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                            'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}>
                            {interest.status === 'PENDING' ? 'Applied (Pending)' : interest.status}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSubmitInterest(subject)}
                            disabled={submitting}
                            className="text-[10px] font-black uppercase tracking-widest text-[#0b3578] border border-slate-200 px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Express Interest
                          </button>
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
                  
                  {(subject.is_allocated || subject.allocated_to_me) && (
                    <div className="flex flex-col gap-1 mt-1">
                      {subject.is_allocated && !subject.allocated_to_me && (
                        <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 uppercase tracking-tight">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          Allocated to another faculty
                        </span>
                      )}
                      {subject.allocated_to_me && (
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 uppercase tracking-tight">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          You are already teaching this
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 border-t border-slate-100 pt-3">
                    {interest ? (
                      <div className={`w-full flex justify-center px-3 py-2 rounded text-[10px] font-black uppercase tracking-widest border ${
                        interest.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        interest.status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                        'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        {interest.status === 'PENDING' ? 'Applied (Pending)' : interest.status}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSubmitInterest(subject)}
                        disabled={submitting}
                        className="w-full text-[11px] font-black uppercase tracking-widest text-white border border-indigo-600 rounded bg-indigo-600 hover:bg-indigo-700 py-3 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Express Interest
                      </button>
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
      </div>
    </section>
  );
}
