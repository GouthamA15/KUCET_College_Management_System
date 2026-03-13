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

  const [viewingImage, setViewingImage] = useState(null);

  useEffect(() => {
    if (!isLoading && clerk && clerk.role === 'admission') {
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

  const formatLabel = (str) => {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (isLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Navbar role="clerkAdmission" />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Profile & Data Requests</h1>
                <p className="text-gray-500 font-medium text-sm mt-1 uppercase tracking-widest">Verify and approve student information updates</p>
            </div>
            <button 
              onClick={() => window.history.back()}
              className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-indigo-700 bg-white border-2 border-indigo-100 rounded-xl shadow-sm hover:bg-indigo-50 transition-all"
            >
              ← Back to Dashboard
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-xl p-24 text-center border-2 border-dashed border-gray-200 flex flex-col items-center">
              <span className="text-7xl mb-6">🏜️</span>
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">The desk is clear</h2>
              <p className="text-gray-500 font-medium mt-2">No pending profile or data update requests from students.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-10">
              {requests.map((req) => (
                <div key={req.id} className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden hover:border-indigo-300 transition-all group">
                  {/* Header: Student Info */}
                  <div className="bg-[#0b3578] px-8 py-5 flex items-center justify-between text-white">
                    <div>
                      <div className="text-xl font-black uppercase tracking-tight">{req.name}</div>
                      <div className="text-xs text-blue-200 font-bold tracking-widest uppercase mt-0.5">{req.roll_no}</div>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Submitted {new Date(req.created_at).toLocaleString()}</div>
                  </div>

                  <div className="p-8 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
                    {/* Left Side: Updates */}
                    <div className="space-y-10">
                        {/* Visual Updates */}
                        {(req.new_pfp || req.new_signature) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {req.new_pfp && (
                                    <div className="space-y-4">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                            Profile Photo
                                        </h3>
                                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <div className="text-center space-y-1 flex-1">
                                                <div className="text-[9px] font-black text-gray-400 uppercase">Current</div>
                                                <div className="w-full aspect-square bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                                                    {req.old_pfp ? <Image src={req.old_pfp} alt="Old" width={150} height={150} unoptimized className="object-cover w-full h-full" /> : <span className="text-[9px] text-gray-300 font-bold">NONE</span>}
                                                </div>
                                            </div>
                                            <div className="text-indigo-300 text-xl font-black">→</div>
                                            <div className="text-center space-y-1 flex-1">
                                                <div className="text-[9px] font-black text-indigo-500 uppercase">Proposed</div>
                                                <button onClick={() => setViewingImage(req.new_pfp)} className="w-full aspect-square bg-indigo-50 rounded-xl border-2 border-indigo-200 flex items-center justify-center overflow-hidden shadow-md hover:scale-105 transition-transform active:scale-95">
                                                    <Image src={req.new_pfp} alt="New" width={150} height={150} unoptimized className="object-cover w-full h-full" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {req.new_signature && (
                                    <div className="space-y-4">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                            Signature
                                        </h3>
                                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <div className="text-center space-y-1 flex-1">
                                                <div className="text-[9px] font-black text-gray-400 uppercase">Current</div>
                                                <div className="w-full h-32 bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                                                    {req.old_signature ? <Image src={req.old_signature} alt="Old" width={150} height={80} unoptimized className="object-contain" /> : <span className="text-[9px] text-gray-300 font-bold">NONE</span>}
                                                </div>
                                            </div>
                                            <div className="text-indigo-300 text-xl font-black">→</div>
                                            <div className="text-center space-y-1 flex-1">
                                                <div className="text-[9px] font-black text-amber-500 uppercase">Proposed</div>
                                                <button onClick={() => setViewingImage(req.new_signature)} className="w-full h-32 bg-amber-50 rounded-xl border-2 border-amber-200 flex items-center justify-center overflow-hidden shadow-md hover:scale-105 transition-transform active:scale-95">
                                                    <Image src={req.new_signature} alt="New" width={150} height={80} unoptimized className="object-contain" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Data Updates */}
                        {req.new_data && (
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                    Record Data Updates
                                </h3>
                                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 border-b border-gray-200">
                                                <th className="px-6 py-3 font-black text-gray-500 uppercase tracking-wider w-1/4">Field Name</th>
                                                <th className="px-6 py-3 font-black text-indigo-700 uppercase tracking-wider">Requested Change</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {Object.entries(typeof req.new_data === 'string' ? JSON.parse(req.new_data) : req.new_data).map(([field, value]) => (
                                                <tr key={field} className="hover:bg-indigo-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-gray-500 uppercase">{formatLabel(field)}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">{value || <span className="text-indigo-300 italic opacity-50">Empty</span>}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Proof & Actions */}
                    <div className="space-y-8 flex flex-col">
                        <div className="space-y-4 flex-1">
                            <h3 className="text-[11px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                Verification Proof
                            </h3>
                            <div className="bg-amber-50 p-4 rounded-3xl border-2 border-dashed border-amber-200 flex flex-col items-center justify-center">
                                {req.proof_url ? (
                                    <div className="space-y-4 w-full">
                                        <button 
                                            onClick={() => setViewingImage(req.proof_url)}
                                            className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg border-4 border-white hover:scale-105 transition-transform active:scale-95 group/proof relative"
                                        >
                                            <Image src={req.proof_url} alt="Proof" fill unoptimized className="object-cover" />
                                            <div className="absolute inset-0 bg-amber-900/40 opacity-0 group-hover/proof:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest bg-amber-600 px-3 py-1 rounded-full shadow-xl">Enlarge Proof</span>
                                            </div>
                                        </button>
                                        <p className="text-[10px] text-amber-800 font-bold text-center leading-relaxed italic uppercase tracking-wider opacity-60 px-4">Student provided document for verification</p>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center space-y-2">
                                        <span className="text-3xl grayscale">📂</span>
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">No Proof Image</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-gray-100">
                            <button 
                                disabled={processing}
                                onClick={() => handleAction(req.id, 'approve')}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-100 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : '✅ Approve & Update'}
                            </button>
                            <button 
                                disabled={processing}
                                onClick={() => setRejectingRequest(req)}
                                className="w-full bg-white text-red-600 border-2 border-red-50 hover:bg-red-50 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                            >
                                ❌ Reject Request
                            </button>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Image Preview Modal */}
      {viewingImage && (
        <div 
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 md:p-10 cursor-zoom-out"
            onClick={() => setViewingImage(null)}
        >
            <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-200">
                <div className="absolute top-0 right-0 p-6">
                    <button className="text-white text-4xl hover:scale-110 transition-transform">×</button>
                </div>
                <div className="relative max-w-5xl max-h-full w-full h-full flex items-center justify-center">
                    <Image src={viewingImage} alt="Preview" fill unoptimized className="object-contain" />
                </div>
            </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10">
            <div className="flex items-center gap-4 text-red-600 mb-6">
                <span className="text-4xl">🚫</span>
                <h2 className="text-2xl font-black uppercase tracking-tight">Reject Request</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-8 font-medium leading-relaxed uppercase tracking-wider">
              State the reason for rejecting <span className="text-indigo-600 font-bold">{rejectingRequest.name}</span>&apos;s request.
            </p>
            
            <textarea 
              autoFocus
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl p-6 text-sm font-bold focus:ring-4 focus:ring-red-100 focus:border-red-500 outline-none transition-all placeholder:text-gray-300"
              rows={4}
              placeholder="e.g. Identity proof not clear, Signature mismatch..."
            />
            
            <div className="mt-10 flex gap-4">
              <button 
                onClick={() => { setRejectingRequest(null); setRejectionReason(''); }}
                className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
              >
                Go Back
              </button>
              <button 
                disabled={processing || !rejectionReason.trim()}
                onClick={() => handleAction(rejectingRequest.id, 'reject', rejectionReason)}
                className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-white bg-red-600 rounded-2xl hover:bg-red-700 disabled:opacity-50 shadow-xl shadow-red-200 transition-all active:scale-95"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
