"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';

export default function TimeMachine() {
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';
  
  // Hydration fix: Initialize with empty/null and load from browser in useEffect
  const [mockDate, setMockDate] = useState('');
  const [currentDisplay, setCurrentDisplay] = useState('SYNCING...');

  useEffect(() => {
    if (!isTesting) return;

    let mockDateTimer;

    // Load initial mock date from cookie
    const match = document.cookie.match(/dev_mock_date=([^;]+)/);
    if (match) {
      try {
        const d = new Date(decodeURIComponent(match[1]));
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        mockDateTimer = setTimeout(() => {
          setMockDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        }, 0);
      } catch (e) {
        console.error("Failed to parse mock date cookie", e);
      }
    }

    const updateDisplay = () => {
      const cookieMatch = document.cookie.match(/dev_mock_date=([^;]+)/);
      const d = cookieMatch ? new Date(decodeURIComponent(cookieMatch[1])) : new Date();
      setCurrentDisplay(d.toLocaleString('en-IN', { 
        weekday: 'short', 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      }));
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => {
      clearInterval(interval);
      if (mockDateTimer) clearTimeout(mockDateTimer);
    };
  }, [isTesting]);

  if (!isTesting) {
    return (
      <>
        <HeaderMobileView />
        <Header />
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="text-center">
            <h1 className="text-4xl font-black text-red-500 mb-4">403 - Forbidden</h1>
            <p className="text-gray-400 font-medium">Developer tools are disabled in this environment.</p>
            <Link href="/" className="mt-6 inline-block bg-blue-600 px-4 sm:px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs">Return Home</Link>
          </div>
        </div>
      </>
    );
  }

  const setTime = (dateTimeStr) => {
    if (!dateTimeStr) {
      document.cookie = "dev_mock_date=; path=/; max-age=0";
      toast.success("Time reset to system clock");
      setMockDate('');
    } else {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) {
        toast.error("Invalid date selected");
        return;
      }
      document.cookie = `dev_mock_date=${encodeURIComponent(date.toISOString())}; path=/; max-age=86400`;
      toast.success(`Time traveled to ${date.toLocaleString()}`);
      setMockDate(dateTimeStr);
    }
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <>
    <HeaderMobileView />
    <Header />
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="bg-[#1a1a1a] p-4 sm:p-10 rounded-[2.5rem] shadow-2xl border border-white/5 max-w-md w-full relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 blur-[100px] rounded-full"></div>
        
        <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3 relative z-10">
          🕒 Time Machine 
          <span className="text-[10px] bg-red-600/20 text-red-500 border border-red-500/30 px-2 py-1 rounded-full uppercase tracking-tighter font-black">DEV ONLY</span>
        </h1>
        <p className="text-gray-500 text-xs mb-8 font-medium leading-relaxed">Precision temporal control. Adjust hours and minutes to test live lecture detection and period transitions.</p>

        <div className="bg-white/5 p-6 rounded-3xl mb-8 border border-white/5 backdrop-blur-md">
          <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Application Perceived Time</label>
          <div className="text-2xl font-black text-white tracking-tight leading-none tabular-nums">
            {currentDisplay}
          </div>
        </div>

        <div className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Target Date & Time</label>
            <input
              type="datetime-local"
              value={mockDate}
              onChange={(e) => setMockDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 ring-blue-500 outline-none font-bold transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setTime(mockDate)} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-blue-900/20"
            >
              Set Moment
            </button>
            <button 
              onClick={() => setTime('')} 
              className="bg-white/5 hover:bg-white/10 text-gray-400 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl transition-all active:scale-95 border border-white/10"
            >
              Reset Clock
            </button>
          </div>

          <div className="pt-6 border-t border-white/5">
            <h3 className="text-[10px] font-black text-gray-600 mb-4 uppercase tracking-widest">Temporal Presets</h3>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => setTime('2026-03-10T09:30')} className="group flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-2xl transition-all text-left">
                <div>
                   <div className="text-xs font-black text-white uppercase tracking-tight">Period 1 Start</div>
                   <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Mar 10, 09:30 AM</div>
                </div>
                <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</div>
              </button>
              
              <button onClick={() => setTime('2026-03-10T11:15')} className="group flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-2xl transition-all text-left">
                <div>
                   <div className="text-xs font-black text-white uppercase tracking-tight">Mid-Morning Break</div>
                   <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Mar 10, 11:15 AM</div>
                </div>
                <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</div>
              </button>

              <button onClick={() => setTime('2026-03-10T13:30')} className="group flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-2xl transition-all text-left">
                <div>
                   <div className="text-xs font-black text-white uppercase tracking-tight">Lunch Break</div>
                   <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Mar 10, 01:30 PM</div>
                </div>
                <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</div>
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-10 text-center">
           <Link href="/clerk/faculty/dashboard" className="text-[10px] font-black text-blue-500/60 hover:text-blue-500 uppercase tracking-widest transition-colors">&larr; Back to Faculty Console</Link>
        </div>
      </div>
    </div>
    </>
  );
}
