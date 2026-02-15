'use client';
import React from 'react';

export default function ScholarshipTableDesktop({ rows }) {
  return (
    <div className="hidden md:block overflow-x-hidden">
      <div className="rounded-md overflow-hidden">
        <table className="table-fixed w-full border-collapse text-sm">
          <colgroup>
            <col style={{ width: '7.5rem' }} />
            <col style={{ width: '45%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead className="bg-gray-100">
            <tr className="border border-gray-300">
              <th className="text-left py-2 px-3 border-r border-gray-300">Year</th>
              <th className="text-left py-2 px-3 border-r border-gray-300">Proceedings No</th>
              <th className="text-right py-2 px-3 border-r border-gray-300">Amount Sanctioned</th>
              <th className="text-right py-2 px-3 border-r border-gray-300">Amount Distributed</th>
              <th className="text-left py-2 px-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-x border-b border-gray-300">
                <td className="py-2 px-3 border-r border-gray-300 align-top">{r.labelYear}</td>
                <td className="py-2 px-3 border-r border-gray-300 whitespace-normal wrap-break-word align-top">{r.proceedings_no || '\u00A0'}</td>
                <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{r.amount_sanctioned ? `₹ ${r.amount_sanctioned}` : '\u00A0'}</td>
                <td className="py-2 px-3 border-r border-gray-300 text-right align-top">{r.amount_disbursed ? `₹ ${r.amount_disbursed}` : '\u00A0'}</td>
                <td className="py-2 px-3 align-top">{r.date || '\u00A0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pointer-events-none border border-gray-300 rounded-md mt-[calc(100%-100%)]" />
      </div>
    </div>
  );
}
