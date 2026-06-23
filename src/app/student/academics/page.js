'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useStudent } from '@/context/StudentContext';
import { getSyllabusUrl } from '@/lib/getSyllabusUrl';
import { getBranchFromRoll, getCurrentStudyingYear, getCurrentSemester } from '@/lib/rollNumber';
import { AcademicsProvider, useAcademicsCache } from '@/context/AcademicsContext';
import toast from 'react-hot-toast';

// Utility: derive subject metadata (kept isolated for future DB migration)
function getSubjectMeta(_subjectName) {
  // Placeholder logic: always return Core, 3 credits.
  return { type: 'Core', credits: 3 };
}

// Utility: derive short name code from subject name (e.g., "Introduction to Data Analysis" -> "IDAV")
function deriveShortName(subjectName) {
  if (!subjectName) return '';
  const words = subjectName.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';
  // Take first letter of up to 4 significant words
  const initials = words.slice(0, 4).map(w => w.replace(/[^A-Za-z]/g, '')[0] || '').join('');
  return initials.toUpperCase();
}

export default function AcademicsPage() {
  const { studentData, collegeInfo } = useStudent();
  if (!studentData) return null;

  return (
    <AcademicsProvider roll={studentData.student.roll_no}>
      <AcademicsInner studentData={studentData} collegeInfo={collegeInfo} />
    </AcademicsProvider>
  );
}

function AcademicsInner({ studentData, collegeInfo }) {
  const [data, setData] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [_historySubject, setHistorySubject] = useState(null);
  const [_historyData, setHistoryData] = useState([]);
  const [_loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('subjects');
  const [currentSem, setCurrentSem] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);

  const { cache, saveCache, isReload } = useAcademicsCache() || { /* empty */ };
  
  // BREAK THE LOOP: Use a ref to access the latest cache without making it a dependency of the fetch function.
  // Since fetchAcademicInfo updates the cache, having cache as a dependency creates a cycle.
  const cacheRef = React.useRef(cache);
  const hasFetchedRef = React.useRef(false);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  const fetchAcademicInfo = React.useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Access current cache via ref to stay independent of re-renders
      const cached = cacheRef.current?.payload;
      
      if (!forceRefresh && cached && !isReload) {
        setData(cached.data || []);
        setCurrentSem(cached.semester);
        setCurrentYear(cached.academicYear);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/student/academic-info');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch academic info');
      const subjects = json.data || [];
      setData(subjects);
      setCurrentSem(json.semester);
      setCurrentYear(json.academicYear);
      // Save payload to session cache - this triggers a re-render but NOT a re-fetch
      try { saveCache({ data: subjects, semester: json.semester, academicYear: json.academicYear }); } catch { /* empty */ }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [saveCache, isReload]);

  const _fetchHistory = async (subject) => {
    setHistorySubject(subject);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/student/attendance/history?assignment_id=${subject.assignment_id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch attendance history');
      setHistoryData(json.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    // Prevent double-firing in StrictMode or due to parent re-renders
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    fetchAcademicInfo(false);
  }, [fetchAcademicInfo]);

  // removed unused helpers: getPercentageColor, overallAttendance
  // resolve syllabus URL via helper that uses rollNumber utilities
  function resolveSyllabusUrl(studentData, collegeInfo) {
    try {
      const roll = studentData?.student?.roll_no;
      if (!roll) return null;
      const branch = getBranchFromRoll(roll);
      const yearOfStudy = getCurrentStudyingYear(roll, collegeInfo);
      const semester = getCurrentSemester(roll, collegeInfo);
      if (!branch && yearOfStudy !== 1) return null; // branch required except maybe first year
      if (!yearOfStudy || !semester) return null;
      return getSyllabusUrl({ course: branch, year: yearOfStudy, semester });
    } catch (_e) {
      return null;
    }
  }

  const syllabusUrl = resolveSyllabusUrl(studentData, collegeInfo);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800">Academic Subjects and Performance</h1>
        <p className="text-sm text-gray-600 mt-1">Overview of your current semester subjects, attendance, and internal assessment results.</p>
      </header>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setActiveTab('subjects')} className={`px-3 py-2 rounded-md text-sm ${activeTab === 'subjects' ? 'bg-[#0b3578] text-white' : 'bg-white border'}`}>Subjects</button>
            <button onClick={() => setActiveTab('attendance')} className={`px-3 py-2 rounded-md text-sm ${activeTab === 'attendance' ? 'bg-[#0b3578] text-white' : 'bg-white border'}`}>Attendance</button>
            <button onClick={() => setActiveTab('internals')} className={`px-3 py-2 rounded-md text-sm ${activeTab === 'internals' ? 'bg-[#0b3578] text-white' : 'bg-white border'}`}>Internals</button>
            <div className="ml-auto text-xs text-gray-500"></div>
          </div>

          {/* Section 1: Subjects Offered */}
          {activeTab === 'subjects' && (
            <section className="border border-gray-300 rounded-md bg-white p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-gray-800">
                Subjects Offered {currentSem ? `– Semester ${currentSem}` : ''}
              </h2>
              <p className="text-sm text-gray-600">
                Academic Year {currentYear || '—'}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-0 table-auto">
                <thead className="bg-gray-100 text-sm font-medium text-gray-700">
                  <tr>
                    <th className="text-left py-2.5 px-2 text-[11px] sm:text-sm whitespace-normal wrap-break-word">Code</th>
                    <th className="text-left py-2.5 px-2 text-[11px] sm:text-sm whitespace-normal wrap-break-word">Subject Name</th>
                    <th className="text-left py-2.5 px-2 w-20 text-[11px] sm:text-sm whitespace-normal wrap-break-word">Type</th>
                    <th className="text-right py-2.5 px-2 w-16 text-[11px] sm:text-sm whitespace-normal wrap-break-word">Credits</th>
                    <th className="text-left py-2.5 px-2 text-[11px] sm:text-sm whitespace-normal wrap-break-word">Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((sub) => {
                    const meta = getSubjectMeta(sub.subject_name);
                    const code = sub.subject_code || '—';
                    return (
                      <tr key={sub.subject_code} className="border-b">
                        <td className="py-2.5 px-2 text-[11px] sm:text-sm text-gray-800 whitespace-normal wrap-break-word">{code}</td>
                        <td className="py-2.5 px-2 text-[11px] sm:text-sm text-gray-700 whitespace-normal wrap-break-word">{sub.subject_name}</td>
                        <td className="py-2.5 px-2 text-[11px] sm:text-sm text-gray-700 whitespace-normal wrap-break-word">{meta.type}</td>
                        <td className="py-2.5 px-2 text-[11px] sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{meta.credits}</td>
                        <td className="py-2.5 px-2 text-[11px] sm:text-sm text-gray-700 whitespace-normal wrap-break-word">{sub.faculty_name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-right space-y-1">
              {syllabusUrl ? (
                <a href={syllabusUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0b3578] hover:underline">View Full Curriculum</a>
              ) : (
                <div className="text-sm text-gray-500">Curriculum Not Available</div>
              )}
              <div>
                <Link href="/student/timetable" className="text-sm text-[#0b3578] hover:underline">View Detailed Time Table</Link>
              </div>
            </div>
            </section>
          )}

          {/* Section 2: Attendance Summary */}
          {activeTab === 'attendance' && (
            <section className="border border-gray-300 rounded-md bg-white p-4">
            <div className="mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-800">Attendance Summary</h2>
              <p className="text-xs sm:text-sm text-gray-600">Conducted and attended classes (shortcut codes)</p>
            </div>

            <div>
              <table className="w-full table-auto">
                <thead className="bg-gray-100 text-xs sm:text-sm font-medium text-gray-700">
                  <tr>
                    <th className="text-left py-2.5 px-2 text-xs sm:text-sm">Subject</th>
                    <th className="text-right py-2.5 px-2 w-20 text-xs sm:text-sm">Conducted</th>
                    <th className="text-right py-2.5 px-2 w-20 text-xs sm:text-sm">Attended</th>
                    <th className="text-right py-2.5 px-2 w-20 text-xs sm:text-sm">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((sub) => {
                    const pct = sub.total_classes > 0 ? (sub.attended_classes / sub.total_classes) * 100 : 100;
                    const short = deriveShortName(sub.subject_name) || sub.subject_code || '—';
                    return (
                      <tr key={`att-${sub.subject_code}`} className="border-b">
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-800">{short}</td>
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{sub.total_classes ?? '--'}</td>
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{sub.attended_classes ?? '--'}</td>
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </section>
          )}

          {/* Section 3: Internal Assessment Summary */}
          {activeTab === 'internals' && (
            <section className="space-y-4">
              {/* Theory subjects */}
              {(() => {
                const theorySubjects = data.filter((sub) => sub.subject_type !== 'lab');
                if (!theorySubjects.length) return null;
                return (
                  <div className="border border-gray-300 rounded-md bg-white p-4">
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold text-gray-800">Internal Assessment 
                        <span className="font-normal"> – Theory Subjects</span>
                      </h2>
                      <p className="text-sm text-gray-600">Mid examinations and assignment marks for theory subjects.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-0 table-auto text-sm">
                        <thead className="bg-gray-100 font-medium text-gray-700">
                          <tr>
                            <th className="text-left py-2 px-2 text-xs sm:text-sm whitespace-normal wrap-break-word">Subject</th>
                            <th className="text-right py-2 px-2 w-20 text-xs sm:text-sm whitespace-normal wrap-break-word">Mid I</th>
                            <th className="text-right py-2 px-2 w-20 text-xs sm:text-sm whitespace-normal wrap-break-word">Mid II</th>
                            <th className="text-right py-2 px-2 w-24 text-xs sm:text-sm whitespace-normal wrap-break-word">Assignment</th>
                            <th className="text-right py-2 px-2 w-20 text-xs sm:text-sm whitespace-normal wrap-break-word">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {theorySubjects.map((sub) => {
                            const m1 = sub.mid1_marks !== null ? parseFloat(sub.mid1_marks) : null;
                            const m2 = sub.mid2_marks !== null ? parseFloat(sub.mid2_marks) : null;
                            const assgn = sub.assignment_marks !== null ? parseFloat(sub.assignment_marks) : null;
                            let total = null;
                            if (m1 !== null || m2 !== null || assgn !== null) {
                              const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
                              total = bestMid + (assgn ?? 0);
                            }
                            const short = deriveShortName(sub.subject_name) || sub.subject_code || '—';
                            return (
                              <tr key={`theory-${sub.subject_code}`} className="border-b">
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-800 whitespace-normal wrap-break-word">{short}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{m1 !== null ? m1 : '--'}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{m2 !== null ? m2 : '--'}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{assgn !== null ? assgn : '--'}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{total !== null ? total.toFixed(1) : '--'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Lab subjects */}
              {(() => {
                const labSubjects = data.filter((sub) => sub.subject_type === 'lab');   
                if (!labSubjects.length) return null;
                return (
                  <div className="border border-gray-300 rounded-md bg-white p-4">      
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold text-gray-800">Lab Evaluation</h2>
                      <p className="text-sm text-gray-600">Execution, writing, and record/observation marks for lab subjects.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-0 table-auto text-sm">
                        <thead className="bg-gray-100 font-medium text-gray-700">       
                          <tr>
                            <th className="text-left py-2 px-2 text-xs sm:text-sm whitespace-normal wrap-break-word">Subject</th>
                            <th className="text-right py-2 px-2 w-24 text-xs sm:text-sm whitespace-normal wrap-break-word">Execution</th>
                            <th className="text-right py-2 px-2 w-24 text-xs sm:text-sm whitespace-normal wrap-break-word">Writing</th>
                            <th className="text-right py-2 px-2 w-24 text-xs sm:text-sm whitespace-normal wrap-break-word">Record/Obs</th>
                            <th className="text-right py-2 px-2 w-20 text-xs sm:text-sm whitespace-normal wrap-break-word">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labSubjects.map((sub) => {
                            const th = sub.lab_theory_marks !== null ? parseFloat(sub.lab_theory_marks) : null;
                            const ex = sub.lab_execution_marks !== null ? parseFloat(sub.lab_execution_marks) : null;
                            const rec = sub.lab_record_marks !== null ? parseFloat(sub.lab_record_marks) : null;
                            let total = null;
                            if (th !== null || ex !== null || rec !== null) {
                              total = (th ?? 0) + (ex ?? 0) + (rec ?? 0);
                            }
                            const short = deriveShortName(sub.subject_name) || sub.subject_code || '—';
                            return (
                              <tr key={`lab-${sub.subject_code}`} className="border-b">
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-800 whitespace-normal wrap-break-word">{short}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{ex !== null ? ex : '--'}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{th !== null ? th : '--'}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{rec !== null ? rec : '--'}</td>
                                <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word">{total !== null ? total.toFixed(1) : '--'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}            </section>
          )}
        </div>
  );
}
