'use client';

export default function FeeSummaryView({ feeSummary }) {
  const fs = feeSummary || {};
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 tracking-tight">Fee Summary</h4>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Fee</div>
        <div className="text-[11px] font-semibold text-slate-700 text-right">{fs.total_fee ?? '-'}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Govt Paid</div>
        <div className="text-[11px] font-semibold text-slate-700 text-right">{fs.govt_paid ?? 0}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Paid</div>
        <div className="text-[11px] font-semibold text-slate-700 text-right">{fs.student_paid ?? 0}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Fee</div>
        <div className="text-[11px] font-semibold text-slate-700 text-right">{fs.pending_fee ?? '-'}</div>
      </div>
    </section>
  );
}
