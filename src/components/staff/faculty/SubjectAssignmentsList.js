'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { getNowSync } from '@/lib/clock';
import { useStaff } from '@/context/StaffContext';
import AcademicYearSelect from '@/components/ui/AcademicYearSelect';

export default function SubjectAssignmentsList() {
  const { staffData, refreshFaculty } = useStaff();
  const [branches] = useState(COLLEGE_CONFIG.branches);
  const [selectedBranch, setSelectedBranch] = useState(staffData?.hod_department_code || '');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [syllabus, setSyllabus] = useState([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [startYear, setStartYear] = useState(2020);

  // Set default academic year (current)
  useEffect(() => {
    const id = setTimeout(() => {
      const now = getNowSync();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      let yearStr = '';
      if (currentMonth >= 6) {
        yearStr = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
        setStartYear(currentYear - 1);
      } else {
        yearStr = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
        setStartYear(currentYear - 2);
      }
      setAcademicYear(yearStr);
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const fetchSyllabus = useCallback(async () => {
    if (!selectedBranch || !selectedSemester || !academicYear) return;
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

  const handleSubmitAssign = async (subject) => {
    setSubmittingId(subject.code);
    try {
      const res = await fetch('/api/staff/hod/subject-assignments', {
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
      if (!res.ok) throw new Error(data.error || 'Failed to assign subject');
      toast.success(`Successfully assigned ${subject.title}`);
      
      // Update local state to reflect assignment immediately
      setSyllabus(prev => {
        const updateVariant = (v) => {
          if (v.code === subject.code) {
            return { ...v, is_allocated: true, allocated_to_me: true };
          }
          return v;
        };

        return prev.map(item => {
          if (item.isGroup || item.variants) {
            return {
              ...item,
              variants: (item.variants || []).map(updateVariant)
            };
          }
          if (item.code === subject.code) {
            return { ...item, is_allocated: true, allocated_to_me: true };
          }
          return item;
        });
      });
      
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-white text-sm font-medium text-slate-700"
            >
              <option value="">All Types</option>
              <option value="theory">Theory</option>
              <option value="lab">Lab</option>
              <option value="core">Core</option>
              <option value="elective">Elective</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Academic Year</label>
            <AcademicYearSelect
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              startYear={startYear}
              numYears={3}
              className="w-full h-10 px-3 border border-slate-200 rounded-sm bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {loadingSyllabus ? (
          <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Loading subjects…</div>
        ) : filteredSyllabus.length > 0 ? (
          <>
            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
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
                {filteredSyllabus.map((subject, idx) => {
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
                        {subject.subject_type && (
                          <span className="ml-2 text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-sm border border-indigo-200 text-[10px] font-bold uppercase tracking-widest">
                            {subject.subject_type}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-800 align-middle font-mono font-bold">{subject.code}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 align-middle whitespace-normal">
                        <div className="flex flex-col">
                          <span>{subject.title}</span>
                          {subject.is_allocated && !subject.allocated_to_me && (
                            <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-tight">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Allocated to another faculty.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-right align-middle">
                        {subject.allocated_to_me ? (
                          <span className="inline-flex px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-800 border-emerald-200">
                            Assigned to you
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSubmitAssign(subject)}
                            disabled={submittingId === subject.code}
                            className="px-4 py-1.5 bg-[#0b3578] text-white rounded-md text-sm font-medium hover:bg-[#0a2d66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            Assign to Me
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
            {filteredSyllabus.map((subject, idx) => {
              return (
                <div key={`${subject.code}-${idx}`} className={`border p-4 rounded-lg shadow-sm flex flex-col gap-3 ${subject.isElective ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded w-fit border border-slate-200">{subject.code}</span>
                      <span className="font-bold text-sm text-slate-800 leading-tight">{subject.title}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {subject.isElective ? (
                        <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
                          Elective
                        </span>
                      ) : (
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">Core</span>
                      )}
                      {subject.subject_type && (
                        <span className="text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
                          {subject.subject_type}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {subject.is_allocated && !subject.allocated_to_me && (
                    <div className="flex flex-col gap-1 mt-1">
                        <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 uppercase tracking-tight">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          Allocated to another faculty
                        </span>
                    </div>
                  )}

                  <div className="mt-2 border-t border-slate-100 pt-3">
                    {subject.allocated_to_me ? (
                      <div className="w-full flex justify-center px-3 py-2 rounded text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-800 border-emerald-200">
                        Assigned to you
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSubmitAssign(subject)}
                        disabled={submittingId === subject.code}
                        className="w-full px-4 py-2 bg-[#0b3578] text-white rounded-md text-sm font-medium hover:bg-[#0a2d66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        Assign to Me
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
  );
}
