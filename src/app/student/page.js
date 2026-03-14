// arai moddus, this page is only for uzair's reference for refactoring the student home page to be more of a dashboard with quick insights and links, rather than just redirecting to profile and is NOT finalized. The actual profile page will be more detailed and focused on profile info, while this home/dashboard page will give a snapshot of key info and quick access to important sections.
//so do not do not delete ts or do any sort of moddala panulu
'use client';

import React from 'react';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useStudent } from '@/context/StudentContext';
import Link from 'next/link';
import { getBranchFromRoll, getBatchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import useFinancialRows from '@/components/student/useFinancialRows';

const formatCurrency = (amount) => {
  if (amount == null || Number.isNaN(Number(amount))) return '₹0';
  return `₹ ${Number(amount).toLocaleString('en-IN')}`;
};

export default function StudentHomePage() {
  const { studentData, loading: contextLoading, refreshData } = useStudent();

  const student = studentData?.student || null;

  const branch = student ? getBranchFromRoll(student.roll_no) : null;
  const batch = student ? getBatchFromRoll(student.roll_no) : null;
  const { yearOfStudy, semester, semesterLabel } = student ? calculateYearAndSemester(student.roll_no, studentData?.collegeInfo) : { yearOfStudy: null, semester: null, semesterLabel: '' };
  const academicYear = student ? getResolvedCurrentAcademicYear(student.roll_no, studentData?.collegeInfo) : null;

  const scholarshipList = studentData?.scholarship || [];
  const feeRecords = studentData?.fees || [];

  const { rows = [], yearlyTotalFee = 0 } = useFinancialRows(student?.roll_no, scholarshipList, feeRecords, branch);

  const totalScholarship = scholarshipList.reduce((s, item) => s + Number(item.amount_disbursed ?? item.amount_sanctioned ?? 0), 0);
  const totalPaid = feeRecords.reduce((s, item) => s + Number(item.amount || 0), 0);
  const pendingFee = rows.reduce((s, row) => s + Number(row.pending_fee || 0), 0);

  const latestRequest = studentData?.latestProfileRequest || studentData?.certificateRequests?.[0] || null;

  if (contextLoading && !student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-6 shadow-sm text-gray-700">Loading your student dashboard...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm w-full max-w-md text-center">
          <h2 className="text-2xl font-semibold text-slate-800">Student Dashboard</h2>
          <p className="mt-3 text-slate-600">No student profile found. Please login again to access your student home.</p>
          <Link href="/" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar
        role={'student'}
        activeTab={'profile'}
        onLogout={async () => {
          await fetch('/api/student/logout', { method: 'POST' });
          localStorage.removeItem('logged_in_student');
          sessionStorage.clear();
          window.location.replace('/');
        }}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto p-6 space-y-6">
        <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-100 via-white to-cyan-100 p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-blue-900">Welcome back, {student.name || student.full_name || student.roll_no}!</h1>
          <p className="mt-2 text-blue-800">You’re on track for an amazing academic year. Here’s a quick snapshot based on your profile.</p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs uppercase font-semibold text-blue-600">Branch</p>
              <span className="text-xl font-semibold text-blue-900">{branch || 'N/A'}</span>
            </article>
            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs uppercase font-semibold text-blue-600">Batch</p>
              <span className="text-xl font-semibold text-blue-900">{batch || 'Unknown'}</span>
            </article>
            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs uppercase font-semibold text-blue-600">Year / Semester</p>
              <span className="text-xl font-semibold text-blue-900">{yearOfStudy || '-' } / {semester || '-'}{semesterLabel ? ` (${semesterLabel})` : ''}</span>
            </article>
            <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs uppercase font-semibold text-blue-600">Academic Year</p>
              <span className="text-xl font-semibold text-blue-900">{academicYear || 'Not available'}</span>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-900">Financial Health</h2>
            <p className="text-sm text-slate-500">Based on fee records and scholarships.</p>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Total Fee Target</p>
              <p className="text-2xl font-semibold text-slate-800">{formatCurrency(yearlyTotalFee)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Scholarship Received</p>
              <p className="text-2xl font-semibold text-emerald-700">{formatCurrency(totalScholarship)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500">Pending Fee</p>
              <p className={`text-2xl font-semibold ${pendingFee > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatCurrency(pendingFee)}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gray-100 bg-indigo-50 p-4 text-indigo-900">
            <p className="text-sm">Good job! You have paid {formatCurrency(totalPaid)} so far.</p>
            <p className="text-xs text-indigo-700 mt-1">A little update every week helps you stay ahead of your dues.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Latest Activity</h2>
          <p className="text-sm text-slate-500 mt-1">Things to check and actions you can take.</p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Profile status:</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{student.is_email_verified ? 'Email verified' : 'Email not verified'}</p>
              {!student.is_email_verified && (
                <p className="mt-1 text-xs text-rose-600">Please verify your email in <Link href="/student/settings/security" className="text-sky-600 underline">Security & Privacy</Link>.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Latest request</p>
              <p className="mt-1 text-lg text-slate-900">{latestRequest ? `${latestRequest.certificate_type || latestRequest.type || 'Request'} — ${latestRequest.status || 'Status Unknown'}` : 'No active requests'}</p>
              {latestRequest ? <p className="mt-1 text-xs text-slate-500">Updated {latestRequest.updated_at ? new Date(latestRequest.updated_at).toLocaleDateString() : 'recently'}.</p> : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/student/profile" className="rounded-lg border border-indigo-300 bg-indigo-100 px-4 py-2 text-indigo-700 hover:bg-indigo-200">View Full Profile</Link>
            <Link href="/student/academics" className="rounded-lg border border-emerald-300 bg-emerald-100 px-4 py-2 text-emerald-700 hover:bg-emerald-200">Academic Progress</Link>
            <Link href="/student/requests/certificates" className="rounded-lg border border-blue-300 bg-blue-100 px-4 py-2 text-blue-700 hover:bg-blue-200">Requests & Certificates</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
