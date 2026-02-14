"use client";

export default function RejectDetailsModal({ isOpen, request, onClose, onReapply }) {
  if (!isOpen || !request) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="bg-white max-w-lg w-full rounded-md shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Request Rejection Details</h3>
        <div className="text-sm text-gray-700 mb-4">
          <div><strong>Certificate:</strong> {request.certificate_type}</div>
          <div className="mt-2"><strong>Reason:</strong></div>
          <div className="mt-1 p-3 bg-gray-50 border rounded text-sm text-red-700">{request.reject_reason || 'No reason provided.'}</div>
          <div className="mt-3 text-xs text-gray-500">Applied on: {new Date(request.created_at).toLocaleString()}</div>
          <div className="mt-4 p-3 bg-indigo-50 border-l-4 border-indigo-400 rounded-md text-sm text-indigo-700">
            You can re-apply to the certificate from the Requests page.
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Close</button>
          <button onClick={() => onReapply?.(request)} className="px-3 py-1 rounded bg-indigo-600 text-white">Re-Apply</button>
        </div>
      </div>
    </div>
  );
}
