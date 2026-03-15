// src/app/student/page.js
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
  const { studentData, latestCertificateRequest, loading: contextLoading } = useStudent();

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

  const latestRequest = studentData?.latestProfileRequest || latestCertificateRequest || studentData?.certificateRequests?.[0] || null;
  const isVerified = !!(student?.is_email_verified && !!student?.password_hash);

  if (contextLoading && !student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-slate-600 font-medium animate-pulse text-lg">Synchronizing with central database...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="rounded-lg border border-slate-300 bg-white p-8 shadow-sm w-full max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-4">UNAUTHORIZED ACCESS</h2>
          <p className="mt-4 text-slate-600">No student profile session found. Your credentials could not be verified.</p>
          <Link href="/" className="mt-6 inline-block w-full rounded bg-[#0b3578] px-4 py-2.5 text-white font-semibold hover:bg-blue-900 transition-colors uppercase tracking-wider text-sm">Return to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header />
      <Navbar
        role={'student'}
        activeTab={'home'}
        onLogout={async () => {
          await fetch('/api/student/logout', { method: 'POST' });
          localStorage.removeItem('logged_in_student');
          sessionStorage.clear();
          window.location.replace('/');
        }}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        {/* Unified Institutional Dashboard Card */}
        <div className="bg-white border border-slate-300 shadow-md rounded-sm overflow-hidden">
          
          {/* Header Section */}
          <div className="bg-[#0b3578] px-6 py-4 border-b border-blue-900">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tight">Student Dashboard</h1>
                <p className="text-blue-100 text-sm mt-1">Official Academic & Administrative Information System</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isVerified ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'}`}>
                  {isVerified ? '● Verified Account' : '● Verification Pending'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            
            {/* 1. Academic Identification Section */}
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Student Identification</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm">
                  <span className="block text-[10px] font-black text-slate-400 uppercase">Full Name</span>
                  <span className="text-lg font-bold text-slate-800">{student.name || student.full_name}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm">
                  <span className="block text-[10px] font-black text-slate-400 uppercase">Permanent Roll No</span>
                  <span className="text-lg font-bold text-slate-800">{student.roll_no}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm">
                  <span className="block text-[10px] font-black text-slate-400 uppercase">Department / Branch</span>
                  <span className="text-lg font-bold text-slate-800">{branch || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm">
                  <span className="block text-[10px] font-black text-slate-400 uppercase">Current Academic Period</span>
                  <span className="text-lg font-bold text-slate-800">
                    {yearOfStudy ? `Year ${yearOfStudy}` : 'N/A'} / {semester ? `Semester ${semester}` : 'N/A'}
                  </span>
                </div>
              </div>
            </section>

            {/* 2. Financial & Academic Status Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Financial Records */}
              <section className="border border-slate-200 rounded-sm">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-600 uppercase">Financial Summary ({academicYear || 'Current'})</h3>
                </div>
                {isVerified ? (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-l-4 border-slate-400 pl-3">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Total Fee Target</span>
                        <p className="text-xl font-bold">{formatCurrency(yearlyTotalFee)}</p>
                      </div>
                      <div className="border-l-4 border-emerald-500 pl-3">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Scholarships</span>
                        <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalScholarship)}</p>
                      </div>
                      <div className="border-l-4 border-indigo-500 pl-3">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Amount Paid</span>
                        <p className="text-xl font-bold text-indigo-700">{formatCurrency(totalPaid)}</p>
                      </div>
                      <div className={`border-l-4 ${pendingFee > 0 ? 'border-rose-500' : 'border-emerald-500'} pl-3`}>
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Outstanding Dues</span>
                        <p className={`text-xl font-bold ${pendingFee > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatCurrency(pendingFee)}</p>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-3 text-[11px] text-blue-800 rounded-sm italic">
                      Disclaimer: Financial records are subject to manual verification by the administrative office.
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-slate-400 text-xs italic uppercase tracking-wider">Verification required to view financial data</p>
                  </div>
                )}
              </section>

              {/* Administrative Activity */}
              <section className="border border-slate-200 rounded-sm">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-600 uppercase">Administrative Activity</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Account Verification Status</span>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className={student.is_email_verified ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                          {student.is_email_verified ? '✓ EMAIL VERIFIED' : '✗ EMAIL NOT VERIFIED'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={student.password_hash ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                          {student.password_hash ? '✓ PASSWORD CONFIGURED' : '✗ PASSWORD NOT CONFIGURED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isVerified && latestRequest && (
                    <div className="pt-4 border-t border-slate-100">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Recent Request status</span>
                      <p className="text-sm font-bold mt-1 text-slate-800">
                        {latestRequest.certificate_type || latestRequest.type || 'Request'} — 
                        <span className="text-[#0b3578] ml-1 uppercase">{latestRequest.status || 'PROCESSED'}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 italic">
                        Last system update: {latestRequest.updated_at ? new Date(latestRequest.updated_at).toLocaleDateString() : 'recently'}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* 3. Action Portal Section */}
            <section className="pt-4 border-t border-slate-200">
              <div className="flex flex-wrap gap-4">
                {isVerified ? (
                  <>
                    <Link href="/student/profile" className="flex-1 min-w-[180px] bg-white border border-slate-300 text-slate-700 py-3 px-4 rounded-sm text-xs font-bold uppercase tracking-widest text-center hover:bg-slate-50 transition-all">
                      Access Profile Records
                    </Link>
                    <Link href="/student/academics" className="flex-1 min-w-[180px] bg-white border border-slate-300 text-slate-700 py-3 px-4 rounded-sm text-xs font-bold uppercase tracking-widest text-center hover:bg-slate-50 transition-all">
                      Academic Performance
                    </Link>
                    <Link href="/student/requests/certificates" className="flex-1 min-w-[180px] bg-white border border-slate-300 text-slate-700 py-3 px-4 rounded-sm text-xs font-bold uppercase tracking-widest text-center hover:bg-slate-50 transition-all">
                      Certificate Portal
                    </Link>
                  </>
                ) : (
                  <Link href="/student/settings/security" className="w-full bg-[#0b3578] text-white py-4 px-6 rounded-sm text-sm font-bold uppercase tracking-widest text-center hover:bg-blue-900 transition-all shadow-sm">
                    Complete Mandatory Account Verification
                  </Link>
                )}
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
