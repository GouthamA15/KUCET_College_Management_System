"use client";
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function CertificateRequests({ clerkType }) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [clerkType]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clerk/requests?clerkType=${clerkType}`);
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

  const handleCompleteRequest = async (requestId) => {
    try {
      const response = await fetch(`/api/clerk/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' }),
      });

      if (response.ok) {
        toast.success('Request marked as completed!');
        fetchRequests();
        setSelectedRequest(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update request.');
      }
    } catch (error) {
      toast.error('An error occurred while updating the request.');
    }
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(req.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button onClick={() => setSelectedRequest(req)} className="text-indigo-600 hover:text-indigo-900">View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <h3 className="text-xl font-semibold mb-4">Request Details</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Roll Number:</strong> {selectedRequest.roll_number}</p>
                <p><strong>Student Name:</strong> {selectedRequest.student_name}</p>
                <p><strong>Certificate Type:</strong> {selectedRequest.certificate_type}</p>
                <p><strong>Requested At:</strong> {new Date(selectedRequest.created_at).toLocaleString()}</p>
                <p><strong>Fee:</strong> ₹{selectedRequest.payment_amount}</p>
                {selectedRequest.payment_amount > 0 ? (
                  <>
                      <p><strong>Transaction ID:</strong> {selectedRequest.transaction_id}</p>
                      <div>
                          <strong>Payment Screenshot:</strong>
                          {selectedRequest.payment_screenshot ? (
                              <img 
                                  src={`data:image/jpeg;base64,${arrayBufferToBase64(selectedRequest.payment_screenshot.data)}`} 
                                  alt="Payment Screenshot" 
                                  className="mt-2 rounded-lg border w-full h-auto"
                              />
                          ) : <p>Not provided.</p>}
                      </div>
                  </>
                ) : <p>No payment required.</p>}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button onClick={() => setSelectedRequest(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Close</button>
              <button 
                onClick={() => handleCompleteRequest(selectedRequest.request_id)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Mark as Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
