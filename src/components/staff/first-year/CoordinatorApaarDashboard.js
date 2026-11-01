'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  FileSpreadsheet,
  Users,
  Check,
  Building2,
  X
} from 'lucide-react';

const BRANCH_OPTIONS = [
  { value: 'ALL', label: 'All Branches (7 Institutional Branches)' },
  { value: 'CSE', label: 'CSE - Computer Science & Engineering' },
  { value: 'IT', label: 'IT - Information Technology' },
  { value: 'CSD', label: 'CSD - Computer Science & Data Science' },
  { value: 'ECE', label: 'ECE - Electronics & Communication Engineering' },
  { value: 'EEE', label: 'EEE - Electrical & Electronics Engineering' },
  { value: 'CIVIL', label: 'CIVIL - Civil Engineering' },
  { value: 'MECH', label: 'MECH - Mechanical Engineering' }
];

export default function CoordinatorApaarDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Summaries
  const [cohortSummary, setCohortSummary] = useState({
    totalStudents: 0,
    submittedCount: 0,
    pendingCount: 0,
    submissionPercentage: 0
  });

  const [filteredSummary, setFilteredSummary] = useState({
    totalStudents: 0,
    submittedCount: 0,
    pendingCount: 0,
    submissionPercentage: 0
  });

  // Export Loading States
  const [exportingType, setExportingType] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when branch or status changes
  const handleBranchChange = (newBranch) => {
    setSelectedBranch(newBranch);
    setPage(1);
  };

  const handleStatusChange = (newStatus) => {
    setSelectedStatus(newStatus);
    setPage(1);
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        branch: selectedBranch,
        status: selectedStatus,
        search: debouncedSearch,
        page: String(page),
        limit: String(limit)
      });

      const res = await fetch(`/api/staff/coordinator/apaar-monitoring?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch APAAR monitoring records');
      }

      setStudents(data.students || []);
      setTotalRecords(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
      if (data.summary) setCohortSummary(data.summary);
      if (data.filteredSummary) setFilteredSummary(data.filteredSummary);
    } catch (err) {
      setError(err.message || 'Error loading records');
      toast.error(err.message || 'Error loading records');
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedStatus, debouncedSearch, page, limit]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) fetchData();
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchData]);

  // Export Trigger Handler
  const handleExport = async (type = 'current') => {
    let branchParam = selectedBranch;
    let statusParam = selectedStatus;
    let label = 'Report';

    if (type === 'all_branches') {
      branchParam = 'ALL';
      statusParam = 'ALL';
      label = 'All Branches Report';
    } else if (type === 'pending_only') {
      statusParam = 'PENDING';
      label = `Pending Students Report (${selectedBranch === 'ALL' ? 'All Branches' : selectedBranch})`;
    } else if (type === 'submitted_only') {
      statusParam = 'SUBMITTED';
      label = `Submitted Students Report (${selectedBranch === 'ALL' ? 'All Branches' : selectedBranch})`;
    } else {
      label = `${selectedBranch === 'ALL' ? 'All Branches' : selectedBranch} Report`;
    }

    setExportingType(type);
    const toastId = toast.loading(`Generating ${label}...`);

    try {
      const params = new URLSearchParams({
        branch: branchParam,
        status: statusParam,
        format: 'excel'
      });

      const res = await fetch(`/api/staff/coordinator/apaar-monitoring?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate Excel export');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      let filename = `KUCET_FirstYear_APAAR_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Successfully exported ${label}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Export generation failed', { id: toastId });
    } finally {
      setExportingType(null);
    }
  };

  const isFiltered = selectedBranch !== 'ALL' || selectedStatus !== 'ALL' || debouncedSearch !== '';

  return (
    <div className="space-y-6 antialiased">
      {/* ─── Header & Summary KPI Section ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0b3578] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                NEP 2020 Compliance
              </span>
              <span className="text-xs text-slate-500 font-medium">First-Year Cohort (Sem 1 &amp; 2)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#0b3578]" />
              <span>APAAR ID Monitoring &amp; Cohort Exports</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Students */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <span>Total First-Year Cohort</span>
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {cohortSummary.totalStudents}
            </div>
            <p className="text-[11px] text-slate-500">
              {isFiltered ? `Filtered view: ${filteredSummary.totalStudents} students` : 'Across all 7 branches'}
            </p>
          </div>

          {/* Card 2: Submitted APAAR IDs */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold uppercase tracking-wider">
              <span>APAAR Submitted</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-900">
              {cohortSummary.submittedCount}
            </div>
            <p className="text-[11px] text-emerald-700">
              {isFiltered ? `In filter: ${filteredSummary.submittedCount} submitted` : 'Verified & mapped in registry'}
            </p>
          </div>

          {/* Card 3: Pending APAAR IDs */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
            <div className="flex items-center justify-between text-amber-800 text-xs font-semibold uppercase tracking-wider">
              <span>APAAR Pending</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900">
              {cohortSummary.pendingCount}
            </div>
            <p className="text-[11px] text-amber-700">
              {isFiltered ? `In filter: ${filteredSummary.pendingCount} pending` : 'Action required from students'}
            </p>
          </div>

          {/* Card 4: Submission Rate */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
            <div className="flex items-center justify-between text-[#0b3578] text-xs font-semibold uppercase tracking-wider">
              <span>Cohort Compliance</span>
              <Building2 className="w-4 h-4 text-[#0b3578]" />
            </div>
            <div className="text-2xl font-bold text-[#0b3578]">
              {cohortSummary.submissionPercentage}%
            </div>
            <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-[#0b3578] h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, cohortSummary.submissionPercentage)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Controls: Filter, Search & Export Actions ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap flex-1">
            {/* Branch Selector */}
            <div className="relative min-w-[240px]">
              <label htmlFor="branch-filter" className="sr-only">Filter by branch</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Filter className="w-4 h-4" />
              </div>
              <select
                id="branch-filter"
                value={selectedBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578]"
              >
                {BRANCH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleStatusChange('ALL')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                  selectedStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Statuses
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('PENDING')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  selectedStatus === 'PENDING'
                    ? 'bg-amber-100 text-amber-900 shadow-xs border border-amber-200'
                    : 'text-slate-600 hover:text-amber-800'
                }`}
              >
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>Pending Only</span>
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('SUBMITTED')}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  selectedStatus === 'SUBMITTED'
                    ? 'bg-emerald-100 text-emerald-900 shadow-xs border border-emerald-200'
                    : 'text-slate-600 hover:text-emerald-800'
                }`}
              >
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Submitted Only</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <label htmlFor="search-input" className="sr-only">Search students</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="search-input"
                type="text"
                placeholder="Search name, roll no, or admission ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Export Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Download Selected Branch */}
            <button
              type="button"
              onClick={() => handleExport('current')}
              disabled={exportingType !== null || totalRecords === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0b3578] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Download currently filtered students"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {selectedBranch === 'ALL' ? 'Download Cohort' : `Download ${selectedBranch}`}
              </span>
            </button>

            {/* Download All Branches (Cohort) */}
            <button
              type="button"
              onClick={() => handleExport('all_branches')}
              disabled={exportingType !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0b3578] hover:bg-[#082654] rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="Download all 7 branches"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
              <span>All Branches Export</span>
            </button>

            {/* Download Pending Only List */}
            <button
              type="button"
              onClick={() => handleExport('pending_only')}
              disabled={exportingType !== null || cohortSummary.pendingCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Download students who have not submitted APAAR IDs"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending List</span>
            </button>
          </div>
        </div>

        {/* Filter status note */}
        {isFiltered && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>
              Showing results for branch <strong>{selectedBranch}</strong> • status <strong>{selectedStatus}</strong>
              {debouncedSearch && <> • matching &quot;{debouncedSearch}&quot;</>} ({filteredSummary.totalStudents} records)
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedBranch('ALL');
                setSelectedStatus('ALL');
                setSearchQuery('');
              }}
              className="text-[#0b3578] font-bold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ─── Student Table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-[#0b3578] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading First-Year student records...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-800">{error}</p>
            <button
              type="button"
              onClick={fetchData}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0b3578] rounded-lg hover:bg-[#082654] transition"
            >
              Retry
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {selectedStatus === 'PENDING'
                ? 'No Pending APAAR IDs Found!'
                : 'No Student Records Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {selectedStatus === 'PENDING'
                ? 'All students in the selected scope have successfully submitted their 12-digit APAAR IDs.'
                : 'No student records match your selected branch or search criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Admission / App ID</th>
                  <th className="py-3 px-4 text-center">Branch</th>
                  <th className="py-3 px-4 text-center">APAAR Status</th>
                  <th className="py-3 px-4 text-center">APAAR ID Number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {students.map((student, idx) => {
                  const sno = (page - 1) * limit + idx + 1;
                  const isSubmitted = student.status === 'Submitted';

                  return (
                    <tr key={student.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{sno}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{student.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        {student.roll_no ? (
                          <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {student.roll_no}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Awaiting Roll No
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {student.admission_no || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-[#0b3578] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                          {student.branch}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isSubmitted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {isSubmitted && student.apaar_id ? (
                          <span className="tracking-wider text-[#0b3578]">
                            {student.apaar_id.replace(/(\d{4})(?=\d)/g, '$1 ')}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Pagination Footer ─────────────────────────────────────────────── */}
        {!loading && totalRecords > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} records</span>
              <span className="text-slate-300">•</span>
              <label htmlFor="per-page-select" className="sr-only">Records per page</label>
              <select
                id="per-page-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-semibold text-slate-700"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-800">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
