'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useStudent } from '@/context/StudentContext';
import { getSyllabusUrl } from '@/lib/getSyllabusUrl';
import { getBranchFromRoll, getCurrentStudyingYear, getCurrentSemester } from '@/lib/rollNumber';
import { AcademicsProvider, useAcademicsCache } from '@/context/AcademicsContext';
import StudentProfileLayout from '@/components/student/StudentProfileLayout';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import toast from 'react-hot-toast';

const MarkAttendanceCard = ({ session, onVerified }) => {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    if (pin.length !== 4) {
      toast.error('Enter the 4-digit PIN shown on faculty screen');
      return;
    }

    setSubmitting(true);
    try {
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        toast.error("GPS requires HTTPS on mobile. Please host on Render or use a laptop on 'localhost'.", { duration: 6000 });
        setSubmitting(false);
        return;
      }

      let deviceId = localStorage.getItem('kucet_device_uuid');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('kucet_device_uuid', deviceId);
      }

      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });

      const { latitude, longitude, accuracy } = pos.coords;

      const res = await fetch('/api/student/attendance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: session.assignment_id,
          pin: pin,
          latitude,
          longitude,
          accuracy,
          device_id: deviceId
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verification failed');

      toast.success(json.message);
      onVerified();
    } catch (err) {
      let msg = err.message;
      if (err.code === 1) msg = 'Location access denied. Please enable GPS.';
      if (err.code === 3) msg = 'Location request timed out. Please retry.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-md bg-white p-3 flex flex-col md:flex-row items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">{session.subject_name}</div>
          <div className="text-xs text-gray-500">{session.subject_code} • {session.faculty_name}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          maxLength="4"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none"
        />
        <button
          onClick={handleVerify}
          disabled={submitting || pin.length !== 4}
          className="bg-[#0b3578] text-white px-3 py-1 rounded-md text-sm disabled:opacity-60"
        >
          {submitting ? 'Verifying...' : 'Mark Present'}
        </button>
      </div>
    </div>
  );
};

// Utility: derive subject metadata (kept isolated for future DB migration)
function getSubjectMeta(subjectName) {
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
  const [activeSessions, setActiveSessions] = useState([]);
  const [verifiedMessages, setVerifiedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historySubject, setHistorySubject] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('subjects');

  const { cache, saveCache, isReload } = useAcademicsCache() || {};

  const fetchActiveSessions = async (subjects) => {
    if (!subjects.length) return;
    try {
      const assignmentIds = subjects.map(s => s.assignment_id).join(',');
      const res = await fetch(`/api/student/attendance/active-sessions?ids=${assignmentIds}`);
      const json = await res.json();
      if (res.ok) {
        setActiveSessions(json.data || []);
        return json.data || [];
      }
    } catch (e) {
      console.error('Failed to fetch active sessions');
    }
    return [];
  };

  const onVerificationSuccess = (assignmentId, subjectName, attendanceDate) => {
    const today = attendanceDate || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    setVerifiedMessages(prev => {
      if (prev.find(m => m.id === assignmentId)) return prev;
      return [...prev, { id: assignmentId, text: `Your attendance for ${subjectName} has been successfully taken on ${today}.` }];
    });

    setActiveSessions(prev => prev.filter(s => s.assignment_id !== assignmentId));
    // refresh academic info after verification and update cache
    fetchAcademicInfo(true);
  };

  const fetchAcademicInfo = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // If we have cached payload and caller doesn't force refresh and this was not a full page reload, use cache
      const cached = cache?.payload;
      if (!forceRefresh && cached && !isReload) {
        setData(cached.data || []);
        setActiveSessions(cached.activeSessions || []);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/student/academic-info');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch academic info');
      const subjects = json.data || [];
      setData(subjects);
      const act = await fetchActiveSessions(subjects);
      // Save combined payload to session cache
      try { saveCache({ data: subjects, activeSessions: act }); } catch {}
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (subject) => {
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

  useEffect(() => { fetchAcademicInfo(false); }, []);

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
    } catch (e) {
      return null;
    }
  }

  const syllabusUrl = resolveSyllabusUrl(studentData, collegeInfo);

  return (
    <StudentProfileLayout>
      <Header />
      <Navbar role={'student'} activeTab={'academics'} />

      <main className="flex-1 px-6 py-4">
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
              <h2 className="text-sm font-semibold text-gray-800">Subjects Offered – Semester VI</h2>
              <p className="text-sm text-gray-600">Academic Year 2025–26</p>
            </div>

            <div>
              <table className="w-full table-auto">
                <thead className="bg-gray-100 text-sm font-medium text-gray-700">
                  <tr>
                    <th className="text-left py-2.5 px-2 text-xs sm:text-sm">Code</th>
                    <th className="text-left py-2.5 px-2 text-xs sm:text-sm">Subject Name</th>
                    <th className="text-left py-2.5 px-2 w-20 text-xs sm:text-sm">Type</th>
                    <th className="text-right py-2.5 px-2 w-16 text-xs sm:text-sm">Credits</th>
                    <th className="text-left py-2.5 px-2 text-xs sm:text-sm">Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((sub) => {
                    const meta = getSubjectMeta(sub.subject_name);
                    const code = sub.subject_code || '—';
                    return (
                      <tr key={sub.assignment_id} className="border-b">
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-800">{code}</td>
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 break-words">{sub.subject_name}</td>
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700">{meta.type}</td>
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{meta.credits}</td>
                        <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 break-words">{sub.faculty_name || '—'}</td>
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
                      <tr key={`att-${sub.assignment_id}`} className="border-b">
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
            <section className="border border-gray-300 rounded-md bg-white p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Internal Assessment Summary</h2>
              <p className="text-sm text-gray-600">Per-subject internals for current semester</p>
            </div>

            <div>
                <table className="w-full table-auto">
                <thead className="bg-gray-100 text-sm font-medium text-gray-700">
                  <tr>
                    <th className="text-left py-2.5 px-2">Subject</th>
                    <th className="text-right py-2.5 px-2 w-20">Mid I</th>
                    <th className="text-right py-2.5 px-2 w-20">Mid II</th>
                    <th className="text-right py-2.5 px-2 w-20">Assign</th>
                    <th className="text-right py-2.5 px-2 w-20">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((sub) => {
                    const isLab = sub.subject_type === 'lab';
                    const m1 = sub.mid1_marks !== null ? parseFloat(sub.mid1_marks) : null;
                    const m2 = sub.mid2_marks !== null ? parseFloat(sub.mid2_marks) : null;
                    const assgn = sub.assignment_marks !== null ? parseFloat(sub.assignment_marks) : 0;
                    let internalTotal = null;
                    if (isLab) internalTotal = (m1 ?? 0) + (m2 ?? 0) + (assgn ?? 0);
                    else if (m1 !== null || m2 !== null) internalTotal = Math.max(m1 ?? 0, m2 ?? 0) + assgn;
                    const short = deriveShortName(sub.subject_name) || sub.subject_code || '—';
                    return (
                      <tr key={`mark-${sub.assignment_id}`} className="border-b">
                          <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-800">{short}</td>
                          <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{m1 ?? '--'}</td>
                          <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{m2 ?? '--'}</td>
                          <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{assgn ?? '--'}</td>
                          <td className="py-2.5 px-2 text-xs sm:text-sm text-gray-700 text-right">{internalTotal !== null ? internalTotal.toFixed(1) : '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </StudentProfileLayout>
  );
}
