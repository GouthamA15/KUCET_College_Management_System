'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useStudent } from '@/context/StudentContext';
import NotificationDropdown from '@/components/NotificationDropdown';

const menuItems = [
  {
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    route: '/student',
  },
  {
    label: 'Profile',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    route: '/student/profile',
  },
  {
    label: 'Academics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    route: '/student/academics',
  },
  {
    label: 'Finances',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    route: '/student/finances',
  },
  {
    label: 'Timetable',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
      </svg>
    ),
    route: '/student/timetable',
  },
  {
    label: 'Requests',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    route: '#',
    hasDropdown: true,
    subItems: [
      { label: 'Certificates', route: '/student/requests/certificates' },
      { label: 'ID Card Reissue', route: '/student/requests/id-card' },
      { label: 'Modify Records', route: '/student/settings/edit-profile' },
      { label: 'Update History', route: '/student/requests/profile-updates' },
    ]
  },
  {
    label: 'Security',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    route: '/student/settings/security',
  },
];

export default function StudentSidebar({ isMobileOpen, setIsMobileOpen }) {
  const pathname = usePathname();
  const { studentData } = useStudent();
  const student = studentData?.student;
  const [isHovered, setIsHovered] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/student/logout', { method: 'POST' });
    localStorage.removeItem('logged_in_student');
    sessionStorage.clear();
    window.location.replace('/');
  };

  const isExpanded = isHovered || isMobileOpen;

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setRequestsOpen(false);
      }}
      className={`fixed left-0 top-0 bottom-0 bg-[#0b3578] flex flex-col z-[60] transition-all duration-300 ease-in-out shadow-2xl pt-[env(safe-area-inset-top)]
        ${isMobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'} 
        ${isExpanded ? 'lg:w-60' : 'lg:w-16'}
        ${isNotifOpen ? '' : 'overflow-hidden'}
      `}
    >
      {/* Personalized Header Section */}
      <div className="h-24 flex items-center px-3 gap-3 border-b border-white/5 relative group">
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Student Avatar / PFP */}
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 relative border border-white/10 flex items-center justify-center">
           {student?.pfp ? (
             <Image 
               src={student.pfp} 
               alt="Profile" 
               fill 
               className="object-cover"
               unoptimized
             />
           ) : (
             <span className="text-white font-bold text-xs">{student?.name?.charAt(0) || 'S'}</span>
           )}
        </div>

        {/* Student Name & Roll No */}
        <div className={`flex flex-col min-w-0 transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
           <span className="text-white font-bold text-sm truncate leading-tight uppercase tracking-tight">
              {student?.name || 'Student'}
           </span>
           <span className="text-blue-200/40 text-[9px] font-black uppercase tracking-widest mt-0.5">
              {student?.roll_no || '---'}
           </span>
        </div>

        {/* Notification Bell in Sidebar */}
        <div className={`transition-all duration-300 ${isExpanded ? 'ml-auto' : 'hidden'}`}>
          <NotificationDropdown onOpenChange={setIsNotifOpen} />
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
          const isActive = pathname === item.route || (item.route !== '/student' && item.route !== '#' && pathname.startsWith(item.route));
          
          if (item.hasDropdown) {
            const isAnySubActive = item.subItems.some(sub => pathname === sub.route);
            return (
              <div key={item.label} className="space-y-1">
                <button
                  onClick={() => isExpanded && setRequestsOpen(!requestsOpen)}
                  className={`w-full flex items-center rounded-xl transition-all duration-200 group relative overflow-hidden h-12 ${
                    isAnySubActive 
                      ? 'bg-white/10 text-white font-semibold' 
                      : 'text-blue-100/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="w-10 flex-shrink-0 flex items-center justify-center ml-0.5">
                    <span className={`transition-colors ${isAnySubActive ? 'text-white' : 'text-blue-100/40 group-hover:text-white'}`}>
                      {item.icon}
                    </span>
                  </div>
                  <span className={`text-sm whitespace-nowrap ml-3 transition-all duration-300 flex-1 text-left ${
                    isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                  }`}>
                    {item.label}
                  </span>
                  {isExpanded && (
                    <svg className={`w-4 h-4 mr-3 transition-transform ${requestsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                
                {isExpanded && requestsOpen && (
                  <div className="ml-10 space-y-1 animate-fadeIn">
                    {item.subItems.map((sub) => (
                      <Link
                        key={sub.label}
                        href={sub.route}
                        onClick={() => setIsMobileOpen(false)}
                        className={`block px-4 py-2 text-xs rounded-lg transition-all ${
                          pathname === sub.route 
                            ? 'text-white font-bold bg-white/5' 
                            : 'text-blue-100/40 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
              <div className="w-10 flex-shrink-0 flex items-center justify-center ml-0.5">
                <span className={`transition-colors ${isActive ? 'text-white' : 'text-blue-100/40 group-hover:text-white'}`}>
                  {item.icon}
                </span>
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