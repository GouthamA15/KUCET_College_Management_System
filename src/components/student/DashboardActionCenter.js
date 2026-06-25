'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import useProfileActivity from '@/hooks/student/useProfileActivity';
import useActivityDismissal from '@/hooks/student/useActivityDismissal';
import { useStudent } from '@/context/StudentContext';
import toast from 'react-hot-toast';

const periodTimes = {
  1: { start: '09:30', end: '10:20' },
  2: { start: '10:20', end: '11:10' },
  3: { start: '11:20', end: '12:10' },
  4: { start: '12:10', end: '13:00' },
  5: { start: '14:00', end: '14:50' },
  6: { start: '14:50', end: '15:40' },
  7: { start: '15:40', end: '16:30' },
};

export default function DashboardActionCenter({ student }) {
  const activity = useProfileActivity();
  const { academicPerformance } = useStudent();
  const {
    latestRequest,
    scholarshipThumbUpdate,
    scholarshipHardcopyPending,
    scholarshipApplicationReceived,
    scholarshipApplicationsOpen,
  } = activity;

  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [pinByAssignment, setPinByAssignment] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [statusByAssignment, setStatusByAssignment] = useState({});
  const [deviceId, setDeviceId] = useState(null);
  const [activeActivity, setActiveActivity] = useState(null);

  // Fetch current lecture session (StudentActivityBar replacement for desktop)
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/student/current-activity');
      if (res.status === 401 || res.status === 403) return;
      const data = await res.json();
      if (res.ok && data.active) {
        setActiveActivity(data);
      } else {
        setActiveActivity(null);
      }
    } catch {
      // Silent
    }
  }, []);

  const fetchAttendanceSessions = useCallback(async () => {
    try {
      const assignmentIds = (academicPerformance || []).map((s) => s.assignment_id).filter(Boolean);
      if (!assignmentIds.length) {
        setAttendanceSessions([]);
        return;
      }

      const res = await fetch(`/api/student/attendance/active-sessions?ids=${assignmentIds.join(',')}`);
      if (res.status === 401 || res.status === 403) return;
      
      const json = await res.json();
      if (res.ok) {
        setAttendanceSessions(json.data || []);
      }
    } catch {
      // Silent
    }
  }, [academicPerformance]);

  useEffect(() => {
    const init = async () => {
      await fetchActivity();
      await fetchAttendanceSessions();
    };
    init();
  }, [fetchActivity, fetchAttendanceSessions]);

  useEffect(() => {
    const channel = new BroadcastChannel('kucet_sse_sync');
    channel.onmessage = (event) => {
      const data = event.data;
      if (data) {
        if (data.type === 'TIMETABLE_CHANGED') {
          fetchActivity();
        } else if (data.type === 'SESSION_STARTED' || data.type === 'SESSION_ENDED') {
          fetchAttendanceSessions();
        }
      }
    };
    return () => channel.close();
  }, [fetchActivity, fetchAttendanceSessions]);

  // Sync polling every 30 seconds for current class transitions
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  // Hydrate device ID from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const existing = localStorage.getItem('kucet_device_uuid');
        if (existing) {
          setDeviceId(existing);
          return;
        }

        if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
          const fallback = 'kucet_device_no_crypto';
          localStorage.setItem('kucet_device_uuid', fallback);
          setDeviceId(fallback);
          return;
        }

        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const created = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('kucet_device_uuid', created);
        setDeviceId(created);
      } catch {
        // ignore
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleChangePin = (assignmentId, value) => {
    const numeric = value.replace(/\D/g, '').slice(0, 4);
    setPinByAssignment(prev => ({ ...prev, [assignmentId]: numeric }));
    setStatusByAssignment(prev => {
      if (!prev[assignmentId]) return prev;
      const { [assignmentId]: _discard, ...rest } = prev;
      return rest;
    });
  };

  const handleVerify = async (session) => {
    const assignmentId = session.assignment_id;
    const pin = pinByAssignment[assignmentId] || '';

    if (pin.length !== 4) {
      toast.error('Enter the 4-digit PIN shown on faculty screen');
      return;
    }

    setSubmittingId(assignmentId);
    setStatusByAssignment((prev) => {
      const { [assignmentId]: _discard, ...rest } = prev;
      return rest;
    });
    try {
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        toast.error("GPS requires HTTPS on mobile. Please host on Render or use a laptop on 'localhost'.", { duration: 6000 });
        setSubmittingId(null);
        return;
      }

      const resolvedDeviceId = deviceId || localStorage.getItem('kucet_device_uuid');
      if (!resolvedDeviceId) {
        toast.error('Device ID not ready. Please retry.');
        setSubmittingId(null);
        return;
      }

      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude, accuracy } = pos.coords;

      if (accuracy > 100) {
        toast.error(`Location accuracy is too low (${Math.round(accuracy)}m). Please move near a window or outdoors for better GPS reception.`);
        setSubmittingId(null);
        return;
      }

      const res = await fetch('/api/student/attendance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          session_id: session.session_id,
          pin,
          latitude,
          longitude,
          accuracy,
          device_id: resolvedDeviceId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Verification failed');
      }

      toast.success(json.message || 'Attendance successfully marked.');
      setAttendanceSessions((prev) => prev.filter((s) => s.assignment_id !== assignmentId));
      
      const channel = new BroadcastChannel('kucet_sse_sync');
      channel.postMessage({ type: 'SESSION_ENDED' });
      channel.close();
    } catch (err) {
      let msg = err.message || 'Verification failed';
      if (err.code === 1) msg = 'Location access denied. Please enable GPS.';
      if (err.code === 3) msg = 'Location request timed out. Please retry.';
      toast.error(msg);
      setStatusByAssignment((prev) => ({
        ...prev,
        [assignmentId]: {
          tone: 'error',
          message: msg
        }
      }));
    } finally {
      setSubmittingId(null);
    }
  };

  const hasAttendanceSessions = attendanceSessions.length > 0;
  const scholarshipReceivedDismissal = useActivityDismissal('scholarship_received');

  const isScholarshipEligible = student?.fee_reimbursement === 'YES' || student?.fee_reimbursement === 'GOV';
  const showScholarshipThumb = isScholarshipEligible && !!scholarshipThumbUpdate?.active;
  const showScholarshipHardcopy = isScholarshipEligible && !!scholarshipHardcopyPending?.active;
  const showScholarshipApplicationReceived = isScholarshipEligible && !!scholarshipApplicationReceived?.active;
  const showScholarshipApplicationsOpen = isScholarshipEligible && !!scholarshipApplicationsOpen?.active;

  const showSecurityWarning = !!student && (!student.email || !student.is_email_verified || !student.password_hash);

  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return String(dateStr);
  };

  const hasMobileActions =
    showSecurityWarning ||
    showScholarshipThumb ||
    showScholarshipHardcopy ||
    (showScholarshipApplicationReceived && !scholarshipReceivedDismissal.dismissed) ||
    showScholarshipApplicationsOpen;

  const hasDesktopScholarship =
    showScholarshipHardcopy ||
    showScholarshipThumb ||
    (showScholarshipApplicationReceived && !scholarshipReceivedDismissal.dismissed) ||
    showScholarshipApplicationsOpen;

  const hasDesktopActions =
    !!activeActivity ||
    hasDesktopScholarship ||
    hasAttendanceSessions ||
    (latestRequest && latestRequest.status === 'Pending');

  let containerClass = "rounded-sm border border-[#0b3578] lg:border-slate-200 bg-white overflow-hidden";
  if (!hasMobileActions && !hasDesktopActions) {
    containerClass += " hidden";
  } else if (!hasMobileActions) {
    containerClass += " hidden lg:block";
  } else if (!hasDesktopActions) {
    containerClass += " lg:hidden";
  }

  return (
    <section className={containerClass}>
      <div className="bg-[#0b3578]/5 lg:bg-slate-50 px-4 py-2.5 border-b border-[#0b3578] lg:border-slate-200 flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-[#0b3578] lg:text-slate-500 uppercase tracking-[0.20em]">Priority Actions</h2>
      </div>

      {/* MOBILE ACTIONS VIEW (Locked & Unchanged Mobile Structure) */}
      <div className="lg:hidden p-4 space-y-3">
        {/* 1. Scholarship Hard Copies */}
        {showScholarshipHardcopy && (
          <div className="border border-indigo-100 bg-white rounded-sm overflow-hidden">
            <div className="border-l-4 border-indigo-400 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-sm bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 flex items-center justify-center">
                  <span className="text-sm" aria-hidden="true">📄</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">Submit Scholarship Hard Copies</div>
                  <div className="text-xs mt-1 text-slate-600">
                    Application No: <span className="font-bold">{scholarshipHardcopyPending.application_no || 'N/A'}</span>
                    {scholarshipHardcopyPending.academic_year && ` — Session: ${scholarshipHardcopyPending.academic_year}`}
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                    Submit documents at scholarship office.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Thumb Verification */}
        {showScholarshipThumb && (
          <div className="border border-purple-100 bg-white rounded-sm overflow-hidden">
            <div className="border-l-4 border-purple-400 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-sm bg-purple-50 text-purple-700 ring-1 ring-purple-100 flex items-center justify-center">
                  <span className="text-sm" aria-hidden="true">🔔</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">Scholarship Thumb Verification Required</div>
                  <div className="text-xs mt-1 text-slate-600">
                    Biometric verification required for App No: <span className="font-bold">{scholarshipThumbUpdate.application_no || 'N/A'}</span>
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-purple-700 uppercase tracking-widest">
                    Visit a Mee-Seva center to complete verification.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Scholarship Application Received */}
        {showScholarshipApplicationReceived && !scholarshipReceivedDismissal.dismissed && (
          <div
            className={
              'overflow-hidden transition-[max-height,opacity] duration-200 ease-out ' +
              (scholarshipReceivedDismissal.closing ? 'mt-0! max-h-0 opacity-0' : 'max-h-64 opacity-100')
            }
          >
            <div className="border border-emerald-100 bg-white rounded-sm overflow-hidden">
              <div className="border-l-4 border-emerald-400 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-sm bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 flex items-center justify-center">
                      <span className="text-sm" aria-hidden="true">✅</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">Scholarship Application Received</div>
                      <div className="text-xs mt-1 text-slate-600">
                        Documents submitted successfully. Awaiting verification updates.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={scholarshipReceivedDismissal.dismiss}
                    className="shrink-0 -mt-1 -mr-1 rounded-sm p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Scholarship Applications Open */}
        {showScholarshipApplicationsOpen && (
          <div className="border border-blue-100 bg-white rounded-sm overflow-hidden">
            <div className="border-l-0 sm:border-l-4 border-blue-400 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-sm bg-blue-50 text-blue-700 ring-1 ring-blue-100 flex items-center justify-center">
                    <span className="text-sm" aria-hidden="true">📅</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Scholarship Applications Open</div>
                    <div className="text-xs mt-1 text-slate-600">
                      Window: <span className="font-bold">{formatDateDDMMYYYY(scholarshipApplicationsOpen.startDate)}</span> — <span className="font-bold">{formatDateDDMMYYYY(scholarshipApplicationsOpen.endDate)}</span>
                    </div>
                  </div>
                </div>
                <Link
                  href="https://telanganaepass.cgg.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-[0.22em] rounded-sm hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all text-center"
                >
                  Apply Now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 5. Security Warning */}
        {showSecurityWarning && (
          <div className="border border-amber-100 bg-white rounded-sm overflow-hidden">
            <div className="border-l-4 border-amber-400 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-sm bg-amber-50 text-amber-700 ring-1 ring-amber-100 flex items-center justify-center">
                    <span className="text-sm" aria-hidden="true">⚠️</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">Account Security Required</div>
                    <div className="text-xs mt-1 text-slate-600">
                      {!student.email ? 'Email not added.' : !student.is_email_verified ? 'Email verification pending.' : 'Password not set.'} Complete setup to access all portal features.
                    </div>
                  </div>
                </div>
                <Link
                  href="/student/settings/security"
                  className="px-5 py-2 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-[0.22em] rounded-sm hover:bg-amber-600 hover:-translate-y-0.5 active:translate-y-0 transition-all text-center"
                >
                  Secure Account
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP ACTIONS VIEW (V2 Redesigned Flat Lightweight Layout) */}
      <div className="hidden lg:block divide-y divide-slate-100">
        
        {/* Priority 1: Current Running Class */}
        {activeActivity && (
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-sm bg-slate-50 text-[#0b3578] ring-1 ring-slate-100 flex items-center justify-center shrink-0">
              <span className="text-sm" aria-hidden="true">📚</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Current Running Class</div>
              <div className="text-xs font-bold text-slate-800 mt-1.5 uppercase truncate leading-none">
                {activeActivity.activity.subject_name}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 font-medium leading-tight">
                Room: {activeActivity.activity.room_no || 'TBD'} • Period {activeActivity.period} ({activeActivity.period ? `${periodTimes[activeActivity.period]?.start || ''} - ${periodTimes[activeActivity.period]?.end || ''}` : ''})
              </p>
              <Link 
                href="/student/timetable" 
                className="inline-block mt-2 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors"
              >
                View Timetable
              </Link>
            </div>
          </div>
        )}

        {/* Priority 2: Scholarship Applications (Dynamic Render) */}
        {showScholarshipHardcopy && (
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-sm bg-slate-50 text-indigo-700 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
              <span className="text-sm" aria-hidden="true">📄</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Scholarship Applications</div>
              <div className="text-xs font-bold text-slate-800 mt-1.5 leading-none">Submit Hard Copies</div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                Submit documents at scholarship office. App No: {scholarshipHardcopyPending.application_no || 'N/A'}
              </p>
            </div>
          </div>
        )}

        {showScholarshipThumb && (
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-sm bg-slate-50 text-purple-700 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
              <span className="text-sm" aria-hidden="true">🔔</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Scholarship Applications</div>
              <div className="text-xs font-bold text-slate-800 mt-1.5 leading-none">Thumb Verification Required</div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                Visit Mee-Seva center for biometric verification (App No: {scholarshipThumbUpdate.application_no || 'N/A'}).
              </p>
            </div>
          </div>
        )}

        {showScholarshipApplicationReceived && !scholarshipReceivedDismissal.dismissed && (
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-sm bg-slate-50 text-emerald-700 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
              <span className="text-sm" aria-hidden="true">✅</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Scholarship Applications</div>
              <div className="text-xs font-bold text-slate-800 mt-1.5 leading-none">Application Received</div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                Documents submitted successfully. Awaiting verification updates.
              </p>
              <button 
                type="button"
                onClick={scholarshipReceivedDismissal.dismiss} 
                className="mt-2 text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider transition-colors"
              >
                Dismiss Update
              </button>
            </div>
          </div>
        )}

        {showScholarshipApplicationsOpen && (
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-sm bg-slate-50 text-blue-700 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
              <span className="text-sm" aria-hidden="true">📅</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Scholarship Applications</div>
              <div className="text-xs font-bold text-slate-800 mt-1.5 leading-none">Applications Open</div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                Window: {formatDateDDMMYYYY(scholarshipApplicationsOpen.startDate)} — {formatDateDDMMYYYY(scholarshipApplicationsOpen.endDate)}
              </p>
              <Link
                href="https://telanganaepass.cgg.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors"
              >
                Apply Now
              </Link>
            </div>
          </div>
        )}

        {/* Priority 3: Attendance Verification PIN (Dynamic Render) */}
        {hasAttendanceSessions && attendanceSessions.map((session) => {
          const assignmentId = session.assignment_id;
          const pin = pinByAssignment[assignmentId] || '';
          const status = statusByAssignment[assignmentId];

          return (
            <div key={assignmentId} className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-sm bg-slate-50 text-blue-700 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
                <span className="text-sm" aria-hidden="true">🔑</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Attendance Verification</div>
                <div className="text-xs font-bold text-slate-800 mt-1.5 uppercase leading-none truncate">
                  {session.subject_name}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                  Faculty: {session.faculty_name || 'Faculty'} • Valid for current session
                </p>
                
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="PIN"
                    value={pin}
                    onChange={(e) => handleChangePin(assignmentId, e.target.value)}
                    className="w-16 rounded-sm border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold tracking-widest text-slate-850 placeholder:text-slate-350 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerify(session)}
                    disabled={submittingId === assignmentId || pin.length !== 4}
                    className="px-3 py-1 bg-[#0b3578] text-white text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-blue-700 disabled:opacity-65 transition"
                  >
                    {submittingId === assignmentId ? '...' : 'Verify'}
                  </button>
                </div>
                {status?.tone === 'error' && status?.message && (
                  <p className="text-[10px] text-rose-600 mt-2 font-semibold leading-tight">
                    {status.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Priority 4: Certificate Requests (Dynamic Render) */}
        {latestRequest && latestRequest.status === 'Pending' && (
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-sm bg-slate-50 text-amber-700 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
              <span className="text-sm" aria-hidden="true">⏳</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Certificate Request</div>
              <div className="text-xs font-bold text-slate-800 mt-1.5 uppercase leading-none truncate">
                {latestRequest.certificate_type}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                Pending approval.
              </p>
              <Link 
                href={`/student/requests/certificates?request_id=${latestRequest.request_id}&scroll=history`}
                className="inline-block mt-2 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        )}
      </div>

    </section>
  );
}
