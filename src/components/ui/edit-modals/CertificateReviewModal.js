'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import CertificateActionPanel from '@/components/staff/certificates/CertificateActionPanel';

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
  if (!isDialogOpen || typeof document === 'undefined') return null;

  const modal = (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Request Details</h3>
          <button
            type="button"
            className="text-gray-600 hover:text-gray-900 cursor-pointer"
            onClick={closeDialog}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isDialogLoading ? (
            <div className="text-sm text-gray-600">Loading request details…</div>
          ) : dialogError ? (
            <div className="text-sm text-red-600">{dialogError}</div>
          ) : (
            <CertificateActionPanel request={selectedRequestDetails} />
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-2">
          {selectedRequestDetails?.status === 'PENDING' ? (
            <>
              <button 
                type="button" 
                className="px-4 py-2 rounded-md bg-red-600 text-white cursor-pointer disabled:opacity-60 transition-colors hover:bg-red-700" 
                disabled={isDialogLoading || !!dialogError || !selectedRequestId} 
                onClick={() => setRejectReasonOpen(true)}
              >
                Reject
              </button>
              <button 
                type="button" 
                className="px-4 py-2 rounded-md bg-green-600 text-white cursor-pointer disabled:opacity-60 transition-colors hover:bg-green-700" 
                disabled={isDialogLoading || !!dialogError || !selectedRequestId} 
                onClick={async () => {
                  try {
                    if (!selectedRequestId) return;
                    if (selectedRequestDetails?.status !== 'PENDING') return;
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
                  } catch { /* empty */ }
                }}
              >
                Approve
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={closeDialog}
            className="px-4 py-2 rounded-md border cursor-pointer hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
