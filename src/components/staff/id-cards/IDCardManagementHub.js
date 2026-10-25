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
  FileText,
  Archive,
  Users,
  ShieldCheck
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

export default function IDCardManagementHub({ initialBranch = 'ALL' }) {
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

    const found = branches.find((b) => b.branch === selectedBranch);
    const fallback = CANONICAL_BRANCH_INFO.find((b) => b.name === selectedBranch);

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
    const formatLabel = exportFormat === 'xlsx' ? 'Excel with Embedded Photos' : exportFormat === 'zip' ? 'Photos ZIP Archive' : 'CSV Dataset';
    const toastId = toast.loading(`Generating ${formatLabel} for ${targetLabel}...`);

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
        ? `Downloaded ${count} eligible student records for ${targetLabel}`
        : `Downloaded complete dataset for ${targetLabel}`;

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
      setRefreshKey((prev) => prev + 1);

      // Update preview student if currently open
      if (previewStudent && previewStudent.rollNo === uploadStudent.rollNo) {
        setPreviewStudent((prev) => ({
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
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Student ID Cards
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Generate print-ready identity cards and export official datasets for finalized students with persisted roll numbers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isLoading || isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Refresh Authoritative Records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. Global Readiness Metrics */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Total Finalized Students
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalEligible}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Persisted official roll numbers
              </div>
            </div>
            <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0b3578]">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Photographs Available
              </div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">
                {stats.photosAvailable}
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5">
                {stats.totalEligible > 0 ? ((stats.photosAvailable / stats.totalEligible) * 100).toFixed(1) : 0}% print-ready
              </div>
            </div>
            <div className="w-10 h-10 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className={`bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between ${
            stats.photosMissing > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-gray-200'
          }`}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Photographs Pending
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-1">
                {stats.photosMissing}
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                {stats.photosMissing > 0 ? 'Action required prior to printing' : 'All student photos ready'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Branch Selection Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0b3578]" />
            <span className="text-sm font-semibold text-gray-900">Academic Branch</span>
          </div>

          <button
            onClick={() => { setSelectedBranch('ALL'); setPage(1); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition border cursor-pointer ${
              selectedBranch === 'ALL'
                ? 'bg-[#0b3578] text-white border-[#0b3578]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Authorized Branches ({stats?.totalEligible ?? 0})
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {CANONICAL_BRANCH_INFO.map((b) => {
            const isSelected = selectedBranch === b.name;
            const bStats = branches.find((item) => item.branch === b.name);
            const total = bStats?.totalEligible ?? 0;
            const photosReady = bStats?.photosAvailable ?? 0;
            const isAllowed = bStats ? bStats.isAllowed : true;

            return (
              <button
                key={b.name}
                type="button"
                onClick={() => {
                  if (isAllowed) {
                    setSelectedBranch(b.name);
                    setPage(1);
                  }
                }}
                disabled={!isAllowed}
                className={`p-3 rounded-lg text-left transition border cursor-pointer ${
                  !isAllowed
                    ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                    : isSelected
                    ? 'bg-blue-50/40 border-[#0b3578] ring-1 ring-[#0b3578]'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-[#0b3578]' : 'text-gray-900'}`}>
                    {b.name}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    {b.code}
                  </span>
                </div>

                <div className="mt-2 text-lg font-bold text-gray-900">
                  {total}
                </div>
                <div className="text-[10px] text-gray-500 truncate" title={b.fullName}>
                  {photosReady}/{total} photos
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. One-Click Branch Export Panel */}
      <div className="bg-[#0b3578] text-white rounded-lg p-5 shadow-sm border border-[#0b3578]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white border border-white/20">
                Official Export
              </span>
              <span className="text-xs text-blue-200 font-medium">
                {currentBranchStats.name === 'ALL'
                  ? 'All Authorized Academic Branches'
                  : `${currentBranchStats.fullName} (${currentBranchStats.name})`}
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              Export Authoritative ID Card Dataset ({currentBranchStats.totalEligible} Students)
            </h3>
            <p className="text-xs text-blue-100 leading-relaxed">
              Downloads complete finalized student records with official roll numbers, permanent addresses, and verified identity fields.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Format Selector */}
            <div className="flex items-center bg-black/25 p-1 rounded-md border border-white/10">
              <button
                type="button"
                onClick={() => setExportFormat('xlsx')}
                disabled={isExporting}
                className={`px-3 py-1.5 text-xs font-medium rounded transition flex items-center gap-1.5 cursor-pointer ${
                  exportFormat === 'xlsx'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Excel Workbook with high-quality embedded photographs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                disabled={isExporting}
                className={`px-3 py-1.5 text-xs font-medium rounded transition flex items-center gap-1.5 cursor-pointer ${
                  exportFormat === 'csv'
                    ? 'bg-white text-gray-900 shadow-sm font-semibold'
                    : 'text-gray-300 hover:text-white'
                }`}
                title="CSV plain text data with storage references"
              >
                <FileText className="w-3.5 h-3.5" />
                CSV (.csv)
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('zip')}
                disabled={isExporting}
                className={`px-3 py-1.5 text-xs font-medium rounded transition flex items-center gap-1.5 cursor-pointer ${
                  exportFormat === 'zip'
                    ? 'bg-amber-500 text-gray-900 shadow-sm font-semibold'
                    : 'text-gray-300 hover:text-white'
                }`}
                title="Companion ZIP archive with CSV and original photographs by roll number"
              >
                <Archive className="w-3.5 h-3.5" />
                Photos (.zip)
              </button>
            </div>

            {/* Main Action Button */}
            <button
              onClick={() => handleDownloadBranchData(selectedBranch)}
              disabled={isExporting || currentBranchStats.totalEligible === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-[#0b3578] bg-white hover:bg-gray-100 active:scale-[0.98] rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? 'Generating...' : `Download Dataset (${currentBranchStats.totalEligible})`}
            </button>
          </div>
        </div>

        {/* Informative Format Notice */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200">
          <div>
            {exportFormat === 'xlsx' && (
              <span>📷 <strong>Excel (.xlsx)</strong> contains decoded, high-resolution student photographs directly embedded in the worksheet cells.</span>
            )}
            {exportFormat === 'csv' && (
              <span>📄 <strong>CSV (.csv)</strong> contains plain text records and storage keys. (Spreadsheet image embedding is not supported in CSV).</span>
            )}
            {exportFormat === 'zip' && (
              <span>📦 <strong>Photos (.zip)</strong> packages the complete student dataset CSV alongside original high-res photos organized by roll number.</span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Eligible Students Preview Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Eligible Finalized Students ({pagination.total})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Authoritative records with persisted roll numbers matching current branch and filters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search roll, name, mobile..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Photo Filter */}
            <select
              value={photoFilter}
              onChange={(e) => { setPhotoFilter(e.target.value); setPage(1); }}
              className="py-1.5 px-2.5 text-xs bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578] text-gray-700"
            >
              <option value="ALL">All Photos</option>
              <option value="AVAILABLE">Available</option>
              <option value="MISSING">Missing</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">S.No</th>
                <th className="py-2.5 px-3 w-14 text-center">Photo</th>
                <th className="py-2.5 px-4">Official Roll No</th>
                <th className="py-2.5 px-4">Student &amp; Father Name</th>
                <th className="py-2.5 px-3">Branch &amp; Batch</th>
                <th className="py-2.5 px-4">Mobile</th>
                <th className="py-2.5 px-4">Permanent Address</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400 mb-2" />
                    Loading authoritative student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <p className="font-medium text-gray-700">No matching finalized student records found.</p>
                    <p className="text-xs text-gray-500 mt-1">
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
                    <tr key={st.rollNo || st.roll_number || idx} className="hover:bg-gray-50/70 transition">
                      <td className="py-2 px-3 text-center text-gray-400 font-mono">
                        {rowNumber}
                      </td>

                      <td className="py-2 px-3 text-center">
                        {st.photoUrl && !isPhotoMissing ? (
                          <div 
                            onClick={() => handleOpenPreview(st)}
                            className="w-8 h-10 rounded border border-gray-300 overflow-hidden mx-auto cursor-pointer hover:ring-1 hover:ring-[#0b3578] transition bg-gray-50"
                            title="Click to preview ID card"
                          >
                            <img
                              src={st.photoUrl}
                              alt={st.studentName || st.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setUploadStudent(st)}
                            className="w-8 h-10 rounded border border-dashed border-red-300 bg-red-50 hover:bg-red-100 flex flex-col items-center justify-center text-red-600 mx-auto transition cursor-pointer"
                            title="Photograph Missing - Click to upload"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span className="text-[8px] font-bold uppercase mt-0.5">Add</span>
                          </button>
                        )}
                      </td>

                      <td className="py-2 px-4">
                        <div className="font-mono font-bold text-gray-900 tracking-wide">
                          {st.rollNo || st.roll_number}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Finalized
                        </div>
                      </td>

                      <td className="py-2 px-4">
                        <div className="font-semibold text-gray-900">
                          {st.studentName || st.name}
                        </div>
                        {st.fatherName && st.fatherName !== 'N/A' && (
                          <div className="text-[11px] text-gray-500">
                            F: {st.fatherName}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded bg-gray-100 text-gray-800 border border-gray-200">
                          {st.branch}
                        </span>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {st.batch}
                        </div>
                      </td>

                      <td className="py-2 px-4 font-mono text-gray-700">
                        {st.studentPhone || '—'}
                      </td>

                      <td className="py-2 px-4 max-w-xs">
                        <p className="text-gray-600 truncate text-[11px]" title={st.studentAddress}>
                          {st.studentAddress || '—'}
                        </p>
                      </td>

                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleOpenPreview(st)}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition cursor-pointer"
                            title="Interactive Card Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDownloadSinglePdf(st.rollNo)}
                            disabled={isSingleDownloading}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition disabled:opacity-50 cursor-pointer"
                            title="Download Card PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setUploadStudent(st)}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition cursor-pointer"
                            title="Upload/Rectify Photograph"
                          >
                            <Upload className="w-3.5 h-3.5" />
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
        <div className="p-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 bg-gray-50/30">
          <div>
            Showing <span className="font-semibold text-gray-700">{students.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
            <span className="font-semibold text-gray-700">{Math.min(page * limit, pagination.total)}</span> of{' '}
            <span className="font-semibold text-gray-700">{pagination.total}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer"
            >
              Previous
            </button>
            <span className="font-medium text-gray-700">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-2.5 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 6. Physical ID Card Simulation Modal */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Student ID Card Preview</h3>
                <p className="text-xs text-gray-500 font-mono">{previewStudent.rollNo}</p>
              </div>
              <button
                onClick={() => setPreviewStudent(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Physical Card Canvas Matching IDCardPDF */}
            <div className="p-4 bg-gray-100/70 flex justify-center">
              <div 
                className="w-[242px] h-[385px] bg-white rounded-lg shadow border border-gray-300 relative overflow-hidden flex flex-col select-none"
                style={{ fontFamily: 'sans-serif' }}
              >
                {/* 1. Header Area: Navy Curve and Title */}
                <div className="relative h-[82px] w-full">
                  <div 
                    className="absolute top-0 left-0 w-[68px] h-[82px] bg-[#0b3578] rounded-br-[20px] flex items-center justify-center z-10"
                  >
                    <div className="w-[48px] h-[48px] bg-white rounded-full flex items-center justify-center p-1">
                      <img
                        src="/assets/ku-college-logo.png"
                        alt="KUCET Crest"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="absolute top-1.5 left-[74px] right-2 z-10">
                    <div className="text-[17px] font-black text-black leading-tight tracking-wider">
                      KUCE&amp;T
                    </div>
                    <div className="text-[7.5px] font-bold text-[#0b3578] leading-tight mt-0.5">
                      KU COLLEGE OF ENGINEERING &amp; TECHNOLOGY
                    </div>
                    <div className="text-[6px] font-bold text-black mt-0.5 leading-tight">
                      KAKATIYA UNIVERSITY CAMPUS
                    </div>
                    <div className="text-[6px] font-bold text-black leading-tight">
                      VIDYARANYAPURI, WARANGAL 506 009
                    </div>
                    <div className="text-[6px] font-bold text-black leading-tight">
                      Tel: 91- 870 - 2449191
                    </div>
                  </div>
                </div>

                {/* 2. Ribbon: IDENTITY CARD */}
                <div className="relative mt-0.5 flex justify-end">
                  <div className="bg-[#e91e63] text-white text-[9.5px] font-black tracking-wider px-3 py-0.5 rounded-l-md shadow-sm">
                    IDENTITY CARD
                  </div>
                </div>

                {/* 3. Photo & Info Grid */}
                <div className="mt-1.5 px-2.5 flex gap-2">
                  <div className="w-[78px] h-[98px] border-2 border-[#0b3578] rounded bg-slate-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {previewStudent.photoUrl ? (
                      <img
                        src={previewStudent.photoUrl}
                        alt={previewStudent.studentName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <ImageIcon className="w-6 h-6 mx-auto" />
                        <span className="text-[8px] font-bold block mt-1 text-red-500">NO PHOTO</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 h-[98px] border border-[#d32f2f] rounded flex flex-col justify-between py-1 px-1.5 bg-red-50/20 text-[9px]">
                    <div className="border-b border-[#fca5a5] pb-0.5">
                      <span className="font-black text-black text-[9.5px]">
                        B.Tech ({previewStudent.branch})
                      </span>
                    </div>
                    <div className="border-b border-[#fca5a5] py-0.5">
                      <span className="text-slate-600 font-bold text-[7.5px] block">H.T. No:</span>
                      <span className="font-black text-black text-[9.5px]">
                        {previewStudent.rollNo}
                      </span>
                    </div>
                    <div className="pt-0.5">
                      <span className="text-slate-600 font-bold text-[7.5px] block">Academic Year:</span>
                      <span className="font-black text-black text-[9px]">
                        {previewStudent.batch || '2026-2030'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Student Name & Father Name */}
                <div className="mt-1.5 px-2.5 text-left">
                  <div className="text-[10.5px] font-black text-[#d32f2f] uppercase leading-tight truncate">
                    {previewStudent.studentName}
                  </div>
                  <div className="text-[8px] font-bold text-black mt-0.5 truncate">
                    Father&apos;s Name: {(previewStudent.fatherName || 'N/A').toUpperCase()}
                  </div>
                </div>

                {/* 5. QR Code & Authentic Principal Signature */}
                <div className="mt-1.5 px-2.5 flex items-end justify-between">
                  <div className="w-[46px] h-[46px] border border-slate-300 p-0.5 bg-white rounded">
                    {previewStudent.qrUrl ? (
                      <img src={previewStudent.qrUrl} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[7px] text-slate-400">QR</div>
                    )}
                  </div>

                  <div className="w-[85px] flex flex-col items-center justify-end">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 mb-1 rounded bg-emerald-50 border border-emerald-300/80 shadow-xs">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="text-[7.5px] font-bold text-emerald-800 tracking-tight leading-none whitespace-nowrap">
                        Verified Seal
                      </span>
                    </div>
                    <div className="border-t border-black text-[8px] font-black text-black w-[65px] text-center pt-0.5">
                      Principal
                    </div>
                  </div>
                </div>

                {/* 6. Footer Address & Cell */}
                <div className="mt-auto pb-1.5 px-2 text-center border-t border-slate-100 pt-0.5">
                  <p className="text-[6.5px] font-bold text-black line-clamp-2 leading-tight">
                    {previewStudent.studentAddress}
                  </p>
                  <p className="text-[7.5px] font-black text-black mt-0.5">
                    Cell: {previewStudent.studentPhone}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setUploadStudent(previewStudent)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
              </button>

              <button
                onClick={() => handleDownloadSinglePdf(previewStudent.rollNo)}
                disabled={isSingleDownloading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#0b3578] hover:bg-[#082452] rounded-md transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Upload Photo Modal */}
      {uploadStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Upload Student Photograph</h3>
                <p className="text-xs text-gray-500">{uploadStudent.studentName} ({uploadStudent.rollNo})</p>
              </div>
              <button
                onClick={() => {
                  setUploadStudent(null);
                  setUploadFile(null);
                  setUploadPreviewUrl(null);
                }}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadPhotoSubmit} className="p-5 space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center hover:border-gray-400 transition bg-gray-50/50">
                {uploadPreviewUrl ? (
                  <div className="space-y-2">
                    <div className="w-20 h-26 rounded border border-gray-300 overflow-hidden mx-auto shadow-sm">
                      <img src={uploadPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-emerald-700 font-medium">Image ready for upload</p>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-700">Select photograph file</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, or WEBP up to 5MB</p>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoSelect}
                  className="mt-3 text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#0b3578] file:text-white hover:file:bg-[#082452] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUploadStudent(null);
                    setUploadFile(null);
                    setUploadPreviewUrl(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#0b3578] hover:bg-[#082452] rounded-md transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
                  {isUploading ? 'Uploading...' : 'Save & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
