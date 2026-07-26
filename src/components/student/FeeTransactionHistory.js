'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate } from '@/lib/date';

export default function FeeTransactionHistory({ feeRecords = [], student = null, branch = '' }) {
  const [expandedId, setExpandedId] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  if (!feeRecords || feeRecords.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-sm p-8 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold text-gray-700">No Payment Transactions Recorded</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Your institutional fee payments and bank challan receipts will appear here once verified by the academic accounts department.</p>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const modal = selectedReceipt ? (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center overflow-y-auto p-3 sm:p-6">
      <div 
        role="dialog" 
        aria-modal="true" 
        className="bg-white rounded-sm max-w-xl w-full shadow-lg border border-gray-300 relative flex flex-col my-auto p-5 sm:p-8 max-h-[92vh] overflow-hidden"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setSelectedReceipt(null)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors print:hidden z-10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Receipt Printable Area */}
        <div id="printable-receipt-area" className="space-y-6 overflow-y-auto pr-1">
          {/* Institutional Header */}
          <div className="text-center border-b border-gray-300 pb-4">
            <h2 className="text-base font-bold text-[#0b3578] uppercase tracking-wide">
              Kakatiya University College of Engineering & Technology
            </h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
              Vidyaranyapuri, Warangal — 506009, Telangana
            </p>
            <div className="mt-3 inline-block bg-gray-800 text-white font-semibold text-[10px] px-2.5 py-1 rounded-sm uppercase tracking-wider">
              Official Fee Payment Receipt
            </div>
          </div>

          {/* Student & Receipt Meta */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-sm border border-gray-200">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Student Name</span>
              <span className="font-semibold text-gray-800">{student?.name || 'Student'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Roll Number</span>
              <span className="font-mono font-bold text-gray-800">{student?.roll_no || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Branch / Course</span>
              <span className="font-medium text-gray-700">{branch || 'B.Tech Regular'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Academic Year</span>
              <span className="font-semibold text-gray-800">{selectedReceipt.academic_year || '—'}</span>
            </div>
          </div>

          {/* Transaction Details Table */}
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2 px-3 text-left">Description</th>
                  <th className="py-2 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-750">
                <tr>
                  <td className="py-2 px-3 text-gray-500">Transaction Reference (UTR)</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">{selectedReceipt.transaction_ref_no || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-500">Payment Mode / Channel</td>
                  <td className="py-2 px-3 text-right font-semibold uppercase">{selectedReceipt.payment_mode || 'ONLINE'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-500">Bank Institution</td>
                  <td className="py-2 px-3 text-right font-semibold">{selectedReceipt.bank_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-500">Transaction Date</td>
                  <td className="py-2 px-3 text-right font-mono">{selectedReceipt.transaction_date ? formatDate(selectedReceipt.transaction_date) : '—'}</td>
                </tr>
                <tr className="bg-emerald-50/30 font-bold text-sm">
                  <td className="py-2.5 px-3 text-emerald-950">Total Amount Paid</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">₹ {Number(selectedReceipt.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signature Footer */}
          <div className="pt-4 flex items-end justify-between border-t border-gray-200 text-xs">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">System Status</p>
              <p className="text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Electronically Verified
              </p>
              <p className="text-[9px] text-gray-400 mt-0.5">Generated by KUCET Student Portal</p>
            </div>
            <div className="text-center">
              <div className="w-24 border-b border-gray-300 mb-1 mx-auto"></div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Accounts Officer</p>
              <p className="text-[8px] text-gray-400">KUCET Warangal</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={() => setSelectedReceipt(null)}
            className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-sm transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b3578] hover:bg-blue-900 text-white font-semibold text-xs rounded-sm shadow-xs transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h3 className="text-base font-semibold text-gray-800">Fee Payment Transactions</h3>
        <p className="text-xs text-gray-500 mt-0.5">Verified payment history, bank UTR references, and downloadable receipts.</p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto border border-gray-300 rounded-sm bg-white shadow-xs">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Transaction Date</th>
              <th className="py-2.5 px-4">Academic Year</th>
              <th className="py-2.5 px-4">Reference / UTR No.</th>
              <th className="py-2.5 px-4">Payment Mode & Bank</th>
              <th className="py-2.5 px-4 text-right">Amount Paid</th>
              <th className="py-2.5 px-4 text-center">Status</th>
              <th className="py-2.5 px-4 text-center">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
            {feeRecords.map((payment, idx) => {
              const pId = payment.id || idx;
              const isExpanded = expandedId === pId;
              const formattedDate = payment.transaction_date ? formatDate(payment.transaction_date) : '—';
              
              return (
                <React.Fragment key={pId}>
                  <tr 
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer border-b border-gray-200" 
                    onClick={() => toggleExpand(pId)}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{formattedDate}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{payment.academic_year || '—'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#0b3578]">{payment.transaction_ref_no || 'N/A'}</td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-semibold text-gray-800 uppercase">{payment.payment_mode || 'ONLINE'}</span>
                      {payment.bank_name && <span className="text-gray-500 ml-1.5 font-normal">({payment.bank_name})</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                      ₹ {Number(payment.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block text-emerald-700 font-semibold text-xs bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm">
                        Verified
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(payment)}
                        className="inline-flex items-center gap-1 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs px-2.5 py-1 rounded-sm border border-gray-300 transition-colors cursor-pointer"
                        title="Download / Print Receipt"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Receipt
                      </button>
                    </td>
                  </tr>
                  <tr className={`bg-gray-50/40 transition-colors ${isExpanded ? 'border-b border-gray-250' : ''}`}>
                    <td colSpan={7} className="p-0">
                      <div 
                        className="transition-all duration-300 ease-in-out overflow-hidden"
                        style={{
                          maxHeight: isExpanded ? '400px' : '0',
                          opacity: isExpanded ? 1 : 0,
                          padding: isExpanded ? '1rem' : '0 1rem',
                        }}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-white p-4 rounded-sm border border-gray-200 shadow-2xs">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-1 uppercase">Payment Hash / UTR</span>
                            <span className="font-mono text-gray-800 font-bold break-all">{payment.transaction_ref_no || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-1 uppercase">Bank Institution</span>
                            <span className="font-semibold text-gray-800">{payment.bank_name || 'Not Specified'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-1 uppercase">Verification Status</span>
                            <span className="text-emerald-700 font-bold">Approved by Academic Accounts</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-4">
        {feeRecords.map((payment, idx) => {
          const pId = payment.id || idx;
          const formattedDate = payment.transaction_date ? formatDate(payment.transaction_date) : '—';

          return (
            <div key={pId} className="bg-white border border-gray-300 rounded-sm p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-gray-150 pb-2.5">
                <div>
                  <span className="font-semibold text-gray-800 text-sm">{payment.academic_year || '—'}</span>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">{formattedDate}</div>
                </div>
                <span className="inline-block text-emerald-700 font-semibold text-xs bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm">
                  Verified
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-gray-500">UTR / Ref No:</div>
                <div className="font-mono font-bold text-gray-800 text-right truncate pl-2">{payment.transaction_ref_no || '—'}</div>

                <div className="text-gray-500">Bank & Mode:</div>
                <div className="text-right font-medium text-gray-800 truncate pl-2 uppercase">
                  {payment.payment_mode || 'ONLINE'} {payment.bank_name && `(${payment.bank_name})`}
                </div>

                <div className="text-gray-500 font-semibold">Amount Paid:</div>
                <div className="text-right font-mono font-bold text-emerald-700">₹ {Number(payment.amount || 0).toLocaleString('en-IN')}</div>
              </div>

              <div className="border-t border-gray-150 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(payment)}
                  className="w-full py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Receipt PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Render modal directly to body to avoid z-index/clipping issues */}
      {typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
    </div>
  );
}
