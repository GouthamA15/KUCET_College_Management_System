"use client";

function statusStyles(status) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED') return 'bg-green-100 text-green-800';
  if (s === 'PENDING') return 'bg-yellow-100 text-yellow-800';
  if (s === 'REJECTED') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

export default function RequestHistoryMobile({
  requests,
  downloadingId,
  downloadErrors,
  onDownload,
  onOpenRejectModal,
}) {
  return (
    <div className="bg-white p-5 md:p-6 rounded-lg shadow-md">
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-3">Request History</h2>
      <div className="space-y-3">
        {requests.length > 0 ? (
          requests.map((req) => {
            const s = (req.status || '').toUpperCase();
            return (
              <div key={req.request_id} className="w-full border rounded-md p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 wrap-break-word">{req.certificate_type}</div>
                    <div className="text-xs text-gray-500 mt-1">Request ID: <span className="font-medium text-gray-700">{req.request_id}</span></div>
                  </div>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles(s)}`}>{s}</span>
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
        ) : (
          <div className="text-center text-sm text-gray-500">No requests found.</div>
        )}
      </div>
    </div>
  );
}
