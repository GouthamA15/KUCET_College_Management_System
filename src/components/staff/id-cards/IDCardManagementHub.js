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
  Image as ImageIcon 
} from 'lucide-react';

const BRANCHES = ['ALL', 'CIVIL', 'CSD', 'CSE', 'ECE', 'EEE', 'IT', 'MECH'];

export default function IDCardManagementHub({ initialBranch = 'ALL' }) {
  // Filters & Pagination State
  const [branch, setBranch] = useState(initialBranch);
  const [search, setSearch] = useState('');
  const [photoFilter, setPhotoFilter] = useState('ALL');
  const [addressFilter, setAddressFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Data State
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Selection & Bulk State
  const [selectedRolls, setSelectedRolls] = useState(new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  // Modals State
  const [previewStudent, setPreviewStudent] = useState(null);
  const [uploadStudent, setUploadStudent] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSingleDownloading, setIsSingleDownloading] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch student list
  useEffect(() => {
    let ignore = false;
    async function loadStudents() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          branch,
          search,
          photoStatus: photoFilter,
          addressStatus: addressFilter,
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
          setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
          setStats(data.stats || null);
        }
      } catch (err) {
        if (!ignore) {
          toast.error(err.message || 'Error loading records');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadStudents();
    return () => {
      ignore = true;
    };
  }, [branch, search, photoFilter, addressFilter, page, limit, refreshKey]);

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

  // Selection Handling
  const handleSelectAllOnPage = () => {
    const newSet = new Set(selectedRolls);
    const allSelected = students.every(s => newSet.has(s.rollNo));
    if (allSelected) {
      students.forEach(s => newSet.delete(s.rollNo));
    } else {
      students.forEach(s => newSet.add(s.rollNo));
    }
    setSelectedRolls(newSet);
  };

  const handleToggleSelect = (rollNo) => {
    const newSet = new Set(selectedRolls);
    if (newSet.has(rollNo)) newSet.delete(rollNo);
    else newSet.add(rollNo);
    setSelectedRolls(newSet);
  };

  const isAllOnPageSelected = useMemo(() => {
    if (students.length === 0) return false;
    return students.every(s => selectedRolls.has(s.rollNo));
  }, [students, selectedRolls]);

  // Download Single PDF
  const handleDownloadSinglePdf = async (rollNo) => {
    setIsSingleDownloading(true);
    try {
      const toastId = toast.loading(`Generating PDF for ${rollNo}...`);
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
      toast.success(`ID Card downloaded for ${rollNo}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Download failed');
    } finally {
      setIsSingleDownloading(false);
    }
  };

  // Bulk PDF Generation
  const handleBulkDownload = async () => {
    if (selectedRolls.size === 0) return;
    setIsBulkDownloading(true);
    const toastId = toast.loading(`Generating bulk PDF for ${selectedRolls.size} students...`);
    try {
      const res = await fetch('/api/staff/id-cards/bulk-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNos: Array.from(selectedRolls) })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate bulk PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kucet_id_cards_batch_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Successfully downloaded ${selectedRolls.size} ID cards`, { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Bulk generation failed', { id: toastId });
    } finally {
      setIsBulkDownloading(false);
    }
  };

  // Upload / Rectify Photo
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadPhotoSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadStudent) return;
    setIsUploading(true);
    const toastId = toast.loading('Uploading photo...');
    try {
      const formData = new FormData();
      formData.append('rollNo', uploadStudent.rollNo);
      formData.append('file', uploadFile);

      const res = await fetch('/api/staff/id-cards/upload-photo', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload photo');
      }

      const data = await res.json();
      toast.success('Photo updated successfully!', { id: toastId });

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
          photoStatus: 'AVAILABLE'
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
      // Ignore background fetch error
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header & Quick Stats */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪪</span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Student ID Card Management
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Reconciled official student records, interactive card previews, and individual or bulk batch PDF printing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Enrolled</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalInScope}</div>
              <div className="text-xs text-slate-500 mt-0.5">Authoritative students</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Photos Ready</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">{stats.photosAvailable}</div>
              <div className="text-xs text-emerald-600 mt-0.5">{((stats.photosAvailable / stats.totalInScope) * 100).toFixed(1)}% complete</div>
            </div>

            <div className={`rounded-xl p-3 border ${stats.photosMissing > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">Photos Missing</div>
              <div className="text-2xl font-black text-amber-900 mt-1">{stats.photosMissing}</div>
              <div className="text-xs text-amber-700 mt-0.5">Action required</div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">Addresses Ready</div>
              <div className="text-2xl font-black text-blue-800 mt-1">{stats.addressesAvailable}</div>
              <div className="text-xs text-blue-600 mt-0.5">{stats.addressesNeedsReview} review flagged</div>
            </div>

            <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-purple-700">Phone Numbers</div>
              <div className="text-2xl font-black text-purple-800 mt-1">{stats.phonesAvailable}</div>
              <div className="text-xs text-purple-600 mt-0.5">100% decrypted</div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filters & Search Control Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        {/* Branch Tabs */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
            Academic Branch
          </label>
          <div className="flex flex-wrap gap-1.5">
            {BRANCHES.map((b) => {
              const active = branch === b;
              const count = stats?.branchCounts?.[b] || (b === 'ALL' ? stats?.totalInScope : 0);
              return (
                <button
                  key={b}
                  onClick={() => { setBranch(b); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{b === 'ALL' ? 'All Branches' : b}</span>
                  {count !== undefined && count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search, Photo Filter & Quality Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by roll number, student name, father name, phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Photo Status Filter */}
          <div>
            <select
              value={photoFilter}
              onChange={(e) => { setPhotoFilter(e.target.value); setPage(1); }}
              className="w-full py-2.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-700"
            >
              <option value="ALL">All Photograph Statuses</option>
              <option value="AVAILABLE">Photographs Available</option>
              <option value="MISSING">Photographs Missing Only</option>
            </select>
          </div>

          {/* Address Status Filter */}
          <div>
            <select
              value={addressFilter}
              onChange={(e) => { setAddressFilter(e.target.value); setPage(1); }}
              className="w-full py-2.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-700"
            >
              <option value="ALL">All Address Quality</option>
              <option value="AVAILABLE">Fully Verified Addresses</option>
              <option value="NEEDS_REVIEW">Needs Review / Rural Localities</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Floating Bulk Action Bar */}
      {selectedRolls.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 mx-auto max-w-xl z-40 px-4">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <p className="font-bold text-sm">
                  {selectedRolls.size} {selectedRolls.size === 1 ? 'student' : 'students'} selected
                </p>
                <p className="text-xs text-slate-400">Ready for batch ID-card generation</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedRolls(new Set())}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Clear
              </button>
              <button
                onClick={handleBulkDownload}
                disabled={isBulkDownloading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-sm disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${isBulkDownloading ? 'animate-bounce' : ''}`} />
                {isBulkDownloading ? 'Generating...' : `Generate Batch PDF (${selectedRolls.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Student Records Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Student Records ({pagination.total})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAllOnPage}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 underline"
            >
              {isAllOnPageSelected ? 'Deselect Page' : 'Select All on Page'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100/70 text-slate-700 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllOnPageSelected}
                    onChange={handleSelectAllOnPage}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">S.No</th>
                <th className="py-3 px-3 w-16 text-center">Photo</th>
                <th className="py-3 px-4">Hall Ticket / Roll No</th>
                <th className="py-3 px-4">Student & Father Name</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Permanent Address</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-2" />
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No matching student records found.
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const isSelected = selectedRolls.has(st.rollNo);
                  const isPhotoMissing = st.photoStatus === 'MISSING';

                  return (
                    <tr
                      key={st.rollNo}
                      className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-amber-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(st.rollNo)}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </td>

                      {/* S.No */}
                      <td className="py-3 px-3 text-center text-xs font-mono text-slate-400">
                        {st.sNo}
                      </td>

                      {/* Photo Thumbnail */}
                      <td className="py-3 px-3 text-center">
                        {st.photoUrl && !isPhotoMissing ? (
                          <div 
                            onClick={() => handleOpenPreview(st)}
                            className="w-10 h-12 rounded border border-slate-300 overflow-hidden mx-auto cursor-pointer hover:ring-2 hover:ring-slate-900 transition bg-slate-100"
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
                            className="w-10 h-12 rounded border-2 border-dashed border-red-300 bg-red-50 hover:bg-red-100 flex flex-col items-center justify-center text-red-600 mx-auto transition"
                            title="Photograph Missing - Click to upload"
                          >
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-[9px] font-black uppercase">Add</span>
                          </button>
                        )}
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-black text-slate-900 tracking-wide">
                          {st.rollNo}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {st.academicYear}
                        </div>
                      </td>

                      {/* Student & Father Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {st.studentName}
                        </div>
                        {st.fatherName && (
                          <div className="text-xs text-slate-500">
                            F: {st.fatherName}
                          </div>
                        )}
                      </td>

                      {/* Branch Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-1 text-xs font-black rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                          {st.branch}
                        </span>
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
                        {st.addressStatus === 'NEEDS_REVIEW' && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Rural Locality
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Preview Button */}
                          <button
                            onClick={() => handleOpenPreview(st)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Preview ID Card"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download Single PDF */}
                          <button
                            onClick={() => handleDownloadSinglePdf(st.rollNo)}
                            disabled={isSingleDownloading}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Upload/Replace Photo */}
                          <button
                            onClick={() => setUploadStudent(st)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Upload/Replace Photograph"
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
        <div className="p-4 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
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

      {/* 5. Interactive Card Preview Modal */}
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
              {/* ID Card Simulation Box: 242pt x 385pt ratio */}
              <div 
                className="w-[280px] h-[445px] bg-white rounded-xl shadow-md border border-slate-300 relative overflow-hidden flex flex-col select-none"
                style={{ fontFamily: 'sans-serif' }}
              >
                {/* 1. Header Area: Navy Curve and Title */}
                <div className="relative h-[95px] w-full">
                  {/* Blue badge */}
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

                  {/* Header Text */}
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
                  {/* Photo box */}
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

                  {/* Info Grid */}
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
                        {previewStudent.academicYear || '2026-2030'}
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
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
