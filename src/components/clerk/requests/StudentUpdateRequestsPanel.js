'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useClerk } from '@/context/ClerkContext';
import Image from 'next/image';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { getAssetUrl } from '@/lib/assets';

const StudentUpdateRequestsPanel = () => {
  const { clerkData: clerk, loading: isContextLoading, pendingProfileRequests, isLoadingRequests, refreshProfileRequests } = useClerk();
  
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const [viewingImage, setViewingImage] = useState(null);

  const requests = pendingProfileRequests || [];
  const loading = isLoadingRequests && requests.length === 0;

  const formatIstDateTimeUpper = (value) => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
        .format(new Date(value))
        .toUpperCase();
    } catch {
      try {
        return new Date(value).toISOString().replace('T', ' ').slice(0, 16).toUpperCase();
      } catch {
        return '';
      }
    }
  };

  useEffect(() => {
    if (!isContextLoading && clerk && clerk.role === 'admission' && requests.length === 0) {
      refreshProfileRequests();
    }
  }, [clerk, isContextLoading, requests.length, refreshProfileRequests]);

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
        refreshProfileRequests();
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

  if (isContextLoading || (loading && requests.length === 0)) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center">Connecting to Records Office...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Profile Modification Queue</h2>
          <p className="text-[10px] text-slate-500 font-medium uppercase mt-1 tracking-wider">Verify and authorize student-initiated data modifications</p>
        </div>
        <button onClick={refreshProfileRequests} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all rounded-sm shadow-sm">
            <span className={`${loading ? 'animate-spin' : ''}`}>↻</span> Sync
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 shadow-sm py-20 text-center rounded-sm">
          <span className="text-4xl opacity-20 block mb-4">📂</span>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Queue Status: Clear</h2>
          <p className="text-slate-500 mt-2 text-[10px] font-medium uppercase tracking-tight">No pending modification applications detected</p>
        </div>
      ) : (
        <div className="space-y-12">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border border-slate-200 shadow-md rounded-sm overflow-hidden animate-fadeIn">
              
              {/* Formal Header: Application Identifier */}
              <div className="bg-[#0b3578] px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between text-white border-b border-blue-900 gap-4">
                <div>
                  <div className="text-lg font-black uppercase tracking-tight">{req.name}</div>
                  <div className="text-[10px] text-blue-200 font-bold tracking-widest uppercase mt-1">Roll No: {req.roll_no} — Application Identifier #{req.id}</div>
                </div>
                <div className="bg-blue-900/40 px-5 py-2 border border-blue-700/50 rounded-sm">
                  <span className="text-[10px] font-black uppercase tracking-widest">SUBMISSION TIMESTAMP: {formatIstDateTimeUpper(req.created_at)}</span>
                </div>
              </div>

              <div className="p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
                
                {/* Left Side: Audit of Proposed Modifications */}
                <div className="space-y-12">
                    
                    {/* 1. Visual Evidence Modifications */}
                    {(req.new_pfp || req.new_signature) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {req.new_pfp && (
                                <div className="space-y-5">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                      Identification Photo Audit
                                    </h3>
                                    <div className="flex items-center gap-6 bg-slate-50 p-6 border border-slate-200 rounded-sm">
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">College Record</span>
                                            <div className="w-full aspect-square bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                                                {req.old_pfp ? <Image src={getAssetUrl(req.old_pfp)} alt="Old" width={150} height={150} unoptimized className="object-cover w-full h-full" /> : <span className="text-[9px] text-slate-300 font-bold uppercase">No Record</span>}
                                            </div>
                                        </div>
                                        <div className="text-slate-300 font-black text-xl">→</div>
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-black text-[#0b3578] uppercase tracking-widest">Proposed New</span>
                                            <button onClick={() => setViewingImage(req.new_pfp)} className="w-full aspect-square bg-white border-2 border-blue-200 flex items-center justify-center overflow-hidden hover:border-blue-500 transition-all cursor-zoom-in shadow-md">
                                                <Image src={getAssetUrl(req.new_pfp)} alt="New" width={150} height={150} unoptimized className="object-cover w-full h-full" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {req.new_signature && (
                                <div className="space-y-5">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                      Specimen Signature Audit
                                    </h3>
                                    <div className="flex items-center gap-6 bg-slate-50 p-6 border border-slate-200 rounded-sm">
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">College Record</span>
                                            <div className="w-full h-24 bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                                                {req.old_signature ? <Image src={getAssetUrl(req.old_signature)} alt="Old" width={150} height={80} unoptimized className="object-contain" /> : <span className="text-[9px] text-slate-300 font-bold uppercase">No Record</span>}
                                            </div>
                                        </div>
                                        <div className="text-slate-300 font-black text-xl">→</div>
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-black text-amber-600 uppercase tracking-widest">Proposed New</span>
                                            <button onClick={() => setViewingImage(req.new_signature)} className="w-full h-24 bg-white border-2 border-amber-200 flex items-center justify-center overflow-hidden hover:border-amber-500 transition-all cursor-zoom-in shadow-md">
                                                <Image src={getAssetUrl(req.new_signature)} alt="New" width={150} height={80} unoptimized className="object-contain" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. Textual Record Modifications */}
                    {req.new_data && (
                        <div className="space-y-5">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Proposed Data Modifications
                            </h3>
                            <div className="border border-slate-200 rounded-sm overflow-hidden shadow-sm bg-slate-50">
                                <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                        <tr className="bg-white border-b border-slate-200">
                                            <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-left">Administrative Field</th>
                                            <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest border-l border-slate-100 text-center">College Record</th>
                                            <th className="px-6 py-4 font-black text-[#0b3578] uppercase tracking-widest border-l border-slate-100 text-center">Student Submission</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {Object.entries(typeof req.new_data === 'string' ? JSON.parse(req.new_data) : req.new_data).map(([field, value]) => (
                                            <tr key={field} className="hover:bg-white transition-colors">
                                                <td className="px-6 py-4 font-black text-slate-500 uppercase tracking-tight">{formatLabel(field)}</td>
                                                <td className="px-6 py-4 text-center border-l border-slate-100">
                                                    <span className="font-bold text-slate-400 uppercase tracking-tighter opacity-70 italic">{req.current_values?.[field] || 'Null'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center border-l border-slate-100">
                                                    <span className="font-black text-[#0b3578] bg-blue-50 px-4 py-1.5 border border-blue-100 rounded-sm uppercase tracking-tight shadow-sm inline-block min-w-30">
                                                      {value || 'Null'}
                                                    </span>
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
                    <div className="space-y-5 flex-1">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Substantiating Evidence</h3>
                        <div className="bg-slate-50 p-6 border border-slate-200 rounded-sm">
                            {req.proof_url ? (
                                <div className="space-y-5">
                                    <button 
                                        onClick={() => setViewingImage(req.proof_url)}
                                        className="w-full aspect-4/3 bg-white border-2 border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all group relative rounded-sm"
                                    >
                                        <Image src={getAssetUrl(req.proof_url)} alt="Proof" fill unoptimized className="object-contain" />
                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest bg-slate-800 px-5 py-2 shadow-2xl rounded-sm">Audit Document</span>
                                        </div>
                                    </button>
                                    <p className="text-[9px] text-slate-400 font-bold text-center leading-relaxed uppercase tracking-widest opacity-80">Official Verification Artifact Provided</p>
                                </div>
                            ) : (
                                <div className="py-20 text-center space-y-4 border-2 border-dashed border-slate-200 rounded-sm bg-slate-100/30">
                                    <span className="text-4xl grayscale opacity-10 block">📄</span>
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">No Evidence Appended</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Administrative Actions */}
                    <div className="space-y-4 pt-8 border-t border-slate-200">
                        <button 
                            disabled={processing}
                            onClick={() => handleAction(req.id, 'approve')}
                            className="w-full bg-[#0b3578] hover:bg-blue-900 text-white py-4 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-50"
                        >
                            {processing ? 'AUTHORIZING...' : 'VALIDATE & AUTHORIZE'}
                        </button>
                        <button 
                            disabled={processing}
                            onClick={() => setRejectingRequest(req)}
                            className="w-full bg-white text-rose-700 border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200 py-4 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                        >
                            ISSUE REJECTION MEMO
                        </button>
                    </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Image Preview Modal */}
        {viewingImage && createPortal(
        (
          <div 
            className="fixed inset-0 z-[200] bg-slate-900/95 flex items-center justify-center p-6 md:p-12 cursor-zoom-out animate-fadeIn"
            onClick={() => setViewingImage(null)}
          >
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <div className="absolute top-0 right-0 p-8">
                <button className="text-white text-3xl font-light hover:scale-110 transition-transform uppercase tracking-widest flex items-center gap-3">
                 <span className="text-xs font-black tracking-[0.3em]">DISMISS AUDIT</span> ×
                </button>
              </div>
              <div className="relative max-w-6xl max-h-[85vh] w-full h-full flex items-center justify-center border-8 border-slate-800 shadow-2xl bg-white rounded-sm overflow-hidden">
                <Image src={getAssetUrl(viewingImage)} alt="Audit Preview" fill unoptimized className="object-contain" />
              </div>
              <div className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Digital Forensic Environment • High-Resolution View</div>
            </div>
          </div>
        ),
        document.body
        )}

      {/* Rejection Memo Modal */}
      {rejectingRequest && createPortal(
        (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/70 p-6 backdrop-blur-md animate-fadeIn">
            <div className="bg-white rounded-sm shadow-2xl max-w-md w-full border border-slate-300 overflow-hidden animate-fadeInUp">
              <div className="bg-[#0b3578] px-8 py-5 text-white">
                  <h2 className="text-lg font-black uppercase tracking-tight">Administrative Rejection Memo</h2>
              </div>
              
              <div className="p-8">
                  <p className="text-[11px] text-slate-500 mb-6 font-bold leading-relaxed uppercase tracking-wider">
                    Specify formal rationale for rejection of record modification application for student <span className="text-blue-700 underline underline-offset-4 font-black">{rejectingRequest.name}</span>.
                  </p>
                  
                  <textarea 
                    autoFocus
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full border-2 border-slate-100 bg-slate-50 rounded-sm p-5 text-xs font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 shadow-inner resize-none"
                    rows={5}
                    placeholder="e.g. Identification evidence illegible, Record mismatch, Insufficient substantiation..."
                  />
                  
                  <div className="mt-10 flex gap-4">
                    <button 
                      onClick={() => { setRejectingRequest(null); setRejectionReason(''); }}
                      className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 rounded-sm hover:bg-slate-100 transition-colors border-2 border-slate-100 shadow-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={processing || !rejectionReason.trim()}
                      onClick={() => handleAction(rejectingRequest.id, 'reject', rejectionReason)}
                      className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-white bg-rose-700 rounded-sm hover:bg-rose-800 disabled:opacity-50 transition-all shadow-lg shadow-rose-100 active:scale-95"
                    >
                      Issue Rejection
                    </button>
                  </div>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
}

export default StudentUpdateRequestsPanel;
