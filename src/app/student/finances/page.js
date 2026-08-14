'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { useStudent } from '@/context/StudentContext';
import { getBranchFromRoll } from '@/lib/rollNumber';
import FinancialSummaryTable from '@/components/student/FinancialSummaryTable';
import FeeTransactionHistory from '@/components/student/FeeTransactionHistory';
import useFinancialRows from '@/components/student/useFinancialRows';

export default function StudentFinancesPage() {
  const { studentData, loading: contextLoading } = useStudent();
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'transactions'

  // Help Icon / Bottom Sheet state
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent scroll when bottom sheet is open
  useEffect(() => {
    if (isBottomSheetOpen && isMobileDevice) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isBottomSheetOpen, isMobileDevice]);

  const student = studentData?.student || null;
  const branch = student ? getBranchFromRoll(student.roll_no) : null;

  const scholarshipList = studentData?.scholarship || [];
  const feeRecords = studentData?.fees || [];
  const { rows = [], yearlyTotalFee = 0 } = useFinancialRows(student, scholarshipList, feeRecords, branch);

  if (contextLoading && !student) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <header className="mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-800">Fee Details & Scholarships</h1>
            <div className="text-slate-400 p-1 rounded-full"><Info size={20} className="shrink-0" /></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Institutional tuition fee structures, government scholarship reimbursements, and payment receipts.</p>
          <div className="md:hidden flex items-center gap-2 mt-3.5">
             <button className="px-3 py-2 rounded-md text-sm transition-colors bg-[#0b3578] text-white">Academic Ledger</button>
             <button className="px-3 py-2 rounded-md text-sm transition-colors bg-white border text-gray-700 cursor-not-allowed">Transactions & Receipts</button>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-md p-3 sm:p-4 border border-gray-200 h-28 skeleton-shimmer"></div>
          ))}
        </section>

        <div className="hidden md:flex items-center gap-2 mb-4">
           <button className="px-3 py-2 rounded-md text-sm transition-colors bg-[#0b3578] text-white">Academic Ledger</button>
           <button className="px-3 py-2 rounded-md text-sm transition-colors bg-white border text-gray-700 cursor-not-allowed">Transactions & Receipts</button>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4 sm:p-6 shadow-sm">
           <div className="h-8 w-1/3 skeleton-shimmer rounded mb-6"></div>
           <div className="space-y-4">
             {[...Array(5)].map((_, i) => (
               <div key={i} className="h-12 skeleton-shimmer w-full rounded"></div>
             ))}
           </div>
        </div>
      </div>
    );
  }

  if (!student) return null;

  const isScholar = student?.fee_reimbursement === 'YES' || student?.fee_reimbursement === 'GOV';

  // Current Year of Study based on Academic Calendar
  const yearOfStudy = student?.academic_session?.yearOfStudy;
  const activeYearOfStudy = yearOfStudy || 1;

  // Specific current year row data
  const currentYearRow = rows[activeYearOfStudy - 1] || {};

  // Metrics specifically for the current active academic year (not cumulative)
  const currentExpectedTotal = yearlyTotalFee;
  const currentStudentPaid = Number(currentYearRow.student_paid) || 0;
  const currentGovtPaid = Number(currentYearRow.amount_sanctioned) || 0;
  const currentPaidTotal = currentStudentPaid + currentGovtPaid;
  const currentPendingDue = Number(currentYearRow.pending_fee) || 0;

  // Tab Buttons JSX - defined once to prevent code repetition
  const tabButtons = (
    <>
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
    </>
  );

  const bottomSheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="help-sheet-title" 
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <button 
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h3 id="help-sheet-title" className="text-lg font-bold text-[#0b2447] mb-3">Fee & Scholarship Information</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <p className="text-slate-600">
            This page provides a comprehensive overview of your institutional fee structure, government scholarship reimbursements, and payment receipts. Please note:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Year-Wise Fees:</strong> Tuition fees are tracked strictly by academic year.</li>
            <li><strong>Fee Calculation:</strong> The fee structure is determined by your course type (Self Finance or Regular / NON-Self Finance).</li>
            <li><strong>Scholarship (Fee Reimbursement):</strong> Shows government scholarship amounts that are sanctioned to cover your tuition fees.</li>
            <li><strong>Transactions & Receipts:</strong> Used exclusively for tracking institutional college tuition fee payments, not for regular online banking transactions.</li>
          </ul>
        </div>
        <button 
          onClick={() => setIsBottomSheetOpen(false)} 
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] active:bg-[#092554] transition-colors focus:outline-none"
        >
          Got It
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Page Header */}
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Fee Details & Scholarships</h1>
          
          <div 
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) {
                  setIsBottomSheetOpen(true);
                }
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Help Information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">Fee & Scholarship Information</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  This page provides a comprehensive overview of your institutional fee structure, government scholarship reimbursements, and payment receipts. Please note:
                </p>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>Year-Wise Fees:</strong> Tuition fees are tracked strictly by academic year.</li>
                  <li><strong>Fee Calculation:</strong> The fee structure is determined by your course type (Self Finance or Regular / NON-Self Finance).</li>
                  <li><strong>Scholarship (Fee Reimbursement):</strong> Shows government scholarship amounts that are sanctioned to cover your tuition fees.</li>
                  <li><strong>Transactions & Receipts:</strong> Used exclusively for tracking institutional college tuition fee payments, not for regular online banking transactions.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Institutional tuition fee structures, government scholarship reimbursements, and payment receipts.</p>
        
        {/* Mobile View: Render tab buttons immediately after header text */}
        <div className="md:hidden flex items-center gap-2 mt-3.5">
          {tabButtons}
        </div>
      </header>

      {/* Responsive 2x2 Mobile / 4x1 Desktop Grid with subtle border designs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Current Year Tuition Fee */}
        <div className="bg-white rounded-md p-3 sm:p-4 border border-gray-300 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-blue-50/50 rounded-bl-full -mr-4 -mt-4 sm:-mr-5 sm:-mt-5 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Year Fee</span>
            <div className="text-base sm:text-lg lg:text-xl font-bold font-mono text-gray-800">
              ₹ {currentExpectedTotal.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 text-[9px] sm:text-[10px] text-gray-500 truncate">
              {currentYearRow.labelYear || '—'} (Year {activeYearOfStudy})
            </div>
          </div>
        </div>

        {/* Card 2: Current Year Amount Paid */}
        <div className="bg-white rounded-md p-3 sm:p-4 border border-gray-300 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50/50 rounded-bl-full -mr-4 -mt-4 sm:-mr-5 sm:-mt-5 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Year Paid</span>
            <div className="text-base sm:text-lg lg:text-xl font-bold font-mono text-emerald-700">
              ₹ {currentPaidTotal.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 text-[9px] sm:text-[10px] text-gray-500 truncate">
              Student: ₹ {currentStudentPaid.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Card 3: Current Year Due Balance */}
        <div className="bg-white rounded-md p-3 sm:p-4 border border-gray-300 shadow-sm relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-rose-50/50 rounded-bl-full -mr-4 -mt-4 sm:-mr-5 sm:-mt-5 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Year Due</span>
            <div className={`text-base sm:text-lg lg:text-xl font-bold font-mono ${currentPendingDue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              ₹ {currentPendingDue.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 text-[9px] sm:text-[10px] truncate">
              {currentPendingDue > 0 ? (
                <span className="text-rose-600 font-semibold">Action Required</span>
              ) : (
                <span className="text-emerald-600 font-semibold">No Outstanding Due</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Current Year Scholarship Coverage */}
        <div className="bg-white rounded-md p-3 sm:p-4 border border-gray-300 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50/50 rounded-bl-full -mr-4 -mt-4 sm:-mr-5 sm:-mt-5 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Current Scholarship</span>
            <div className="text-base sm:text-lg lg:text-xl font-bold font-mono text-[#0b3578]">
              ₹ {currentGovtPaid.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 text-[9px] sm:text-[10px] text-gray-500 truncate">
              Sanctioned: {currentYearRow.proceedings_no ? 'Yes' : 'None Recieved'}
            </div>
          </div>
        </div>
      </section>

      {/* Desktop View: Render tab buttons below the summary metrics cards */}
      <div className="hidden md:flex items-center gap-2 mb-4">
        {tabButtons}
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

      {typeof document !== 'undefined' && isBottomSheetOpen && isMobileDevice && createPortal(bottomSheet, document.body)}
    </div>
  );
}
