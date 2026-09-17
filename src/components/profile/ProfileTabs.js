'use client';

import React from 'react';

export default function ProfileTabs({ activeTab, setActiveTab, personalPanel }) {
  return (
    <div className="mt-0 rounded-2xl border border-[#dfeafc] bg-white/80 p-3 shadow-sm xl:border-slate-200 xl:bg-white xl:p-1.5">
      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 min-w-[180px] rounded-xl px-4 py-3 text-sm font-bold whitespace-nowrap transition-all duration-200 ${
            activeTab === 'personal'
              ? 'bg-[linear-gradient(135deg,#0b3578_0%,#153e8a_100%)] text-white shadow-[0_10px_24px_rgba(11,53,120,0.25)]'
              : 'text-slate-600 hover:text-[#0b3578] hover:bg-white/90'
          }`}
        >
          Personal Information
        </button>
      </div>

      <div className="mt-3 pl-2 sm:pl-3">{activeTab === 'personal' && personalPanel}</div>
    </div>
  );
}
