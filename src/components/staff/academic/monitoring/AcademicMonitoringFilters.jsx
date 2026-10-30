'use client';

import React from 'react';
import {
  Building2,
  Calendar,
  Search,
  RefreshCw,
  FileDown,
  Filter
} from 'lucide-react';
import { CANONICAL_ACADEMIC_YEARS } from '@/lib/academic-constants';

export default function AcademicMonitoringFilters({
  academicYear,
  setAcademicYear,
  branch,
  setBranch,
  semester,
  setSemester,
  search,
  setSearch,
  allowedBranches = [],
  allowedSemesters = [],
  loading = false,
  onRefresh,
  onExportCsv,
  onExportPdf
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Year */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Year:</span>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-[#0b3578] focus:outline-hidden"
            >
              {CANONICAL_ACADEMIC_YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Branch:</span>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold text-[#0b3578] focus:ring-2 focus:ring-[#0b3578] focus:outline-hidden"
            >
              {allowedBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Semester:</span>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-[#0b3578] focus:outline-hidden"
            >
              {allowedSemesters.map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Cohort Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={onExportCsv}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={onExportPdf}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0b3578] hover:bg-blue-900 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-white/80" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter cohort by Student Name or Roll Number (e.g. 24567T0901)..."
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg placeholder-slate-400 text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b3578] focus:outline-hidden transition-all"
        />
      </div>
    </div>
  );
}
