'use client';
import { useState, useEffect } from 'react';
import { useClerk } from '@/context/ClerkContext';
import Header from '@/app/components/Header/Header';
import Navbar from '@/app/components/Navbar/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function StudentRequestsPage() {
  const { clerkData: clerk, loading: isLoading } = useClerk();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isLoading && clerk) {
      fetchRequests();
    }
  }, [clerk, isLoading]);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/clerk/admission/student-requests');
      const data = await res.json();
      if (res.ok) {
        setRequests(data.data || []);
      } else {
        toast.error(data.error || 'Failed to fetch requests');
      }
    } catch (err) {
      toast.error('Error fetching requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId, action, reason = null) => {
    setProcessing(true);
    try {
      const res = await fetch('/api/clerk/admission/student-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requestId, 
          action, 
          rejectionReason: reason 
        })
      });
      if (res.ok) {
        toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'}`);
        setRejectingRequest(null);
        setRejectionReason('');
        fetchRequests();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Action failed');
      }
    } catch (err) {
      toast.error('Error performing action');
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar role="clerk" />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Student Profile Requests</h1>
            <button 
              onClick={() => window.history.back()}
              className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 bg-white border border-indigo-200 rounded shadow-sm"
            >
              ← Back
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-20 text-center text-gray-500 flex flex-col items-center border border-gray-200">
              <span className="text-5xl mb-4">📭</span>
              <p className="text-xl font-bold text-gray-700">No pending profile requests.</p>
              <p className="text-sm mt-1">Student updates for profile photos and signatures will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {requests.map((req) => (
                <div key={req.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  {/* Header: Student Info */}
                  <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-gray-900">{req.name}</div>
                      <div className="text-sm text-indigo-600 font-mono">{req.roll_no}</div>
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium">Requested on {new Date(req.created_at).toLocaleString()}</div>
                  </div>

                  {/* Body: Comparisons */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Profile Photo Comparison */}
                    {req.new_pfp && (
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                          Profile Photo Update
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-gray-400 mb-1 font-bold">CURRENT</span>
                            <div className="w-32 h-32 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                              {req.old_pfp ? <Image src={req.old_pfp} alt="Old PFP" width={128} height={128} unoptimized className="object-cover w-full h-full" /> : <span className="text-[10px] text-gray-400">Not Set</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-indigo-500 mb-1 font-bold">PROPOSED</span>
                            <div className="w-32 h-32 rounded-lg bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center overflow-hidden shadow-inner">
                              <Image src={req.new_pfp} alt="New PFP" width={128} height={128} unoptimized className="object-cover w-full h-full" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Signature Comparison */}
                    {req.new_signature && (
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          Signature Update
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-gray-400 mb-1 font-bold">CURRENT</span>
                            <div className="w-40 h-24 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                              {req.old_signature ? <Image src={req.old_signature} alt="Old Sig" width={160} height={96} unoptimized className="object-contain" /> : <span className="text-[10px] text-gray-400">Not Set</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-orange-500 mb-1 font-bold">PROPOSED</span>
                            <div className="w-40 h-24 rounded-lg bg-orange-50 border-2 border-orange-200 flex items-center justify-center overflow-hidden shadow-inner">
                              <Image src={req.new_signature} alt="New Sig" width={160} height={96} unoptimized className="object-contain" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer: Actions */}
                  <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button 
                      disabled={processing}
                      onClick={() => handleAction(req.id, 'approve')}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      Approve All
                    </button>
                    <button 
                      disabled={processing}
                      onClick={() => setRejectingRequest(req)}
                      className="bg-white text-red-600 border border-red-200 hover:bg-red-50 px-6 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Rejection Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all scale-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
                <span className="text-3xl">⚠️</span>
                <h2 className="text-2xl font-black">Reject Request</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 font-medium leading-relaxed">
              Provide a clear reason for rejecting the profile update for <span className="text-indigo-600 font-bold">{rejectingRequest.name}</span>. This message will be shown to the student.
            </p>
            
            <textarea 
              autoFocus
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl p-4 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              rows={4}
              placeholder="e.g., Signature must be on white paper, photo is not clear, etc."
            />
            
            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => { setRejectingRequest(null); setRejectionReason(''); }}
                className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Go Back
              </button>
              <button 
                disabled={processing || !rejectionReason.trim()}
                onClick={() => handleAction(rejectingRequest.id, 'reject', rejectionReason)}
                className="flex-1 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-200 transition-all active:scale-95"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
