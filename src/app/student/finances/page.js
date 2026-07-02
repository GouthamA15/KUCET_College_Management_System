'use client';

import React, { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { getBranchFromRoll } from '@/lib/rollNumber';
import FinancialSummaryTable from '@/components/student/FinancialSummaryTable';
import FinancialSummaryCardsMobile from '@/components/student/FinancialSummaryCardsMobile';
import FeeTransactionHistory from '@/components/student/FeeTransactionHistory';
import useFinancialRows from '@/components/student/useFinancialRows';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function StudentFinancesPage() {
  const { studentData, loading: contextLoading } = useStudent();
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'transactions'

  const student = studentData?.student || null;
  const branch = student ? getBranchFromRoll(student.roll_no) : null;

  const scholarshipList = studentData?.scholarship || [];
  const feeRecords = studentData?.fees || [];
  const { rows = [], yearlyTotalFee = 0 } = useFinancialRows(student, scholarshipList, feeRecords, branch);

  if (contextLoading && !student) {
    return (
      <LoadingSpinner
        label="Loading Financial Records"
        spinnerClassName="w-8 h-8 border-2 border-slate-200 border-t-[#0b3578] rounded-full animate-spin"
        labelClassName="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
      />
    );
  }

  if (!student) return null;

  const isScholar = student?.fee_reimbursement === 'YES' || student?.fee_reimbursement === 'GOV';

  // Aggregate Calculations for Summary Cards
  const totalExpectedAllYears = yearlyTotalFee * (rows.length || 4);
  const totalStudentPaid = rows.reduce((sum, r) => sum + (Number(r.student_paid) || 0), 0);
  const totalGovtPaid = rows.reduce((sum, r) => sum + (Number(r.amount_sanctioned) || 0), 0);
  const totalPaidAll = totalStudentPaid + totalGovtPaid;
  const totalPendingDue = rows.reduce((sum, r) => sum + (Number(r.pending_fee) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-2 sm:px-4 animate-fadeIn font-sans antialiased text-slate-900">
      {/* Page Header */}
      <header className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-widest mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
            Official Financial Ledger
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#0b3578]">Fee Details & Scholarships</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Institutional tuition fee structures, government scholarship reimbursements, and payment receipts.</p>
        </div>

        {/* Reimbursement Badge */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl shadow-2xs">
          <div className={`w-3 h-3 rounded-full ${isScholar ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Scholarship Status</span>
            <span className="text-xs font-extrabold text-slate-800 uppercase">{isScholar ? 'Govt Fee Reimbursement Eligible' : 'Standard / Non-Reimbursement'}</span>
          </div>
        </div>
      </header>

      {/* 4 High-Impact Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Fee Amount */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-indigo-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Total Course Fee</span>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹ {totalExpectedAllYears.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1">
              <span>₹ {yearlyTotalFee.toLocaleString('en-IN')} / Year</span>
              <span className="text-slate-300">•</span>
              <span>{rows.length || 4} Years</span>
            </div>
          </div>
        </div>

        {/* Card 2: Amount Paid */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Total Amount Paid</span>
            <div className="text-2xl font-black font-mono text-emerald-700">
              ₹ {totalPaidAll.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1">
              <span>Student: ₹ {totalStudentPaid.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Pending Due */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Pending Due Balance</span>
            <div className={`text-2xl font-black font-mono ${totalPendingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              ₹ {totalPendingDue.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1">
              {totalPendingDue > 0 ? (
                <span className="text-rose-600 font-bold">Action Required for Semester Clearance</span>
              ) : (
                <span className="text-emerald-700 font-bold">No Due Outstanding</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Scholarship Coverage */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-blue-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Scholarship Coverage</span>
            <div className="text-2xl font-black font-mono text-indigo-700">
              ₹ {totalGovtPaid.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500 flex items-center gap-1">
              <span>Govt Sanctioned & Disbursed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`px-5 py-3 font-bold text-xs md:text-sm transition-all border-b-2 rounded-t-lg flex items-center gap-2 ${
            activeTab === 'summary'
              ? 'border-[#0b3578] text-[#0b3578] bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Academic Year-wise Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`px-5 py-3 font-bold text-xs md:text-sm transition-all border-b-2 rounded-t-lg flex items-center gap-2 ${
            activeTab === 'transactions'
              ? 'border-[#0b3578] text-[#0b3578] bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Payment Transactions & Receipts
          {feeRecords.length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1">
              {feeRecords.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow-xl rounded-2xl p-4 sm:p-6 md:p-8 border border-slate-200/80">
        {activeTab === 'summary' ? (
          <div className="space-y-6">
            <FinancialSummaryTable rows={rows} totalExpectedFee={yearlyTotalFee} isScholar={isScholar} />
            <FinancialSummaryCardsMobile rows={rows} totalExpectedFee={yearlyTotalFee} isScholar={isScholar} />
          </div>
        ) : (
          <FeeTransactionHistory feeRecords={feeRecords} student={student} branch={branch} />
        )}
      </div>
    </div>
  );
}
