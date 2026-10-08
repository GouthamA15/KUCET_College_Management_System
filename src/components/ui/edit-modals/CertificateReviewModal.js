'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import CertificateActionPanel from '@/components/staff/certificates/CertificateActionPanel';
import { X, XCircle } from 'lucide-react';

export const CertificateReviewModal = ({
  isDialogOpen,
  closeDialog,
  isDialogLoading,
  dialogError,
  selectedRequestDetails,
  refreshCertificateRequests,
  fetchRecords,
  staffType
}) => {

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
        <div className="p-0 overflow-y-auto max-h-[75vh] bg-gray-50/30 flex flex-col">
          {isDialogLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="animate-spin h-8 w-8 border-4 border-[#0b3578] border-t-transparent rounded-full mb-4"></div>
              <p className="text-sm font-medium text-gray-500">Retrieving details...</p>
            </div>
          ) : dialogError ? (
            <div className="p-4 m-4 bg-rose-50 border border-rose-200 rounded-lg text-sm font-medium text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> {dialogError}
            </div>
          ) : (
            <div className="bg-white border-y border-gray-200 overflow-hidden flex-1">
              <CertificateActionPanel 
                request={selectedRequestDetails} 
                staffType={staffType}
                onActionComplete={async () => {
                  closeDialog();
                  await refreshCertificateRequests(staffType);
                  await fetchRecords();
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={closeDialog}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close Dialog
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
