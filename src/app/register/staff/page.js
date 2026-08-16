'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { FACULTY_BRANCHES } from '@/lib/staff-config';

export default function StaffRegistrationPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    employee_id: '',
    staff_category: 'FACULTY',
    branch: 'CSE',
    mobile: ''
  });
  const [loading, setLoading] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmittedSuccess(null);
    const toastId = toast.loading('Submitting staff registration request...');

    try {
      const res = await fetch('/api/auth/clerk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Registration request submitted successfully!', { id: toastId });
        setSubmittedSuccess(data.message || 'Your registration request has been submitted and is awaiting administrator approval.');
        setForm({
          name: '',
          email: '',
          employee_id: '',
          staff_category: 'FACULTY',
          branch: 'CSE',
          mobile: ''
        });
      } else {
        toast.error(data.error || 'Registration request failed', { id: toastId });
      }
    } catch (_err) {
      toast.error('Network error submitting request. Please try again.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Header Banner */}
      <header className="bg-[#0b3578] text-white border-b-4 border-amber-400 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="assets\ku-college-logo.png"
              alt="KUCET Emblem"
              width={56}
              height={56}
              className="w-14 h-14 object-contain bg-white rounded-full p-1"
            />
            <div>
              <h1 className="text-lg md:text-xl font-extrabold uppercase tracking-tight">
                {COLLEGE_CONFIG.shortName} Staff Onboarding Portal
              </h1>
              <p className="text-xs text-blue-200">
                {COLLEGE_CONFIG.name} — {COLLEGE_CONFIG.location}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded hover:bg-amber-300 transition-colors shadow-sm"
          >
            &larr; Back to Portal Login
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Onboarding Roadmap */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <h2 className="text-sm font-bold uppercase text-[#0b3578] mb-3 tracking-wide">
            Staff Account Provisioning Workflow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded">
              <span className="font-bold text-[#0b3578] block mb-1">1. Submit Request</span>
              Fill out your employee identification details & category.
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded">
              <span className="font-bold text-amber-900 block mb-1">2. Admin Verification</span>
              Super Admin verifies your credentials with HR records.
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded">
              <span className="font-bold text-emerald-900 block mb-1">3. Credential Dispatch</span>
              Temp credentials are sent directly to your official email.
            </div>
            <div className="bg-cyan-50 border border-cyan-200 p-3 rounded">
              <span className="font-bold text-cyan-900 block mb-1">4. First Login Reset</span>
              Change temporary password on initial login to activate account.
            </div>
          </div>
        </div>

        {/* Success Notice */}
        {submittedSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-5 rounded-lg shadow-xs space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span>✅</span> Registration Request Submitted Successfully!
            </h3>
            <p className="text-xs leading-relaxed">{submittedSuccess}</p>
            <div className="pt-2">
              <Link href="/" className="text-xs font-bold text-[#0b3578] hover:underline">
                Return to Login Page &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Registration Form Card */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 sm:p-8">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
              Institutional Staff Registration Form
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Please enter your accurate institutional details. Account credentials will be issued after administrative review.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name (As per Records) *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dr. K. Ramesh"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0b3578]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Employee ID *</label>
                <input
                  type="text"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value.toUpperCase() })}
                  placeholder="EMP1024"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs uppercase font-mono focus:ring-2 focus:ring-[#0b3578]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Staff Category *</label>
                <select
                  value={form.staff_category}
                  onChange={(e) => setForm({
                    ...form,
                    staff_category: e.target.value,
                    branch: e.target.value === 'FACULTY' ? (form.branch || 'CSE') : ''
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-[#0b3578]"
                  required
                >
                  <option value="FACULTY">Faculty (Academic Teaching Staff)</option>
                  <option value="SCHOLARSHIP_CLERK">Scholarship Clerk (Financial & Sanction Ledgers)</option>
                  <option value="ADMISSION_CLERK">Admission Clerk (Student Enrollment & Admissions)</option>
                </select>
              </div>

              {form.staff_category === 'FACULTY' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Associated Academic Branch *</label>
                  <select
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white font-semibold text-[#0b3578] focus:ring-2 focus:ring-[#0b3578]"
                    required
                  >
                    {FACULTY_BRANCHES.map(b => (
                      <option key={b} value={b}>{b} Branch</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center">
                  <p className="text-xs text-slate-400 italic">Branch assignment not applicable for administrative clerks.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Institutional Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staff@kucet.ac.in"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0b3578]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Contact Number (Optional)</label>
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Link href="/" className="text-xs text-slate-600 hover:text-slate-900 font-medium">
                &larr; Return to Login
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0b3578] text-white px-6 py-2.5 rounded font-bold text-xs hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Submitting Request...' : 'Submit Registration Request'}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 text-center border-t border-slate-800">
        &copy; {new Date().getFullYear()} {COLLEGE_CONFIG.name}. All Rights Reserved.
      </footer>
    </div>
  );
}
