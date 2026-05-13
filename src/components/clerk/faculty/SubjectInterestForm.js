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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Express Interest in Subjects</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Branch</option>
            {branches.map(b => (
              <option key={b.code} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="w-full p-2 border rounded"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full p-2 border rounded bg-gray-50"
            placeholder="e.g. 2025-26"
          />
        </div>
      </div>

      {selectedSemester && !isSemesterAllowed(selectedSemester) && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-sm">
          ⚠️ Semester {selectedSemester} is not currently active. You can view subjects but cannot express interest until the next session starts.
        </div>
      )}

      {loadingSyllabus ? (
        <div className="text-center py-4">Loading subjects...</div>
      ) : syllabus.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status / Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
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
                  <tr key={`${subject.code}-${idx}`} className={subject.isElective ? 'bg-amber-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium">
                      {subject.isElective ? (
                        <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Elective ({subject.groupName})
                        </span>
                      ) : (
                        <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Core</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{subject.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span>{subject.title}</span>
                        {subject.is_allocated && !subject.allocated_to_me && (
                          <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Note: This subject is already allocated to another faculty but You can express interest.
                          </span>
                        )}
                        {subject.allocated_to_me && (
                          <span className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            You are already teaching this subject.
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {interest ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          interest.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          interest.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {interest.status === 'PENDING' ? 'Applied (Pending)' : interest.status}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSubmitInterest(subject)}
                          disabled={submitting || !isSemesterAllowed(selectedSemester)}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold disabled:opacity-50"
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
        <div className="text-center py-4 text-gray-500">No subjects found for this selection.</div>
      ) : (
        <div className="text-center py-4 text-gray-500">Select Branch and Semester to see subjects.</div>
      )}
    </div>
  );
}
