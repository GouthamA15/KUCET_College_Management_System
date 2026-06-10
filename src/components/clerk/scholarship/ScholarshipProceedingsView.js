'use client';

export default function ScholarshipProceedingsView({ student, summary, toDmy }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 tracking-tight">Scholarship Proceedings</h4>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Records</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Application No</span>
        <span className="text-[11px] font-semibold text-slate-700">{summary?.application_no || '-'}</span>
      </div>

      {(student?.fee_reimbursement === 'YES' || student?.fee_reimbursement === 'GOV') ? (
        Array.isArray(summary?.scholarship_proceedings) && summary.scholarship_proceedings.length > 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Proceeding</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Date</div>
            </div>
            <div className="divide-y divide-slate-100">
              {summary.scholarship_proceedings.map((p, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 px-3 py-2">
                  <div className="text-[11px] font-semibold text-slate-700 truncate">{p.proceeding_no}</div>
                  <div className="text-[11px] font-semibold text-slate-700 text-right">{p.amount}</div>
                  <div className="text-[11px] font-semibold text-slate-700 text-right">{toDmy?.(p.date) || '-'}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-4">No proceedings recorded</div>
        )
      ) : (
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-4">Scholarship section hidden for non‑scholarship students</div>
      )}
    </section>
  );
}
