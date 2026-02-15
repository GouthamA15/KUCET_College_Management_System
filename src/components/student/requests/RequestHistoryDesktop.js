"use client";

function statusStyles(status) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED') return 'bg-green-100 text-green-800';
  if (s === 'PENDING') return 'bg-yellow-100 text-yellow-800';
  if (s === 'REJECTED') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

export default function RequestHistoryDesktop({
  requests,
  downloadingId,
  downloadErrors,
  onDownload,
  onOpenRejectModal,
}) {
  return (
    <div className="bg-white p-5 md:p-6 rounded-lg shadow-md">
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-3">Request History</h2>
      <div className="max-h-130 overflow-y-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="px-4 py-2 w-2/5">Certificate</th>
              <th className="px-4 py-2 w-1/5">Academic Year</th>
              <th className="px-4 py-2 w-1/5">Status</th>
              <th className="px-4 py-2 w-1/5">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.length > 0 ? (
              requests.map((req) => {
                const s = (req.status || '').toUpperCase();
                return (
                  <tr key={req.request_id} className="border-t">
                    <td className="px-4 py-2 text-sm text-gray-800 wrap-break-word">{req.certificate_type}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{req.academic_year || '-'}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles(s)}`}>{s}</span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {s === 'APPROVED' ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {downloadingId === req.request_id ? (
                            <>
                              <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                              </svg>
                              <span className="text-sm text-gray-600">Please wait...</span>
                            </>
                          ) : (
                            <>
                              <button onClick={() => onDownload(req)} className="text-indigo-600 hover:text-indigo-900">Download</button>
                              {downloadErrors[req.request_id] && (
                                <span className="text-sm text-red-600">{downloadErrors[req.request_id]}</span>
                              )}
                            </>
                          )}
                        </div>
                      ) : s === 'REJECTED' ? (
                        <button onClick={() => onOpenRejectModal(req)} className="text-red-600 hover:text-red-800 text-sm">View Details</button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-4 text-center text-sm text-gray-500" colSpan={3}>No requests found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
