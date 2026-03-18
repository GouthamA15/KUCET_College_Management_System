'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useClerk } from '@/context/ClerkContext';

export default function ClerkNotificationDropdown({ onOpenChange }) {
  const { 
    pendingProfileRequests, 
    pendingCertificateRequests,
    refreshAllRequests, 
    clerkData 
  } = useClerk();
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    onOpenChange?.(notifOpen);
  }, [notifOpen, onOpenChange]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifications = [];

  // Add profile requests
  (pendingProfileRequests || []).forEach(req => {
    notifications.push({
      id: `profile-${req.request_id}`,
      title: 'Profile Update Request',
      desc: `${req.name} (${req.roll_no}) requested a profile update.`,
      time: new Date(req.created_at).toLocaleDateString(),
      link: '/clerk/admission/student-requests',
      type: 'info'
    });
  });

  // Add certificate requests
  (pendingCertificateRequests || []).forEach(req => {
    notifications.push({
      id: `cert-${req.request_id}`,
      title: req.certificate_type || 'Certificate Request',
      desc: `${req.student_name} (${req.roll_number}) requested a ${req.certificate_type}.`,
      time: new Date(req.created_at).toLocaleDateString(),
      link: (clerkData?.role === 'admission' 
        ? '/clerk/admission/dashboard?view=requests' 
        : '/clerk/scholarship/dashboard?view=requests'),
      type: 'info'
    });
  });

  // Sort by time (newest first) - though we don't have full timestamps in the mapped objects yet, 
  // they are roughly sorted by creation in the fetch.

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setNotifOpen(!notifOpen)}
        className={`p-2 transition-colors rounded-xl relative group ${
          notifOpen 
            ? 'text-[#0b3578] bg-blue-50' 
            : 'text-blue-100/60 hover:text-[#0b3578] hover:bg-white/5'
        }`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {notifications.length > 0 && (
          <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {notifOpen && (
        <div className="absolute left-0 lg:left-full lg:ml-4 mt-3 lg:-mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[70] animate-fadeIn">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Tasks</span>
            <span className="text-[9px] font-bold text-[#0b3578] bg-blue-50 px-2 py-0.5 rounded-full">{notifications.length} Requests</span>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div key={n.id} className="block p-5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 relative group">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0b3578] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      {n.title.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-800">{n.title}</h4>
                        <span className="text-[9px] font-medium text-slate-400">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{n.desc}</p>
                      <div className="mt-2">
                        <Link href={n.link} onClick={() => setNotifOpen(false)} className="text-[10px] font-bold text-[#0b3578] uppercase tracking-wider hover:underline">
                          Review Request →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <div className="text-3xl mb-3 opacity-20">✅</div>
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">All caught up!</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => { refreshAllRequests(clerkData?.role); setNotifOpen(false); }}
            className="w-full py-3 text-center bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-colors"
          >
            Refresh List
          </button>
        </div>
      )}
    </div>
  );
}
