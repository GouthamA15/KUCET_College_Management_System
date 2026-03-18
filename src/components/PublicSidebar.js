'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const icons = {
  admission: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  studentLogin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  employeeLogin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  adminLogin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  developers: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
};

export default function PublicSidebar({ activePanel, setActivePanel, isMobileOpen, setIsMobileOpen }) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = isHovered || isMobileOpen;

  const handleNavClick = (panel) => {
    if (activePanel === panel) {
      setActivePanel(null);
    } else {
      setActivePanel(panel);
    }
    setIsMobileOpen(false);
  };

  const menuItems = [
    { label: 'Home', route: '/', icon: icons.home },
    { label: 'Admission', route: '/admission', icon: icons.admission },
    { label: 'Student Login', action: 'student', icon: icons.studentLogin },
    { label: 'Employee Login', action: 'clerk', icon: icons.employeeLogin },
    { label: 'Super Admin', action: 'admin', icon: icons.adminLogin },
    { label: 'Developers', route: '/developers', icon: icons.developers },
  ];

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-0 bottom-0 bg-[#0b3578] flex flex-col z-[60] transition-all duration-300 ease-in-out shadow-2xl overflow-hidden 
        ${isMobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'} 
        ${isExpanded ? 'lg:w-60' : 'lg:w-16'}
      `}
    >
      {/* Header Section */}
      <div className="h-20 flex items-center px-4 gap-3 border-b border-white/5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Brand Logo / Icon */}
        <div className="w-10 h-10 rounded-xl bg-white/10 flex-shrink-0 flex items-center justify-center border border-white/10 shadow-inner">
           <span className="text-white font-bold text-xs uppercase tracking-tighter">KU</span>
        </div>

        {/* Brand Text */}
        <div className={`flex flex-col min-w-0 transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
           <span className="text-white font-bold text-sm tracking-tight uppercase">
              KUCET CMS
           </span>
           <span className="text-blue-200/40 text-[9px] font-black uppercase tracking-widest mt-0.5">
              Portal v4.0
           </span>
        </div>
        
        {/* Close Button - Mobile Only */}
        {isMobileOpen && (
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden ml-auto text-blue-100/60 hover:text-white"
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
          // Logic: If a login panel is active, prioritize it. Otherwise, match the current route.
          const isActive = activePanel 
            ? item.action === activePanel 
            : item.route === pathname;
          
          if (item.action) {
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.action)}
                className={`w-full flex items-center rounded-xl transition-all duration-200 group relative overflow-hidden h-12 ${
                  isActive 
                    ? 'bg-white/10 text-white font-semibold' 
                    : 'text-blue-100/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`w-10 flex-shrink-0 flex items-center justify-center ml-0.5 transition-colors ${isActive ? 'text-white' : 'text-blue-100/40 group-hover:text-white'}`}>
                  {item.icon}
                </div>
                <span className={`text-sm whitespace-nowrap ml-3 transition-all duration-300 ${
                  isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                }`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-l-full shadow-[0_0_10px_white]"></div>
                )}
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.route}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center rounded-xl transition-all duration-200 group relative overflow-hidden h-12 ${
                isActive 
                  ? 'bg-white/10 text-white font-semibold' 
                  : 'text-blue-100/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`w-10 flex-shrink-0 flex items-center justify-center ml-0.5 transition-colors ${isActive ? 'text-white' : 'text-blue-100/40 group-hover:text-white'}`}>
                {item.icon}
              </div>
              <span className={`text-sm whitespace-nowrap ml-3 transition-all duration-300 ${
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-l-full shadow-[0_0_10px_white]"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Hint */}
      <div className={`p-4 border-t border-white/5 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <p className="text-[10px] text-blue-200/30 uppercase tracking-widest leading-relaxed">
          Official Institutional Portal for KUCET Faculty & Students.
        </p>
      </div>
    </aside>
  );
}