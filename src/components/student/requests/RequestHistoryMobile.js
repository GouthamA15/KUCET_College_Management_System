"use client";
import { getStatusStyles } from '@/lib/ui-utils';
import { formatCertificateName } from '@/lib/certificate-utils';

export default function RequestHistoryMobile({
  requests,
  downloadingId,
  downloadErrors,
  onDownload,
  onOpenRejectModal,
  isLoadingRequests
}) {
  const showLoading = !!isLoadingRequests;
  const hasData = Array.isArray(requests) && requests.length > 0;

  return (
    <div className="w-full">
      <div className="space-y-3 min-h-32">
        {showLoading ? (
          <div className="flex items-center justify-center h-32">
            <svg className="animate-spin h-6 w-6 text-indigo-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <div className="text-sm text-gray-600">Loading Request History...</div>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-32 text-gray-600">No certificate requests found.</div>
        ) : (
          requests.map((req) => {
            const s = (req.status || '').toUpperCase();
            return (
              <div key={req.request_id} className="w-full border rounded-md p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 wrap-break-word">{formatCertificateName(req.certificate_type, req.purpose)}</div>
                    <div className="text-xs text-gray-500 mt-1">Request ID: <span className="font-medium text-gray-700">{req.request_id}</span></div>
                  </div>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyles(s)}`}>{s}</span>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  <div>Applied: <span className="font-medium text-gray-800">{new Date(req.created_at).toLocaleDateString()}</span></div>
                  {req.reject_reason && (
                    <div className="mt-2 text-sm text-gray-700">Remarks: <span className="font-normal text-gray-800">{req.reject_reason}</span></div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-end gap-3">
                  {s === 'APPROVED' && (
                    <button onClick={() => onDownload(req)} disabled={!!downloadingId} className="text-indigo-600 hover:text-indigo-900 text-sm">
                      {downloadingId === req.request_id ? 'Please wait...' : 'Download'}
                    </button>
                  )}
                  {s === 'REJECTED' && (
                    <button onClick={() => onOpenRejectModal(req)} className="text-red-600 hover:text-red-800 text-sm">View Details</button>
                  )}
                </div>
                {downloadErrors[req.request_id] && (
                  <div className="mt-2 text-xs text-red-600">{downloadErrors[req.request_id]}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
