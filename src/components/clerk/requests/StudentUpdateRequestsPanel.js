'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useClerk } from '@/context/ClerkContext';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getAssetUrl } from '@/lib/assets';
import { safeJsonParse } from '@/lib/json-utils';
import { Search, Filter, ArrowUpDown, X, FileText, CheckCircle, XCircle } from 'lucide-react';

const StudentUpdateRequestsPanel = () => {
  const { clerkData: clerk, loading: isContextLoading, pendingProfileRequests, isLoadingRequests, refreshProfileRequests } = useClerk();
  
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const [viewingImage, setViewingImage] = useState(null);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const requests = pendingProfileRequests || [];
  const loading = isLoadingRequests && requests.length === 0;

  const filteredRequests = useMemo(() => {
    return requests.filter(req => 
      req.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      req.roll_no?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [requests, searchQuery]);

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

  // Handle preventing scroll when drawer is open
  useEffect(() => {
    if (reviewingRequest || viewingImage || rejectingRequest) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [reviewingRequest, viewingImage, rejectingRequest]);

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
        setReviewingRequest(null);
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

  const getModifiedFieldsCount = (req) => {
    let count = 0;
    if (req.new_pfp) count++;
    if (req.new_signature) count++;
    if (req.new_data) {
      let data = req.new_data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = {}; }
      }
      if (data && typeof data === 'object') {
        count += Object.keys(data).length;
      } else {
        count += 1; // It's just a raw string update
      }
    }
    return count;
  };

  const getEvidenceCount = (req) => {
    let count = 0;
    if (req.proof_url) count++;
    return count;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0b2447]">Profile Modification Queue</h2>
          <p className="text-sm text-gray-500 mt-1">Review and approve student profile modification requests.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by name or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578] outline-none"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-md shadow-sm">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button onClick={refreshProfileRequests} className="flex items-center gap-2 px-3 py-2 bg-[#0b3578] text-white text-sm font-medium hover:bg-blue-900 transition-colors rounded-md shadow-sm">
            <span className={`${loading ? 'animate-spin' : ''}`}>↻</span> Sync
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2 bg-blue-50 text-[#0b3578] px-3 py-1.5 rounded-full font-medium border border-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            Pending: {requests.length}
        </div>
      </div>

      {/* Request Table */}
      {requests.length === 0 ? (
        <div className="bg-white border border-gray-200 shadow-sm py-24 text-center rounded-lg flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">No Pending Profile Modification Requests</h2>
          <p className="text-sm text-gray-500 mt-2">Students haven&apos;t submitted any profile updates.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-6 py-4 whitespace-nowrap">Student</th>
                  <th className="px-6 py-4 whitespace-nowrap">Roll No</th>
                  <th className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900">Submitted <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Modified Fields</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Evidence</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-800">{req.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 font-medium font-mono">{req.roll_no}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200">
                        {getModifiedFieldsCount(req)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600">
                        <FileText className="w-3.5 h-3.5 text-gray-400" /> {getEvidenceCount(req)} Files
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Pending
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setReviewingRequest(req)}
                        className="inline-flex items-center justify-center px-4 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-[#0b3578] hover:bg-[#0b3578] hover:text-white transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                      No requests matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Drawer */}
      {reviewingRequest && typeof document !== 'undefined' && createPortal(
        (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => !processing && setReviewingRequest(null)}
            ></div>
            
            <div className="relative w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col animate-slideLeft border-l border-gray-200">
              
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Review Modification Request</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">REQ-{reviewingRequest.id} • {formatIstDateTimeUpper(reviewingRequest.created_at)}</p>
                </div>
                <button 
                  onClick={() => !processing && setReviewingRequest(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50">
                
                {/* Top Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Student Name</p>
                      <p className="text-sm font-semibold text-gray-800">{reviewingRequest.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Roll Number</p>
                      <p className="text-sm font-semibold font-mono text-gray-800">{reviewingRequest.roll_no}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Status</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        PENDING
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Submitted</p>
                      <p className="text-sm font-medium text-gray-700">{new Date(reviewingRequest.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                </div>

                {/* Image Comparison */}
                {(reviewingRequest.new_pfp || reviewingRequest.new_signature) && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                      Media Updates
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      
                      {reviewingRequest.new_pfp && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <p className="text-xs font-semibold text-gray-700 text-center mb-4">Profile Picture</p>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <p className="text-[10px] font-bold text-gray-400 text-center uppercase">Current Record</p>
                              <div className="aspect-square bg-gray-50 border border-gray-200 rounded-md overflow-hidden relative">
                                {reviewingRequest.old_pfp ? (
                                  <Image unoptimized src={getAssetUrl(reviewingRequest.old_pfp)} alt="Old" fill className="object-cover" />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-xs text-gray-400">None</div>
                                )}
                              </div>
                            </div>
                            <div className="text-gray-300">→</div>
                            <div className="flex-1 space-y-2">
                              <p className="text-[10px] font-bold text-purple-600 text-center uppercase">Requested Image</p>
                              <button 
                                onClick={() => setViewingImage(reviewingRequest.new_pfp)}
                                className="w-full aspect-square bg-white border-2 border-purple-200 rounded-md overflow-hidden relative hover:border-purple-500 transition-colors shadow-sm cursor-zoom-in"
                              >
                                <Image unoptimized src={getAssetUrl(reviewingRequest.new_pfp)} alt="New" fill className="object-cover" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {reviewingRequest.new_signature && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <p className="text-xs font-semibold text-gray-700 text-center mb-4">Signature</p>
                          <div className="flex flex-col gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Current Record</p>
                              <div className="h-16 bg-gray-50 border border-gray-200 rounded-md overflow-hidden relative">
                                {reviewingRequest.old_signature ? (
                                  <Image unoptimized src={getAssetUrl(reviewingRequest.old_signature)} alt="Old" fill className="object-contain p-2" />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-xs text-gray-400">None</div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-purple-600 uppercase">Requested Image</p>
                              <button 
                                onClick={() => setViewingImage(reviewingRequest.new_signature)}
                                className="w-full h-16 bg-white border-2 border-purple-200 rounded-md overflow-hidden relative hover:border-purple-500 transition-colors shadow-sm cursor-zoom-in"
                              >
                                <Image unoptimized src={getAssetUrl(reviewingRequest.new_signature)} alt="New" fill className="object-contain p-2" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* Supporting Documents */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    Supporting Documents
                  </h4>
                  {reviewingRequest.proof_url ? (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                            <th className="px-4 py-3">Document</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-medium text-gray-800">Verification Proof</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">Image / PDF</td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => setViewingImage(reviewingRequest.proof_url)}
                                className="text-xs font-semibold text-[#0b3578] hover:underline"
                              >
                                Preview
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 border-dashed rounded-lg p-6 text-center shadow-sm">
                      <p className="text-sm text-gray-500">No supporting documents uploaded for this request.</p>
                    </div>
                  )}
                </div>

                {/* Modified Data Fields */}
                {reviewingRequest.new_data && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      Modified Fields
                    </h4>
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden divide-y divide-gray-100">
                      {Object.entries((() => {
                        let data = reviewingRequest.new_data;
                        if (typeof data === 'string') {
                          try { data = JSON.parse(data); } catch (e) { data = { request: data }; }
                        }
                        return data && typeof data === 'object' ? data : {};
                      })()).map(([field, value]) => (
                        <div key={field} className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-gray-500">{formatLabel(field)}</p>
                            <p className="text-sm text-gray-600 line-through decoration-gray-400">{renderValue(reviewingRequest.current_values?.[field])}</p>
                          </div>
                          <div className="hidden sm:flex justify-center text-gray-300">
                            →
                          </div>
                          <div className="space-y-1 sm:text-right">
                            <p className="text-[10px] uppercase font-bold text-blue-600">New Value</p>
                            <p className="text-sm font-semibold text-gray-900 bg-blue-50 px-2 py-0.5 rounded inline-block">{renderValue(value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Action Footer */}
              <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-10 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button 
                  disabled={processing}
                  onClick={() => setRejectingRequest(reviewingRequest)}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button 
                  disabled={processing}
                  onClick={() => handleAction(reviewingRequest.id, 'approve')}
                  className="flex-[2] flex items-center justify-center gap-2 bg-[#0b3578] hover:bg-blue-900 text-white py-3 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 shadow-md"
                >
                  <CheckCircle className="w-4 h-4" /> {processing ? 'Processing...' : 'Approve Modification'}
                </button>
              </div>

            </div>
          </div>
        ),
        document.body
      )}

      {/* Audit Image Preview Modal */}
      {viewingImage && typeof document !== 'undefined' && createPortal(
        (
          <div 
            className="fixed inset-0 z-[200] bg-gray-900/95 flex items-center justify-center p-6 md:p-12 cursor-zoom-out animate-fadeIn"
            onClick={() => setViewingImage(null)}
          >
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <div className="absolute top-0 right-0 p-4 sm:p-8 z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingImage(null); }}
                  className="text-white text-3xl font-light hover:scale-110 transition-transform flex items-center gap-3 bg-black/40 hover:bg-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/20 shadow-lg"
                >
                 <span className="text-xs font-semibold tracking-[0.3em]">DISMISS AUDIT</span> &times;
                </button>
              </div>
              <div className="relative max-w-6xl max-h-[85vh] w-full h-full flex items-center justify-center border-8 border-gray-800 shadow-2xl bg-white rounded-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <Image onError={(e) => { e.currentTarget.style.display = 'none'; }} src={getAssetUrl(viewingImage)} alt="Audit Preview" fill unoptimized className="object-contain" />
              </div>
              <div className="mt-8 text-gray-500 text-[10px] font-semibold tracking-[0.4em] animate-pulse">Digital Forensic Environment &bull; High-Resolution View</div>
            </div>
          </div>
        ),
        document.body
      )}

      {/* Rejection Memo Modal */}
      {rejectingRequest && typeof document !== 'undefined' && createPortal(
        (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-gray-900/70 p-6 backdrop-blur-md animate-fadeIn">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden animate-fadeInUp">
              <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-bold text-red-800">Reject Request</h2>
              </div>
              
              <div className="p-6">
                  <p className="text-sm text-gray-600 mb-4 font-medium leading-relaxed">
                    Specify the formal rationale for rejecting the modification application for <span className="font-bold text-gray-900">{rejectingRequest.name}</span>.
                  </p>
                  
                  <textarea 
                    autoFocus
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all placeholder:text-gray-400 shadow-inner resize-none"
                    rows={4}
                    placeholder="e.g. Identification evidence illegible, Record mismatch, Insufficient substantiation..."
                  />
                  
                  <div className="mt-6 flex gap-3">
                    <button 
                      onClick={() => { setRejectingRequest(null); setRejectionReason(''); }}
                      className="flex-1 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={processing || !rejectionReason.trim()}
                      onClick={() => handleAction(rejectingRequest.id, 'reject', rejectionReason)}
                      className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
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
