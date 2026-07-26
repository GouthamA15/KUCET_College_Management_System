'use client';

import React, { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
import FinancialSummaryTable from '@/components/student/FinancialSummaryTable';
import FeeTransactionHistory from '@/components/student/FeeTransactionHistory';
import useFinancialRows from '@/components/student/useFinancialRows';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function StudentFinancesPage() {
  const { studentData, collegeInfo, loading: contextLoading } = useStudent();
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

  // Current Year of Study based on Academic Calendar
  const { yearOfStudy } = calculateYearAndSemester(student.roll_no, collegeInfo, student.academic_offset_years || 0);
  const activeYearOfStudy = yearOfStudy || 1;

  // Specific current year row data
  const currentYearRow = rows[activeYearOfStudy - 1] || {};

  // Metrics specifically for the current active academic year (not cumulative)
  const currentExpectedTotal = yearlyTotalFee;
  const currentStudentPaid = Number(currentYearRow.student_paid) || 0;
  const currentGovtPaid = Number(currentYearRow.amount_sanctioned) || 0;
  const currentPaidTotal = currentStudentPaid + currentGovtPaid;
  const currentPendingDue = Number(currentYearRow.pending_fee) || 0;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Page Header */}
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800">Fee Details & Scholarships</h1>
        <p className="text-sm text-gray-600 mt-1">Institutional tuition fee structures, government scholarship reimbursements, and payment receipts.</p>
      </header>

      {/* Flat Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Year Tuition Fee */}
        <div className="bg-white rounded-sm p-4 border border-gray-300 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Year Fee</span>
          <div className="text-xl font-bold font-mono text-gray-800">
            ₹ {currentExpectedTotal.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            Academic Year: {currentYearRow.labelYear || '—'} (Year {activeYearOfStudy})
          </div>
        </div>

        {/* Card 2: Current Year Amount Paid */}
        <div className="bg-white rounded-sm p-4 border border-gray-300 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Year Paid</span>
          <div className="text-xl font-bold font-mono text-emerald-700">
            ₹ {currentPaidTotal.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            Student Paid: ₹ {currentStudentPaid.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 3: Current Year Due Balance */}
        <div className="bg-white rounded-sm p-4 border border-gray-300 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Year Due</span>
          <div className={`text-xl font-bold font-mono ${currentPendingDue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            ₹ {currentPendingDue.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px]">
            {currentPendingDue > 0 ? (
              <span className="text-rose-600 font-semibold">Action Required</span>
            ) : (
              <span className="text-emerald-600 font-semibold">No Outstanding Due</span>
            )}
          </div>
        </div>

        {/* Card 4: Current Year Scholarship Coverage */}
        <div className="bg-white rounded-sm p-4 border border-gray-300 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Year Scholarship</span>
          <div className="text-xl font-bold font-mono text-[#0b3578]">
            ₹ {currentGovtPaid.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            Sanctioned: {currentYearRow.proceedings_no ? 'Yes' : 'None Recieved'}
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
            activeTab === 'summary' ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'
          }`}
        >
          Academic Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`px-3 py-2 rounded-md text-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
            activeTab === 'transactions' ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span>Transactions & Receipts</span>
          {feeRecords.length > 0 && (
            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full border ${
              activeTab === 'transactions'
                ? 'bg-blue-950/60 border-blue-900/30 text-blue-100'
                : 'bg-gray-100 border-gray-200 text-gray-600'
            }`}>
              {feeRecords.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm">
        {activeTab === 'summary' ? (
          <FinancialSummaryTable 
            rows={rows} 
            totalExpectedFee={yearlyTotalFee} 
            isScholar={isScholar} 
            scholarshipList={scholarshipList}
            currentYearOfStudy={activeYearOfStudy}
          />
        ) : (
          <FeeTransactionHistory 
            feeRecords={feeRecords} 
            student={student} 
            branch={branch} 
          />
        )}
      </div>
    </div>
  );
}
