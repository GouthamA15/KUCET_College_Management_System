'use client';
import React from 'react';

function getStatusBadge(r) {
  const pending = Number(r.pending_fee) || 0;
  const credit = Number(r.credit_balance) || 0;
  const paid = (Number(r.student_paid) || 0) + (Number(r.amount_sanctioned) || 0);

  if (credit > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
        Credit
      </span>
    );
  }
  if (pending === 0 && paid > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Fully Paid
      </span>
    );
  }
  if (pending > 0 && paid > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
        Partial
      </span>
    );
  }
  if (pending > 0 && paid === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
      No Record
    </span>
  );
}

export default function FinancialSummaryTable({ rows, totalExpectedFee, isScholar = false }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Academic Year-wise Summary</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Annual Expected Fee per year: <span className="font-mono font-bold text-indigo-700">₹ {totalExpectedFee.toLocaleString('en-IN')}</span></p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
          <span>Verified Institutional Records</span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="py-3 px-4">Academic Year</th>
              <th className="py-3 px-4 text-center">Status</th>
              {isScholar && <th className="py-3 px-4">Proceedings No</th>}
              {isScholar && <th className="py-3 px-4 text-right">Govt Sanctioned</th>}
              <th className="py-3 px-4 text-right">Student Paid</th>
              <th className="py-3 px-4 text-right font-black text-slate-700">Pending / Due</th>
              <th className="py-3 px-4 text-right">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3.5 px-4 font-bold text-slate-900">{r.labelYear}</td>
                <td className="py-3.5 px-4 text-center">{getStatusBadge(r)}</td>
                {isScholar && <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{r.proceedings_no || '—'}</td>}
                {isScholar && <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700">{r.amount_sanctioned ? `₹ ${Number(r.amount_sanctioned).toLocaleString('en-IN')}` : '—'}</td>}
                <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-700">{Number(r.student_paid) > 0 ? `₹ ${Number(r.student_paid).toLocaleString('en-IN')}` : '—'}</td>
                <td className="py-3.5 px-4 text-right font-mono font-bold">
                  {Number(r.credit_balance) > 0 ? (
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block" title="Excess payment detected">
                      +₹ {Number(r.credit_balance).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className={Number(r.pending_fee) > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                      ₹ {Number(r.pending_fee).toLocaleString('en-IN')}
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right text-xs text-slate-500 font-mono">{r.date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
