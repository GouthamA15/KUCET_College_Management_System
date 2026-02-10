'use client';

export default function FeeSummaryView({ feeSummary }) {
  const fs = feeSummary || {};
  return (
    <div>
      <h4 className="font-semibold">Fee Summary</h4>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="text-sm text-gray-500">Total Fee</div>
        <div className="text-sm font-medium">{fs.total_fee ?? '-'}</div>
        <div className="text-sm text-gray-500">Govt Paid</div>
        <div className="text-sm font-medium">{fs.govt_paid ?? 0}</div>
        <div className="text-sm text-gray-500">Student Paid</div>
        <div className="text-sm font-medium">{fs.student_paid ?? 0}</div>
        <div className="text-sm text-gray-500">Pending Fee</div>
        <div className="text-sm font-medium">{fs.pending_fee ?? '-'}</div>
      </div>
    </div>
  );
}
