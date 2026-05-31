import React from 'react';

export function SecurityStatusItem({ label, value, subValue, ok, okLabel = 'Protected' }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-800 truncate max-w-full">{value}</span>
        <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase border shrink-0 ${
          ok ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
        }`}>
          {ok ? okLabel : 'Risk'}
        </span>
      </div>
      <div className="text-[11px] text-gray-500 truncate max-w-full">{subValue}</div>
    </div>
  );
}
