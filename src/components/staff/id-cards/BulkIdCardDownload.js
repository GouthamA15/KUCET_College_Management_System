'use client';

import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Download,
  Archive,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  RefreshCw,
  ShieldCheck,
  Layers,
  Info,
} from 'lucide-react';
import Link from 'next/link';

const CANONICAL_BRANCHES = [
  { code: '09', name: 'CSE', fullName: 'Computer Science & Engineering' },
  { code: '18', name: 'IT', fullName: 'Information Technology' },
  { code: '30', name: 'CSD', fullName: 'Computer Science & Data Science' },
  { code: '15', name: 'ECE', fullName: 'Electronics & Communication Engineering' },
  { code: '12', name: 'EEE', fullName: 'Electrical & Electronics Engineering' },
  { code: '00', name: 'CIVIL', fullName: 'Civil Engineering' },
  { code: '03', name: 'MECH', fullName: 'Mechanical Engineering' },
];

const GENERATION_PHASES = [
  { id: 1, label: 'Validating permissions & scope' },
  { id: 2, label: 'Fetching eligible finalized students' },
  { id: 3, label: 'Validating student records & roll numbers' },
  { id: 4, label: 'Loading photographs & institutional credentials' },
  { id: 5, label: 'Generating individual student PDF cards' },
  { id: 6, label: 'Packaging into structured ZIP archive' },
  { id: 7, label: 'Preparing secure download stream' },
  { id: 8, label: 'Generation completed successfully' },
];

export default function BulkIdCardDownload({ defaultBranch = 'ALL', isCoordinatorMode = false }) {
  // State
  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [academicLevel, setAcademicLevel] = useState('FIRST_YEAR');
  const [academicYear, setAcademicYear] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Generation & Progress State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [generationResult, setGenerationResult] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch Preview Summary
  useEffect(() => {
    let ignore = false;
    const loadPreview = async () => {
      try {
        const params = new URLSearchParams({
          branch: selectedBranch,
          academicLevel,
        });
        if (academicYear) params.set('academicYear', academicYear);

        const res = await fetch(`/api/staff/admission/id-cards/bulk/preview?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load ID card preview metrics');
        }

        const data = await res.json();
        if (!ignore) {
          setPreviewData(data);
          if (data.academicYear && !academicYear) {
            setAcademicYear(data.academicYear);
          }
        }
      } catch (err) {
        if (!ignore) {
          toast.error(err.message || 'Error fetching student eligibility counts');
        }
      } finally {
        if (!ignore) {
          setIsLoadingPreview(false);
        }
      }
    };

    loadPreview();
    return () => {
      ignore = true;
    };
  }, [selectedBranch, academicLevel, academicYear, refreshTrigger]);

  const isCoordinator = isCoordinatorMode || Boolean(previewData?.isFirstYearOnly);

  // Dynamic Information for Current Branch Selection
  const currentBranchStats = useMemo(() => {
    if (!previewData?.branches) return null;
    if (selectedBranch === 'ALL') {
      return {
        name: 'ALL',
        fullName: 'All Authorized Academic Branches',
        totalEligible: previewData.totalEligible || 0,
        photosAvailable: previewData.photosAvailable || 0,
        photosMissing: previewData.photosMissing || 0,
      };
    }
    const found = previewData.branches.find((b) => b.branch === selectedBranch);
    const fallback = CANONICAL_BRANCHES.find((b) => b.name === selectedBranch);
    return {
      name: selectedBranch,
      fullName: found?.branchFullName || fallback?.fullName || selectedBranch,
      totalEligible: found?.totalEligible ?? 0,
      photosAvailable: found?.photosAvailable ?? 0,
      photosMissing: found?.photosMissing ?? 0,
      isAllowed: found ? found.isAllowed : true,
    };
  }, [selectedBranch, previewData]);

  // Handle Generation Trigger
  const handleStartGeneration = async () => {
    if (isGenerating) return;
    if (!previewData || previewData.totalEligible === 0) {
      toast.error('No eligible finalized students found for the selected scope');
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);
    setCurrentPhase(1);

    // Simulate honest progress phase increments
    const phaseTimer = setInterval(() => {
      setCurrentPhase((prev) => {
        if (prev < 6) return prev + 1;
        return prev;
      });
    }, 900);

    try {
      const res = await fetch('/api/staff/admission/id-cards/bulk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: selectedBranch,
          academicLevel: isCoordinator ? 'FIRST_YEAR' : academicLevel,
          academicYear,
        }),
      });

      clearInterval(phaseTimer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate bulk student ID card package');
      }

      const result = await res.json();
      setCurrentPhase(7);

      setTimeout(() => {
        setCurrentPhase(8);
        setGenerationResult(result);
        setIsGenerating(false);
        toast.success(`Generated ${result.generatedCount} individual student ID cards!`, { duration: 4500 });
      }, 600);
    } catch (err) {
      clearInterval(phaseTimer);
      setIsGenerating(false);
      setCurrentPhase(0);
      toast.error(err.message || 'Bulk generation failed');
    }
  };

  // Handle ZIP Download Action
  const handleDownloadZip = async () => {
    if (!generationResult?.downloadUrl || isDownloading) return;

    setIsDownloading(true);
    const toastId = toast.loading('Initiating ZIP archive download...');
    try {
      const res = await fetch(generationResult.downloadUrl);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Download failed or link has expired');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generationResult.zipFilename || `KUCET_ID_Cards_${selectedBranch}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success('ZIP archive downloaded successfully!', { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Failed to download ZIP file', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Header & Navigation Context ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0b3578]/10 text-[#0b3578] border border-[#0b3578]/20">
              <Archive className="w-3 h-3" />
              Production Bulk Generator
            </span>
            {isCoordinator && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <ShieldCheck className="w-3 h-3" />
                First-Year Coordinator Scope
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Bulk Student ID Card Generation
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-3xl">
            Generate individual student ID card PDFs and download them together as a single ZIP archive.
            All cards strictly preserve approved KUCET formatting, scannable QR verification, and high-resolution photographs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Link
            href="/staff/admission/id-cards"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-xs transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-gray-500" />
            Individual Hub
          </Link>
          <button
            onClick={() => {
              setIsLoadingPreview(true);
              setRefreshTrigger((prev) => prev + 1);
            }}
            disabled={isLoadingPreview || isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Refresh Eligible Records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── 2. Selection Controls Panel ────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-5">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#0b3578]" />
          Target Population & Scope Selection
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Academic Level */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Academic Level
            </label>
            <div className="relative">
              <select
                value={academicLevel}
                onChange={(e) => {
                  setIsLoadingPreview(true);
                  setAcademicLevel(e.target.value);
                }}
                disabled={isCoordinator || isGenerating}
                className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] disabled:bg-gray-100 disabled:text-gray-500 cursor-pointer"
              >
                <option value="FIRST_YEAR">First Year (Semesters 1 & 2)</option>
                {!isCoordinator && (
                  <>
                    <option value="SECOND_YEAR">Second Year (Semesters 3 & 4)</option>
                    <option value="THIRD_YEAR">Third Year (Semesters 5 & 6)</option>
                    <option value="FOURTH_YEAR">Fourth Year (Semesters 7 & 8)</option>
                    <option value="ALL">All Academic Years</option>
                  </>
                )}
              </select>
            </div>
            {isCoordinator && (
              <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />
                Locked: First-Year Coordinator authority is restricted strictly to First Year.
              </p>
            )}
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Academic Year
            </label>
            <div className="relative">
              <input
                type="text"
                value={academicYear || previewData?.academicYear || 'Loading...'}
                onChange={(e) => setAcademicYear(e.target.value)}
                disabled={isGenerating}
                placeholder="e.g. 2026-27"
                className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] disabled:bg-gray-100"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Synchronized with active calendar session.
            </p>
          </div>

          {/* Target Branch Scope */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Branch Scope
            </label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setIsLoadingPreview(true);
                  setSelectedBranch(e.target.value);
                }}
                disabled={isGenerating}
                className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-[#0b3578] focus:ring-1 focus:ring-[#0b3578] disabled:bg-gray-100 cursor-pointer"
              >
                <option value="ALL">All Authorized Branches (All 7 Branches)</option>
                {CANONICAL_BRANCHES.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.code}) — {b.fullName}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Select one branch or generate institution-wide First Year cards.
            </p>
          </div>
        </div>

        {/* Canonical Branch Tiles */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#0b3578]" />
              Canonical Branches Breakdown
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLoadingPreview(true);
                setSelectedBranch('ALL');
              }}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer border ${
                selectedBranch === 'ALL'
                  ? 'bg-[#0b3578] text-white border-[#0b3578]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              All Branches ({previewData?.totalEligible ?? 0})
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {CANONICAL_BRANCHES.map((b) => {
              const isSelected = selectedBranch === b.name;
              const bStats = previewData?.branches?.find((item) => item.branch === b.name);
              const total = bStats?.totalEligible ?? 0;
              const photosReady = bStats?.photosAvailable ?? 0;
              const isAllowed = bStats ? bStats.isAllowed : true;

              return (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => {
                    if (isAllowed && !isGenerating) {
                      setIsLoadingPreview(true);
                      setSelectedBranch(b.name);
                    }
                  }}
                  disabled={!isAllowed || isGenerating}
                  className={`p-2.5 rounded-lg text-left transition border cursor-pointer ${
                    !isAllowed
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                      : isSelected
                      ? 'bg-blue-50/70 border-[#0b3578] ring-1 ring-[#0b3578]'
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
                  <div className="mt-1 text-base font-bold text-gray-900">
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
      </div>

      {/* ─── 3. Eligibility Preview Summary ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-sm font-bold text-gray-900 flex items-center justify-between mb-4">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Eligibility & Readiness Preview
          </span>
          {isLoadingPreview && (
            <span className="text-xs font-normal text-gray-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Calculating authoritative counts...
            </span>
          )}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Total Eligible */}
          <div className="bg-gray-50/80 border border-gray-200 rounded-lg p-3.5">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Total Finalized Students
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {currentBranchStats?.totalEligible ?? previewData?.totalEligible ?? 0}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Active records with roll numbers
            </div>
          </div>

          {/* Photos Available */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3.5">
            <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
              Photographs Available
            </div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">
              {currentBranchStats?.photosAvailable ?? previewData?.photosAvailable ?? 0}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              Ready for immediate printing
            </div>
          </div>

          {/* Photos Missing */}
          <div className={`rounded-lg p-3.5 border ${
            (currentBranchStats?.photosMissing ?? previewData?.photosMissing ?? 0) > 0
              ? 'bg-amber-50/60 border-amber-300'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              Photographs Missing
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1">
              {currentBranchStats?.photosMissing ?? previewData?.photosMissing ?? 0}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              Will render with NO PHOTO marker
            </div>
          </div>

          {/* Expected Output */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3.5">
            <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
              Expected Output
            </div>
            <div className="text-2xl font-bold text-[#0b3578] mt-1">
              {currentBranchStats?.totalEligible ?? previewData?.totalEligible ?? 0} PDFs
            </div>
            <div className="text-[11px] text-blue-700 mt-0.5">
              Packaged in 1 ZIP archive
            </div>
          </div>
        </div>

        {/* Invariant Policy Notice */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#0b3578] shrink-0" />
            <span>
              Draft, pending, incomplete or dropped admission records are strictly excluded by institutional invariants.
            </span>
          </div>
          <div className="text-gray-400 font-mono text-[11px]">
            ZIP Convention: ROLLNUMBER_STUDENTNAME_ID_CARD.pdf
          </div>
        </div>
      </div>

      {/* ─── 4. Primary Action & Generation Progress ───────────────────────── */}
      <div className="bg-[#0b3578] text-white rounded-xl p-6 shadow-md border border-[#0b3578] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white border border-white/20">
                Archive Builder
              </span>
              <span className="text-xs text-blue-200 font-medium">
                {currentBranchStats?.name === 'ALL'
                  ? 'All Authorized Academic Branches'
                  : `${currentBranchStats?.fullName} (${currentBranchStats?.name})`}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Generate & Download ZIP Archive ({currentBranchStats?.totalEligible ?? previewData?.totalEligible ?? 0} ID Cards)
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              Generates individual PDF ID cards for all eligible finalized students, organizes them into branch folders,
              and bundles them with an institutional verification audit manifest into a single downloadable ZIP file.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleStartGeneration}
              disabled={isGenerating || (currentBranchStats?.totalEligible ?? 0) === 0}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs sm:text-sm font-bold text-[#0b3578] bg-white hover:bg-gray-100 active:scale-[0.98] rounded-lg transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <Download className={`w-4 h-4 ${isGenerating ? 'animate-bounce' : ''}`} />
              {isGenerating ? 'Generating ID Cards...' : `Generate & Download ZIP (${currentBranchStats?.totalEligible ?? 0})`}
            </button>
          </div>
        </div>

        {/* Phase-Based Stepper Progress */}
        {isGenerating && (
          <div className="mt-5 pt-5 border-t border-white/15 space-y-4">
            <div className="flex items-center justify-between text-xs text-blue-200">
              <span className="font-semibold flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Phase {currentPhase} of {GENERATION_PHASES.length}: {GENERATION_PHASES[currentPhase - 1]?.label || 'Processing...'}
              </span>
              <span>{Math.round((currentPhase / GENERATION_PHASES.length) * 100)}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-blue-950/60 rounded-full h-2 overflow-hidden border border-white/10">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(currentPhase / GENERATION_PHASES.length) * 100}%` }}
              />
            </div>

            {/* Stepper items */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {GENERATION_PHASES.map((p) => {
                const isPassed = currentPhase > p.id;
                const isCurrent = currentPhase === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded text-[11px] border transition ${
                      isPassed
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : isCurrent
                        ? 'bg-white/15 border-white text-white font-semibold'
                        : 'bg-black/10 border-white/5 text-blue-300/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isPassed ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-full bg-white/20 text-[9px] flex items-center justify-center shrink-0">
                          {p.id}
                        </span>
                      )}
                      <span className="truncate">{p.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── 5. Completed Result & Download Card ────────────────────────────── */}
      {generationResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  Bulk Package Generated Successfully!
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Package: <strong className="font-mono text-emerald-900">{generationResult.zipFilename}</strong>
                </p>
                <div className="flex items-center gap-3 text-xs text-emerald-700 mt-1">
                  <span>Size: {formatFileSize(generationResult.fileSize)}</span>
                  <span>•</span>
                  <span>Generated: {generationResult.generatedCount} individual PDFs</span>
                  {generationResult.excludedCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-amber-800 font-medium">Flagged: {generationResult.excludedCount} notices</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={handleDownloadZip}
                disabled={isDownloading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] rounded-lg transition shadow-xs cursor-pointer"
              >
                <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                {isDownloading ? 'Downloading...' : 'Download ZIP Package'}
              </button>
            </div>
          </div>

          {/* Audit & Notice Log */}
          {generationResult.exclusions && generationResult.exclusions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-200">
              <div className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Package Audit Notices ({generationResult.exclusions.length})
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                {generationResult.exclusions.map((ex, idx) => (
                  <div
                    key={idx}
                    className="text-[11px] bg-white/70 border border-emerald-200 rounded p-2 text-gray-700 flex items-center justify-between"
                  >
                    <span>
                      <strong className="font-mono text-gray-900">{ex.rollNo}</strong> ({ex.name}) — {ex.reason}
                    </span>
                    <span className="text-gray-400 text-[10px] uppercase">{ex.branch || 'N/A'}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-emerald-800 mt-2">
                A copy of this notice report is included inside the ZIP as <strong className="font-mono">README.txt</strong>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
