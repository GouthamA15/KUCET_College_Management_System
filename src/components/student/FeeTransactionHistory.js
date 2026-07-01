'use client';
import React, { useState } from 'react';
import { formatDate } from '@/lib/date';

export default function FeeTransactionHistory({ feeRecords = [], student = null, branch = '' }) {
  const [expandedId, setExpandedId] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  if (!feeRecords || feeRecords.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h4 className="text-sm font-bold text-slate-700">No Payment Transactions Recorded</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Your institutional fee payments and bank challan receipts will appear here once verified by the academic accounts department.</p>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Fee Payment Transactions</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Verified payment history, bank UTR references, and downloadable receipts.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold border border-indigo-100">
          {feeRecords.length} {feeRecords.length === 1 ? 'Transaction' : 'Transactions'}
        </span>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="py-3 px-4">Transaction Date</th>
              <th className="py-3 px-4">Academic Year</th>
              <th className="py-3 px-4">Reference / UTR No.</th>
              <th className="py-3 px-4">Payment Mode & Bank</th>
              <th className="py-3 px-4 text-right">Amount Paid</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {feeRecords.map((payment, idx) => {
              const pId = payment.id || idx;
              const isExpanded = expandedId === pId;
              const formattedDate = payment.transaction_date ? formatDate(payment.transaction_date) : '—';
              
              return (
                <React.Fragment key={pId}>
                  <tr className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => toggleExpand(pId)}>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{formattedDate}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{payment.academic_year || '—'}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{payment.transaction_ref_no || 'N/A'}</td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-semibold text-slate-800 uppercase">{payment.payment_mode || 'ONLINE'}</span>
                      {payment.bank_name && <span className="text-slate-500 ml-1.5 font-normal">({payment.bank_name})</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-base">
                      ₹ {Number(payment.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Verified
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(payment)}
                        className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all shadow-2xs"
                        title="Download / Print Official Receipt"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Receipt
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50/60 border-t border-b border-slate-200/80">
                      <td colSpan={7} className="p-4">
                        <div className="grid grid-cols-3 gap-4 text-xs bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Payment Hash / UTR</span>
                            <span className="font-mono text-slate-800 font-bold break-all">{payment.transaction_ref_no || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Bank Institution</span>
                            <span className="font-semibold text-slate-800">{payment.bank_name || 'Not Specified'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Verification Status</span>
                            <span className="text-emerald-700 font-bold">Approved by Academic Accounts</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-3">
        {feeRecords.map((payment, idx) => {
          const pId = payment.id || idx;
          const isExpanded = expandedId === pId;
          const formattedDate = payment.transaction_date ? formatDate(payment.transaction_date) : '—';

          return (
            <div key={pId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-mono font-extrabold text-xs text-indigo-700">{payment.transaction_ref_no || `TRX-${idx + 100}`}</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Verified
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Amount Paid</span>
                  <span className="font-mono font-black text-emerald-700 text-lg">₹ {Number(payment.amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Academic Year</span>
                  <span className="font-bold text-slate-800 text-sm">{payment.academic_year || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Payment Mode</span>
                  <span className="font-semibold text-slate-700">{payment.payment_mode || 'ONLINE'} {payment.bank_name && `(${payment.bank_name})`}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Date</span>
                  <span className="font-mono text-slate-600">{formattedDate}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleExpand(pId)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(payment)}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Receipt
                </button>
              </div>

              {isExpanded && (
                <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Bank Institution:</span>
                    <span className="font-bold text-slate-700">{payment.bank_name || 'Not Specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Full UTR / Ref:</span>
                    <span className="font-mono text-slate-800 font-semibold break-all">{payment.transaction_ref_no || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Verification Status:</span>
                    <span className="text-emerald-700 font-bold">Verified & Posted</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Official Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 overflow-hidden relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors print:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Receipt Printable Area */}
            <div id="printable-receipt-area" className="space-y-6">
              {/* Institutional Header */}
              <div className="text-center border-b-2 border-slate-800 pb-4">
                <h2 className="text-lg md:text-xl font-black text-[#0b3578] uppercase tracking-wide">Kakatiya University College of Engineering & Technology</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Vidyaranyapuri, Warangal — 506009, Telangana</p>
                <div className="mt-3 inline-block bg-slate-900 text-white font-extrabold text-xs px-3 py-1 rounded uppercase tracking-widest">
                  Official Fee Payment Receipt
                </div>
              </div>

              {/* Student & Receipt Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Student Name</span>
                  <span className="font-bold text-slate-800 text-sm">{student?.name || 'Student'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Roll Number</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">{student?.roll_no || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Branch / Course</span>
                  <span className="font-semibold text-slate-700">{branch || 'B.Tech Regular'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Academic Year</span>
                  <span className="font-bold text-slate-800">{selectedReceipt.academic_year || '—'}</span>
                </div>
              </div>

              {/* Transaction Details Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    <tr>
                      <td className="py-2.5 px-3 text-slate-500">Transaction Reference (UTR)</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{selectedReceipt.transaction_ref_no || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-500">Payment Mode / Channel</td>
                      <td className="py-2.5 px-3 text-right font-semibold uppercase">{selectedReceipt.payment_mode || 'ONLINE'}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-500">Bank Institution</td>
                      <td className="py-2.5 px-3 text-right font-semibold">{selectedReceipt.bank_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-slate-500">Transaction Date</td>
                      <td className="py-2.5 px-3 text-right font-mono">{selectedReceipt.transaction_date ? formatDate(selectedReceipt.transaction_date) : '—'}</td>
                    </tr>
                    <tr className="bg-emerald-50/50 font-bold text-sm">
                      <td className="py-3 px-3 text-emerald-900">Total Amount Paid</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-base">₹ {Number(selectedReceipt.amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signature Footer */}
              <div className="pt-6 flex items-end justify-between border-t border-slate-200 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Status</p>
                  <p className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Electronically Verified Receipt
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Generated by KUCET Academic Portal</p>
                </div>
                <div className="text-center">
                  <div className="w-32 border-b border-slate-400 mb-1"></div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Accounts Officer</p>
                  <p className="text-[9px] text-slate-400">KUCET Warangal</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Close Window
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#0b3578] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save Receipt PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
