'use client';

import React from 'react';
import {
  ChevronRight,
  ChevronLeft,
  HelpCircle
} from 'lucide-react';

export default function CombinedAcademicOverview({
  students = [],
  pagination = {},
  loading = false,
  onPageChange,
  onSelectStudent
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-4" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">No Consolidated Records Found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          No active student cohort data available for the selected filters.
        </p>
      </div>
    );
  }

  const { page = 1, total_pages = 1, total_students = 0, limit = 50 } = pagination;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <th className="py-3 px-3.5 w-12 text-center text-slate-400">#</th>
              <th className="py-3 px-3.5 min-w-[130px]">Roll Number</th>
              <th className="py-3 px-3.5 min-w-[180px]">Student Name</th>
              <th className="py-3 px-4 text-center min-w-[130px]">Attendance %</th>
              <th className="py-3 px-3 text-center">Attendance Status</th>
              <th className="py-3 px-4 text-center min-w-[130px]">CIE Avg (/30)</th>
              <th className="py-3 px-3 text-center">Marks Status</th>
              <th className="py-3 px-4 text-center min-w-[160px]">Combined Status</th>
              <th className="py-3 px-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((st, idx) => {
              const rowNum = (page - 1) * limit + idx + 1;
              const attPct = st.attendance_percentage ?? 0;
              const cieAvg = st.average_cie_marks ?? null;
              const isAttLow = attPct < 75 && st.total_sessions > 0;

              return (
                <tr
                  key={st.id}
                  onClick={() => onSelectStudent && onSelectStudent(st)}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[11px]">{rowNum}</td>

                  {/* Roll No */}
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 group-hover:text-[#0b3578]">
                    {st.roll_no}
                  </td>

                  {/* Name */}
                  <td className="py-2.5 px-3.5 font-medium text-slate-800">
                    <span>{st.name}</span>
                  </td>

                  {/* Attendance Percentage */}
                  <td className="py-2.5 px-4 text-center font-mono">
                    <span className={`font-bold text-sm ${isAttLow ? 'text-amber-700' : 'text-slate-800'}`}>
                      {attPct}%
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {st.attended_sessions}/{st.total_sessions} Sessions
                    </div>
                  </td>

                  {/* Attendance Standing */}
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                      isAttLow ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {st.attendance_status_label}
                    </span>
                  </td>

                  {/* CIE Average */}
                  <td className="py-2.5 px-4 text-center font-mono">
                    {cieAvg !== null ? (
                      <div>
                        <span className="font-bold text-sm text-slate-800">
                          {cieAvg}
                        </span>
                        <span className="text-[10px] text-slate-400">/30</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[11px] italic">Pending</span>
                    )}
                  </td>

                  {/* Marks Status */}
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                      st.marks_status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      st.marks_status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {st.marks_status_label}
                    </span>
                  </td>

                  {/* Combined Status Category */}
                  <td className="py-2.5 px-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10.5px] font-semibold whitespace-nowrap ${
                      st.combined_category === 'ATTENDANCE_ATTENTION' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
                      st.combined_category === 'MARKS_AVAILABLE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                      st.combined_category === 'MARKS_NOT_PUBLISHED' ? 'bg-blue-50 text-[#0b3578] border border-blue-200' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {st.combined_label}
                    </span>
                  </td>

                  {/* Drilldown Arrow */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center text-slate-400 group-hover:text-[#0b3578] transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Showing <strong>{(page - 1) * limit + 1}</strong> to <strong>{Math.min(page * limit, total_students)}</strong> of <strong>{total_students}</strong> students
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>
          <span className="px-2 font-medium">Page {page} of {total_pages}</span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= total_pages}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
