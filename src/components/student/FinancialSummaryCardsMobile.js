'use client';
import React from 'react';

function getStatusBadge(r) {
  const pending = Number(r.pending_fee) || 0;
  const credit = Number(r.credit_balance) || 0;
  const paid = (Number(r.student_paid) || 0) + (Number(r.amount_sanctioned) || 0);

  if (credit > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
        Credit
      </span>
    );
  }
  if (pending === 0 && paid > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Fully Paid
      </span>
    );
  }
  if (pending > 0 && paid > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
        Partial
      </span>
    );
  }
  if (pending > 0 && paid === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
      No Record
    </span>
  );
}

export default function FinancialSummaryCardsMobile({ rows, totalExpectedFee, isScholar = false }) {
  return (
    <div className="md:hidden space-y-4">
      <div className="px-1 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">Year-wise Summary</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Annual Expected: <span className="font-mono font-bold text-indigo-700">₹ {totalExpectedFee.toLocaleString('en-IN')}</span></p>
        </div>
      </div>
      {rows.map((r, idx) => (
        <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-800">{r.labelYear}</span>
            </div>
            {getStatusBadge(r)}
          </div>
          
          <div className="grid grid-cols-2 gap-y-2.5 text-xs">
            {isScholar && (
              <>
                <div className="text-slate-500 font-medium">Proceedings No</div>
                <div className="font-mono font-bold text-slate-700 text-right truncate pl-2">{r.proceedings_no || '—'}</div>
                
                <div className="text-slate-500 font-medium">Govt Sanctioned</div>
                <div className="text-right font-mono font-bold text-emerald-700">{r.amount_sanctioned ? `₹ ${Number(r.amount_sanctioned).toLocaleString('en-IN')}` : '—'}</div>
              </>
            )}
            
            <div className="text-slate-500 font-medium">Student Paid</div>
            <div className="text-right font-mono font-bold text-indigo-700">{Number(r.student_paid) > 0 ? `₹ ${Number(r.student_paid).toLocaleString('en-IN')}` : '—'}</div>
            
            <div className="text-slate-500 font-medium">Pending Due</div>
            <div className="text-right font-mono font-extrabold">
              {Number(r.credit_balance) > 0 ? (
                <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                  +₹ {Number(r.credit_balance).toLocaleString('en-IN')}
                </span>
              ) : (
                <span className={Number(r.pending_fee) > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                  ₹ {Number(r.pending_fee).toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <div className="text-slate-500 font-medium">Last Updated</div>
            <div className="text-right font-mono text-[11px] text-slate-500">{r.date || '—'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
