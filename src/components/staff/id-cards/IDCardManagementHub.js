'use client';

import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { 
  Search, 
  RefreshCw, 
  Download, 
  Eye, 
  Upload, 
  X, 
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  Users
} from 'lucide-react';

const CANONICAL_BRANCH_INFO = [
  { code: '09', name: 'CSE', fullName: 'Computer Science & Engineering' },
  { code: '18', name: 'IT', fullName: 'Information Technology' },
  { code: '30', name: 'CSD', fullName: 'Computer Science & Data Science' },
  { code: '15', name: 'ECE', fullName: 'Electronics & Communication Engineering' },
  { code: '12', name: 'EEE', fullName: 'Electrical & Electronics Engineering' },
  { code: '00', name: 'CIVIL', fullName: 'Civil Engineering' },
  { code: '03', name: 'MECH', fullName: 'Mechanical Engineering' },
];

export default function IDCardManagementHub({ initialBranch = 'CSE' }) {
  // Branch & Filters State
  const [selectedBranch, setSelectedBranch] = useState(initialBranch);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [search, setSearch] = useState('');
  const [photoFilter, setPhotoFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Data State
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Modals State
  const [previewStudent, setPreviewStudent] = useState(null);
  const [uploadStudent, setUploadStudent] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSingleDownloading, setIsSingleDownloading] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch Authoritative Student Records & Dynamic Branch Statistics
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          branch: selectedBranch,
          search,
          photoStatus: photoFilter,
          page: String(page),
          limit: String(limit),
        });

        const res = await fetch(`/api/staff/id-cards?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to fetch student ID card records');
        }

        const data = await res.json();
        if (!ignore) {
          setStudents(data.students || []);
          setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
          setStats(data.stats || null);
          setBranches(data.branches || []);
        }
      } catch (err) {
        if (!ignore) {
          toast.error(err.message || 'Error loading authoritative records');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [selectedBranch, search, photoFilter, page, limit, refreshKey]);

  const handleManualRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Debounced Search Handling
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Dynamic Information for Current Selection
  const currentBranchStats = useMemo(() => {
    if (selectedBranch === 'ALL') {
      return {
        name: 'ALL',
        fullName: 'All Authorized Academic Branches',
        totalEligible: stats?.totalEligible || 0,
        photosAvailable: stats?.photosAvailable || 0,
        photosMissing: stats?.photosMissing || 0,
      };
    }

    const found = branches.find(b => b.branch === selectedBranch);
    const fallback = CANONICAL_BRANCH_INFO.find(b => b.name === selectedBranch);

    return {
      name: selectedBranch,
      fullName: found?.branchFullName || fallback?.fullName || selectedBranch,
      totalEligible: found?.totalEligible ?? 0,
      photosAvailable: found?.photosAvailable ?? 0,
      photosMissing: found?.photosMissing ?? 0,
    };
  }, [selectedBranch, branches, stats]);

  // Primary 1-Click Branch Export Action
  const handleDownloadBranchData = async (branchToExport = selectedBranch) => {
    if (isExporting) return;
    setIsExporting(true);

    const targetLabel = branchToExport === 'ALL' ? 'All Authorized Branches' : branchToExport;
    const toastId = toast.loading(`Generating authoritative ID card dataset for ${targetLabel}...`);

    try {
      const params = new URLSearchParams({
        branch: branchToExport,
        format: exportFormat,
      });

      const res = await fetch(`/api/staff/id-cards/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to export ID card data');
      }

      // Extract filename from response header or compute default
      const disposition = res.headers.get('Content-Disposition') || '';
      let filename = `KUCET_${branchToExport}_ID_CARD_DATA.${exportFormat}`;
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }

      const countHeader = res.headers.get('X-Total-Count');
      const count = countHeader ? parseInt(countHeader, 10) : null;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const successMsg = count 
        ? `Downloaded complete dataset: ${count} eligible students for ${targetLabel}`
        : `Downloaded complete ID card dataset for ${targetLabel}`;

      toast.success(successMsg, { id: toastId, duration: 4000 });
    } catch (err) {
      toast.error(err.message || 'Export failed', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Download Single Student ID Card PDF
  const handleDownloadSinglePdf = async (rollNo) => {
    setIsSingleDownloading(true);
    const toastId = toast.loading(`Generating official ID card PDF for ${rollNo}...`);
    try {
      const res = await fetch(`/api/staff/id-cards/${rollNo}/pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate ID card PDF');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kucet_id_card_${rollNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`ID Card PDF downloaded for ${rollNo}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Download failed', { id: toastId });
    } finally {
      setIsSingleDownloading(false);
    }
  };

  // Upload / Rectify Photo
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, or WEBP)');
      return;
    }
    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadPhotoSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadStudent) return;
    setIsUploading(true);
    const toastId = toast.loading('Uploading and updating photo in database...');
    try {
      const formData = new FormData();
      formData.append('rollNo', uploadStudent.rollNo);
      formData.append('file', uploadFile);

      const res = await fetch('/api/staff/id-cards/upload-photo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload photo');
      }

      const data = await res.json();
      toast.success('Photograph successfully persisted in database!', { id: toastId });

      // Refresh list & close modal
      setUploadStudent(null);
      setUploadFile(null);
      setUploadPreviewUrl(null);
      setRefreshKey(prev => prev + 1);

      // Update preview student if currently open
      if (previewStudent && previewStudent.rollNo === uploadStudent.rollNo) {
        setPreviewStudent(prev => ({
          ...prev,
          photoKey: data.photoKey,
          photoUrl: data.photoUrl,
          photoStatus: 'AVAILABLE',
        }));
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = async (student) => {
    setPreviewStudent(student);
    try {
      const res = await fetch(`/api/staff/id-cards/${student.rollNo}`);
      if (res.ok) {
        const data = await res.json();
        if (data.student) setPreviewStudent(data.student);
      }
    } catch {
      // Non-blocking preview fetch error
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Header & Quick Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-blue-50 text-[#0b3578] rounded-xl text-xl">🪪</span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  Student ID Card Data Collection &amp; Export
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Collect and export authoritative ID card datasets for finalized admissions with official roll numbers.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isLoading || isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              title="Refresh Authoritative Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Authoritative Readiness Metrics */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Finalized Students</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalEligible}</div>
                <div className="text-xs text-slate-500 mt-0.5">With official persisted roll numbers</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-700">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Photographs Available</div>
                <div className="text-2xl font-black text-emerald-800 mt-1">{stats.photosAvailable}</div>
                <div className="text-xs text-emerald-600 mt-0.5">
                  {stats.totalEligible > 0 ? ((stats.photosAvailable / stats.totalEligible) * 100).toFixed(1) : 0}% ready for printing
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className={`rounded-xl p-4 border flex items-center justify-between ${stats.photosMissing > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800">Photographs Pending</div>
                <div className="text-2xl font-black text-amber-900 mt-1">{stats.photosMissing}</div>
                <div className="text-xs text-amber-700 mt-0.5">
                  {stats.photosMissing > 0 ? 'Action required prior to printing' : 'All student photos ready'}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Branch Selection Dashboard */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#0b3578]" />
              Select Academic Branch
            </h2>
            <p className="text-xs text-slate-500">
              Select an institutional branch to view live student readiness counts and trigger a 1-click dataset export.
            </p>
          </div>

          <button
            onClick={() => { setSelectedBranch('ALL'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition border ${
              selectedBranch === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Authorized Branches ({stats?.totalEligible ?? 0})
          </button>
        </div>

        {/* Canonical Branch Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {CANONICAL_BRANCH_INFO.map((b) => {
            const isSelected = selectedBranch === b.name;
            const bStats = branches.find(item => item.branch === b.name);
            const total = bStats?.totalEligible ?? 0;
            const photosReady = bStats?.photosAvailable ?? 0;
            const photosMissing = bStats?.photosMissing ?? 0;
            const isAllowed = bStats ? bStats.isAllowed : true;

            return (
              <div
                key={b.name}
                onClick={() => {
                  if (isAllowed) {
                    setSelectedBranch(b.name);
                    setPage(1);
                  }
                }}
                className={`relative rounded-2xl p-4 transition text-left border cursor-pointer select-none ${
                  !isAllowed
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200'
                    : isSelected
                    ? 'bg-gradient-to-b from-[#0b3578]/5 to-[#0b3578]/10 border-[#0b3578] shadow-md ring-2 ring-[#0b3578]/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-black rounded-lg ${
                      isSelected ? 'bg-[#0b3578] text-white' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {b.name}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-slate-400 ml-2">
                      Code {b.code}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0b3578] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0b3578]"></span>
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs font-bold text-slate-800 truncate" title={b.fullName}>
                  {b.fullName}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <div>
                    <div className="text-xl font-black text-slate-900">{total}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Eligible Students</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-700">{photosReady} photos</div>
                    {photosMissing > 0 && (
                      <div className="text-[10px] font-bold text-amber-700">{photosMissing} pending</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Primary One-Click Branch Export Hero Panel */}
      <div className="bg-gradient-to-br from-[#0b3578] to-[#082452] text-white rounded-3xl p-6 md:p-8 shadow-xl border border-[#0b3578]/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-amber-300 rounded-full text-xs font-bold tracking-wide uppercase">
              <span>⚡ One-Click Dataset Export</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {currentBranchStats.name === 'ALL'
                ? 'All Authorized Academic Branches'
                : `${currentBranchStats.fullName} (${currentBranchStats.name})`}
            </h3>
            <p className="text-sm text-slate-200">
              Downloads a complete, authoritative dataset containing all <strong className="text-white">{currentBranchStats.totalEligible}</strong> finalized students and approved ID card fields without pagination cutoff.
            </p>

            <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Authoritative Roll Numbers
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Photographs &amp; Storage Keys
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Permanent Addresses &amp; Emergency Mobile
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
            {/* Format Selector */}
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl">
              <button
                onClick={() => setExportFormat('xlsx')}
                disabled={isExporting}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  exportFormat === 'xlsx'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel (.xlsx)
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                disabled={isExporting}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                  exportFormat === 'csv'
                    ? 'bg-amber-400 text-slate-900 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                CSV (.csv)
              </button>
            </div>

            {/* Main Action Button */}
            <button
              onClick={() => handleDownloadBranchData(selectedBranch)}
              disabled={isExporting || currentBranchStats.totalEligible === 0}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-black text-[#0b3578] bg-white hover:bg-slate-100 active:scale-[0.98] rounded-xl transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className={`w-5 h-5 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? (
                'Generating Dataset...'
              ) : currentBranchStats.totalEligible === 0 ? (
                'No Eligible Students'
              ) : (
                `Download ID Card Data (${currentBranchStats.totalEligible})`
              )}
            </button>
          </div>
        </div>

        {currentBranchStats.totalEligible === 0 && (
          <div className="mt-4 p-3 bg-amber-500/20 border border-amber-300/40 rounded-xl text-xs text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>No finalized students with persisted official roll numbers currently exist for this branch. Admissions must complete the finalization workflow before becoming eligible.</span>
          </div>
        )}
      </div>

      {/* 4. Secondary Feature: Eligible Students Preview Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>📋</span>
              Eligible Students Preview ({pagination.total})
            </h3>
            <p className="text-xs text-slate-500">
              Paginated preview of authoritative finalized records. Use the primary download action above to export all {currentBranchStats.totalEligible} records at once.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search roll number, name, phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Photo Filter */}
            <select
              value={photoFilter}
              onChange={(e) => { setPhotoFilter(e.target.value); setPage(1); }}
              className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-700"
            >
              <option value="ALL">All Photos</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="MISSING">Missing Only</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/70 text-slate-700 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3 w-12 text-center">S.No</th>
                <th className="py-3 px-3 w-16 text-center">Photo</th>
                <th className="py-3 px-4">Official Roll No</th>
                <th className="py-3 px-4">Student &amp; Father Name</th>
                <th className="py-3 px-3">Branch &amp; Batch</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Permanent Address</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-2" />
                    Loading authoritative student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="font-bold text-slate-600">No matching finalized student records found.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedBranch !== 'ALL'
                        ? `Branch ${selectedBranch} currently has no eligible students matching these filter criteria.`
                        : 'No eligible finalized students found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                students.map((st, idx) => {
                  const isPhotoMissing = st.photoStatus === 'MISSING';
                  const rowNumber = (page - 1) * limit + idx + 1;

                  return (
                    <tr key={st.rollNo} className="hover:bg-slate-50/80 transition">
                      {/* S.No */}
                      <td className="py-3 px-3 text-center text-xs font-mono text-slate-400">
                        {rowNumber}
                      </td>

                      {/* Photo Thumbnail */}
                      <td className="py-3 px-3 text-center">
                        {st.photoUrl && !isPhotoMissing ? (
                          <div 
                            onClick={() => handleOpenPreview(st)}
                            className="w-10 h-12 rounded border border-slate-300 overflow-hidden mx-auto cursor-pointer hover:ring-2 hover:ring-[#0b3578] transition bg-slate-100"
                            title="Click to preview ID card"
                          >
                            <img
                              src={st.photoUrl}
                              alt={st.studentName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setUploadStudent(st)}
                            className="w-10 h-12 rounded border-2 border-dashed border-red-300 bg-red-50 hover:bg-red-100 flex flex-col items-center justify-center text-red-600 mx-auto transition cursor-pointer"
                            title="Photograph Missing - Click to upload"
                          >
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-[9px] font-black uppercase">Add</span>
                          </button>
                        )}
                      </td>

                      {/* Official Roll Number */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-black text-slate-900 tracking-wide">
                          {st.rollNo}
                        </div>
                        <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Finalized
                        </div>
                      </td>

                      {/* Student & Father Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {st.studentName}
                        </div>
                        {st.fatherName && st.fatherName !== 'N/A' && (
                          <div className="text-xs text-slate-500">
                            F: {st.fatherName}
                          </div>
                        )}
                      </td>

                      {/* Branch & Batch */}
                      <td className="py-3 px-3">
                        <span className="inline-block px-2.5 py-0.5 text-xs font-black rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                          {st.branch}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {st.batch}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {st.studentPhone || '—'}
                        </span>
                      </td>

                      {/* Address */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-xs text-slate-600 truncate" title={st.studentAddress}>
                          {st.studentAddress || '—'}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          {/* Preview Card Button */}
                          <button
                            onClick={() => handleOpenPreview(st)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Interactive Card Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download Single Card PDF */}
                          <button
                            onClick={() => handleDownloadSinglePdf(st.rollNo)}
                            disabled={isSingleDownloading}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                            title="Download Card PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Upload Photo Button */}
                          <button
                            onClick={() => setUploadStudent(st)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Upload/Rectify Photograph"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <span className="font-bold">{students.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
            <span className="font-bold">{Math.min(page * limit, pagination.total)}</span> of{' '}
            <span className="font-bold">{pagination.total}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 5. Physical ID Card Simulation Modal */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-900 text-base">Student ID Card Preview</h3>
                <p className="text-xs text-slate-500 font-mono">{previewStudent.rollNo}</p>
              </div>
              <button
                onClick={() => setPreviewStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Physical Card Canvas Matching IDCardPDF */}
            <div className="p-6 bg-slate-100/80 flex justify-center">
              <div 
                className="w-[280px] h-[445px] bg-white rounded-xl shadow-md border border-slate-300 relative overflow-hidden flex flex-col select-none"
                style={{ fontFamily: 'sans-serif' }}
              >
                {/* 1. Header Area: Navy Curve and Title */}
                <div className="relative h-[95px] w-full">
                  <div 
                    className="absolute top-0 left-0 w-[78px] h-[95px] bg-[#0b3578] rounded-br-[22px] flex items-center justify-center z-10"
                  >
                    <div className="w-[58px] h-[58px] bg-white rounded-full flex items-center justify-center p-1">
                      <img
                        src="/assets/ku-college-logo.png"
                        alt="KUCET Crest"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="absolute top-2 left-[84px] right-2 z-10">
                    <div className="text-[17px] font-black text-black leading-tight tracking-wider">
                      KUCE&amp;T
                    </div>
                    <div className="text-[9px] font-bold text-[#0b3578] leading-tight mt-0.5">
                      KU COLLEGE OF ENGINEERING &amp; TECHNOLOGY
                    </div>
                    <div className="text-[6.5px] font-bold text-black mt-1 leading-tight">
                      KAKATIYA UNIVERSITY CAMPUS
                    </div>
                    <div className="text-[6.5px] font-bold text-black leading-tight">
                      VIDYARANYAPURI, WARANGAL 506 009
                    </div>
                    <div className="text-[6.5px] font-bold text-black leading-tight">
                      Tel: 91- 870 - 2449191
                    </div>
                  </div>
                </div>

                {/* 2. Ribbon: IDENTITY CARD */}
                <div className="relative mt-2 flex justify-end">
                  <div className="bg-[#e91e63] text-white text-[11px] font-black tracking-wider px-4 py-0.5 rounded-l-full shadow-sm">
                    IDENTITY CARD
                  </div>
                </div>

                {/* 3. Photo & Info Grid */}
                <div className="mt-3 px-3 flex gap-2.5">
                  <div className="w-[95px] h-[120px] border-2 border-[#0b3578] rounded bg-slate-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {previewStudent.photoUrl ? (
                      <img
                        src={previewStudent.photoUrl}
                        alt={previewStudent.studentName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <ImageIcon className="w-8 h-8 mx-auto" />
                        <span className="text-[9px] font-bold block mt-1 text-red-500">NO PHOTO</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 border border-[#d32f2f] rounded flex flex-col justify-between py-1 px-1.5 bg-red-50/20 text-[10px]">
                    <div className="border-b border-[#d32f2f] pb-1">
                      <span className="font-black text-black text-[11px]">
                        B.Tech ({previewStudent.branch})
                      </span>
                    </div>
                    <div className="border-b border-[#d32f2f] py-1">
                      <span className="text-slate-600 font-bold text-[9px] block">H.T. No:</span>
                      <span className="font-black text-black text-[11px]">
                        {previewStudent.rollNo}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-slate-600 font-bold text-[9px] block">Academic Year:</span>
                      <span className="font-black text-black text-[10.5px]">
                        {previewStudent.batch || '2026-2030'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Student Name & Father Name */}
                <div className="mt-3 px-3 text-left">
                  <div className="text-[13px] font-black text-[#d32f2f] uppercase leading-tight truncate">
                    {previewStudent.studentName}
                  </div>
                  <div className="text-[9px] font-bold text-black mt-1 truncate">
                    Father&apos;s Name: {(previewStudent.fatherName || 'N/A').toUpperCase()}
                  </div>
                </div>

                {/* 5. QR Code & Principal Signature */}
                <div className="mt-2 px-3 flex items-center justify-between">
                  <div className="w-[50px] h-[50px] border border-slate-300 p-0.5 bg-white rounded">
                    {previewStudent.qrUrl ? (
                      <img src={previewStudent.qrUrl} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[7px] text-slate-400">QR</div>
                    )}
                  </div>

                  <div className="text-center flex flex-col items-center">
                    <div className="text-[9.5px] font-bold text-[#2e7d32]">T.M. Reddy</div>
                    <div className="border-t border-black text-[9px] font-black text-black w-16 pt-0.5 mt-0.5">
                      Principal
                    </div>
                  </div>
                </div>

                {/* 6. Footer Address & Cell */}
                <div className="mt-auto pb-2 px-2 text-center border-t border-slate-100 pt-1">
                  <p className="text-[7.5px] font-bold text-black line-clamp-2 leading-tight">
                    {previewStudent.studentAddress}
                  </p>
                  <p className="text-[9px] font-black text-black mt-0.5">
                    Cell: {previewStudent.studentPhone}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setUploadStudent(previewStudent);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <Upload className="w-4 h-4" />
                Upload / Replace Photo
              </button>

              <button
                onClick={() => handleDownloadSinglePdf(previewStudent.rollNo)}
                disabled={isSingleDownloading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Upload Photo Modal */}
      {uploadStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-base">Upload Student Photograph</h3>
                <p className="text-xs text-slate-500">{uploadStudent.studentName} ({uploadStudent.rollNo})</p>
              </div>
              <button
                onClick={() => {
                  setUploadStudent(null);
                  setUploadFile(null);
                  setUploadPreviewUrl(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadPhotoSubmit} className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-slate-400 transition bg-slate-50/50">
                {uploadPreviewUrl ? (
                  <div className="space-y-3">
                    <div className="w-24 h-32 rounded-lg border-2 border-slate-900 overflow-hidden mx-auto shadow-md">
                      <img src={uploadPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-emerald-600 font-bold">Image ready for upload</p>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">Choose photograph file</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, or WEBP up to 5MB</p>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoSelect}
                  className="mt-4 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadStudent(null);
                    setUploadFile(null);
                    setUploadPreviewUrl(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  <Upload className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
                  {isUploading ? 'Uploading...' : 'Save & Update Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
