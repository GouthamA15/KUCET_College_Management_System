'use client';
import React from 'react';

export default function FinancialSummaryTable({ rows, totalExpectedFee, isScholar = false }) {
  return (
    <div className="hidden md:block overflow-x-hidden">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Financial Summary</h3>
        <p className="text-sm text-gray-600 italic">Total Annual Expected Fee: ₹ {totalExpectedFee.toLocaleString('en-IN')}</p>
      </div>
      <div className="rounded-md overflow-hidden">
        <table className="table-fixed w-full border-collapse text-sm">
          <colgroup>
            <col style={{ width: '7rem' }} />
            {isScholar && <col style={{ width: '30%' }} />}
            {isScholar && <col style={{ width: '15%' }} />}
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead className="bg-gray-100">
            <tr className="border border-gray-300">
              <th className="text-left py-2 px-3 border-r border-gray-300">Year</th>
              {isScholar && <th className="text-left py-2 px-3 border-r border-gray-300">Proceedings No</th>}
              {isScholar && <th className="text-right py-2 px-3 border-r border-gray-300">Govt Paid</th>}
              <th className="text-right py-2 px-3 border-r border-gray-300">Student Paid</th>
              <th className="text-right py-2 px-3 border-r border-gray-300 font-bold">Pending/Credit</th>
              <th className="text-left py-2 px-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-x border-b border-gray-300">
                <td className="py-2 px-3 border-r border-gray-300 align-top">{r.labelYear}</td>
                {isScholar && <td className="py-2 px-3 border-r border-gray-300 whitespace-normal wrap-break-word align-top font-mono text-xs">{r.proceedings_no || '\u00A0'}</td>}
                {isScholar && <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{r.amount_sanctioned ? `₹ ${Number(r.amount_sanctioned).toLocaleString('en-IN')}` : '\u00A0'}</td>}
                <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{Number(r.student_paid) > 0 ? `₹ ${Number(r.student_paid).toLocaleString('en-IN')}` : '\u00A0'}</td>
                <td className={`py-2 px-3 border-r border-gray-300 text-right align-top font-bold`}>
                  {Number(r.credit_balance) > 0 ? (
                    <span className="text-blue-600" title="Excess payment detected (likely due to scholarship arrival after student payment)">
                      (Credit) ₹ {Number(r.credit_balance).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className={Number(r.pending_fee) > 0 ? 'text-red-600' : 'text-green-600'}>
                      ₹ {Number(r.pending_fee).toLocaleString('en-IN')}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 align-top text-xs">{r.date || '\u00A0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
