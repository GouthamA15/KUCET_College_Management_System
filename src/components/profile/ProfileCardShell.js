'use client';

import React from 'react';

export default function ProfileCardShell({ left, right, compact = false, noGap = false }) {
  return (
    <div className={`w-full overflow-hidden rounded-[24px] border border-[#dfeafc] bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] shadow-[0_20px_48px_rgba(11,53,120,0.12)] ${compact ? 'p-2 sm:p-3 lg:p-4' : 'p-6'}`}>
      <div className={`grid grid-cols-1 ${compact ? 'gap-3 xl:grid-cols-[160px_1fr] xl:gap-9' : `${noGap ? 'gap-4 md:grid-cols-[160px_1fr]' : 'gap-8 md:grid-cols-[280px_1fr]'}`}`}>
        {left}
        <div className="flex flex-col justify-start">{right}</div>
      </div>
    </div>
  );
}
