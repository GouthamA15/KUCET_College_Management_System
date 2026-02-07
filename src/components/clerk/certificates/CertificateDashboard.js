"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from 'next/navigation';
// Filters moved into a contextual popover; removed full-width CertificateFilters component
import CertificateWorkspaceCard from "./CertificateWorkspaceCard";
import CertificateDateHistory from "./CertificateDateHistory";
import CertificateRecordsView from "./CertificateRecordsView";
import CertificateActionPanel from "./CertificateActionPanel";
import FiltersPopover from "./FiltersPopover";
import FiltersButton from "./FiltersButton";

export default function CertificateDashboard({ clerkType }) {
  const [workspaceMode, setWorkspaceMode] = useState("active"); // "active" | "history"
  const [selectedDate, setSelectedDate] = useState(null); // string | null
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  // Filter UI state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ certificateType: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState({ certificateType: '', status: '' });
  const filtersRef = useRef(null);
  const pathname = usePathname();

  const handleChangeMode = (next) => {
    setWorkspaceMode(next);
    if (next === "active") {
      // Clear selected date when switching back to active
      setSelectedDate(null);
    }
  };

  // Fetch records whenever mode/date/clerkType changes
  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      params.set('workspace', workspaceMode);
      if (workspaceMode === 'history' && selectedDate) params.set('date', selectedDate);
      if (clerkType) params.set('clerkType', clerkType);
      // Apply active filters to records fetch
      if (appliedFilters?.certificateType) params.set('certificate_type', appliedFilters.certificateType);
      if (appliedFilters?.status) params.set('status', appliedFilters.status);
      const res = await fetch(`/api/clerk/requests?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      // Normalize date field for UI
      const normalized = (Array.isArray(data) ? data : []).map(r => ({
        ...r,
        // Prefer the explicit date provided by the backend (YYYY-MM-DD) for history mode.
        date: r.date ?? (workspaceMode === 'history' ? (r.completed_at || r.updated_at || r.created_at) : (r.created_at)),
      }));
      setRecords(normalized);
    } catch (e) {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Fetch history dates when entering history mode
  const fetchHistoryDates = async () => {
    if (workspaceMode !== 'history') return;
    setLoadingDates(true);
    try {
      const params = new URLSearchParams();
      params.set('historyDates', 'true');
      if (clerkType) params.set('clerkType', clerkType);
      const res = await fetch(`/api/clerk/requests?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch history dates');
      const data = await res.json();
      // Backend MUST return an array of YYYY-MM-DD strings. Treat them as opaque values.
      const dates = Array.isArray(data) ? data.filter(d => typeof d === 'string') : [];
      setHistoryDates(dates);
    } catch {
      setHistoryDates([]);
    } finally {
      setLoadingDates(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchRecords();
    if (workspaceMode === 'history') {
      fetchHistoryDates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceMode, selectedDate, clerkType, appliedFilters]);

  // Click-away and Escape handling for Filters popover
  useEffect(() => {
    const onPointerDown = (e) => {
      if (!showFilters) return;
      const el = filtersRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setShowFilters(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && showFilters) setShowFilters(false);
    };
    const onScroll = () => {
      // Close on scroll for small screens to avoid awkward overlays
      try {
        if (showFilters && typeof window !== 'undefined' && window.innerWidth < 640) setShowFilters(false);
      } catch {}
    };

    const onResize = () => {
      // If user resizes, ensure popover doesn't remain incorrectly placed
      if (showFilters && typeof window !== 'undefined' && window.innerWidth < 480) setShowFilters(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [showFilters]);

  // Close popover on route change
  useEffect(() => {
    if (showFilters) setShowFilters(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (workspaceMode === 'history') fetchHistoryDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceMode, clerkType]);

  const formatDateForDisplay = (val) => {
    if (!val) return val;
    try {
      const s = String(val);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-');
        return `${d}-${m}-${y}`;
      }
      // If it's already in another display-friendly format, return as-is
      return s;
    } catch {
      return String(val);
    }
  };

  const handleViewDetails = async (r) => {
    const id = r?.request_id;
    setSelectedRequestId(id || null);
    setIsDialogOpen(true);
    setIsDialogLoading(true);
    setDialogError(null);
    setSelectedRequestDetails(null);
    try {
      if (!id) throw new Error('Invalid request id');
      const res = await fetch(`/api/clerk/requests/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load request details');
      const data = await res.json();
      const req = Array.isArray(data) ? data[0] : data;
      setSelectedRequestDetails(req || null);
    } catch (e) {
      setDialogError(e?.message || 'Unable to load details');
    } finally {
      setIsDialogLoading(false);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedRequestId(null);
    setSelectedRequestDetails(null);
    setIsDialogLoading(false);
    setDialogError(null);
    setRejectReason('');
    setRejectReasonOpen(false);
  };

  return (
    <div className="w-full space-y-4">
      {/* Filters moved to contextual popover aligned with the main content card */}

      {/* Main: Single grid with stacked left cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Left column: stacked cards */}
        <div className="md:col-span-3 space-y-4">
          <CertificateWorkspaceCard mode={workspaceMode} onChange={handleChangeMode} />
          {workspaceMode === "history" && (
            <CertificateDateHistory dates={historyDates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          )}
        </div>

        {/* Right column: main content — one area, conditional content */}
        <div className="md:col-span-9 space-y-4">
          {workspaceMode === "active" && (
            <>
              <section className="bg-white border rounded-lg p-4 shadow-sm relative">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Active Requests</h3>
                    <p className="text-sm text-gray-600">Placeholder list of currently active certificate requests.</p>
                  </div>
                    <div ref={filtersRef} className="ml-4 relative">
                    <FiltersButton
                      show={showFilters}
                      onToggle={() => setShowFilters((s) => !s)}
                      activeCount={(appliedFilters.certificateType ? 1 : 0) + (appliedFilters.status ? 1 : 0)}
                    />
                    {showFilters && (
                      <FiltersPopover
                        filters={filters}
                        setFilters={setFilters}
                        onApply={() => { setAppliedFilters(filters); setShowFilters(false); }}
                        onClear={() => { setFilters({ certificateType: '', status: '' }); setAppliedFilters({ certificateType: '', status: '' }); setShowFilters(false); }}
                      />
                    )}
                  </div>
                </div>
              </section>
              <CertificateRecordsView records={records} onViewDetails={handleViewDetails} />
            </>
          )}

          {workspaceMode === "history" && selectedDate === null && (
            <section className="bg-white border rounded-lg p-8 shadow-sm grid place-items-center text-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">History</h3>
                <p className="text-sm text-gray-600">Select a date on the left to view historical records.</p>
              </div>
            </section>
          )}

          {workspaceMode === "history" && selectedDate !== null && (
            <>
              <section className="bg-white border rounded-lg p-4 shadow-sm relative">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">History — {formatDateForDisplay(selectedDate)}</h3>
                    <p className="text-sm text-gray-600">Placeholder records for the selected date.</p>
                  </div>
                  <div className="ml-4 relative">
                    <FiltersButton
                      show={showFilters}
                      onToggle={() => setShowFilters((s) => !s)}
                      activeCount={(appliedFilters.certificateType ? 1 : 0) + (appliedFilters.status ? 1 : 0)}
                    />
                    {showFilters && (
                      <FiltersPopover
                        filters={filters}
                        setFilters={setFilters}
                        onApply={() => { setAppliedFilters(filters); setShowFilters(false); }}
                        onClear={() => { setFilters({ certificateType: '', status: '' }); setAppliedFilters({ certificateType: '', status: '' }); setShowFilters(false); }}
                      />
                    )}
                  </div>
                </div>
              </section>
              <CertificateRecordsView records={records} onViewDetails={handleViewDetails} />
            </>
          )}
        </div>
      </div>

      {/* Modal/Dialog for request details */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Request Details</h3>
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900"
                onClick={closeDialog}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isDialogLoading ? (
                <div className="text-sm text-gray-600">Loading request details…</div>
              ) : dialogError ? (
                <div className="text-sm text-red-600">{dialogError}</div>
              ) : (
                <CertificateActionPanel request={selectedRequestDetails} />
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-2">
              {selectedRequestDetails?.status === 'PENDING' ? (
                <>
                  <button type="button" className="px-4 py-2 rounded-md bg-red-600 text-white cursor-pointer disabled:opacity-60" disabled={isDialogLoading || !!dialogError || !selectedRequestId} onClick={() => setRejectReasonOpen(true)}>Reject</button>
                  <button type="button" className="px-4 py-2 rounded-md bg-green-600 text-white cursor-pointer disabled:opacity-60" disabled={isDialogLoading || !!dialogError || !selectedRequestId} onClick={async () => {
                    try {
                      if (!selectedRequestId) return;
                      // Guard: only allow PUT when request is still pending
                      if (selectedRequestDetails?.status !== 'PENDING') return;
                      const res = await fetch(`/api/clerk/requests/${encodeURIComponent(selectedRequestId)}`, {
                        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'APPROVED' })
                      });
                      if (res.ok) {
                        closeDialog();
                        await fetchRecords();
                        if (workspaceMode === 'history') await fetchHistoryDates();
                      }
                    } catch {}
                  }}>Approve</button>
                </>
              ) : null}

              <button
                type="button"
                onClick={closeDialog}
                className="px-4 py-2 rounded-md border cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject reason dialog */}
      {rejectReasonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Reason for Rejection</h3>
              <button type="button" className="text-gray-600 hover:text-gray-900 cursor-pointer" onClick={() => setRejectReasonOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">Provide a clear reason so the student can re-apply if needed.</p>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={6} className="w-full p-3 border border-gray-300 rounded-md resize-none text-sm" placeholder="Enter rejection reason" />
            </div>
            <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded-md border cursor-pointer" onClick={() => setRejectReasonOpen(false)}>Cancel</button>
              <button type="button" className="px-4 py-2 rounded-md bg-red-600 text-white cursor-pointer" onClick={async () => {
                try {
                  if (!selectedRequestId) return;
                  // Do not allow rejection if already finalized
                  if (selectedRequestDetails?.status !== 'PENDING') return;
                  const reason = String(rejectReason || '').trim();
                  if (!reason) return;
                  const res = await fetch(`/api/clerk/requests/${encodeURIComponent(selectedRequestId)}`, {
                    method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REJECTED', reject_reason: reason })
                  });
                  if (res.ok) {
                    setRejectReasonOpen(false);
                    closeDialog();
                    await fetchRecords();
                    if (workspaceMode === 'history') await fetchHistoryDates();
                  }
                } catch {}
              }}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
