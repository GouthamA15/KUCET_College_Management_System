"use client";

import { useState } from "react";
import Image from "next/image";
import { getStatusStyles } from "@/lib/ui-utils";

export default function CertificateActionPanel({ request }) {
  const [imageLoading, setImageLoading] = useState(true);

  const toDmy = (val) => {
    if (!val) return "—";
    try {
      const s = String(val);
      const datePart = s.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split("-");
        return `${d}-${m}-${y}`;
      }
      const ddmmyyyy = s.split("-");
      if (ddmmyyyy.length === 3 && ddmmyyyy[0].length === 2 && ddmmyyyy[1].length === 2 && ddmmyyyy[2].length === 4) {
        return s; // already DD-MM-YYYY
      }
      return s;
    } catch {
      return String(val);
    }
  };

  const currency = (amt) => {
    if (amt === null || amt === undefined) return "—";
    const n = Number(amt);
    if (Number.isNaN(n)) return "—";
    return `₹${n}`;
  };

  const isNoObjection = request?.certificate_type === 'No Objection Certificate';
  const screenshotSrc = (request?.request_id && !isNoObjection) 
    ? `/api/student/requests/image/${request.request_id}?t=${request.updated_at ? new Date(request.updated_at).getTime() : (request.created_at ? new Date(request.created_at).getTime() : 0)}` 
    : null;

  return (
    <section className="bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="text-sm">
          {/* Student Details */}
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Student Details</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Name</div>
                <div className="font-semibold text-gray-800">{request?.student_name ?? '—'}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Roll No</div>
                <div className="font-semibold text-gray-800">{request?.roll_number ?? '—'}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Academic Year</div>
                <div className="font-semibold text-gray-800">{request?.academic_year ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* INTEGRITY GUARD WARNING */}
          {request?.is_flagged && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-sm animate-pulse">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Integrity Guard: Duplicate Proof Warning</span>
              </div>
              <p className="text-[11px] text-rose-700 font-medium leading-relaxed">
                This request has been flagged for potentially recycled payment evidence. 
                {request.flag_details?.type === 'TRANSACTION_ID_CONFLICT' && (
                  <span className="block mt-1 font-bold">CONFLICT: Transaction ID previously used by {request.flag_details.conflict_roll_no} (Req #{request.flag_details.conflict_request_id}).</span>
                )}
                {request.flag_details?.hash_conflict && (
                  <span className="block mt-1 font-bold">CONFLICT: Screenshot data is identical to a submission by {request.flag_details.conflict_roll_no}.</span>
                )}
              </p>
            </div>
          )}

          {/* Request Details */}
          <div className="mb-3 pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Request Details</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Certificate Type</div>
                <div className="font-semibold text-gray-800">{request?.certificate_type ?? '—'}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Requested On</div>
                <div className="font-semibold text-gray-800">{toDmy(request?.created_at)}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Completed On</div>
                <div className="font-semibold text-gray-800">{toDmy(request?.completed_at)}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Status</div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-semibold border ${getStatusStyles(request?.status)}`}>
                    {request?.status ?? '—'}
                  </span>
                </div>
              </div>
              {request?.status && request?.status !== 'PENDING' ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-36 text-sm text-gray-500">Completed On</div>
                    <div className="font-semibold text-gray-800">{toDmy(request?.completed_at)}</div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-36 text-sm text-gray-500">Action By</div>
                    <div className="font-semibold text-gray-800">{request?.action_by_clerk_name ?? request?.action_by_role ?? request?.action_by_clerk_id ?? '—'}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Payment Details */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Payment Details</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Amount</div>
                <div className="font-semibold text-gray-800">{currency(request?.payment_amount)}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Transaction ID</div>
                <div className="font-semibold text-gray-800">{request?.transaction_id ?? '—'}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-36 text-sm text-gray-500">Purpose</div>
                <div className="font-semibold text-gray-800">{request?.purpose ?? '—'}</div>
              </div>
              {request?.reject_reason ? (
                <div className="flex items-start gap-3">
                  <div className="w-36 text-sm text-gray-500">Reject Reason</div>
                  <div className="font-semibold text-gray-800">{request.reject_reason}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800">Payment Screenshot</h4>
            {screenshotSrc && (
              <a 
                href={screenshotSrc} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>View Full Image</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
          <div className="flex-1 min-h-[180px] w-full rounded-md border bg-gray-50 grid place-items-center relative overflow-hidden">
            {screenshotSrc ? (
              <>
                {imageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 space-y-1">
                        <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                        <span className="text-xs text-gray-500 font-medium">Image is loading...</span>
                    </div>
                )}
                <Image 
                    src={screenshotSrc} 
                    alt="Payment Screenshot" 
                    width={500} 
                    height={500} 
                    unoptimized
                    className={`max-w-full max-h-[48vh] object-contain rounded-md transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setImageLoading(false)}
                />
              </>
            ) : (
              <span className="text-sm text-gray-400">No screenshot provided.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
