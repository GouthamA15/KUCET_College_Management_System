'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import useProfileActivity from '@/hooks/student/hooks/useProfileActivity';
import useActivityDismissal from '@/hooks/student/hooks/useActivityDismissal';
import { useStudent } from '@/context/StudentContext';

export default function DashboardActionCenter({ student }) {
  const activity = useProfileActivity();
  const { academicPerformance } = useStudent();
  const {
    scholarshipThumbUpdate,
    scholarshipHardcopyPending,
    scholarshipApplicationReceived,
    scholarshipApplicationsOpen
  } = activity;

  const [attendanceSessions, setAttendanceSessions] = useState([]);

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
    } catch (e) {
      // Silent
    }
  }, [academicPerformance]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAttendanceSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAttendanceSessions]);

  useEffect(() => {
    const channel = new BroadcastChannel('kucet_sse_sync');
    channel.onmessage = (event) => {
      const data = event.data;
      if (data && (data.type === 'SESSION_STARTED' || data.type === 'SESSION_ENDED')) {
        fetchAttendanceSessions();
      }
    };
    return () => channel.close();
  }, [fetchAttendanceSessions]);

  const handleSessionVerified = (assignmentId) => {
    setAttendanceSessions((prev) => prev.filter((s) => s.assignment_id !== assignmentId));
  };

  const hasAttendanceSessions = attendanceSessions.length > 0;

  const scholarshipReceivedDismissal = useActivityDismissal('scholarship_received');

  const isScholarshipEligible = student?.fee_reimbursement === 'YES';
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

  if (
    !showSecurityWarning &&
    !showScholarshipThumb &&
    !showScholarshipHardcopy &&
    !(showScholarshipApplicationReceived && !scholarshipReceivedDismissal.dismissed) &&
    !showScholarshipApplicationsOpen
  ) {
    return null;
  }

  return (
    <section className="rounded-[18px] border border-white/70 bg-white/55 backdrop-blur-xl shadow-[0_14px_46px_rgba(15,23,42,0.08)] overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100/70 flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.22em]">Priority Actions</h2>
          <p className="text-xs text-slate-500 mt-1">Important updates that need your attention.</p>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        {/* 1. Scholarship Hard Copies */}
        {showScholarshipHardcopy && (
          <div className="border border-indigo-200/70 bg-white/70 rounded-[16px] overflow-hidden">
            <div className="border-l-4 border-indigo-400 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 flex items-center justify-center">
                  <span className="text-sm" aria-hidden="true">📄</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900">Submit Scholarship Hard Copies</div>
                  <div className="text-xs mt-1 text-slate-600">
                    Application No: <span className="font-extrabold">{scholarshipHardcopyPending.application_no || 'N/A'}</span>
                    {scholarshipHardcopyPending.academic_year && ` — Session: ${scholarshipHardcopyPending.academic_year}`}
                  </div>
                  <div className="mt-2 text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest">
                    Submit documents at scholarship office.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Thumb Verification */}
        {showScholarshipThumb && (
          <div className="border border-purple-200/70 bg-white/70 rounded-[16px] overflow-hidden">
            <div className="border-l-4 border-purple-400 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-purple-50 text-purple-700 ring-1 ring-purple-100 flex items-center justify-center">
                  <span className="text-sm" aria-hidden="true">🔔</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900">Scholarship Thumb Verification Required</div>
                  <div className="text-xs mt-1 text-slate-600">
                    Biometric verification required for App No: <span className="font-extrabold">{scholarshipThumbUpdate.application_no || 'N/A'}</span>
                  </div>
                  <div className="mt-2 text-[10px] font-extrabold text-purple-700 uppercase tracking-widest">
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
            <div className="border border-emerald-200/70 bg-white/70 rounded-[16px] overflow-hidden">
              <div className="border-l-4 border-emerald-400 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 flex items-center justify-center">
                      <span className="text-sm" aria-hidden="true">✅</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900">Scholarship Application Received</div>
                      <div className="text-xs mt-1 text-slate-600">
                        Documents submitted successfully. Awaiting verification updates.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={scholarshipReceivedDismissal.dismiss}
                    className="shrink-0 -mt-1 -mr-1 rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
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
          <div className="border border-blue-200/70 bg-white/70 rounded-[16px] overflow-hidden">
            <div className="border-l-4 border-blue-400 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[14px] bg-blue-50 text-blue-700 ring-1 ring-blue-100 flex items-center justify-center">
                    <span className="text-sm" aria-hidden="true">📅</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Scholarship Applications Open</div>
                    <div className="text-xs mt-1 text-slate-600">
                      Window: <span className="font-extrabold">{formatDateDDMMYYYY(scholarshipApplicationsOpen.startDate)}</span> — <span className="font-extrabold">{formatDateDDMMYYYY(scholarshipApplicationsOpen.endDate)}</span>
                    </div>
                  </div>
                </div>
                <Link
                  href="https://telanganaepass.cgg.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#2563EB] text-white text-[10px] font-extrabold uppercase tracking-[0.22em] rounded-[14px] hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all text-center shadow-[0_10px_26px_rgba(37,99,235,0.28)]"
                >
                  Apply Now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 5. Security Warning */}
        {showSecurityWarning && (
          <div className="border border-amber-200/70 bg-white/70 rounded-[16px] overflow-hidden">
            <div className="border-l-4 border-amber-400 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[14px] bg-amber-50 text-amber-700 ring-1 ring-amber-100 flex items-center justify-center">
                    <span className="text-sm" aria-hidden="true">⚠️</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900">Account Security Required</div>
                    <div className="text-xs mt-1 text-slate-600">
                      {!student.email ? 'Email not added.' : !student.is_email_verified ? 'Email verification pending.' : 'Password not set.'} Complete setup to access all portal features.
                    </div>
                  </div>
                </div>
                <Link
                  href="/student/settings/security"
                  className="px-5 py-2.5 bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-[0.22em] rounded-[14px] hover:bg-amber-600 hover:-translate-y-0.5 active:translate-y-0 transition-all text-center shadow-[0_10px_26px_rgba(245,158,11,0.25)]"
                >
                  Secure Account
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
