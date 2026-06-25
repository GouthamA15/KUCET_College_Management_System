'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if the user has already acknowledged the banner
    const acknowledged = localStorage.getItem('kucet_cookie_consent_acknowledged');
    if (!acknowledged) {
      // Delay showing the banner slightly for better UX
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('kucet_cookie_consent_acknowledged', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-8 md:right-auto md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[999] overflow-hidden animate-slideUp">
      <div className="bg-[#0b3578] h-1.5 w-full"></div>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-bold text-slate-800">We use Cookies 🍪</h3>
          <button 
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          This portal uses essential cookies and local storage to securely maintain your session and enable offline functionality. We do not use tracking or marketing cookies.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <Link href="/privacy-policy" className="text-xs text-indigo-600 font-bold hover:underline">
            Read Policy
          </Link>
          <button 
            onClick={handleDismiss}
            className="px-4 py-2 bg-[#0b3578] text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#0a2d66] transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
