'use client';

import React from 'react';
import { useSystemConfig } from '@/context/SystemConfigContext';
import { usePathname } from 'next/navigation';

export default function MaintenanceGuard({ children }) {
  const { config, loading, isMaintenance } = useSystemConfig();
  const pathname = usePathname();

  // 1. Bypass if still loading (prevent flash)
  if (loading) return children;

  // 2. Bypass Maintenance Mode for Admin routes so they can fix it!
  const isAdminRoute = pathname.startsWith('/admin');
  const isApiRoute = pathname.startsWith('/api');
  
  if (isMaintenance && !isAdminRoute && !isApiRoute) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0b3578] flex items-center justify-center p-6 text-center">
        <div className="max-w-2xl w-full bg-white shadow-2xl rounded-sm p-12 border-t-8 border-rose-600 animate-slideUp">
          <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 11-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Institutional Maintenance</h1>
          <p className="text-slate-600 font-medium leading-relaxed mb-8">
            The {config.shortName} College Portal is currently undergoing scheduled infrastructure upgrades to improve system resilience.
          </p>
          
          <div className="bg-slate-50 p-6 rounded-sm border border-slate-200 text-left space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></span>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Public services temporarily restricted.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></span>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Academic records remain secured and encrypted.</p>
            </div>
          </div>
          
          <p className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Registry Command Hub • Est. Availability: ~15 mins
          </p>
        </div>
      </div>
    );
  }

  return children;
}
