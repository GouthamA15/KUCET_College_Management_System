'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { getAssetUrl } from '@/lib/assets';

export default function PendingClerkRequests({ onRequestAction, categoryFilter }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [rejectingReq, setRejectingReq] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const url = categoryFilter
        ? `/api/admin/clerk-requests?status=PENDING&category=${categoryFilter}`
        : '/api/admin/clerk-requests?status=PENDING';
      const res = await fetch(url);
      const data = await res.json();
      if (data.requests) {
        setRequests(data.requests);
      }
    } catch (_err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const url = categoryFilter
          ? `/api/admin/clerk-requests?status=PENDING&category=${categoryFilter}`
          : '/api/admin/clerk-requests?status=PENDING';
        const res = await fetch(url);
        const data = await res.json();
        if (isMounted && res.ok && data.requests) {
          setRequests(data.requests);
        }
      } catch (_err) {
        // ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [categoryFilter]);

  const handleApprove = async (request) => {
    if (!confirm(`Are you sure you want to APPROVE ${request.name} (${request.employee_id})? This will create their clerk account and send them an email with a temporary password.`)) {
      return;
    }

    setActionId(request.id);
    const toastId = toast.loading(`Approving ${request.name}...`);

    try {
      const res = await fetch(`/api/admin/clerk-requests/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Clerk registration approved successfully!', { id: toastId });
        fetchRequests();
        if (onRequestAction) onRequestAction();
      } else {
        toast.error(data.error || 'Failed to approve request', { id: toastId });
      }
    } catch (_err) {
      toast.error('Network error approving request', { id: toastId });
    } finally {
      setActionId(null);
    }
  };

  const handleOpenReject = (request) => {
    setRejectingReq(request);
    setRejectionReason('');
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingReq) return;

    setSubmittingReject(true);
    const toastId = toast.loading(`Rejecting ${rejectingReq.name}...`);

    try {
      const res = await fetch(`/api/admin/clerk-requests/${rejectingReq.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Clerk registration request rejected.', { id: toastId });
        setRejectingReq(null);
        fetchRequests();
        if (onRequestAction) onRequestAction();
      } else {
        toast.error(data.error || 'Failed to reject request', { id: toastId });
      }
    } catch (_err) {
      toast.error('Network error rejecting request', { id: toastId });
    } finally {
      setSubmittingReject(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#0b3578] uppercase tracking-wide">
            Pending Clerk Registration Requests
          </h2>
        </div>
        <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
          Loading registration requests...
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[#0b3578] uppercase tracking-wide">
              Pending Clerk Registration Requests
            </h2>
            <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
              0 Pending
            </span>
          </div>
          <button
            onClick={fetchRequests}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            🔄 Refresh
          </button>
        </div>
        <p className="text-slate-500 text-sm italic py-4">
          No pending self-registration requests. Newly submitted clerk requests will appear here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-amber-200 rounded-lg p-6 shadow-xs mb-8">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-amber-100">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
          <h2 className="text-lg font-bold text-[#0b3578] uppercase tracking-wide">
            Pending Clerk Registration Requests
          </h2>
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-300">
            {requests.length} Action Needed
          </span>
        </div>
        <button
          onClick={fetchRequests}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded transition-colors"
        >
          🔄 Refresh List
        </button>
      </div>

      <div className="space-y-4">
        {requests.map((req) => (
          <div
            key={req.id}
            className="border border-slate-200 rounded-lg p-4 sm:p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              {req.pfp ? (
                <Image
                  src={getAssetUrl(req.pfp)}
                  alt={req.name || 'Staff PFP'}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-full object-cover border border-slate-300 shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-100 text-[#0b3578] flex items-center justify-center font-bold text-xl shrink-0 border border-blue-200">
                  {req.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-base">{req.name}</h3>
                  <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs px-2 py-0.5 rounded font-mono font-semibold">
                    {req.employee_id}
                  </span>
                  <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded font-medium">
                    {req.department}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                  <p><span className="font-medium text-slate-700">Designation:</span> {req.designation}</p>
                  <p><span className="font-medium text-slate-700">Email:</span> {req.email}</p>
                  <p className="text-slate-400">
                    Submitted: {req.created_at ? new Date(req.created_at).toLocaleString() : 'Recent'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center shrink-0">
              <button
                onClick={() => handleApprove(req)}
                disabled={actionId === req.id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                ✓ Approve & Create
              </button>
              <button
                onClick={() => handleOpenReject(req)}
                disabled={actionId === req.id}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Rejection Modal */}
      {rejectingReq && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Reject Registration Request
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Rejecting request for <strong className="text-slate-800">{rejectingReq.name}</strong> ({rejectingReq.employee_id}).
              A notification email will be sent explaining the reason.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason (Sent via email)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Employee ID does not match institutional records or invalid department selection."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingReq(null)}
                  className="text-xs text-slate-600 hover:text-slate-800 font-medium px-3 py-2"
                  disabled={submittingReject}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded transition-colors disabled:opacity-50"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
