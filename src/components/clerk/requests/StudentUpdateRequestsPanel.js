'use client';

import { useState, useEffect, _useRef } from 'react';
import { createPortal } from 'react-dom';
import { useClerk } from '@/context/ClerkContext';
import Image from 'next/image';
import toast from 'react-hot-toast';
import _LoadingSpinner from '@/components/ui/LoadingSpinner';
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
    } catch (_err) {
      toast.error('Administrative system error', { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const formatLabel = (str) => {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderValue = (val) => (val !== null && val !== undefined ? String(val) : 'Null');

  if (isContextLoading || (loading && requests.length === 0)) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="animate-spin h-6 w-6 border-2 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
            <p className="text-sm font-medium text-center text-gray-500">Connecting to Records Office...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Profile Modification Queue</h2>
          <p className="text-sm text-gray-500 mt-1">Verify and authorize student-initiated data modifications</p>
        </div>
        <button onClick={refreshProfileRequests} className="flex items-center gap-2 flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-md shadow-sm">
            <span className={`${loading ? 'animate-spin' : ''}`}>↻</span> Sync
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-gray-200 shadow-sm py-20 text-center rounded-md">
          <span className="text-4xl opacity-20 block mb-4">📂</span>
          <h2 className="text-sm font-semibold text-gray-700">Queue Status: Clear</h2>
          <p className="text-sm text-gray-500 mt-2">No pending modification applications detected</p>
        </div>
      ) : (
        <div className="space-y-12">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border border-gray-200 shadow-sm rounded-md overflow-hidden animate-fadeIn">
              
              {/* Formal Header: Application Identifier */}
              <div className="bg-[#0b3578] px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between text-white border-b border-blue-900 gap-4">
                <div>
                  <div className="text-lg font-semibold">{req.name}</div>
                  <div className="text-[10px] text-blue-200 font-bold mt-1">Roll No: {req.roll_no} — Application Identifier #{req.id}</div>
                </div>
                <div className="bg-blue-900/40 px-5 py-2 border border-blue-700/50 rounded-md">
                  <span className="text-[10px] font-semibold">SUBMISSION TIMESTAMP: {formatIstDateTimeUpper(req.created_at)}</span>
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
                                    <h3 className="text-[10px] font-semibold text-gray-400 border-b border-gray-100 pb-2 flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                      Identification Photo Audit
                                    </h3>
                                    <div className="flex items-center gap-6 bg-gray-50 p-6 border border-gray-200 rounded-md">
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-semibold text-gray-400 ">College Record</span>
                                            <div className="w-full aspect-square bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-inner">
                                                {req.old_pfp ? <Image src={getAssetUrl(req.old_pfp)} alt="Old" width={150} height={150} unoptimized className="object-cover w-full h-full" /> : <span className="text-[9px] text-gray-300 font-bold ">No Record</span>}
                                            </div>
                                        </div>
                                        <div className="text-gray-300 font-semibold text-xl">→</div>
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-semibold text-[#0b3578] ">Proposed New</span>
                                            <button onClick={() => setViewingImage(req.new_pfp)} className="w-full aspect-square bg-white border-2 border-blue-200 flex items-center justify-center overflow-hidden hover:border-blue-500 transition-all cursor-zoom-in shadow-sm">
                                                <Image src={getAssetUrl(req.new_pfp)} alt="New" width={150} height={150} unoptimized className="object-cover w-full h-full" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {req.new_signature && (
                                <div className="space-y-5">
                                    <h3 className="text-[10px] font-semibold text-gray-400 border-b border-gray-100 pb-2 flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                      Specimen Signature Audit
                                    </h3>
                                    <div className="flex items-center gap-6 bg-gray-50 p-6 border border-gray-200 rounded-md">
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-semibold text-gray-400 ">College Record</span>
                                            <div className="w-full h-24 bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-inner">
                                                {req.old_signature ? <Image src={getAssetUrl(req.old_signature)} alt="Old" width={150} height={80} unoptimized className="object-contain" /> : <span className="text-[9px] text-gray-300 font-bold ">No Record</span>}
                                            </div>
                                        </div>
                                        <div className="text-gray-300 font-semibold text-xl">→</div>
                                        <div className="text-center space-y-3 flex-1">
                                            <span className="block text-[9px] font-semibold text-amber-600 ">Proposed New</span>
                                            <button onClick={() => setViewingImage(req.new_signature)} className="w-full h-24 bg-white border-2 border-amber-200 flex items-center justify-center overflow-hidden hover:border-amber-500 transition-all cursor-zoom-in shadow-sm">
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
                            <h3 className="text-[10px] font-semibold text-gray-400 border-b border-gray-100 pb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Proposed Data Modifications
                            </h3>
                            <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm bg-white divide-y divide-gray-100">
                                <div className="hidden md:grid grid-cols-3 bg-gray-50 border-b border-gray-200 p-4">
                                    <div className="font-semibold text-gray-500 text-xs">Field</div>
                                    <div className="font-semibold text-gray-500 text-xs text-center border-l border-gray-200">Current Record</div>
                                    <div className="font-semibold text-[#0b3578] text-xs text-center border-l border-gray-200">Requested Change</div>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {Object.entries(typeof req.new_data === 'string' ? JSON.parse(req.new_data) : req.new_data).map(([field, value]) => (
                                        <div key={field} className="grid grid-cols-1 md:grid-cols-3 hover:bg-gray-50 transition-colors p-4 md:items-center gap-3 md:gap-0">
                                            <div className="font-medium text-gray-700 text-sm break-words border-b md:border-0 pb-2 md:pb-0">{formatLabel(field)}</div>
                                            <div className="md:text-center md:border-l border-gray-100 md:px-2 break-words flex flex-row items-center justify-between md:block">
                                                <span className="md:hidden text-xs text-gray-400 uppercase tracking-wider font-semibold">Current:</span>
                                                <span className="text-sm text-gray-500 italic">{renderValue(req.current_values?.[field])}</span>
                                            </div>
                                            <div className="md:text-center md:border-l border-gray-100 md:px-2 break-words flex flex-row items-center justify-between md:block">
                                                <span className="md:hidden text-xs text-gray-400 uppercase tracking-wider font-semibold">Requested:</span>
                                                <span className="font-semibold text-[#0b3578] bg-blue-50 px-3 py-1 border border-blue-100 rounded-md inline-block">
                                                  {renderValue(value)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Administrative Evidence & Actions */}
                <div className="space-y-8 flex flex-col border-l border-gray-100 lg:pl-12">
                    <div className="space-y-5 flex-1">
                        <h3 className="text-[10px] font-semibold text-gray-400 border-b border-gray-100 pb-2">Substantiating Evidence</h3>
                        <div className="bg-gray-50 p-6 border border-gray-200 rounded-md">
                            {req.proof_url ? (
                                <div className="space-y-5">
                                    <button 
                                        onClick={() => setViewingImage(req.proof_url)}
                                        className="w-full aspect-4/3 bg-white border-2 border-gray-200 overflow-hidden shadow-sm hover:shadow-sm hover:border-blue-300 transition-all group relative rounded-md"
                                    >
                                        <Image src={getAssetUrl(req.proof_url)} alt="Proof" fill unoptimized className="object-contain" />
                                        <div className="absolute inset-0 bg-gray-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-[10px] font-semibold text-white bg-gray-800 px-5 py-2 shadow-2xl rounded-md">Audit Document</span>
                                        </div>
                                    </button>
                                    <p className="text-[9px] text-gray-400 font-bold text-center leading-relaxed opacity-80">Official Verification Artifact Provided</p>
                                </div>
                            ) : (
                                <div className="py-20 text-center space-y-4 border-2 border-dashed border-gray-200 rounded-md bg-gray-100/30">
                                    <span className="text-4xl grayscale opacity-10 block">📄</span>
                                    <span className="text-[9px] font-semibold text-gray-300 tracking-[0.2em]">No Evidence Appended</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Administrative Actions */}
                    <div className="space-y-4 pt-8 border-t border-gray-200">
                        <button 
                            disabled={processing}
                            onClick={() => handleAction(req.id, 'approve')}
                            className="w-full bg-[#0b3578] hover:bg-blue-900 text-white py-4 rounded-md font-semibold text-[10px] transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-50"
                        >
                            {processing ? 'AUTHORIZING...' : 'VALIDATE & AUTHORIZE'}
                        </button>
                        <button 
                            disabled={processing}
                            onClick={() => setRejectingRequest(req)}
                            className="w-full bg-white text-rose-700 border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200 py-4 rounded-md font-semibold text-[10px] transition-all active:scale-95 disabled:opacity-50 shadow-sm"
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
        {viewingImage && typeof document !== 'undefined' && createPortal(
        (
          <div 
            className="fixed inset-0 z-[200] bg-gray-900/95 flex items-center justify-center p-6 md:p-12 cursor-zoom-out animate-fadeIn"
            onClick={() => setViewingImage(null)}
          >
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <div className="absolute top-0 right-0 p-8">
                <button className="text-white text-3xl font-light hover:scale-110 transition-transform flex items-center gap-3">
                 <span className="text-xs font-semibold tracking-[0.3em]">DISMISS AUDIT</span> ×
                </button>
              </div>
              <div className="relative max-w-6xl max-h-[85vh] w-full h-full flex items-center justify-center border-8 border-gray-800 shadow-2xl bg-white rounded-md overflow-hidden">
                <Image src={getAssetUrl(viewingImage)} alt="Audit Preview" fill unoptimized className="object-contain" />
              </div>
              <div className="mt-8 text-gray-500 text-[10px] font-semibold tracking-[0.4em] animate-pulse">Digital Forensic Environment • High-Resolution View</div>
            </div>
          </div>
        ),
        document.body
        )}

      {/* Rejection Memo Modal */}
      {rejectingRequest && typeof document !== 'undefined' && createPortal(
        (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-gray-900/70 p-6 backdrop-blur-md animate-fadeIn">
            <div className="bg-white rounded-md shadow-2xl max-w-md w-full border border-gray-300 overflow-hidden animate-fadeInUp">
              <div className="bg-[#0b3578] px-8 py-5 text-white">
                  <h2 className="text-lg font-semibold">Administrative Rejection Memo</h2>
              </div>
              
              <div className="p-8">
                  <p className="text-[11px] text-gray-500 mb-6 font-bold leading-relaxed ">
                    Specify formal rationale for rejection of record modification application for student <span className="text-blue-700 underline underline-offset-4 font-semibold">{rejectingRequest.name}</span>.
                  </p>
                  
                  <textarea 
                    autoFocus
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full border-2 border-gray-100 bg-gray-50 rounded-md p-5 text-xs font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 shadow-inner resize-none"
                    rows={5}
                    placeholder="e.g. Identification evidence illegible, Record mismatch, Insufficient substantiation..."
                  />
                  
                  <div className="mt-10 flex gap-4">
                    <button 
                      onClick={() => { setRejectingRequest(null); setRejectionReason(''); }}
                      className="flex-1 py-4 text-[10px] font-semibold text-gray-400 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors border-2 border-gray-100 shadow-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={processing || !rejectionReason.trim()}
                      onClick={() => handleAction(rejectingRequest.id, 'reject', rejectionReason)}
                      className="flex-1 py-4 text-[10px] font-semibold text-white bg-rose-700 rounded-md hover:bg-rose-800 disabled:opacity-50 transition-all shadow-lg shadow-rose-100 active:scale-95"
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
