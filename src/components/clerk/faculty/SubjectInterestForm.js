'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { getNowSync } from '@/lib/clock';

export default function SubjectInterestForm({ onInterestSubmitted }) {
  const [branches] = useState(COLLEGE_CONFIG.branches);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [syllabus, setSyllabus] = useState([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [academicYear, setAcademicYear] = useState('');
  const [existingInterests, setExistingInterests] = useState([]);
  const [collegeInfo, setCollegeInfo] = useState(null);

  // Fetch college info
  const fetchCollegeInfo = async () => {
    try {
      const res = await fetch('/api/public/college-info');
      const data = await res.json();
      if (res.ok) setCollegeInfo(data);
    } catch (e) { console.error(e); }
  };

  // Fetch existing interests
  const fetchExistingInterests = async () => {
    try {
      const res = await fetch('/api/clerk/faculty/interests');
      const data = await res.json();
      if (res.ok) {
        setExistingInterests(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch existing interests:', error);
    }
  };

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
      fetchExistingInterests();
      fetchCollegeInfo();
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const isSemesterAllowed = (sem) => {
    if (!collegeInfo) return true; // Default to allow if not loaded
    const now = getNowSync();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentTime = currentMonth * 100 + currentDay;

    const firstSemStartMonth = parseInt(collegeInfo.first_sem_start_month) || 6;
    const firstSemStartDay = parseInt(collegeInfo.first_sem_start_day) || 1;
    const firstSemTime = firstSemStartMonth * 100 + firstSemStartDay;

    const secondSemStartMonth = parseInt(collegeInfo.second_sem_start_month) || 1;
    const secondSemStartDay = parseInt(collegeInfo.second_sem_start_day) || 15;
    const secondSemTime = secondSemStartMonth * 100 + secondSemStartDay;

    let isOddPeriod = false;
    if (firstSemTime < secondSemTime) {
      isOddPeriod = currentTime >= firstSemTime && currentTime < secondSemTime;
    } else {
      isOddPeriod = currentTime >= firstSemTime || currentTime < secondSemTime;
    }

    const isOddSemester = parseInt(sem) % 2 !== 0;
    return isOddSemester === isOddPeriod;
  };

  const fetchSyllabus = useCallback(async () => {
    if (!selectedBranch || !selectedSemester) return;
    setLoadingSyllabus(true);
    try {
      const res = await fetch(`/api/clerk/faculty/syllabus?branch=${selectedBranch}&semester=${selectedSemester}&academicYear=${academicYear}`);
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
      const res = await fetch('/api/clerk/faculty/interests', {
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
      fetchExistingInterests();
      if (onInterestSubmitted) onInterestSubmitted();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getInterestStatus = (subjectCode) => {
    return existingInterests.find(i => 
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
              <option key={s} value={s} disabled={!isSemesterAllowed(s)}>
                Semester {s} {!isSemesterAllowed(s) ? '(Inactive)' : ''}
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

        {selectedSemester && !isSemesterAllowed(selectedSemester) && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm text-[11px] font-medium">
            Semester {selectedSemester} is not currently active. You can view subjects but cannot express interest until the next session starts.
          </div>
        )}

        {loadingSyllabus ? (
          <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Loading subjects…</div>
        ) : syllabus.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-sm">
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
                          disabled={submitting || !isSemesterAllowed(selectedSemester)}
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
      ) : (selectedBranch && selectedSemester) ? (
        <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">No subjects found for this selection.</div>
      ) : (
        <div className="text-center py-10 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Select branch and semester to view subjects.</div>
      )}
      </div>
    </section>
  );
}
