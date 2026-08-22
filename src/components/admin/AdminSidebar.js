'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutByRole } from '@/lib/logout';
import { NAV_MENU_CONFIG } from '@/lib/menu-config';

const icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  manageStaff: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  staffRequests: (
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

const labelToIcon = {
  'DASHBOARD': icons.dashboard,
  'PAYMENTS': icons.payments,
  'MANAGE STAFF': icons.manageStaff,
  'STAFF REQUESTS': icons.staffRequests,
  'INFRASTRUCTURE': icons.infrastructure,
  'AUDIT TRAILS': icons.auditLogs,
  'VERIFICATIONS': icons.verifications,
};

const menuItems = NAV_MENU_CONFIG.superAdmin.map(item => ({
  label: item.label.charAt(0) + item.label.slice(1).toLowerCase(),
  route: item.route,
  icon: labelToIcon[item.label]
}));

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function AdminSidebar({ isMobileOpen, setIsMobileOpen }) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  const handleLogout = async () => {
    await logoutByRole({ role: 'admin' });
  };

  const isExpanded = isHovered;

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

  const DesktopNav = (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`hidden lg:flex fixed left-0 bg-linear-to-b from-[#f8fbff] via-white to-[#eef5ff] flex-col z-60 transition-all duration-300 ease-in-out shadow-sm overflow-hidden rounded-tr-2xl rounded-br-2xl border border-slate-200/70 
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = pathname === item.route || (item.route !== '/admin/dashboard' && pathname.startsWith(item.route));
          
          return (
            <Link
              key={item.label}
              href={item.route}
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

  const MobileNav = (
    <aside
      className={cn(
        'lg:hidden fixed left-0 top-0 z-50 h-full w-72',
        'bg-gradient-to-b from-white via-slate-50/95 to-blue-50/70 backdrop-blur-md border-r border-slate-200/60 shadow-2xl',
        'transform transition-transform duration-300 ease-in-out',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 bg-linear-to-b from-blue-50/30 to-transparent">
          <div className="flex flex-col">
            <span className="text-[#002A5C] font-extrabold text-[13px] tracking-wider uppercase">
              Admin Portal
            </span>
            <span className="text-[9.5px] text-[#002A5C]/50 font-black uppercase tracking-widest mt-0.5">
              Menu Navigation
            </span>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = pathname === item.route || (item.route !== '/admin/dashboard' && pathname.startsWith(item.route));

            const commonRow = cn(
              'group w-full rounded-xl transition-all duration-200',
              'h-11 flex items-center gap-3 px-2.5',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60',
              isActive ? 'bg-blue-50/40 ring-1 ring-[#002A5C]/5' : 'bg-transparent hover:bg-slate-100/40'
            );

            return (
              <Link
                key={item.label}
                href={item.route}
                onClick={() => setIsMobileOpen(false)}
                className={commonRow}
              >
                <div className="shrink-0">
                  <div
                    className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 [&>svg]:w-[18px] [&>svg]:h-[18px]',
                      isActive
                        ? 'bg-[#002A5C] text-white shadow-md shadow-[#002A5C]/15 ring-1 ring-[#002A5C]/10'
                        : 'bg-transparent text-slate-600 group-hover:bg-slate-100 group-hover:text-[#002A5C]'
                    )}
                  >
                    {item.icon}
                  </div>
                </div>
                <div
                  className={cn(
                    'text-[13.5px] font-semibold tracking-tight transition-colors truncate',
                    isActive ? 'text-[#002A5C]' : 'text-slate-700 group-hover:text-[#002A5C]'
                  )}
                >
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Logout (bottom) */}
        <div className="border-t border-slate-100 p-3.5 bg-linear-to-t from-blue-50/30 to-transparent">
          <button
            type="button"
            onClick={async () => {
              setIsMobileOpen(false);
              await logoutByRole({ role: 'admin' });
            }}
            className="w-full flex items-center justify-center px-3 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50/50 font-bold text-[12.5px] tracking-wide rounded-lg transition-all focus:outline-none"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.4 7.2V6.6c0-1 .8-1.8 1.8-1.8h5c1 0 1.8.8 1.8 1.8v10.8c0 1-.8 1.8-1.8 1.8h-5c-1 0-1.8-.8-1.8-1.8v-.6" />
                <path d="M11.6 12H4.8" />
                <path d="M7 9.7 4.8 12 7 14.3" />
              </svg>
              <span>LOGOUT</span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {DesktopNav}
      {MobileNav}
    </>
  );
}
