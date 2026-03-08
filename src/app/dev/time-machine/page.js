"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function TimeMachine() {
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';
  const [mockDate, setMockDate] = useState(() => {
    if (typeof window === 'undefined') return '';
    if (!isTesting) return '';
    const match = document.cookie.match(/dev_mock_date=([^;]+)/);
    return match ? new Date(decodeURIComponent(match[1])).toISOString().split('T')[0] : '';
  });
  const [currentDisplay, setCurrentDisplay] = useState('');
  const [isMounted, setIsMounted] = useState(() => (typeof window !== 'undefined') && isTesting);

  useEffect(() => {
    if (!isTesting) return;
    // mockDate is initialized from cookie; avoid setting state synchronously here
    const updateDisplay = () => {
      const cookieMatch = document.cookie.match(/dev_mock_date=([^;]+)/);
      const d = cookieMatch ? new Date(decodeURIComponent(cookieMatch[1])) : new Date();
      setCurrentDisplay(d.toLocaleString());
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => clearInterval(interval);
  }, [isTesting]);

  if (!isTesting) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-500 mb-4">403 - Forbidden</h1>
          <p className="text-gray-400">Developer tools are disabled in this environment.</p>
          <Link href="/" className="mt-6 inline-block bg-blue-600 px-6 py-2 rounded-lg font-bold">Return Home</Link>
        </div>
      </div>
    );
  }

  const setTime = (dateStr) => {
    if (!dateStr) {
      document.cookie = "dev_mock_date=; path=/; max-age=0";
      toast.success("Time reset to system clock");
      setMockDate('');
    } else {
      const date = new Date(dateStr);
      document.cookie = `dev_mock_date=${encodeURIComponent(date.toISOString())}; path=/; max-age=86400`;
      toast.success(`Time traveled to ${date.toLocaleDateString()}`);
      setMockDate(dateStr);
    }
    window.location.reload(); // Refresh to apply everywhere
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full">
        <h1 className="text-3xl font-extrabold text-blue-400 mb-2 flex items-center gap-2">
          🕒 Time Machine <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter">DEV ONLY</span>
        </h1>
        <p className="text-gray-400 text-sm mb-6 italic">Control the application&apos;s perceived date to test semester transitions.</p>

        <div className="bg-black/40 p-4 rounded-xl mb-6 border border-gray-700">
          <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Application Time</label>
          <div className="text-2xl font-mono text-green-400 tracking-wider leading-none h-8">
            {isMounted ? currentDisplay : 'Loading...'}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Target Date</label>
            <input
              type="date"
              value={mockDate}
              onChange={(e) => setMockDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTime(mockDate)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition active:scale-95">Set Date</button>
            <button onClick={() => setTime('')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 rounded-lg transition active:scale-95">Reset</button>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-tight">Quick Presets</h3>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => setTime('2026-09-15')} className="bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-sm py-2 rounded-md text-left px-4">📅 Travel to Sep 15 (Odd Semester Start)</button>
              <button onClick={() => setTime('2026-03-15')} className="bg-amber-900/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-sm py-2 rounded-md text-left px-4">📅 Travel to Mar 15 (Even Semester Active)</button>
            </div>
          </div>
        </div>
        <p className="mt-8 text-[10px] text-gray-600 text-center">Delete <code className="bg-black/20 px-1 rounded">src/app/time-machine-dev</code> to remove this tool.</p>
      </div>
    </div>
  );
}
