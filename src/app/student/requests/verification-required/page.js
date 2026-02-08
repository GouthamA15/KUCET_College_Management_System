"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
// No client-side routing for auth; server handles redirects

export default function VerificationRequiredPage() {
  const [studentStatus, setStudentStatus] = useState({ email: null, is_email_verified: false, password_hash: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch('/api/student/me');
        if (!meRes.ok) {
          return;
        }
        const { roll_no } = await meRes.json();
        const sRes = await fetch(`/api/student/${roll_no}`);
        if (!sRes.ok) {
          return;
        }
        const data = await sRes.json();
        const s = data?.student || {};
        setStudentStatus({
          email: s.email || null,
          is_email_verified: !!s.is_email_verified,
          password_hash: s.password_hash || null,
        });
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const emailStatus = studentStatus.email && studentStatus.is_email_verified ? 'Verified' : 'Not Verified';
  const passwordStatus = studentStatus.password_hash ? 'Set' : 'Not Set';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <Navbar studentProfileMode={true} isSubPage={true} activeTab="requests" onLogout={async () => { await fetch('/api/student/logout', { method: 'POST' }); window.location.replace('/'); }} />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="border border-gray-300 p-6 rounded-sm">
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
      </main>

      <Footer />
    </div>
  );
}
