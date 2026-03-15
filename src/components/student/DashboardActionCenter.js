'use client';

import React from 'react';
import Link from 'next/link';
import useProfileActivity from '@/components/student/hooks/useProfileActivity';

export default function DashboardActionCenter({ student }) {
  const activity = useProfileActivity();
  const {
    scholarshipThumbUpdate,
    scholarshipHardcopyPending,
    scholarshipApplicationReceived,
    scholarshipApplicationsOpen
  } = activity;

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
    !showScholarshipApplicationReceived &&
    !showScholarshipApplicationsOpen
  ) {
    return null;
  }

  return (
    <section className="space-y-4 px-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Priority Actions</h2>
      </div>

      <div className="space-y-3">
        {/* 1. Scholarship Hard Copies */}
        {showScholarshipHardcopy && (
          <div className="border border-indigo-200 bg-indigo-50 text-indigo-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">📄</span>
                <div className="text-sm">
                  <div className="font-bold">Submit Scholarship Hard Copies</div>
                  <div className="text-xs mt-1 opacity-80">
                    Application No: <span className="font-bold">{scholarshipHardcopyPending.application_no || 'N/A'}</span>
                    {scholarshipHardcopyPending.academic_year && ` — Session: ${scholarshipHardcopyPending.academic_year}`}
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-indigo-700 uppercase tracking-tight">
                    Please submit documents at the scholarship office immediately.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Thumb Verification */}
        {showScholarshipThumb && (
          <div className="border border-purple-200 bg-purple-50 text-purple-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">🔔</span>
                <div className="text-sm">
                  <div className="font-bold">Scholarship Thumb Verification Required</div>
                  <div className="text-xs mt-1 opacity-80">
                    Your scholarship requires biometric verification for App No: <span className="font-bold">{scholarshipThumbUpdate.application_no || 'N/A'}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-purple-600 uppercase tracking-tight">
                    Visit the nearest Mee-Seva center to complete verification.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Scholarship Application Received */}
        {showScholarshipApplicationReceived && (
          <div className="border border-green-200 bg-green-50 text-green-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-lg">✅</span>
              <div className="text-sm">
                <div className="font-bold">Scholarship Application Received</div>
                <div className="text-xs mt-1 opacity-80">
                  Documents submitted successfully. Awaiting government verification updates.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Scholarship Applications Open */}
        {showScholarshipApplicationsOpen && (
          <div className="border border-blue-200 bg-blue-50 text-blue-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">📅</span>
                <div className="text-sm">
                  <div className="font-bold">Scholarship Applications Open</div>
                  <div className="text-xs mt-1 opacity-80">
                    Submission Window: <span className="font-bold">{formatDateDDMMYYYY(scholarshipApplicationsOpen.startDate)}</span> — <span className="font-bold">{formatDateDDMMYYYY(scholarshipApplicationsOpen.endDate)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <Link
                  href="https://telanganaepass.cgg.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all"
                >
                  Apply Now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 5. Security Warning */}
        {showSecurityWarning && (
          <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div className="text-sm">
                  <div className="font-bold">Account Security Required</div>
                  <div className="text-xs mt-1 opacity-80">
                    {!student.email ? 'Email not added.' : !student.is_email_verified ? 'Email verification pending.' : 'Password not set.'} 
                    Complete setup to access all portal features.
                  </div>
                </div>
              </div>
              <Link
                href="/student/settings/security"
                className="px-4 py-1.5 bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-amber-700 transition-all text-center"
              >
                Secure Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}