'use client';

export default function ScholarshipProceedingsView({ student, summary, toDmy }) {
  return (
    <div>
      <h4 className="font-semibold">Scholarship Proceedings</h4>
      <div className="mt-2">
        <div className="text-sm text-gray-500">Application Number</div>
        <div className="text-sm font-medium">{summary?.application_no || '-'}</div>
      </div>
      {(student?.fee_reimbursement === 'YES') ? (
        Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length > 0 ? (
          <div className="space-y-2 mt-2">
            {summary.scholarship_proceedings.map((p, i) => (
              <div key={i} className="flex items-center justify-between border rounded p-2">
                <div className="text-sm">{p.proceeding_no}</div>
                <div className="text-sm">{p.amount}</div>
                <div className="text-sm">{toDmy?.(p.date)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600 mt-2">No records yet.</div>
        )
      ) : (
        <div className="text-sm text-gray-600 mt-2">Scholarship section hidden for non‑scholarship students.</div>
      )}
    </div>
  );
}
