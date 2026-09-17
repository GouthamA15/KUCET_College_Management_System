'use client';

import React from 'react';

export default function ProfileStatusBar({ title, lines }) {
  const rows = Array.isArray(lines) ? lines.filter(Boolean) : [];

  return (
    <div className="space-y-1.5 sm:space-y-2">
      {title ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#dfeafc] bg-white/80 px-2.5 py-2">
          <div>
            <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-[#0b3578]">Academic profile</div>
            <div className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-black text-slate-900">{title}</div>
          </div>
          <span className="inline-flex items-center rounded-full border border-[#0b3578]/20 bg-[#edf5ff] px-2 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.18em] text-[#0b3578]">Active</span>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid gap-1.5 sm:gap-2 sm:grid-cols-3">
          {rows.map((row, idx) => (
            <div key={idx} className="rounded-xl border border-[#e8f0ff] bg-white/90 px-2 py-1.5 sm:py-2 shadow-[0_8px_18px_rgba(11,53,120,0.04)]">
              <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.16em] text-[#0b3578]/75">{row.label || 'Detail'}</div>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-bold text-slate-800">{row.value ?? '-'}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
