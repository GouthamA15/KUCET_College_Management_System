'use client';

import { useEffect, useCallback, useState } from 'react';
import { Info, RefreshCw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import RealtimeListener from '@/components/RealtimeListener';
import UniversalTimetable from '@/components/timetable/UniversalTimetable';

export default function StudentTimetablePage() {
  const [schedule, setSchedule] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Info button state — matches Academics / Fees / Certificates pattern
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isBottomSheetOpen && isMobileDevice) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isBottomSheetOpen, isMobileDevice]);

  const fetchTimetable = useCallback(async () => {
    try {
      const res = await fetch('/api/student/timetable');
      const data = await res.json();
      if (res.ok) {
        setSchedule(data.data || []);
        setMeta(data.meta);
      } else {
        setError(data.error || 'Failed to load timetable');
      }
    } catch (_e) {
      setError('Network error — could not sync timetable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => fetchTimetable(), 0);
    return () => clearTimeout(id);
  }, [fetchTimetable]);

  const handleRealtimeUpdate = (data) => {
    if (data.type === 'TIMETABLE_CHANGED') fetchTimetable();
  };

  const subtitleParts = [];
  if (meta?.branch) subtitleParts.push(meta.branch);
  if (meta?.semester) subtitleParts.push(`Semester ${meta.semester}`);
  const subtitle = subtitleParts.join(' · ');

  // Bottom sheet (mobile) — rendered via portal to avoid z-index issues
  const bottomSheet = typeof document !== 'undefined' && isBottomSheetOpen ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 backdrop-blur-xs">
      <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBottomSheetOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timetable-help-title"
        className="relative bg-white w-full rounded-t-2xl shadow-2xl p-6 border-t border-slate-200 z-10 animate-slideUp max-h-[90vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h3 id="timetable-help-title" className="text-lg font-bold text-[#0b2447] mb-3">About Timetable</h3>
        <div className="text-sm text-slate-700 space-y-4 mb-6 leading-relaxed">
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Periods:</strong> 7 class periods per day, Monday through Saturday.</li>
            <li><strong>Short Break:</strong> 11:10–11:20 AM between Period 2 and Period 3.</li>
            <li><strong>Lunch Break:</strong> 01:00–02:00 PM between Period 4 and Period 5.</li>
            <li><strong>Active period</strong> is highlighted with a green indicator during live class hours.</li>
            <li>Timetable is managed by your department and updates automatically.</li>
          </ul>
        </div>
        <button
          onClick={() => setIsBottomSheetOpen(false)}
          className="w-full bg-[#0b3578] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#0a2d66] transition-colors focus:outline-none"
        >
          Got It
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-10">
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      {bottomSheet}

      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Time table</h1>
          
          <div 
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) {
                  setIsBottomSheetOpen(true);
                }
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Help Information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">About Timetable</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  This module displays your weekly class schedule. Please note the following:
                </p>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>Periods:</strong> 7 class periods per day, Monday through Saturday.</li>
                  <li><strong>Breaks:</strong> Short break after Period 2 and lunch after Period 4.</li>
                  <li>The current period is highlighted during live class hours.</li>
                  <li>Your department manages updates automatically.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">View your weekly class schedule and active periods.</p>
      </header>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-[#dce8f8] bg-white px-6 py-12 text-center shadow-[0_10px_28px_rgba(11,53,120,0.06)]">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#0b3578]"><RefreshCw size={20} className="animate-spin" /></div>
          <p className="text-sm font-bold text-slate-800">Syncing your schedule</p>
          <p className="mt-1 text-xs text-slate-500">Fetching the latest periods from your department.</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
          <p className="text-sm font-bold text-rose-800">We couldn’t load your timetable</p>
          <p className="mt-1 text-xs text-rose-600">{error}</p>
          <button
            onClick={fetchTimetable}
            className="mt-4 rounded-lg bg-[#0b3578] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#092d68]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <UniversalTimetable
          data={schedule}
          isEditable={false}
          subtitle={subtitle}
        />
      )}
    </div>
  );
}
