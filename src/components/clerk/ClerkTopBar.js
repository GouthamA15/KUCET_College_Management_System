'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useClerk } from '@/context/ClerkContext';
import _Image from 'next/image';
import Link from 'next/link';
// import ClerkNotificationDropdown from './ClerkNotificationDropdown';

export default function ClerkTopBar({ onMenuClick }) {
  const { clerkData } = useClerk();
  
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-8 bg-transparent relative">
      {/* Left: Mobile Menu Toggle & Search */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Middle: Notification Hub for Mobile - Commented out per request
      <div className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
        {(clerkData?.role === 'admission' || clerkData?.role === 'scholarship') && (
           <div className="scale-110 sm:scale-125">
             <ClerkNotificationDropdown />
           </div>
        )}
      </div>
      */}

      {/* Right Side: Profile & Role */}
      <div className="flex items-center gap-3 lg:gap-5 flex-1 justify-end">
        {/* Desktop Notification Hub - Commented out per request
        <div className="hidden lg:block border-r border-slate-200 pr-4">
          {(clerkData?.role === 'admission' || clerkData?.role === 'scholarship') && (
            <ClerkNotificationDropdown />
          )}
        </div>
        */}
        
        <div className="flex items-center gap-3 pl-1 lg:pl-4 relative" ref={profileDropdownRef}>
          <div className="text-right max-w-[100px] sm:max-w-none">
            <p className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none truncate">{clerkData?.name || 'Loading...'}</p>
            <p className="text-[8px] sm:text-[10px] text-slate-400 mt-1 uppercase tracking-tighter truncate">
                {clerkData?.role} {clerkData?.is_hod ? '• HOD' : ''}
            </p>
          </div>
          <button 
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="w-8 h-8 lg:w-9 lg:h-9 rounded-full overflow-hidden bg-[#0b3578] relative border border-slate-100 shadow-sm flex-shrink-0 hover:ring-2 hover:ring-[#0b3578]/20 transition-all focus:outline-none flex items-center justify-center text-white font-bold text-xs uppercase"
          >
            {clerkData?.name?.charAt(0) || 'E'}
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 top-full mt-3 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[70] animate-fadeIn">
               <div className="p-2">
                  <Link 
                    href="/clerk/settings/edit-profile" 
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors group"
                  >
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </Link>
                  <Link 
                    href="/clerk/settings/security" 
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors group"
                  >
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-[#0b3578]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Security
                  </Link>
               </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}