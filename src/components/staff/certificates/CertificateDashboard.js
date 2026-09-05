"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { usePathname } from 'next/navigation';
import { useStaff } from "@/context/StaffContext";
import RealtimeListener from '@/components/RealtimeListener';
import CertificateRecordsView from "./CertificateRecordsView";
import FiltersPopover from "./FiltersPopover";
import { createPortal } from 'react-dom';
import { CertificateReviewModal } from '@/components/ui/edit-modals/CertificateReviewModal';
import { Search, Filter, XCircle } from 'lucide-react';

export default function CertificateDashboard({ staffType }) {
  const { pendingCertificateRequests, _isLoadingRequests, refreshCertificateRequests } = useStaff();
  const [workspaceMode, setWorkspaceMode] = useState("active"); // "active" | "history"
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [historyScope, setHistoryScope] = useState('my'); // 'my' | 'all'
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  // Filter and Search UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ certificateType: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState({ certificateType: [], status: [] });
  const filtersRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!pendingCertificateRequests || pendingCertificateRequests.length === 0) {
      refreshCertificateRequests(staffType);
    }
  }, [staffType, pendingCertificateRequests, refreshCertificateRequests]);

  const fetchRecords = useCallback(async () => {
    // We only fetch for history mode. Active mode uses Context data + client-side filtering.
    if (workspaceMode === 'active') return;

    setLoadingRecords(true);
    setRecords([]); // clear old records while loading history

    try {
      const params = new URLSearchParams();
      params.set('workspace', workspaceMode);
      if (workspaceMode === 'history') params.set('scope', historyScope);
      if (staffType) params.set('staffType', staffType);
      
      if (Array.isArray(appliedFilters.certificateType) && appliedFilters.certificateType.length > 0) {
        appliedFilters.certificateType.forEach(v => params.append('certificateType', v));
      }
      if (Array.isArray(appliedFilters.status) && appliedFilters.status.length > 0) {
        appliedFilters.status.forEach(v => params.append('status', v));
      }
      const res = await fetch(`/api/staff/requests?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      
      if (workspaceMode === 'history') {
        const recs = Array.isArray(data?.records) ? data.records : [];
        const normalized = recs.map(r => ({
          ...r,
          date: r.completed_at ? String(r.completed_at).split('T')[0] : (r.date ? String(r.date) : null),
        }));
        setRecords(normalized);
      }
    } catch (_e) {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [workspaceMode, historyScope, staffType, appliedFilters]);

  // Derived records with Client-Side filtering applied
  const displayRecords = useMemo(() => {
    if (workspaceMode === 'active') {
      let filtered = (pendingCertificateRequests || []).map(r => ({ 
        ...r, 
        date: r.created_at ? String(r.created_at).split('T')[0] : r.date 
      }));
      
      if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        filtered = filtered.filter(r => 
          (r.student_name && r.student_name.toLowerCase().includes(lowerQ)) ||
          (r.roll_number && r.roll_number.toLowerCase().includes(lowerQ)) ||
          (r.roll && r.roll.toLowerCase().includes(lowerQ))
        );
      }

      if (appliedFilters.certificateType.length > 0) {
        filtered = filtered.filter(r => appliedFilters.certificateType.includes(r.certificate_type));
      }
      if (appliedFilters.status.length > 0) {
        filtered = filtered.filter(r => appliedFilters.status.includes(r.status));
      }
      return filtered;
    }
    
    // For History, the API has already applied the filters, but we can do client search
    let filtered = records;
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        (r.student_name && r.student_name.toLowerCase().includes(lowerQ)) ||
        (r.roll_number && r.roll_number.toLowerCase().includes(lowerQ)) ||
        (r.roll && r.roll.toLowerCase().includes(lowerQ))
      );
    }
    return filtered;
  }, [workspaceMode, appliedFilters, pendingCertificateRequests, records, searchQuery]);

  // Effects
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords();
  }, [fetchRecords]);

  const handleRealtime = useCallback((data) => {
    if (data.type === 'REQUEST_UPDATED' || data.type === 'REQUEST_CREATED') {
      if (workspaceMode === 'history') {
        fetchRecords();
      } else {
        refreshCertificateRequests(staffType);
      }
    }
  }, [fetchRecords, refreshCertificateRequests, staffType, workspaceMode]);

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

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showFilters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showFilters) setShowFilters(false);
  }, [pathname, showFilters]);

  const handleViewDetails = async (r) => {
    const id = r?.request_id;
    setSelectedRequestId(id || null);
    setIsDialogOpen(true);
    setIsDialogLoading(true);
    setDialogError(null);
    setSelectedRequestDetails(null);
    try {
      if (!id) throw new Error('Invalid request id');
      const res = await fetch(`/api/staff/requests/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
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

  const activeFilterCount = (appliedFilters.certificateType?.length || 0) + (appliedFilters.status?.length || 0);

  return (
    <div className="space-y-6 animate-fadeIn" id="certificate-section">
      <RealtimeListener onUpdate={handleRealtime} enableNotifications={false} />
      
      {/* Top Header & Search Bar matching StudentUpdateRequestsPanel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0b2447]">Certificate & ID Queue</h2>
          <p className="text-sm text-gray-500 mt-1">Approve or reject document requests submitted by students.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Workspace Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button 
              onClick={() => { setWorkspaceMode('active'); setSearchQuery(''); }} 
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors cursor-pointer ${workspaceMode === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Active
            </button>
            <button 
              onClick={() => { setWorkspaceMode('history'); setSearchQuery(''); }} 
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors cursor-pointer ${workspaceMode === 'history' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              History
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by name or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
            />
          </div>

          <div ref={filtersRef} className="relative">
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className={`flex items-center gap-2 px-3 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors ${
                activeFilterCount > 0 
                  ? 'bg-blue-50 border-blue-200 text-[#0b3578] hover:bg-blue-100' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" /> 
              Filter {activeFilterCount > 0 && <span className="bg-[#0b3578] text-white text-[10px] px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
            </button>
            {showFilters && (
              <FiltersPopover
                filters={filters}
                setFilters={setFilters}
                onApply={() => {
                  const certArr = filters.certificateType ? [filters.certificateType] : [];
                  const statusArr = filters.status ? [filters.status] : [];
                  setAppliedFilters({ certificateType: certArr, status: statusArr });
                  setShowFilters(false);
                }}
                onClear={() => { setFilters({ certificateType: '', status: '' }); setAppliedFilters({ certificateType: [], status: [] }); setShowFilters(false); }}
              />
            )}
          </div>

          <button 
            onClick={() => { workspaceMode === 'active' ? refreshCertificateRequests(staffType) : fetchRecords() }} 
            className="flex items-center gap-2 px-3 py-2 bg-[#0b3578] text-white text-sm font-medium hover:bg-blue-900 transition-colors rounded-md shadow-sm cursor-pointer"
          >
            <span className={`${(loadingRecords || _isLoadingRequests) ? 'animate-spin' : ''}`}>↻</span> Sync
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 bg-blue-50 text-[#0b3578] px-3 py-1.5 rounded-full font-medium border border-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            {workspaceMode === 'active' ? 'Pending: ' : 'Showing: '} {displayRecords.length}
        </div>
        
        {workspaceMode === 'history' && (
           <div className="flex bg-gray-50 rounded-md border text-xs">
              <button onClick={() => setHistoryScope('my')} className={`px-3 py-1.5 rounded-l-md transition-colors cursor-pointer ${historyScope === 'my' ? 'bg-gray-200 font-bold text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>My Actions</button>
              <button onClick={() => setHistoryScope('all')} className={`px-3 py-1.5 rounded-r-md transition-colors cursor-pointer ${historyScope === 'all' ? 'bg-gray-200 font-bold text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>All History</button>
           </div>
        )}
      </div>

      <div className="bg-white">
        <CertificateRecordsView 
          records={displayRecords} 
          onViewDetails={handleViewDetails} 
          groupByDate={workspaceMode === 'history'} 
          loading={loadingRecords} 
        />
      </div>

      <CertificateReviewModal
        isDialogOpen={isDialogOpen}
        closeDialog={closeDialog}
        isDialogLoading={isDialogLoading}
        dialogError={dialogError}
        selectedRequestDetails={selectedRequestDetails}
        selectedRequestId={selectedRequestId}
        setRejectReasonOpen={setRejectReasonOpen}
        refreshCertificateRequests={refreshCertificateRequests}
        fetchRecords={fetchRecords}
        staffType={staffType}
      />

      {rejectReasonOpen && typeof document !== 'undefined' && createPortal(
        (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col animate-fadeInUp">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <XCircle className="text-rose-500 w-5 h-5" />
                  Reason for Rejection
                </h3>
                <button type="button" className="text-gray-400 hover:text-gray-900 cursor-pointer p-1 rounded-md hover:bg-gray-100 cursor-pointer" onClick={() => setRejectReasonOpen(false)} aria-label="Close">✕</button>
              </div>
              <div className="p-4 bg-gray-50">
                <p className="text-sm text-gray-600 mb-3">Provide a clear reason so the student can re-apply if needed.</p>
                <textarea 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)} 
                  rows={4} 
                  className="w-full p-3 border border-gray-300 rounded-md resize-none text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-500 outline-none" 
                  placeholder="e.g., Name mismatch with supporting documents." 
                  autoFocus
                />
              </div>
              <div className="p-4 border-t bg-white flex items-center justify-end gap-3">
                <button type="button" className="px-4 py-2 text-sm font-semibold rounded-md border text-gray-700 bg-white hover:bg-gray-50 transition-colors" onClick={() => setRejectReasonOpen(false)}>Cancel</button>
                <button 
                  type="button" 
                  className="px-4 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50" 
                  disabled={!rejectReason.trim()}
                  onClick={async () => {
                    try {
                      if (!selectedRequestId) return;
                      if (selectedRequestDetails?.status !== 'PENDING') return;
                      const reason = String(rejectReason || '').trim();
                      if (!reason) return;
                      const res = await fetch(`/api/staff/requests/${encodeURIComponent(selectedRequestId)}`, {
                        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REJECTED', reject_reason: reason })
                      });
                      if (res.ok) {
                        setRejectReasonOpen(false);
                        closeDialog();
                        await refreshCertificateRequests(staffType);
                        if (workspaceMode === 'history') await fetchRecords();
                      }
                    } catch { /* empty */ }
                  }}
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
}
