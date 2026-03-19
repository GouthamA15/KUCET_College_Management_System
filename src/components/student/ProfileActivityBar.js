'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AttendanceVerificationActivity from './AttendanceVerificationActivity';
import { isCapacitor, downloadToDevice } from '@/lib/capacitor-utils';

export default function ProfileActivityBar({ activity, student }) {
  const {
    latestRequest,
    dismissCount,
    incrementVisit,
    dismiss,
    reset,
    scholarshipThumbUpdate,
    scholarshipHardcopyPending,
    scholarshipApplicationReceived,
    scholarshipApplicationsOpen,
  } = activity || {};
  const [visible, setVisible] = useState(true);
  const processedRef = React.useRef(null);
  const isProd = typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true;

  const [attendanceSessions, setAttendanceSessions] = useState([]);

  const reqId = latestRequest?.request_id;
  const reqStatus = latestRequest?.status;

  // Handle visibility reset and increment logic for certificate requests
  useEffect(() => {
    if (!reqId) return;

    if (processedRef.current !== reqId) {
      const timer = setTimeout(() => setVisible(true), 0);

      const canIncrement = isProd ? dismissCount < 4 : true;
      if (canIncrement && typeof incrementVisit === 'function') {
        incrementVisit();
      }

      processedRef.current = reqId;
      return () => clearTimeout(timer);
    }
  }, [reqId, reqStatus, dismissCount, incrementVisit, isProd]);

  const fetchSessions = useCallback(async () => {
    if (!student) return;
    try {
      const res = await fetch('/api/student/academic-info');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch academic info');
      const subjects = json.data || [];
      const assignmentIds = subjects.map((s) => s.assignment_id).filter(Boolean);
      if (!assignmentIds.length) return;

      const res2 = await fetch(`/api/student/attendance/active-sessions?ids=${assignmentIds.join(',')}`);
      const json2 = await res2.json();
      if (!res2.ok) throw new Error(json2.error || 'Failed to fetch active attendance sessions');

      setAttendanceSessions(json2.data || []);
    } catch (error) {
      console.error('ProfileActivityBar Session Fetch Error:', error);
    }
  }, [student]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const channel = new BroadcastChannel('kucet_sse_sync');
    channel.onmessage = (event) => {
      const data = event.data;
      if (data && (data.type === 'SESSION_STARTED' || data.type === 'SESSION_ENDED')) {
        fetchSessions();
      }
    };
    return () => channel.close();
  }, [fetchSessions]);

  const hasAttendanceSessions = attendanceSessions.length > 0;

  const status = (latestRequest?.status || '').toUpperCase();
  const type = latestRequest?.certificate_type || latestRequest?.type || 'certificate';
  const id = latestRequest?.request_id || latestRequest?.requestId || latestRequest?.id;

  const handleDismiss = () => {
    setVisible(false);
    if (typeof dismiss === 'function') dismiss();
  };

  const handleReset = () => {
    if (typeof reset === 'function') reset();
  };

  const handleDownload = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/student/requests/download/${id}`, { method: 'GET', credentials: 'same-origin' });
      if (!res.ok) return;
      const blob = await res.blob();
      
      const filename = `${type}-${id}.pdf`;

      if (isCapacitor()) {
        await downloadToDevice(blob, filename, 'application/pdf');
        toast.success('Certificate downloaded successfully!');
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Download error:', e);
    }
  };

  const handleSessionVerified = (assignmentId) => {
    setAttendanceSessions((prev) => prev.filter((s) => s.assignment_id !== assignmentId));
  };

  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return String(dateStr);
  };

  const isScholarshipEligible = student?.fee_reimbursement === 'YES';

  const showRequestBar =
    !!latestRequest &&
    visible &&
    !(latestRequest && dismissCount >= 4 && isProd);

  const showLegacyWarning = !latestRequest && !!student && (!student.email || !student.is_email_verified || !student.password_hash);

  const showScholarshipThumb = isScholarshipEligible && !!scholarshipThumbUpdate?.active;
  const showScholarshipHardcopy = isScholarshipEligible && !!scholarshipHardcopyPending?.active;
  const showScholarshipApplicationReceived = isScholarshipEligible && !!scholarshipApplicationReceived?.active;
  const showScholarshipApplicationsOpen = isScholarshipEligible && !!scholarshipApplicationsOpen?.active;

  if (
    !hasAttendanceSessions &&
    !showLegacyWarning &&
    !showRequestBar &&
    !showScholarshipThumb &&
    !showScholarshipHardcopy &&
    !showScholarshipApplicationReceived &&
    !showScholarshipApplicationsOpen
  ) {
    return null;
  }

  return (
    <div className="w-full flex justify-center px-6 pt-4">
      <div className="w-full max-w-6xl space-y-3">
        {/* 1️⃣ Submit Hard Copies */}
        {showScholarshipHardcopy && (
          <div className="border border-indigo-200 bg-indigo-50 text-indigo-800 rounded-md p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <div className="font-semibold">📄 Submit Scholarship Hard Copies</div>
                <div className="text-sm mt-1">
                  You have applied for scholarship.
                  <div className="mt-1">
                    Application No: <span className="font-medium">{scholarshipHardcopyPending.application_no || 'N/A'}</span>
                    {scholarshipHardcopyPending.academic_year ? (
                      <span> — Academic Year: <span className="font-medium">{scholarshipHardcopyPending.academic_year}</span></span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-indigo-700">
                    Please submit your required documents in the scholarship office.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2️⃣ Thumb Verification Required */}
        {scholarshipThumbUpdate?.active && (
          <div className="border border-purple-200 bg-purple-50 text-purple-800 rounded-md p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <div className="font-semibold">🔔 Scholarship Thumb Verification Required</div>
                <div className="text-sm mt-1">
                  Your scholarship requires biometric verification. Application No: <span className="font-medium">{scholarshipThumbUpdate.application_no || 'N/A'}</span>
                  {scholarshipThumbUpdate.academic_year ? (
                    <span> — Academic Year: <span className="font-medium">{scholarshipThumbUpdate.academic_year}</span></span>
                  ) : null}
                  <div className="mt-1 text-xs text-purple-700">
                    Please visit the nearest Mee-Seva center to complete thumb verification.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* <Link href="/student/profile" className="text-sm text-purple-700 hover:underline">
                  View Details
                </Link> */}
              </div>
            </div>
          </div>
        )}

        {/* 3️⃣ Scholarship Application Received */}
        {showScholarshipApplicationReceived && (
          <div className="border border-green-200 bg-green-50 text-green-800 rounded-md p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                <div className="font-semibold">✅ Scholarship Application Received</div>
                <div className="text-sm mt-1">
                  Your scholarship application documents have been submitted successfully.
                  <div className="mt-1 text-xs text-green-900">
                    Please wait for government verification updates.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4️⃣ Scholarship Applications Open */}
        {showScholarshipApplicationsOpen && (
          <div className="border border-blue-200 bg-blue-50 text-blue-800 rounded-md p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <div className="font-semibold">📅 Scholarship Applications Open</div>
                <div className="text-sm mt-1">
                  <div className="mt-1">
                    Apply online and submit your documents in the scholarship office.
                  </div>
                  <div className="mt-2 text-xs text-blue-900">
                    Submission Window: <span className="font-medium">{formatDateDDMMYYYY(scholarshipApplicationsOpen.startDate)}</span> — <span className="font-medium">{formatDateDDMMYYYY(scholarshipApplicationsOpen.endDate)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <Link
                  href="https://telanganaepass.cgg.gov.in//epassonlinelinks.do"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-blue-700 hover:underline"
                >
                  Apply Now
                </Link>
              </div>
            </div>
          </div>
        )}

        {showLegacyWarning && (
          <div className="border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-md p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm">
                {!student.email && (
                  <span>⚠️ Email not added. Please set your email and password to use portal features.</span>
                )}
                {student.email && !student.is_email_verified && (
                  <span>⚠️ Email verification required. Please verify your email to use portal features.</span>
                )}
                {!student.password_hash && student.email && student.is_email_verified && (
                  <span>⚠️ Password not set. Please set a password to continue.</span>
                )}
              </div>
              <Link
                href="/student/settings/security"
                className="inline-flex items-center text-sm font-semibold text-blue-700 hover:underline"
              >
                Go to Security &amp; Privacy
              </Link>
            </div>
          </div>
        )}

        {/* 5️⃣ Certificate Notifications */}
        {showRequestBar && (
          <div
            className={
              status === 'APPROVED'
                ? 'border border-green-200 bg-green-50 text-green-800 rounded-md p-3'
                : status === 'REJECTED'
                ? 'border border-red-200 bg-red-50 text-red-800 rounded-md p-3'
                : 'border border-blue-200 bg-blue-50 text-blue-800 rounded-md p-3'
            }
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                {status === 'APPROVED' && (
                  <>
                    Your {type} request is <span className="font-semibold">approved</span>.
                  </>
                )}
                {status === 'REJECTED' && (
                  <>
                    Your {type} request was <span className="font-semibold">rejected</span>. You may view details or
                    re-apply.
                  </>
                )}
                {status !== 'APPROVED' && status !== 'REJECTED' && (
                  <>
                    Your {type} request is <span className="font-semibold">pending</span>. We&apos;ll notify you when
                    it&apos;s processed.
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/student/requests/certificates?request_id=${encodeURIComponent(
                    id || ''
                  )}&scroll=history`}
                  className="text-sm text-blue-700 hover:underline"
                >
                  View Details
                </Link>
                <button onClick={handleDismiss} className="ml-2 text-sm text-gray-600">
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6️⃣ Attendance Warnings */}
        {hasAttendanceSessions && (
          <AttendanceVerificationActivity
            sessions={attendanceSessions}
            onSessionVerified={handleSessionVerified}
          />
        )}
      </div>
    </div>
  );
}

