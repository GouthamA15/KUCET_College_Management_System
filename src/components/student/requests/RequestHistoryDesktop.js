"use client";

function statusStyles(status) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED') return 'bg-[#e6f7ee] text-[#15803d]';
  if (s === 'PENDING') return 'bg-[#fff7e6] text-[#b45309]';
  if (s === 'REJECTED') return 'bg-[#fee2e2] text-[#b91c1c]';
  return 'bg-gray-100 text-gray-800';
}

export default function RequestHistoryDesktop({
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
    <div className="bg-white p-6 rounded-[12px] shadow-sm max-w-[1100px] mx-auto">
      <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-3">Request History</h2>
      <div className="max-h-130 overflow-y-auto overflow-x-hidden min-h-32">
        {showLoading ? (
          <div className="flex items-center justify-center h-32">
            <svg className="animate-spin h-6 w-6 text-indigo-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <div className="text-sm text-gray-600">Loading Request History...</div>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-32 text-gray-500">No Request History Is Found</div>
        ) : (
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-[#f3f4f6] text-left text-[13px] font-semibold text-gray-600 uppercase tracking-[0.4px]">
                <th className="px-3 py-4 w-2/5">Certificate</th>
                <th className="px-3 py-4 w-1/5">Academic Year</th>
                <th className="px-3 py-4 w-1/5 text-center">Status</th>
                <th className="px-3 py-4 w-1/5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const s = (req.status || '').toUpperCase();
                return (
                  <tr key={req.request_id} className="border-b hover:bg-[#f9fafb] transition-colors duration-200 ease-in-out min-h-[60px]">
                    <td className="px-3 py-4 text-sm text-gray-800 align-middle">{req.certificate_type}</td>
                    <td className="px-3 py-4 text-sm text-gray-700 align-middle">{req.academic_year || '-'}</td>
                    <td className="px-3 py-4 text-sm text-center align-middle">
                      <span className={`inline-flex items-center justify-center ${statusStyles(s)} font-semibold rounded-full`} style={{ padding: '6px 14px' }}>{s}</span>
                    </td>
                    <td className="px-3 py-4 text-sm text-center align-middle">
                      {s === 'APPROVED' ? (
                        <div className="flex items-center justify-center">
                          {downloadingId === req.request_id ? (
                            <>
                              <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                              </svg>
                              <span className="text-sm text-gray-600 ml-2">Please wait...</span>
                            </>
                          ) : (
                            <>
                              <button onClick={() => onDownload(req)} className="inline-flex items-center px-3 py-1.5 rounded-md border border-[#3258a8] text-[#3258a8] font-semibold hover:bg-[#274f8f] hover:text-white transition">Download</button>
                              {downloadErrors[req.request_id] && (
                                <div className="text-sm text-red-600 mt-2">{downloadErrors[req.request_id]}</div>
                              )}
                            </>
                          )}
                        </div>
                      ) : s === 'REJECTED' ? (
                        <button onClick={() => onOpenRejectModal(req)} className="text-red-600 hover:text-red-800 text-sm font-semibold">View Details</button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
