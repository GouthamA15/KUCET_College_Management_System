'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutByRole } from '@/lib/logout';

const icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  manageClerks: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  createClerk: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  auditLogs: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  verifications: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  ),
  infrastructure: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  payments: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 8h6m-6 4h6m-6 4h6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
};

const menuItems = [
  { label: 'Dashboard', route: '/admin/dashboard', icon: icons.dashboard },
  { label: 'Payments', route: '/admin/payments', icon: icons.payments },
  { label: 'Manage Clerks', route: '/admin/manage-clerks', icon: icons.manageClerks },
  { label: 'Create Clerk', route: '/admin/create-clerk', icon: icons.createClerk },
  { label: 'Infrastructure', route: '/admin/infrastructure', icon: icons.infrastructure },
  { label: 'Audit Trails', route: '/admin/audit-logs', icon: icons.auditLogs },
  { label: 'Verifications', route: '/admin/verifications', icon: icons.verifications },
];

export default function AdminSidebar({ isMobileOpen, setIsMobileOpen }) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  const handleLogout = async () => {
    await logoutByRole({ role: 'admin' });
  };

  const isExpanded = isHovered || isMobileOpen;

  const DESKTOP_COLLAPSED_W = 64; 
  const DESKTOP_EXPANDED_W = 240; 

  // Publish desktop sidebar width to the app shell
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const width = isExpanded ? `${DESKTOP_EXPANDED_W}px` : `${DESKTOP_COLLAPSED_W}px`;
    root.style.setProperty('--desktop-sidebar-offset', width);
    return () => {
      root.style.removeProperty('--desktop-sidebar-offset');
    };
  }, [isExpanded]);

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 bg-linear-to-b from-[#f8fbff] via-white to-[#eef5ff] flex flex-col z-60 transition-all duration-300 ease-in-out shadow-sm overflow-hidden rounded-tr-2xl rounded-br-2xl border border-slate-200/70 
        ${isMobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'} 
        ${isExpanded ? 'lg:w-[240px]' : 'lg:w-16'}
      `}
      style={{
        top: 'calc(var(--site-header-height, 72px) + 12px)',
        maxHeight: 'calc(100vh - var(--site-header-height, 72px) - 24px)',
      }}
    >
      {/* Header Section */}
      <div className="h-20 flex items-center px-4 gap-3 border-b border-slate-200/70 relative overflow-hidden group">
        <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Admin Avatar / Brand */}
        <div className="w-10 h-10 rounded-xl bg-blue-600/10 shrink-0 flex items-center justify-center border border-blue-200/60 shadow-inner">
           <span className="text-blue-900 font-bold text-xs">A</span>
        </div>

        {/* Brand Text */}
        <div className={`flex flex-col min-w-0 transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
            <span className="text-slate-900 font-bold text-sm tracking-tight">
              ADMIN PANEL
           </span>
            <span className="text-blue-800/50 text-[9px] font-black uppercase tracking-widest mt-0.5">
              CENTRAL CONTROL
           </span>
        </div>
        
        {/* Close Button - Mobile Only */}
        {isMobileOpen && (
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden ml-auto text-slate-500 hover:text-slate-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = pathname === item.route || (item.route !== '/admin/dashboard' && pathname.startsWith(item.route));
          
          return (
            <Link
              key={item.label}
              href={item.route}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center rounded-xl transition-all duration-200 group relative overflow-hidden h-12 ${
                isActive 
                  ? 'bg-white/70 text-slate-900 font-semibold' 
                  : 'text-slate-600 hover:bg-white/45 hover:text-slate-900'
              }`}
            >
              <div className={`w-10 shrink-0 flex items-center justify-center ml-0.5 transition-colors ${isActive ? 'text-blue-900' : 'text-slate-500 group-hover:text-blue-900'}`}>
                {item.icon}
              </div>
              <span className={`text-sm whitespace-nowrap ml-3 transition-all duration-300 ${
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600/45 rounded-l-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-slate-200/70">
        <button
          onClick={handleLogout}
          className="w-full flex items-center rounded-xl transition-all duration-200 group relative overflow-hidden h-12 text-red-700/80 hover:bg-red-50 hover:text-red-700"
        >
          <div className="w-10 shrink-0 flex items-center justify-center ml-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <span className={`text-sm font-medium whitespace-nowrap ml-3 transition-all duration-300 ${
            isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
          }`}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
