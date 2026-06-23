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
          <table className="w-full border border-gray-300 text-sm">
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-2 font-medium text-gray-700">Email Status</td>
                <td className="px-4 py-2 text-gray-900">{emailStatus}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2 font-medium text-gray-700">Password Status</td>
                <td className="px-4 py-2 text-gray-900">{passwordStatus}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href="/student/settings/security" className="inline-flex items-center justify-center px-5 py-2.5 rounded-sm bg-blue-700 text-white font-medium hover:bg-blue-800">Go to Security & Privacy</a>
          <a href="/student/profile" className="inline-flex items-center justify-center px-5 py-2.5 rounded-sm bg-gray-200 text-gray-900 font-medium hover:bg-gray-300">Back to Profile</a>
        </div>
      </div>
    </div>
  );
}
