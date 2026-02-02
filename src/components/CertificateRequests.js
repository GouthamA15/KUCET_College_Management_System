"use client";
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function CertificateRequests({ clerkType }) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [clerkType]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clerk/requests?clerkType=${clerkType}`, { credentials: 'same-origin' });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        toast.error('Failed to fetch certificate requests.');
      }
    } catch (error) {
      toast.error('An error occurred while fetching requests.');
    } finally {
      setIsLoading(false);
    }
  };

  function formatDateDDMMYYYY(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  const handleUpdateStatus = async (requestId, status, reason) => {
    setActionInProgress(true);
    try {
      const body = { status };
      if (status === 'REJECTED') body.reject_reason = String(reason || '').trim();
      const response = await fetch(`/api/clerk/requests/${requestId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(status === 'APPROVED' ? 'Request approved!' : 'Request rejected');
        await fetchRequests();
        setSelectedRequest(null);
        setShowRejectDialog(false);
        setRejectReason('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to update request.');
      }
    } catch (error) {
      toast.error('An error occurred while updating the request.');
    } finally {
      setActionInProgress(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectReason || String(rejectReason).trim().length === 0) {
      toast.error('Rejection reason is required');
      return;
    }
    // call API and close dialog afterwards
    await handleUpdateStatus(selectedRequest.request_id, 'REJECTED', rejectReason);
    setShowRejectDialog(false);
  };
  
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Pending Certificate Requests</h2>
      {isLoading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certificate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested On</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map(req => (
                <tr key={req.request_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{req.roll_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{req.student_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{req.certificate_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDDMMYYYY(req.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button onClick={() => setSelectedRequest(req)} className="cursor-pointer text-indigo-600 hover:text-indigo-900">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col relative">
            <button onClick={() => { setSelectedRequest(null); setRejectReason(''); setShowRejectDialog(false); }} aria-label="Close" className="cursor-pointer absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="flex gap-6">
                {/* LEFT COLUMN: Details */}
                <div className="w-1/2 overflow-y-auto">
                  <h3 className="text-xl font-semibold mb-4">Request Details</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-medium">Student Details</h4>
                      <p><strong>Name:</strong> {selectedRequest.student_name}</p>
                      <p><strong>Roll No:</strong> {selectedRequest.roll_number}</p>
                      <p><strong>Academic Year:</strong> {selectedRequest.academic_year || '-'}</p>
                    </div>

                    <div>
                      <h4 className="font-medium">Request Details</h4>
                      <p><strong>Certificate Type:</strong> {selectedRequest.certificate_type}</p>
                      <p><strong>Requested On:</strong> {formatDateDDMMYYYY(selectedRequest.created_at)}</p>
                      <p><strong>Status:</strong> {selectedRequest.status}</p>
                      <p><strong>Fee:</strong> ₹{selectedRequest.payment_amount}</p>
                    </div>

                    <div>
                      <h4 className="font-medium">Transaction</h4>
                      <p><strong>Transaction ID:</strong> {selectedRequest.transaction_id || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Screenshot preview */}
                <div className="w-1/2 flex flex-col items-center justify-start">
                  <h4 className="font-medium mb-3">Payment Screenshot</h4>
                  <div className="w-full h-full flex items-center justify-center border rounded-lg bg-gray-50 p-4">
                    {selectedRequest.payment_screenshot ? (
                      <img
                        src={`data:image/jpeg;base64,${arrayBufferToBase64(selectedRequest.payment_screenshot.data)}`}
                        alt="Payment Screenshot"
                        className="max-w-full max-h-[60vh] object-contain rounded-md shadow"
                      />
                    ) : (
                      <div className="text-sm text-gray-500">No screenshot provided.</div>
                    )}
                  </div>
                  <div className="mt-6 w-full flex justify-end space-x-3">
                    <button onClick={() => { setSelectedRequest(null); setRejectReason(''); }} disabled={actionInProgress} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Close</button>
                    <button onClick={() => setShowRejectDialog(true)} disabled={actionInProgress} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Reject</button>
                    <button onClick={() => handleUpdateStatus(selectedRequest.request_id, 'APPROVED')} disabled={actionInProgress} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Approve</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 flex items-center justify-center z-60 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col relative">
            <button onClick={() => setShowRejectDialog(false)} aria-label="Close" className="cursor-pointer absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-3">Reason for Rejection</h3>
              <p className="text-sm text-gray-600 mb-4">Provide a clear reason so the student can understand and re-apply if needed.</p>
              <textarea id="reject-dialog-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={6} className="w-full p-3 border border-gray-300 rounded-md resize-none text-sm" placeholder="Enter rejection reason" />
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button onClick={() => setShowRejectDialog(false)} disabled={actionInProgress} className="px-4 py-2 bg-white border rounded-md cursor-pointer">Cancel</button>
              <button onClick={confirmReject} disabled={actionInProgress} className="px-4 py-2 bg-red-600 text-white rounded-md cursor-pointer">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
