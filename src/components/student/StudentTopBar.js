'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStudent } from '@/context/StudentContext';
import useProfileActivity from '@/hooks/student/useProfileActivity';
import _Image from 'next/image';
import Link from 'next/link';
import { useAssets } from '@/context/AssetContext';
import { usePathname, useRouter } from 'next/navigation';
import { _logoutByRole } from '@/lib/logout';

export default function StudentTopBar({ title: _title, subtitle: _subtitle, breadcrumb: _breadcrumb, onMenuClick: _onMenuClick }) {
  const { studentData } = useStudent();
  const _student = studentData?.student;
  const { _getAsset } = useAssets();
  const _router = useRouter();
  const _pathname = usePathname();
  
  const activity = useProfileActivity();
  const { latestRequest, dismissCount, dismiss } = activity;
  const isProd = typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true;
  
  // Local state to hide notification immediately on click
  const [localVisible, setLocalVisible] = useState(true);
  const showRequestNotif = !!latestRequest && localVisible && !(latestRequest && dismissCount >= 4 && isProd);

  const [notifOpen, setNotifOpen] = useState(false);
  const desktopDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (desktopDropdownRef.current && desktopDropdownRef.current.contains(event.target)) return;
      setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifications = [];
  if (showRequestNotif) {
    const status = (latestRequest?.status || '').toUpperCase();
    const type = latestRequest?.certificate_type || latestRequest?.type || 'Certificate';
    notifications.push({
      id: latestRequest.request_id || latestRequest.id,
      title: `${type} Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
      desc: status === 'APPROVED' ? 'Your request has been processed and is ready.' : 
            status === 'REJECTED' ? 'Your request was declined.' : 
            'Your request is currently under review.',
      time: 'Update',
      link: `/student/requests/certificates?request_id=${latestRequest.request_id || ''}&scroll=history`,
      type: status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'info'
    });
  }

  const hasUnread = notifications.length > 0;

  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalVisible(false); // Hide immediately in UI
    if (typeof dismiss === 'function') dismiss(); // Persistence logic
  };

  return (
    <div className="hidden lg:flex lg:h-16 lg:items-center lg:justify-end lg:gap-5 px-8 absolute top-4 right-4 z-40">
      {/* Desktop Bell - Hidden on Mobile */}
        <div className="relative" ref={desktopDropdownRef}>
          <button 
            onClick={() => setNotifOpen(!notifOpen)}
            className={`p-2 transition-colors rounded-lg relative ${notifOpen ? 'text-[#0b3578] bg-blue-50' : 'text-slate-400 hover:text-[#0b3578] hover:bg-slate-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {hasUnread && (
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {/* Desktop Dropdown remains unchanged for desktop layout consistency */}
          {notifOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[70] animate-fadeIn">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inbox</span>
                <span className="text-[9px] font-bold text-[#0b3578] bg-blue-50 px-2 py-0.5 rounded-full">{notifications.length} New</span>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className="block p-5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 relative group"
                    >
                      <div className="flex gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                          n.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
                          n.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-[#0b3578]'
                        }`}>
                          {n.type === 'success' ? '✓' : n.type === 'error' ? '!' : 'i'}
                        </div>
                        <div className="flex-1 pr-4 text-left">
                          <h4 className="text-sm font-bold text-slate-800">{n.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{n.desc}</p>
                          <div className="mt-2">
                            <Link 
                              href={n.link} 
                              onClick={() => setNotifOpen(false)}
                              className="text-[10px] font-bold text-[#0b3578] uppercase tracking-wider hover:underline"
                            >
                              View details →
                            </Link>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors p-1"
                        title="Dismiss"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <div className="text-3xl mb-3 opacity-20">📭</div>
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No new notifications</p>
                  </div>
                )}
              </div>
              
              <Link 
                href="/student/settings/security" 
                onClick={() => setNotifOpen(false)}
                className="block py-3 text-center bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-colors"
              >
                Notification Settings
              </Link>
            </div>
          )}
        </div>
      </div>
  );
}
