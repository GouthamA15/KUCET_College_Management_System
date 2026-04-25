'use client';

import React from 'react';

export default function ProfileCardShell({ left, right }) {
  return (
    <div className="w-full bg-white shadow-xl rounded-lg p-6 overflow-hidden border border-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
        {left}
        <div className="flex flex-col justify-start">{right}</div>
      </div>
    </div>
  );
}
