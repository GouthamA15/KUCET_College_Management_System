'use client';
import React from 'react';

export default function ScholarshipCardsMobile({ rows }) {
  return (
    <div className="block md:hidden">
      <div className="space-y-3">
        {rows.map((r, idx) => (
          <div key={idx} className="border border-gray-300 rounded-md bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Year</div>
              <div className="text-sm font-semibold text-blue-700">{r.labelYear}</div>
            </div>

            <div className="mt-2">
              <div className="text-xs font-medium text-gray-600">Proceedings No</div>
              <div className="text-sm text-gray-800 whitespace-normal wrap-break-word leading-relaxed">{r.proceedings_no || '-'}</div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Amount Sanctioned</div>
              <div className="text-sm font-semibold">{r.amount_sanctioned ? `₹ ${r.amount_sanctioned}` : '-'}</div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Amount Distributed</div>
              <div className="text-sm font-semibold">{r.amount_disbursed ? `₹ ${r.amount_disbursed}` : '-'}</div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Date</div>
              <div className="text-sm">{r.date || '-'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
