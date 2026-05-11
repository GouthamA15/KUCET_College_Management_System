'use client';

import React from 'react';
import { useStudent } from '@/context/StudentContext';
import { getBranchFromRoll } from '@/lib/rollNumber';
import FinancialSummaryTable from '@/components/student/FinancialSummaryTable';
import FinancialSummaryCardsMobile from '@/components/student/FinancialSummaryCardsMobile';
import useFinancialRows from '@/components/student/useFinancialRows';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function StudentFinancesPage() {
  const { studentData, loading: contextLoading } = useStudent();

  const student = studentData?.student || null;
  const branch = student ? getBranchFromRoll(student.roll_no) : null;

  const scholarshipList = studentData?.scholarship || [];
  const feeRecords = studentData?.fees || [];
  const { rows = [], yearlyTotalFee = 0 } = useFinancialRows(student?.roll_no, scholarshipList, feeRecords, branch);

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

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-2 animate-fadeIn font-sans antialiased text-slate-900">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0b3578]">Finances</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Official fee payment history and scholarship records.</p>
      </header>

      <div className="bg-white shadow-xl rounded-lg p-6 overflow-hidden border border-slate-100">
        <FinancialSummaryTable rows={rows} totalExpectedFee={yearlyTotalFee} />
        <div className="md:hidden">
           <FinancialSummaryCardsMobile rows={rows} totalExpectedFee={yearlyTotalFee} />
        </div>
      </div>
    </div>
  );
}
