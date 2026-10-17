'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Search, UserCheck, XCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/date';

export default function StudentReactivationsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Review modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [recommendation, setRecommendation] = useState('RECOMMENDED');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReactivations = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/hod/reactivations');
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.error || data.message || 'Unable to load reactivation requests. Please try again.');
      }
    } catch (_e) {
      toast.error('Unable to connect to the server while loading reactivation requests. Please check your internet connection.');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/staff/hod/reactivations');
        const data = await res.json();
        if (isMounted) {
          if (res.ok) {
            setRequests(data.requests || []);
          } else {
            toast.error(data.error || data.message || 'Unable to load reactivation requests. Please try again.');
          }
        }
      } catch (_e) {
        if (isMounted) toast.error('Unable to connect to the server while loading reactivation requests. Please check your internet connection.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = !search || 
        r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.roll_no?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const handleOpenReview = (req) => {
    setSelectedRequest(req);
    setRecommendation('RECOMMENDED');
    setComments('');
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
    setComments('');
    setIsSubmitting(false);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    if (recommendation === 'NOT_RECOMMENDED' && (!comments || comments.trim().length < 5)) {
      toast.error('Please provide a specific reason for not recommending reactivation (min 5 chars).');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Submitting departmental endorsement...');

    try {
      const res = await fetch(`/api/staff/hod/reactivations/${selectedRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation,
          comments
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Endorsement submitted to Super Admin for clearance.', { id: toastId });
        handleCloseReview();
        await fetchReactivations();
      } else {
        toast.error(data.error || 'Failed to submit review.', { id: toastId });
      }
    } catch (_e) {
      toast.error('Error submitting review.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_HOD':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"><Clock className="w-3 h-3" /> Awaiting HOD</span>;
      case 'PENDING_ADMIN':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#0b3578] border border-blue-200"><Clock className="w-3 h-3" /> Endorsed (Awaiting Admin)</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle className="w-3 h-3" /> Reactivated</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#0b3578]" />
            Student Reactivation Requests (Stage 1 HOD Review)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review accounts deactivated due to extended absence (5+ months). Your endorsement forwards the case to Super Admin for final clearance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by roll or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#0b3578]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-[#0b3578]"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_HOD">Pending HOD Review</option>
            <option value="PENDING_ADMIN">Endorsed to Admin</option>
            <option value="APPROVED">Reactivated</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            onClick={fetchReactivations}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-6 h-6 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium">Loading reactivation requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-lg">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No Reactivation Requests Found</p>
          <p className="text-xs text-slate-400 mt-1">There are no pending student reactivation requests matching your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Inactivity</th>
                <th className="px-4 py-3">Date Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{req.roll_no}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{req.student_name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="font-semibold text-rose-600">{req.inactivity_days || '150+'}</span> days
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(req.created_at, '—')}</td>
                  <td className="px-4 py-3">{getStatusBadge(req.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {req.status === 'PENDING_HOD' ? (
                      <button
                        onClick={() => handleOpenReview(req)}
                        className="px-3 py-1 bg-[#0b3578] text-white font-semibold rounded text-xs hover:bg-blue-900 transition-colors cursor-pointer"
                      >
                        Review
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenReview(req)}
                        className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold rounded text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-slideUp">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#0b2447]">Reactivation Request Review</h3>
                <p className="text-xs text-slate-500 mt-0.5">Stage 1 Departmental Endorsement</p>
              </div>
              <button
                onClick={handleCloseReview}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student Roll:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedRequest.roll_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Student Name:</span>
                  <span className="font-semibold text-slate-800">{selectedRequest.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Inactivity:</span>
                  <span className="font-bold text-rose-600">{selectedRequest.inactivity_days || '150+'} days</span>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-1">Student Explanation & Justification:</span>
                  <p className="text-slate-800 font-medium italic bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                    &quot;{selectedRequest.reason}&quot;
                  </p>
                </div>
              </div>

              {selectedRequest.status === 'PENDING_HOD' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Departmental Recommendation</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRecommendation('RECOMMENDED')}
                        className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          recommendation === 'RECOMMENDED'
                            ? 'bg-blue-50 border-[#0b3578] text-[#0b3578]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-600" /> Endorse for Clearance
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecommendation('NOT_RECOMMENDED')}
                        className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          recommendation === 'NOT_RECOMMENDED'
                            ? 'bg-rose-50 border-rose-500 text-rose-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <XCircle className="w-4 h-4 text-rose-600" /> Do Not Recommend
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      HOD Remarks & Justification {recommendation === 'NOT_RECOMMENDED' && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      rows={3}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder={recommendation === 'RECOMMENDED' ? "e.g., Medical documentation verified. Student is eligible to attend remaining classes." : "State reason why reactivation should not be granted..."}
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0b3578]"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleCloseReview}
                      className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-[#0b3578] text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Endorsement'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">HOD Recommendation:</span>
                      <span className="font-bold text-slate-800">{selectedRequest.hod_recommendation || '—'}</span>
                    </div>
                    {selectedRequest.hod_comments && (
                      <div className="pt-1">
                        <span className="text-slate-500 block mb-0.5">HOD Comments:</span>
                        <p className="font-medium text-slate-700">{selectedRequest.hod_comments}</p>
                      </div>
                    )}
                    {selectedRequest.admin_notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-slate-500 block mb-0.5">Super Admin Notes:</span>
                        <p className="font-medium text-slate-700">{selectedRequest.admin_notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCloseReview}
                      className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
