'use client';

import React from 'react';
import {
  ChevronRight,
  ChevronLeft,
  HelpCircle
} from 'lucide-react';

export default function MarksMonitoringGrid({
  students = [],
  subjects = [],
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
        <h3 className="text-sm font-semibold text-slate-800">No Student Marks Found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          No active students or CIE marks evaluations match the selected filters.
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
              <th className="py-3 px-3.5 min-w-[170px]">Student Name</th>
              <th className="py-3 px-3 text-center">Evaluated</th>
              <th className="py-3 px-4 text-center min-w-[130px]">Average CIE (30)</th>
              <th className="py-3 px-3 text-center">Standing</th>
              {subjects.map(s => (
                <th key={s.subject_code} className="py-3 px-2.5 text-center min-w-[100px] border-l border-slate-200/60" title={s.subject_name}>
                  <div className="font-bold text-slate-700">{s.subject_code}</div>
                  <div className="text-[10px] text-slate-400 font-normal truncate max-w-[95px]">
                    {s.is_lab ? 'Lab Assessment' : (s.pattern || 'Theory')}
                  </div>
                </th>
              ))}
              <th className="py-3 px-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((st, idx) => {
              const rowNum = (page - 1) * limit + idx + 1;
              const avgScore = st.average_cie_marks ?? null;

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
                    {st.name}
                  </td>

                  {/* Evaluated Count */}
                  <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                    <span className="font-semibold text-slate-800">{st.evaluated_subjects_count}</span>
                    <span className="text-[10px] text-slate-400">/{subjects.length}</span>
                  </td>

                  {/* Average CIE */}
                  <td className="py-2.5 px-4 text-center">
                    {avgScore !== null ? (
                      <div className="inline-flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-sm text-slate-800">
                          {avgScore}
                        </span>
                        <span className="text-[10px] text-slate-400">/30</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[11px] italic">Pending</span>
                    )}
                  </td>

                  {/* Marks Status Badge */}
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                      st.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      st.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {st.status_label}
                    </span>
                  </td>

                  {/* Subject Marks */}
                  {subjects.map(s => {
                    const subMarks = st.subject_breakdown?.[s.subject_code];
                    const hasMarks = subMarks && subMarks.total_marks !== null;

                    return (
                      <td key={s.subject_code} className="py-2.5 px-2.5 text-center border-l border-slate-100 font-mono">
                        {hasMarks ? (
                          <div className="inline-block text-[11px]">
                            <span className="font-bold text-slate-800">
                              {subMarks.total_marks}
                            </span>
                            <div className="text-[9px] mt-0.5">
                              {subMarks.is_published ? (
                                <span className="text-emerald-700 font-semibold">Pub</span>
                              ) : (
                                <span className="text-amber-600 font-medium bg-amber-50 px-1 rounded">Draft</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                    );
                  })}

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
