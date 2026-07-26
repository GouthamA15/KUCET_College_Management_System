'use client';

import React, { useState } from 'react';

function getStatusBadge(r, y, currentYearOfStudy) {
  if (currentYearOfStudy && y > currentYearOfStudy) {
    return (
      <span className="inline-block text-gray-400 font-semibold text-xs bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-sm">
        Not Active
      </span>
    );
  }

  const pending = Number(r.pending_fee) || 0;
  const credit = Number(r.credit_balance) || 0;
  const paid = (Number(r.student_paid) || 0) + (Number(r.amount_sanctioned) || 0);

  if (credit > 0) {
    return (
      <span className="inline-block text-blue-600 font-semibold text-xs bg-blue-50 border border-blue-150 px-2 py-0.5 rounded-sm">
        Credit
      </span>
    );
  }
  if (pending === 0 && paid > 0) {
    return (
      <span className="inline-block text-emerald-700 font-semibold text-xs bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-sm">
        Fully Paid
      </span>
    );
  }
  if (pending > 0 && paid > 0) {
    return (
      <span className="inline-block text-amber-700 font-semibold text-xs bg-amber-50 border border-amber-150 px-2 py-0.5 rounded-sm">
        Partial
      </span>
    );
  }
  if (pending > 0 && paid === 0) {
    return (
      <span className="inline-block text-rose-700 font-semibold text-xs bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-sm">
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-block text-gray-650 font-semibold text-xs bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-sm">
      No Record
    </span>
  );
}

function ChevronIcon({ direction }) {
  const isExpanded = direction === 'down';
  return (
    <svg 
      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-gray-800' : 'text-gray-400'}`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function FinancialSummaryTable({ rows, totalExpectedFee, isScholar = false, scholarshipList = [], currentYearOfStudy = 4 }) {
  const [expandedYears, setExpandedYears] = useState({});

  const toggleYear = (year) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  return (
    <div className="w-full">
      {/* Header Info */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Academic Year-wise Summary</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Annual Tuition Fee: <span className="font-mono font-bold text-gray-700">₹ {totalExpectedFee.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
          <span>Verified Institutional Records</span>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto border border-gray-300 rounded-sm bg-white shadow-xs">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-gray-100 border-b border-gray-300 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4 w-12 text-center"></th>
              <th className="py-2.5 px-4">Academic Year</th>
              <th className="py-2.5 px-4 text-center">Status</th>
              <th className="py-2.5 px-4 text-right">Pending / Due</th>
              <th className="py-2.5 px-4 text-right">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-700 font-medium">
            {rows.map((r, idx) => {
              const y = idx + 1;
              const isExpanded = !!expandedYears[r.labelYear];
              const yearScholarships = (scholarshipList || []).filter((s) => {
                if ((s.status || 'SANCTIONED').toUpperCase() === 'REJECTED') return false;
                const matchesYearIndex = s.year && Number(s.year) === y;
                const matchesAcademicLabel = s.academic_year && String(s.academic_year) === String(r.labelYear);
                return matchesYearIndex || matchesAcademicLabel;
              });

              return (
                <React.Fragment key={r.labelYear}>
                  <tr 
                    onClick={() => toggleYear(r.labelYear)}
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer border-b border-gray-200"
                  >
                    <td className="py-3 px-4 text-center text-gray-500" onClick={(e) => e.stopPropagation()}>
                      <button 
                        type="button"
                        onClick={() => toggleYear(r.labelYear)}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                      >
                        <ChevronIcon direction={isExpanded ? 'down' : 'right'} />
                      </button>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{r.labelYear}</td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(r, y, currentYearOfStudy)}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {y > currentYearOfStudy ? (
                        <span className="text-gray-400">—</span>
                      ) : Number(r.credit_balance) > 0 ? (
                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">
                          +₹ {Number(r.credit_balance).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className={Number(r.pending_fee) > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                          ₹ {Number(r.pending_fee).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 font-mono text-xs">
                      {y > currentYearOfStudy ? <span className="text-gray-400">—</span> : r.date || '—'}
                    </td>
                  </tr>

                  <tr className={`bg-gray-50/40 transition-colors ${isExpanded ? 'border-b border-gray-200' : ''}`}>
                    <td colSpan={5} className="p-0">
                      <div 
                        className="transition-all duration-300 ease-in-out overflow-hidden"
                        style={{
                          maxHeight: isExpanded ? '800px' : '0',
                          opacity: isExpanded ? 1 : 0,
                          padding: isExpanded ? '1rem' : '0 1rem',
                        }}
                      >
                        {y > currentYearOfStudy ? (
                          <div className="bg-white border border-gray-300 rounded-sm p-4 text-center text-gray-500 italic text-xs">
                            Academic year {r.labelYear} has not started. Fee structures and scholarship proceedings will be detailed once the academic session commences.
                          </div>
                        ) : (
                          <div className="bg-white border border-gray-300 rounded-sm p-4 space-y-4 shadow-2xs">
                            {/* Header details */}
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                              <h4 className="font-semibold text-gray-800 text-sm">Financial Details — {r.labelYear}</h4>
                              <div className="text-[11px] text-gray-500 font-mono">Last Sync: {r.date || '—'}</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                              {/* Tuition fee breakdown */}
                              <div className="space-y-2">
                                <h5 className="font-semibold text-gray-700 border-b border-gray-100 pb-1">Annual Fee Structure</h5>
                                <div className="space-y-1.5 text-gray-600">
                                  <div className="flex justify-between">
                                    <span>Annual Expected Tuition Fee:</span>
                                    <span className="font-mono font-bold text-gray-800">₹ {totalExpectedFee.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Paid by Student:</span>
                                    <span className="font-mono font-bold text-indigo-700">₹ {Number(r.student_paid || 0).toLocaleString('en-IN')}</span>
                                  </div>
                                  {isScholar && (
                                    <div className="flex justify-between">
                                      <span>Reimbursed by Government:</span>
                                      <span className="font-mono font-bold text-emerald-700">₹ {Number(r.amount_sanctioned || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between border-t border-gray-100 pt-1.5 font-bold text-gray-800">
                                    <span>Pending Due / Balance:</span>
                                    <span className="font-mono text-rose-600 text-sm">₹ {Number(r.pending_fee || 0).toLocaleString('en-IN')}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Scholarship proceedings */}
                              <div className="space-y-2">
                                <h5 className="font-semibold text-gray-700 border-b border-gray-100 pb-1">Scholarship Proceedings & Disbursal</h5>
                                {yearScholarships.length > 0 ? (
                                  <div className="overflow-x-auto border border-gray-200 rounded-sm">
                                    <table className="w-full text-[11px] text-left text-gray-700">
                                      <thead className="bg-gray-50 font-bold uppercase text-gray-600 text-[10px] border-b border-gray-200">
                                        <tr>
                                          <th className="py-1.5 px-2">Proceeding No.</th>
                                          <th className="py-1.5 px-2 text-right">Sanctioned</th>
                                          <th className="py-1.5 px-2 text-right">Released</th>
                                          <th className="py-1.5 px-2 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 font-medium">
                                        {yearScholarships.map((s, sIdx) => (
                                          <tr key={sIdx} className="hover:bg-gray-50/50">
                                            <td className="py-1.5 px-2 font-mono text-gray-900">{s.proceeding_no || '—'}</td>
                                            <td className="py-1.5 px-2 text-right font-mono text-emerald-700">₹ {Number(s.sanctioned_amount || 0).toLocaleString('en-IN')}</td>
                                            <td className="py-1.5 px-2 text-right font-mono text-blue-700">₹ {Number(s.released_amount || 0).toLocaleString('en-IN')}</td>
                                            <td className="py-1.5 px-2 text-center uppercase font-semibold text-[10px] text-gray-600">{s.status || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-gray-500 italic p-3 bg-gray-50 rounded-sm text-center">
                                    No scholarship proceedings recorded for this year.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {rows.map((r, idx) => {
          const y = idx + 1;
          const isExpanded = !!expandedYears[r.labelYear];
          const yearScholarships = (scholarshipList || []).filter((s) => {
            if ((s.status || 'SANCTIONED').toUpperCase() === 'REJECTED') return false;
            const matchesYearIndex = s.year && Number(s.year) === y;
            const matchesAcademicLabel = s.academic_year && String(s.academic_year) === String(r.labelYear);
            return matchesYearIndex || matchesAcademicLabel;
          });

          return (
            <div key={idx} className="border border-gray-300 rounded-sm bg-white shadow-xs p-3 space-y-2">
              {/* Simple row view */}
              <div 
                onClick={() => toggleYear(r.labelYear)} 
                className="grid grid-cols-[1fr_95px_80px] items-center gap-2 cursor-pointer"
              >
                {/* Column 1: Year Label */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">
                    <ChevronIcon direction={isExpanded ? 'down' : 'right'} />
                  </span>
                  <span className="font-semibold text-gray-800">{r.labelYear}</span>
                </div>
                
                {/* Column 2: Status Badge */}
                <div className="flex justify-center">
                  {getStatusBadge(r, y, currentYearOfStudy)}
                </div>
                
                {/* Column 3: Pending/Due Amount */}
                <div className="text-right font-mono font-bold text-gray-800 text-xs truncate">
                  {y > currentYearOfStudy ? '—' : `₹${Number(r.pending_fee || 0).toLocaleString('en-IN')}`}
                </div>
              </div>

              {/* Expanded details */}
              <div 
                className="transition-all duration-300 ease-in-out overflow-hidden"
                style={{
                  maxHeight: isExpanded ? '800px' : '0',
                  opacity: isExpanded ? 1 : 0,
                  paddingTop: isExpanded ? '0.75rem' : '0',
                  borderTop: isExpanded ? '1px solid var(--color-gray-250, #e2e8f0)' : 'none',
                }}
              >
                {y > currentYearOfStudy ? (
                  <div className="text-gray-500 italic text-center py-2 text-xs">
                    Academic year {r.labelYear} has not started. Fee structures and scholarship proceedings will be detailed once the academic session commences.
                  </div>
                ) : (
                  <div className="space-y-3 text-xs text-gray-700 mt-1">
                    <div className="flex justify-between">
                      <span>Last Updated:</span>
                      <span className="font-mono">{r.date || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tuition Fee / Year:</span>
                      <span className="font-mono">₹ {totalExpectedFee.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid by Student:</span>
                      <span className="font-mono text-indigo-700 font-bold">₹ {Number(r.student_paid || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {isScholar && (
                      <div className="flex justify-between">
                        <span>Reimbursed by Govt:</span>
                        <span className="font-mono text-emerald-700 font-bold">₹ {Number(r.amount_sanctioned || 0).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="border-t border-gray-150 pt-2 space-y-1.5">
                      <span className="font-semibold text-gray-800">Scholarship Proceedings</span>
                      {yearScholarships.length > 0 ? (
                        <div className="space-y-2 mt-1">
                          {yearScholarships.map((s, sIdx) => (
                            <div key={sIdx} className="bg-gray-50 border border-gray-200 rounded-sm p-2 space-y-1">
                              <div className="flex justify-between font-mono font-bold text-[11px] text-gray-800">
                                <span>{s.proceeding_no || '—'}</span>
                                <span className="text-[9px] uppercase font-bold text-gray-500">{s.status}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-gray-650">
                                <span>Sanctioned: ₹{Number(s.sanctioned_amount || 0).toLocaleString('en-IN')}</span>
                                <span>Released: ₹{Number(s.released_amount || 0).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 italic mt-1 text-center bg-gray-50 p-2 rounded-sm">
                          No scholarship proceedings recorded.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
