'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useStaff } from '@/context/StaffContext';

export default function StaffNotificationDropdown({ onOpenChange }) {
  const { 
    pendingProfileRequests, 
    pendingCertificateRequests,
    refreshAllRequests 
  } = useStaff();
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

  const formatIstDate = (value) => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value));
    } catch {
      return '';
    }
  };

  const totalCount = (pendingProfileRequests?.length || 0) + (pendingCertificateRequests?.length || 0);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setNotifOpen(!notifOpen)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {notifOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
            <button 
              onClick={() => refreshAllRequests?.()}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Refresh
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
            {totalCount === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                No pending requests
              </div>
            ) : (
              <>
                {pendingProfileRequests?.map((req) => (
                  <Link 
                    key={`p-${req.id}`} 
                    href="/staff/student-requests"
                    onClick={() => setNotifOpen(false)}
                    className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-slate-800">Profile Update: {req.roll_no || req.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatIstDate(req.created_at)}</p>
                  </Link>
                ))}
                {pendingCertificateRequests?.map((req) => (
                  <Link 
                    key={`c-${req.request_id || req.id}`} 
                    href="/staff/requests"
                    onClick={() => setNotifOpen(false)}
                    className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-slate-800">{req.certificate_type || 'Certificate'}: {req.roll_number || req.student_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatIstDate(req.created_at)}</p>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
