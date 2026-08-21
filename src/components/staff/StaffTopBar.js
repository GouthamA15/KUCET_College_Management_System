'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStaff } from '@/context/StaffContext';
import _Image from 'next/image';
import Link from 'next/link';

export default function StaffTopBar({ onMenuClick }) {
  const { staffData } = useStaff();
  
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

      {/* Right Side: Profile & Role */}
      <div className="flex items-center gap-3 lg:gap-5 flex-1 justify-end">
        <div className="flex items-center gap-3 pl-1 lg:pl-4 relative" ref={profileDropdownRef}>
          <button 
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
          >
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden border border-slate-200">
              {staffData?.name ? staffData.name[0].toUpperCase() : 'S'}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-sm font-semibold text-slate-800 leading-tight">
                {staffData?.name || 'Staff Member'}
              </span>
              <span className="text-xs text-slate-500 capitalize leading-tight">
                {staffData?.role ? `${staffData.role} Staff` : 'Staff'}
              </span>
            </div>
          </button>

          {/* User Profile Dropdown Menu */}
          {profileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                <p className="text-sm font-semibold text-slate-800">{staffData?.name || 'Staff Member'}</p>
                <p className="text-xs text-slate-500 capitalize">{staffData?.role || 'Staff'}</p>
              </div>

              <Link
                href="/staff/settings/edit-profile"
                onClick={() => setProfileMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Edit Profile
              </Link>

              <Link
                href="/staff/settings/reset-password"
                onClick={() => setProfileMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Reset Password
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
