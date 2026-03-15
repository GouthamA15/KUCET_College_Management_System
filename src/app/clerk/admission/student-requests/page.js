// src/app/clerk/admission/student-requests/page.js
'use client';

import { useState, useEffect } from 'react';
import { useClerk } from '@/context/ClerkContext';
import Header from '@/components/Header';
import Navbar from '@/components/Navbar';
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
        toast.error(data.error || 'Access to records office failed');
      }
    } catch (err) {
      toast.error('System synchronization error');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId, action, reason = null) => {
    setProcessing(true);
    const toastId = toast.loading('Synchronizing update with central database...');
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
        toast.success(`Application ${action === 'approve' ? 'validated and applied' : 'rejected'} successfully`, { id: toastId });
        setRejectingRequest(null);
        setRejectionReason('');
        fetchRequests();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Database operation failed', { id: toastId });
      }
    } catch (err) {
      toast.error('Administrative system error', { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const formatLabel = (str) => {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-500 font-bold uppercase tracking-widest text-xs">
        Connecting to Records Office...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Header />
      <Navbar role="clerkAdmission" />
      
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Record Modification Requests</h1>
              <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">Verify and authorize student-initiated data modifications</p>
          </div>
          <button 
            onClick={() => window.history.back()}
            className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            ← Return to Console
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white border border-slate-300 shadow-sm p-24 text-center rounded-sm">
            <span className="text-5xl opacity-20 block mb-6">📂</span>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Queue Status: Clear</h2>
            <p className="text-slate-500 mt-2 text-[11px] font-medium uppercase tracking-tighter">No pending modification applications detected in the system.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {requests.map((req) => (
              <div key={req.id} className="bg-white border border-slate-300 shadow-md rounded-sm overflow-hidden">
                
                {/* Formal Header: Application Identifier */}
                <div className="bg-[#0b3578] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between text-white border-b border-blue-900 gap-4">
                  <div>
                    <div className="text-lg font-bold uppercase tracking-tight">{req.name}</div>
                    <div className="text-[10px] text-blue-200 font-bold tracking-widest uppercase mt-0.5">Roll No: {req.roll_no} — Application #{req.id}</div>
                  </div>
                  <div className="bg-blue-900/50 px-4 py-1.5 border border-blue-700/50 rounded-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest">Submission: {new Date(req.created_at).toLocaleString().toUpperCase()}</span>
                  </div>
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
                  
                  {/* Left Side: Audit of Proposed Modifications */}
                  <div className="space-y-12">
                      
                      {/* 1. Visual Evidence Modifications */}
                      {(req.new_pfp || req.new_signature) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {req.new_pfp && (
                                  <div className="space-y-4">
                                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Identification Photo Audit</h3>
                                      <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-200">
                                          <div className="text-center space-y-2 flex-1">
                                              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter">Current Record</span>
                                              <div className="w-full aspect-square bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                                                  {req.old_pfp ? <Image src={req.old_pfp} alt="Old" width={150} height={150} unoptimized className="object-cover w-full h-full" /> : <span className="text-[9px] text-slate-300 font-bold uppercase">No Record</span>}
                                              </div>
                                          </div>
                                          <div className="text-slate-300 font-black">→</div>
                                          <div className="text-center space-y-2 flex-1">
                                              <span className="block text-[9px] font-black text-blue-600 uppercase tracking-tighter">Proposed New</span>
                                              <button onClick={() => setViewingImage(req.new_pfp)} className="w-full aspect-square bg-white border-2 border-blue-200 flex items-center justify-center overflow-hidden hover:border-blue-500 transition-all cursor-zoom-in">
                                                  <Image src={req.new_pfp} alt="New" width={150} height={150} unoptimized className="object-cover w-full h-full" />
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              )}
                              {req.new_signature && (
                                  <div className="space-y-4">
                                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Specimen Signature Audit</h3>
                                      <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-200">
                                          <div className="text-center space-y-2 flex-1">
                                              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter">Current Record</span>
                                              <div className="w-full h-24 bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                                                  {req.old_signature ? <Image src={req.old_signature} alt="Old" width={150} height={80} unoptimized className="object-contain" /> : <span className="text-[9px] text-slate-300 font-bold uppercase">No Record</span>}
                                              </div>
                                          </div>
                                          <div className="text-slate-300 font-black">→</div>
                                          <div className="text-center space-y-2 flex-1">
                                              <span className="block text-[9px] font-black text-amber-600 uppercase tracking-tighter">Proposed New</span>
                                              <button onClick={() => setViewingImage(req.new_signature)} className="w-full h-24 bg-white border-2 border-amber-200 flex items-center justify-center overflow-hidden hover:border-amber-500 transition-all cursor-zoom-in">
                                                  <Image src={req.new_signature} alt="New" width={150} height={80} unoptimized className="object-contain" />
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}

                      {/* 2. Textual Record Modifications */}
                      {req.new_data && (
                          <div className="space-y-4">
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Proposed Data Modifications</h3>
                              <div className="border border-slate-200 overflow-hidden">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                      <thead>
                                          <tr className="bg-slate-50 border-b border-slate-200 text-center">
                                              <th className="px-6 py-3 font-black text-slate-500 uppercase tracking-wider text-left">Field Designation</th>
                                              <th className="px-6 py-3 font-black text-slate-500 uppercase tracking-wider border-l border-slate-200">College Record</th>
                                              <th className="px-6 py-3 font-black text-blue-800 uppercase tracking-wider border-l border-slate-200">Student Request</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {Object.entries(typeof req.new_data === 'string' ? JSON.parse(req.new_data) : req.new_data).map(([field, value]) => (
                                              <tr key={field} className="hover:bg-slate-50 transition-colors">
                                                  <td className="px-6 py-3 font-bold text-slate-500 uppercase">{formatLabel(field)}</td>
                                                  <td className="px-6 py-3 text-center border-l border-slate-100">
                                                      <span className="font-medium text-slate-400 uppercase">{req.current_values?.[field] || <span className="italic opacity-50">Null</span>}</span>
                                                  </td>
                                                  <td className="px-6 py-3 text-center border-l border-slate-100">
                                                      <span className="font-bold text-blue-900 bg-blue-50 px-3 py-1 border border-blue-100 uppercase">{value || <span className="text-slate-300 italic opacity-50">Null</span>}</span>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Right Side: Administrative Evidence & Actions */}
                  <div className="space-y-8 flex flex-col border-l border-slate-100 lg:pl-12">
                      <div className="space-y-4 flex-1">
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Substantiating Evidence</h3>
                          <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                              {req.proof_url ? (
                                  <div className="space-y-4">
                                      <button 
                                          onClick={() => setViewingImage(req.proof_url)}
                                          className="w-full aspect-[4/3] bg-white border border-slate-300 overflow-hidden shadow-sm hover:shadow-md transition-all group relative"
                                      >
                                          <Image src={req.proof_url} alt="Proof" fill unoptimized className="object-contain" />
                                          <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                              <span className="text-[9px] font-black text-white uppercase tracking-widest bg-slate-800 px-3 py-1 shadow-xl">Audit Full Document</span>
                                          </div>
                                      </button>
                                      <p className="text-[9px] text-slate-500 font-bold text-center leading-relaxed italic uppercase tracking-tighter opacity-70">Official Verification Document Provided by Student</p>
                                  </div>
                              ) : (
                                  <div className="py-12 text-center space-y-2 border-2 border-dashed border-slate-200">
                                      <span className="text-3xl grayscale opacity-20 block">📄</span>
                                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No Evidence Appended</span>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Administrative Actions */}
                      <div className="space-y-3 pt-6 border-t border-slate-200">
                          <button 
                              disabled={processing}
                              onClick={() => handleAction(req.id, 'approve')}
                              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-sm font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50"
                          >
                              {processing ? 'Processing...' : 'Authorize Modification'}
                          </button>
                          <button 
                              disabled={processing}
                              onClick={() => setRejectingRequest(req)}
                              className="w-full bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 py-3 rounded-sm font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                          >
                              Issue Rejection Memo
                          </button>
                      </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Audit Image Preview Modal */}
      {viewingImage && (
        <div 
            className="fixed inset-0 z-[200] bg-slate-900/95 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setViewingImage(null)}
        >
            <div className="relative w-full h-full flex flex-col items-center justify-center">
                <div className="absolute top-0 right-0 p-6">
                    <button className="text-white text-2xl font-light hover:scale-110 transition-transform uppercase tracking-widest flex items-center gap-2">
                       <span className="text-sm">Close Audit</span> ×
                    </button>
                </div>
                <div className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center border-4 border-slate-800 shadow-2xl">
                    <Image src={viewingImage} alt="Audit Preview" fill unoptimized className="object-contain bg-white" />
                </div>
                <div className="mt-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Digital Audit Environment • High-Resolution View</div>
            </div>
        </div>
      )}

      {/* Rejection Memo Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-sm shadow-2xl max-w-md w-full border border-slate-300">
            <div className="bg-[#0b3578] px-8 py-4 text-white">
                <h2 className="text-lg font-bold uppercase tracking-tight">Administrative Rejection</h2>
            </div>
            
            <div className="p-8">
                <p className="text-[11px] text-slate-600 mb-6 font-bold leading-relaxed uppercase tracking-wider">
                  Specify formal reason for rejection of application for student <span className="text-blue-800 underline">{rejectingRequest.name}</span>.
                </p>
                
                <textarea 
                  autoFocus
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border border-slate-300 bg-slate-50 rounded-sm p-4 text-xs font-bold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                  rows={4}
                  placeholder="e.g. Identity evidence illegible, Record mismatch..."
                />
                
                <div className="mt-8 flex gap-4">
                  <button 
                    onClick={() => { setRejectingRequest(null); setRejectionReason(''); }}
                    className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 rounded-sm hover:bg-slate-200 transition-colors border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={processing || !rejectionReason.trim()}
                    onClick={() => handleAction(rejectingRequest.id, 'reject', rejectionReason)}
                    className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-white bg-rose-700 rounded-sm hover:bg-rose-800 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                  >
                    Issue Rejection
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
