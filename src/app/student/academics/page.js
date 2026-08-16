'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useStudent } from '@/context/StudentContext';
import { getSyllabusUrl } from '@/lib/getSyllabusUrl';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { AcademicsProvider, useAcademicsCache } from '@/context/AcademicsContext';
import toast from 'react-hot-toast';
import { Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

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
  const { studentData } = useStudent();
  if (!studentData) return null;

  return (
    <AcademicsProvider roll={studentData.student.roll_no}>
      <AcademicsInner studentData={studentData} />
    </AcademicsProvider>
  );
}

function AcademicsInner({ studentData }) {
  const [data, setData] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [_historySubject, setHistorySubject] = useState(null);
  const [_historyData, setHistoryData] = useState([]);
  const [_loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('subjects');
  const [currentSem, setCurrentSem] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);

  // Help Icon / Bottom Sheet state
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent scroll when bottom sheet is open
  useEffect(() => {
    if (isBottomSheetOpen && isMobileDevice) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isBottomSheetOpen, isMobileDevice]);

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
  // resolve syllabus URL via helper that uses rollNumber utilities
  function resolveSyllabusUrl(studentData) {
    try {
      const roll = studentData?.student?.roll_no;
      if (!roll) return null;
      const branch = getBranchFromRoll(roll);
      const yearOfStudy = studentData?.academic_session?.yearOfStudy;
      const semester = studentData?.academic_session?.semester;
      if (!branch && yearOfStudy !== 1) return null; // branch required except maybe first year
      if (!yearOfStudy || !semester) return null;
      return getSyllabusUrl({ course: branch, year: yearOfStudy, semester });
    } catch (_e) {
      return null;
    }
  }

  const syllabusUrl = resolveSyllabusUrl(studentData);

  if (_loading) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <header className="mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-800">Academic Subjects and Performance</h1>
            <div className="text-slate-400 p-1 rounded-full"><Info size={20} className="shrink-0" /></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Overview of your current semester subjects, attendance, and internal assessment results.</p>
        </header>

        <div className="flex items-center gap-2 mb-3">
          <button className="px-3 py-2 rounded-md text-sm transition-colors bg-[#0b3578] text-white">Subjects</button>
          <button className="px-3 py-2 rounded-md text-sm transition-colors bg-white border text-gray-500 cursor-not-allowed">Attendance</button>
          <button className="px-3 py-2 rounded-md text-sm transition-colors bg-white border text-gray-500 cursor-not-allowed">Internals</button>
        </div>

        <section className="border border-gray-200 rounded-md bg-white p-4">
          <div className="mb-4">
            <div className="h-5 skeleton-shimmer w-48 rounded mb-2"></div>
            <div className="h-4 skeleton-shimmer w-32 rounded"></div>
          </div>
          <div className="space-y-3">
             <div className="h-10 skeleton-shimmer w-full rounded"></div>
             <div className="h-10 skeleton-shimmer w-full rounded"></div>
             <div className="h-10 skeleton-shimmer w-full rounded"></div>
             <div className="h-10 skeleton-shimmer w-full rounded"></div>
          </div>
        </section>
      </div>
    );
  }

  const bottomSheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="help-sheet-title" 
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <button 
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Academics Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            This module provides a comprehensive overview of your current academic status. Please note the following:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Subjects:</strong> Displays your current semester curriculum, credits, and assigned faculty.</li>
            <li><strong>Attendance:</strong> Tracks your attendance percentage based on conducted vs. attended classes.</li>
            <li><strong>Internals:</strong> Shows mid-term and assignment marks for theory subjects, and evaluation marks for lab subjects.</li>
          </ul>
        </div>
        <button 
          onClick={() => setIsBottomSheetOpen(false)} 
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors focus:outline-none"
        >
          Got It
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Academic Subjects and Performance</h1>
          
          <div 
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) {
                  setIsBottomSheetOpen(true);
                }
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Help Information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">Academics Information</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  This module provides a comprehensive overview of your current academic status. Please note the following:
                </p>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>Subjects:</strong> Displays your current semester curriculum, credits, and assigned faculty.</li>
                  <li><strong>Attendance:</strong> Tracks your attendance percentage based on conducted vs. attended classes.</li>
                  <li><strong>Internals:</strong> Shows mid-term and assignment marks for theory subjects, and evaluation marks for lab subjects.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Overview of your current semester subjects, attendance, and internal assessment results.</p>
      </header>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setActiveTab('subjects')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'subjects' ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}>Subjects</button>
            <button onClick={() => setActiveTab('attendance')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'attendance' ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}>Attendance</button>
            <button onClick={() => setActiveTab('internals')} className={`px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'internals' ? 'bg-[#0b3578] text-white' : 'bg-white border hover:bg-gray-50'}`}>Internals</button>
          </div>

          {/* Construction Warning Bar */}
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm font-medium flex items-start gap-2 shadow-sm mb-4">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <span>The Academics module and its core features (Subjects curriculum, Attendance tracking, and Internal marks recording) are currently in the construction stage. Data shown may be for testing purposes and not final.</span>
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

            <>
              <div className="hidden md:block overflow-x-auto">
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
              <div className="md:hidden flex flex-col gap-3">
                {data.map((sub) => {
                  const meta = getSubjectMeta(sub.subject_name);
                  const code = sub.subject_code || '—';
                  return (
                    <div key={sub.subject_code} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-800 text-xs">{code}</div>
                        <div className="bg-white border text-xs px-2 py-0.5 rounded text-gray-600">{meta.type}</div>
                      </div>
                      <div className="font-medium text-gray-800 mb-2">{sub.subject_name}</div>
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <div><span className="font-semibold">Faculty:</span> {sub.faculty_name || '—'}</div>
                        <div><span className="font-semibold">Credits:</span> {meta.credits}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>

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

            <>
              <div className="hidden md:block overflow-x-auto">
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
              <div className="md:hidden flex flex-col gap-3">
                {data.map((sub) => {
                  const pct = sub.total_classes > 0 ? (sub.attended_classes / sub.total_classes) * 100 : 100;
                  const short = deriveShortName(sub.subject_name) || sub.subject_code || '—';
                  return (
                    <div key={`att-${sub.subject_code}`} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm flex justify-between items-center">
                      <div className="font-medium text-gray-800">{short}</div>
                      <div className="flex gap-4 items-center">
                        <div className="text-right">
                          <div className="text-[10px] text-gray-500 font-semibold uppercase">Attended / Total</div>
                          <div className="text-xs text-gray-800">{sub.attended_classes ?? '--'} / {sub.total_classes ?? '--'}</div>
                        </div>
                        <div className={`font-bold ${pct < 75 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {pct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
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
                    <>
                      <div className="hidden md:block overflow-x-auto">
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
                                  <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word font-bold">{total !== null ? total.toFixed(1) : '--'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="md:hidden flex flex-col gap-3">
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
                            <div key={`theory-${sub.subject_code}`} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm flex flex-col gap-2">
                              <div className="font-semibold text-gray-800">{short}</div>
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex gap-3 text-gray-600">
                                  <div><span className="font-semibold">Mid I:</span> {m1 !== null ? m1 : '--'}</div>
                                  <div><span className="font-semibold">Mid II:</span> {m2 !== null ? m2 : '--'}</div>
                                  <div><span className="font-semibold">Assgn:</span> {assgn !== null ? assgn : '--'}</div>
                                </div>
                                <div className="font-bold text-gray-800 bg-white border px-2 py-1 rounded">
                                  Total: {total !== null ? total.toFixed(1) : '--'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
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
                    <>
                      <div className="hidden md:block overflow-x-auto">
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
                                  <td className="py-2 px-2 text-xs sm:text-sm text-gray-700 text-right whitespace-normal wrap-break-word font-bold">{total !== null ? total.toFixed(1) : '--'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="md:hidden flex flex-col gap-3">
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
                            <div key={`lab-${sub.subject_code}`} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm flex flex-col gap-2">
                              <div className="font-semibold text-gray-800">{short}</div>
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex gap-3 text-gray-600">
                                  <div><span className="font-semibold">Exec:</span> {ex !== null ? ex : '--'}</div>
                                  <div><span className="font-semibold">Writ:</span> {th !== null ? th : '--'}</div>
                                  <div><span className="font-semibold">Rec/Obs:</span> {rec !== null ? rec : '--'}</div>
                                </div>
                                <div className="font-bold text-gray-800 bg-white border px-2 py-1 rounded">
                                  Total: {total !== null ? total.toFixed(1) : '--'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  </div>
                );
              })()}            </section>
          )}
          
          {typeof document !== 'undefined' && isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
        </div>
  );
}
