"use client";

import { useStudent } from '@/context/StudentContext';
// No client-side routing for auth; server handles redirects

export default function VerificationRequiredPage() {
  const { studentData, _loading } = useStudent();
  const s = studentData?.student || { /* empty */ };
  const studentStatus = {
    email: s.email || null,
    is_email_verified: !!s.is_email_verified,
    password_hash: s.password_hash || null,
  };

  const emailStatus = studentStatus.email && studentStatus.is_email_verified ? 'Verified' : 'Not Verified';
  const passwordStatus = studentStatus.password_hash ? 'Set' : 'Not Set';

  return (
    <div className="max-w-5xl mx-auto py-10">
      <div className="border border-gray-300 p-6 rounded-sm bg-white">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Verification Required</h1>
        <p className="mt-2 text-gray-800">You must verify your email and set a password before requesting certificates.</p>

        <div className="mt-6">
          <div className="flex flex-col gap-3 border border-gray-200 rounded-sm p-4 bg-gray-50">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="font-medium text-gray-700 text-sm">Email Status</span>
              <span className="text-gray-900 font-semibold text-sm">{emailStatus}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-medium text-gray-700 text-sm">Password Status</span>
              <span className="text-gray-900 font-semibold text-sm">{passwordStatus}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href="/student/settings/security" className="inline-flex items-center justify-center px-5 py-2.5 rounded-sm bg-blue-700 text-white font-medium hover:bg-blue-800">Go to Security & Privacy</a>
          <a href="/student/profile" className="inline-flex items-center justify-center px-5 py-2.5 rounded-sm bg-gray-200 text-gray-900 font-medium hover:bg-gray-300">Back to Profile</a>
        </div>
      </div>
    </div>
  );
}
