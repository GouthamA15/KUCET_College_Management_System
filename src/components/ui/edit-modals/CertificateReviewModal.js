'use client';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import CertificateActionPanel from '@/components/staff/certificates/CertificateActionPanel';
import { X, CheckCircle, XCircle } from 'lucide-react';

export const CertificateReviewModal = ({
  isDialogOpen,
  closeDialog,
  isDialogLoading,
  dialogError,
  selectedRequestDetails,
  selectedRequestId,
  setRejectReasonOpen,
  refreshCertificateRequests,
  fetchRecords,
  staffType
}) => {
  const [processing, setProcessing] = useState(false);

  if (!isDialogOpen || typeof document === 'undefined') return null;

  const modal = (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-fadeInUp">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-xl font-bold text-[#0b2447] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>
              Document Verification
            </h3>
            <p className="text-sm font-medium text-gray-500 mt-0.5">
              {selectedRequestDetails?.roll_number ? `Student: ${selectedRequestDetails.roll_number}` : 'Review Request Details'}
            </p>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-800 cursor-pointer p-2 rounded-full hover:bg-gray-200 transition-colors"
            onClick={closeDialog}
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[65vh] bg-gray-50/30">
          {isDialogLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="animate-spin h-8 w-8 border-4 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
              <p className="text-sm font-medium text-gray-500">Retrieving details...</p>
            </div>
          ) : dialogError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm font-medium text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> {dialogError}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-1">
              <CertificateActionPanel request={selectedRequestDetails} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-white flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeDialog}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close
          </button>
          
          {selectedRequestDetails?.status === 'PENDING' && (
            <>
              <button 
                type="button" 
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer disabled:opacity-50 transition-colors hover:bg-rose-700 shadow-sm" 
                disabled={isDialogLoading || !!dialogError || !selectedRequestId || processing} 
                onClick={() => setRejectReasonOpen(true)}
              >
                <XCircle className="w-4 h-4" /> Reject Request
              </button>
              <button 
                type="button" 
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0b3578] text-white font-bold cursor-pointer disabled:opacity-50 transition-colors hover:bg-blue-900 shadow-sm" 
                disabled={isDialogLoading || !!dialogError || !selectedRequestId || processing} 
                onClick={async () => {
                  try {
                    if (!selectedRequestId) return;
                    if (selectedRequestDetails?.status !== 'PENDING') return;
                    setProcessing(true);
                    const res = await fetch(`/api/staff/requests/${encodeURIComponent(selectedRequestId)}`, {
                      method: 'PUT', 
                      credentials: 'same-origin', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: JSON.stringify({ status: 'APPROVED' })
                    });
                    if (res.ok) {
                      closeDialog();
                      await refreshCertificateRequests(staffType);
                      await fetchRecords();
                    }
                  } catch { /* empty */ } finally {
                    setProcessing(false);
                  }
                }}
              >
                {processing ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <CheckCircle className="w-4 h-4" />} 
                Authorize & Approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
