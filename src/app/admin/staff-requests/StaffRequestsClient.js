"use client";

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { 
  CheckCircle2, XCircle, Search, Clock, 
  AlertTriangle, ShieldCheck
} from 'lucide-react';

export default function StaffRequestsClient() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff-requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch requests');
      setRequests(data.requests || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          req.name?.toLowerCase().includes(q) || 
          req.email?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    return {
      pending: requests.filter(r => r.status === 'PENDING').length,
      approved: requests.filter(r => r.status === 'APPROVED').length,
      rejected: requests.filter(r => r.status === 'REJECTED').length,
    };
  }, [requests]);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    const toastId = toast.loading('Approving request...');
    try {
      const res = await fetch(`/api/admin/staff-requests/${selectedRequest.id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      
      toast.success('Staff account created and activation email sent!', { id: toastId });
      setIsApproveModalOpen(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || rejectionReason.trim().length < 5) {
      toast.error('Rejection reason must be at least 5 characters');
      return;
    }
    setProcessing(true);
    const toastId = toast.loading('Rejecting request...');
    try {
      const res = await fetch(`/api/admin/staff-requests/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject');
      
      toast.success('Request rejected.', { id: toastId });
      setIsRejectModalOpen(false);
      setRejectionReason('');
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const handleResendActivation = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    const toastId = toast.loading('Resending activation email...');
    try {
      const res = await fetch(`/api/admin/staff-requests/${selectedRequest.id}/resend-activation`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      toast.success('Activation email resent!', { id: toastId });
      setSelectedRequest(null);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const openDetails = (req) => {
    setSelectedRequest(req);
  };

  const renderAffiliations = (req) => {
    if (req.staff_category !== 'FACULTY' || !req.academic_affiliations) return null;
    try {
      const affils = typeof req.academic_affiliations === 'string' 
        ? JSON.parse(req.academic_affiliations) 
        : req.academic_affiliations;
      
      return affils.map((affil, idx) => (
        <div key={idx} className="mb-2">
          <p className="text-sm font-medium text-slate-700">Department: {affil.department_name || affil.department_code}</p>
          <p className="text-sm text-slate-600">Programs: {(affil.program_names || affil.program_codes || []).join(', ')}</p>
        </div>
      ));
    } catch (_e) {
      return <span className="text-sm text-slate-500">Invalid JSON</span>;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      <header className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Staff Registration Requests</h1>
          <p className="text-sm text-gray-600 mt-1">Review and approve new staff and faculty registrations.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-amber-600 mb-2">
            <Clock className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Pending</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-green-600 mb-2">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Approved</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center text-red-600 mb-2">
            <XCircle className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Rejected</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.rejected}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm w-full sm:w-auto">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  statusFilter === status
                    ? 'bg-blue-50 text-[#0b3578] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-full">Applicant</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role & Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading requests...</td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No requests found.</td></tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr 
                    key={req.id} 
                    onClick={() => openDetails(req)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#0b3578] font-bold">
                          {req.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">{req.name}</div>
                          <div className="text-sm text-slate-500">{req.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 font-medium">{req.requested_role}</div>
                      <div className="text-sm text-slate-500">{req.staff_category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {req.email_verified_at ? (
                        <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                          req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {req.status}
                        </span>
                        {req.status === 'APPROVED' && req.account_status && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            req.account_status === 'PENDING_ACTIVATION' ? 'bg-blue-100 text-blue-800' :
                            req.account_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {req.account_status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(req.created_at).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openDetails(req)}
                        className="text-[#0b3578] hover:text-blue-900 font-medium cursor-pointer"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Action Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => {
              if (!processing) {
                if (isApproveModalOpen) setIsApproveModalOpen(false);
                else if (isRejectModalOpen) setIsRejectModalOpen(false);
                else setSelectedRequest(null);
              }
            }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full border border-slate-200">
              
              {/* ALWAYS SHOW DETAILS */}
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-xl leading-6 font-semibold text-slate-900 mb-6 flex justify-between items-center" id="modal-title">
                      Request Details
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          selectedRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                          selectedRequest.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedRequest.status}
                        </span>
                        {selectedRequest.status === 'APPROVED' && selectedRequest.account_status && (
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                            selectedRequest.account_status === 'PENDING_ACTIVATION' ? 'bg-blue-100 text-blue-800' :
                            selectedRequest.account_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {selectedRequest.account_status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </h3>
                    
                    <div className="bg-slate-50 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 border border-slate-100 mb-6">
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedRequest.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Official Email</p>
                        <div className="flex items-center">
                          <p className="text-sm font-semibold text-slate-900 mr-2">{selectedRequest.email}</p>
                          {selectedRequest.email_verified_at ? (
                            <ShieldCheck className="w-4 h-4 text-green-600" title="Verified Email" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500" title="Unverified Email" />
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Staff Category</p>
                        <p className="text-sm text-slate-900">{selectedRequest.staff_category}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Requested Role</p>
                        <p className="text-sm font-medium text-[#0b3578]">{selectedRequest.requested_role}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Designation</p>
                        <p className="text-sm text-slate-900">{selectedRequest.designation || 'N/A'}</p>
                      </div>
                    </div>

                    {selectedRequest.staff_category === 'FACULTY' && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3">Academic Affiliations</h4>
                        {renderAffiliations(selectedRequest)}
                      </div>
                    )}

                    {selectedRequest.status === 'REJECTED' && selectedRequest.rejection_reason && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                        <h4 className="text-sm font-medium text-red-800">Rejection Reason</h4>
                        <p className="text-sm text-red-700 mt-1">{selectedRequest.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTION AREA - BOTTOM */}
              {!isApproveModalOpen && !isRejectModalOpen ? (
                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-slate-200">
                  {selectedRequest.status === 'PENDING' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsApproveModalOpen(true)}
                        disabled={!selectedRequest.email_verified_at}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#0b3578] text-base font-medium text-white hover:bg-blue-900 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={!selectedRequest.email_verified_at ? "Email must be verified to approve" : ""}
                      >
                        Approve Request
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRejectModalOpen(true)}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(null)}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm cursor-pointer"
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      {selectedRequest.status === 'APPROVED' && selectedRequest.account_status === 'PENDING_ACTIVATION' && (
                        <button
                          type="button"
                          onClick={handleResendActivation}
                          disabled={processing}
                          className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-[#0b3578] hover:bg-slate-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          Resend Activation
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(null)}
                        className="w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm cursor-pointer"
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
              ) : isApproveModalOpen ? (
                <div className="bg-green-50 px-4 py-5 sm:p-6 border-t border-green-200">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
                    </div>
                    <div className="ml-3 w-full">
                      <h3 className="text-sm font-medium text-green-800">Confirm Approval</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>This will automatically generate a unique Employee ID, create the staff account, assign the requested role (<span className="font-semibold text-green-900">{selectedRequest?.requested_role}</span>), and send an activation email.</p>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={processing}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          {processing ? 'Processing...' : 'Confirm Approval'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsApproveModalOpen(false)}
                          disabled={processing}
                          className="w-full inline-flex justify-center rounded-md border border-green-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-green-700 hover:bg-green-50 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 px-4 py-5 sm:p-6 border-t border-red-200">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="ml-3 w-full">
                      <h3 className="text-sm font-medium text-red-800">Reject Request</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>Please provide a reason for rejecting this registration request. This information will be saved for audit purposes.</p>
                      </div>
                      <div className="mt-3">
                        <textarea
                          className="w-full border border-red-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none h-20 bg-white"
                          placeholder="Reason for rejection (required)..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                        ></textarea>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={handleReject}
                          disabled={processing || rejectionReason.trim().length < 5}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          {processing ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsRejectModalOpen(false)}
                          disabled={processing}
                          className="w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
