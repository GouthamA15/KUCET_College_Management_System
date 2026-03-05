'use client';
import React from 'react';

export default function FinancialSummaryCardsMobile({ rows, totalExpectedFee }) {
  return (
    <div className="md:hidden space-y-4">
      <div className="px-1">
        <h3 className="text-lg font-semibold text-gray-800">Financial Summary</h3>
        <p className="text-xs text-gray-600 italic">Total Annual Expected Fee: ₹ {totalExpectedFee.toLocaleString('en-IN')}</p>
      </div>
      {rows.map((r, idx) => (
        <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-gray-50 shadow-sm">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-3">
            <span className="font-bold text-indigo-700">{r.labelYear}</span>
            <span className={`text-sm font-bold ${Number(r.pending_fee) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Pending: ₹ {Number(r.pending_fee).toLocaleString('en-IN')}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-gray-500">Proceedings</div>
            <div className="font-mono text-xs text-right truncate pl-2">{r.proceedings_no || '-'}</div>
            
            <div className="text-gray-500">Govt Paid</div>
            <div className="text-right font-medium">{r.amount_sanctioned ? `₹ ${Number(r.amount_sanctioned).toLocaleString('en-IN')}` : '-'}</div>
            
            <div className="text-gray-500">Student Paid</div>
            <div className="text-right font-medium">{r.student_paid ? `₹ ${Number(r.student_paid).toLocaleString('en-IN')}` : '-'}</div>
            
            <div className="text-gray-500">Date</div>
            <div className="text-right text-xs">{r.date || '-'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
