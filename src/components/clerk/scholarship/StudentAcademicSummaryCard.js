'use client';

export default function StudentAcademicSummaryCard({ student }) {
  if (!student) return null;

  const items = [
    { label: 'Course', value: student.course || '-' },
    { label: 'Admission Academic Year', value: student.admission_year || '-' },
    { label: 'Current Academic Year', value: student.current_year || '-' },
    { label: 'Fee Category', value: student.fee_category || '-' },
    { label: 'Fee Reimbursement', value: student.fee_reimbursement || '-' },
  ];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Academic / Scholarship Summary</p>
          <h3 className="text-base font-semibold text-slate-900 mt-1 tracking-tight">Program & eligibility overview</h3>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {items.map((it) => (
          <div key={it.label} className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{it.label}</div>
            <div className="text-sm font-semibold text-slate-700">{it.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
