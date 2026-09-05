'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, FileText, CheckCircle, XCircle } from 'lucide-react';
import { getAssetUrl } from '@/lib/assets';

export const StudentUpdateReviewModal = ({
  reviewingRequest,
  setReviewingRequest,
  processing,
  setRejectingRequest,
  handleAction,
  setViewingImage
}) => {
  if (!reviewingRequest) return null;

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
      }).format(new Date(value)).toUpperCase();
    } catch {
      try {
        return new Date(value).toISOString().replace('T', ' ').slice(0, 16).toUpperCase();
      } catch {
        return '';
      }
    }
  };

  const formatLabel = (str) => {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderValue = (val) => (val !== null && val !== undefined ? String(val) : 'Null');

  const modal = (
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
                            <Image unoptimized src={getAssetUrl(reviewingRequest.old_pfp)} alt="Old" fill sizes="120px" className="object-cover" />
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
                          <Image unoptimized src={getAssetUrl(reviewingRequest.new_pfp)} alt="New" fill sizes="120px" className="object-cover" />
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
                            <Image unoptimized src={getAssetUrl(reviewingRequest.old_signature)} alt="Old" fill sizes="200px" className="object-contain p-2" />
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
                          <Image unoptimized src={getAssetUrl(reviewingRequest.new_signature)} alt="New" fill sizes="200px" className="object-contain p-2" />
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
                    try { data = JSON.parse(data); } catch (_e) { data = { request: data }; }
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
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
};
