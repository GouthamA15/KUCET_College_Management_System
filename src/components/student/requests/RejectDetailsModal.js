"use client";

import { createPortal } from 'react-dom';

export default function RejectDetailsModal({ isOpen, request, onClose }) {
  if (!isOpen || !request) return null;
  // Format created_at as DD-MM-YYYY
  const pad = (n) => String(n).padStart(2, '0');
  let formattedDate = '-';
  try {
    if (request.created_at) {
      const d = new Date(request.created_at);
      if (!isNaN(d.getTime())) {
        formattedDate = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      }
    }
  } catch (e) {
    // keep '-' on error
  }

  const modal = (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="reject-modal-title" className="bg-white max-w-[650px] w-full mx-4 sm:mx-auto rounded-sm shadow-md p-6">
        <h3 id="reject-modal-title" className="text-lg font-semibold text-gray-800 mb-3 tracking-wide">Request Rejection Details</h3>
        <div className="text-sm text-gray-700 mb-4 space-y-3">
          <div><strong className="font-medium text-gray-800">Certificate:</strong> <span className="text-gray-700">{request.certificate_type}</span></div>
          <div>
            <strong className="font-medium text-gray-800">Reason:</strong>
          </div>
          <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-sm text-sm text-gray-800">
            {request.reject_reason || 'No reason provided.'}
          </div>
          <div className="text-xs text-gray-500">Applied on: {formattedDate}</div>
          <div className="mt-2 text-sm text-gray-600">You may submit a new certificate request from the Requests page.</div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
