"use client";
import { _useEffect, _useState } from 'react';
import { getStatusStyles } from '@/lib/ui-utils';
import { formatCertificateName } from '@/lib/certificate-utils';

export default function RequestHistoryDesktop({
  requests,
  downloadingId,
  downloadErrors,
  onDownload,
  onOpenRejectModal,
  isLoadingRequests
}) {
  const showLoading = !!isLoadingRequests;
  const requestList = Array.isArray(requests) ? requests : [];
  const hasData = requestList.length > 0;

  return (
    <div className="w-full">
      <div className="max-h-130 overflow-y-auto overflow-x-hidden">
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
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gray-200 text-left text-[13px] font-semibold text-gray-700 uppercase tracking-[0.6px] border-b-2 border-gray-300">
                <th className="px-3 py-2 w-2/5">Certificate</th>
                <th className="px-3 py-2 w-1/5">Academic Year</th>
                <th className="px-3 py-2 w-1/5 text-center">Status</th>
                <th className="px-3 py-2 w-1/5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {requestList.map((req, idx) => {
                const s = (req.status || '').toUpperCase();
                return (
                  <tr key={req.request_id ?? `req-${idx}-${req.certificate_type}-${req.academic_year}` } className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-3 py-2 text-sm text-gray-800 align-middle">{formatCertificateName(req.certificate_type, req.purpose)}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 align-middle">{req.academic_year || '-'}</td>
                    <td className="px-3 py-2 text-sm text-center align-middle">
                      <span className={`inline-flex items-center justify-center ${getStatusStyles(s)} text-sm font-medium rounded-sm px-2 py-1`}>
                        {s}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-center align-middle">
                      {s === 'APPROVED' ? (
                        <div className="flex items-center justify-center">
                          {downloadingId === req.request_id ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-[#1f3a93]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                              </svg>
                              <span className="text-sm text-gray-600 ml-2">Please wait...</span>
                            </>
                          ) : (
                            <>
                              <button onClick={() => onDownload(req)} className="inline-flex items-center px-2 py-1 rounded-sm border border-[#1f3a93] text-[#1f3a93] text-sm font-medium hover:bg-[#123164] hover:text-white transition-colors">Download</button>
                              {downloadErrors[req.request_id] && (
                                <div className="text-sm text-red-600 mt-2">{downloadErrors[req.request_id]}</div>
                              )}
                            </>
                          )}
                        </div>
                      ) : s === 'REJECTED' ? (
                        <button onClick={() => onOpenRejectModal(req)} className="text-red-700 hover:text-red-900 text-sm font-medium">View Details</button>
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
