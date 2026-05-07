'use client';

export default function RecordStatusBadge({ state }) {
  const badgeClass = state === 'COMPLETED'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : state === 'PENDING'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  const dotClass = state === 'COMPLETED'
    ? 'bg-emerald-500'
    : state === 'PENDING'
      ? 'bg-amber-500'
      : 'bg-slate-400';

  return (
    <span className={`inline-flex items-center gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {state}
    </span>
  );
}
