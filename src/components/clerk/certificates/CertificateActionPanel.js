"use client";

import { useState } from "react";
import Image from "next/image";

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

  const screenshotSrc = (request?.request_id && Number(request.payment_amount) > 0) 
    ? `/api/student/requests/image/${request.request_id}` 
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-semibold" style={{ backgroundColor: request?.status === 'APPROVED' ? '#ecfdf5' : request?.status === 'REJECTED' ? '#fff1f2' : '#fffbeb', color: request?.status === 'APPROVED' ? '#166534' : request?.status === 'REJECTED' ? '#991b1b' : '#92400e' }}>
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
          <h4 className="font-medium text-gray-800 mb-2">Payment Screenshot</h4>
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
