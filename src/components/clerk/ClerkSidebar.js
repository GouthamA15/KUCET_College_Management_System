'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@/context/ClerkContext';
import ClerkNotificationDropdown from './ClerkNotificationDropdown';

const icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  departments: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
    </svg>
  ),
  timetable: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  attendance: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  marks: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  materials: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
};

export default function ClerkSidebar({ isMobileOpen, setIsMobileOpen }) {
  const pathname = usePathname();
  const { clerkData } = useClerk();
  const [isHovered, setIsHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/clerk/logout', { method: 'POST' });
    window.location.replace('/');
  };

  const isExpanded = isHovered || isMobileOpen;

  const role = clerkData?.role;
  const isHOD = clerkData?.is_hod;

  const menuConfig = {
    admission: [
      { label: 'Dashboard', route: '/clerk/admission/dashboard', icon: icons.dashboard },
      { label: 'Departments', route: '/clerk/departments', icon: icons.departments },
      { label: 'Academic Calendar', route: '/clerk/academic-calendar', icon: icons.calendar },
      { label: 'Time Table', route: '/clerk/timetable', icon: icons.timetable },
    ],
    scholarship: [
      { label: 'Dashboard', route: '/clerk/scholarship/dashboard', icon: icons.dashboard },
      { label: 'Departments', route: '/clerk/departments', icon: icons.departments },
      { label: 'Time Table', route: '/clerk/timetable', icon: icons.timetable },
    ],
    faculty: [
      { label: 'Dashboard', route: '/clerk/faculty/dashboard', icon: icons.dashboard },
      { label: 'Attendance', route: '/clerk/faculty/attendance', icon: icons.attendance },
      { label: 'Marks', route: '/clerk/faculty/marks', icon: icons.marks },
      { label: 'Time Table', route: '/clerk/faculty/time-table', icon: icons.timetable },
      { label: 'Materials', route: '/clerk/faculty/materials', icon: icons.materials },
      { label: 'Profile', route: '/clerk/faculty/profile', icon: icons.profile },
    ]
  };

  const menuItems = menuConfig[role] || [];

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setSettingsOpen(false);
      }}
      className={`fixed left-0 top-0 bottom-0 bg-[#0b3578] flex flex-col z-[60] transition-all duration-300 ease-in-out shadow-2xl 
        ${isMobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'} 
        ${isExpanded ? 'lg:w-60' : 'lg:w-16'}
        ${isNotifOpen ? '' : 'overflow-hidden'}
      `}
    >
      {/* Personalized Header Section */}
      <div className="h-24 flex items-center px-3 gap-3 border-b border-white/5 relative group">
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Employee Avatar / Initials */}
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 relative border border-white/10 flex items-center justify-center">
           <span className="text-white font-bold text-xs">{clerkData?.name?.charAt(0) || 'E'}</span>
        </div>

        {/* Employee Full Name & ID */}
        <div className={`flex flex-col min-w-0 transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
           <span className="text-white font-bold text-sm truncate leading-tight uppercase tracking-tight">
              {clerkData?.name || 'Employee'}
           </span>
           <span className="text-blue-200/40 text-[9px] font-black uppercase tracking-widest mt-0.5">
              {clerkData?.employee_id || role?.toUpperCase()} {isHOD ? '• HOD' : ''}
           </span>
        </div>

        {/* Notification Hub in Sidebar (Admission & Scholarship Only) */}
        {(role === 'admission' || role === 'scholarship') && (
           <div className={`transition-all duration-300 ${isExpanded ? 'ml-auto' : 'hidden'}`}>
             <ClerkNotificationDropdown onOpenChange={setIsNotifOpen} />
           </div>
        )}
        
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
          const isActive = pathname === item.route || (item.route !== '/clerk' && pathname.startsWith(item.route));
          
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

        {/* Settings Dropdown */}
        <div className="space-y-1">
          <button
            onClick={() => isExpanded && setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center rounded-xl transition-all duration-200 group relative overflow-hidden h-12 text-blue-100/60 hover:bg-white/5 hover:text-white`}
          >
            <div className="w-10 flex-shrink-0 flex items-center justify-center ml-0.5 transition-colors group-hover:text-white">
              {icons.settings}
            </div>
            <span className={`text-sm whitespace-nowrap ml-3 transition-all duration-300 flex-1 text-left ${
              isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}>
              Settings
            </span>
            {isExpanded && (
              <svg className={`w-4 h-4 mr-3 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
          
          {isExpanded && settingsOpen && (
            <div className="ml-10 space-y-1 animate-fadeIn">
              <Link
                href="/clerk/settings/edit-profile"
                onClick={() => setIsMobileOpen(false)}
                className="block px-4 py-2 text-xs text-blue-100/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Edit Profile
              </Link>
              <Link
                href="/clerk/settings/security"
                onClick={() => setIsMobileOpen(false)}
                className="block px-4 py-2 text-xs text-blue-100/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Security & Privacy
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center rounded-xl transition-all duration-200 group relative overflow-hidden h-12 text-red-100/60 hover:bg-red-500/10 hover:text-red-300"
        >
          <div className="w-10 flex-shrink-0 flex items-center justify-center ml-0.5">
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