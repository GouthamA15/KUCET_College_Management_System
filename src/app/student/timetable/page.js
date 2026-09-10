'use client';

import { useEffect, useCallback, useState } from 'react';
import { Info, X } from 'lucide-react';
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

      {/* Page header — matches Academics / Fees / Certificates pattern */}
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-800">Timetable</h1>

          {/* Info button: hover popover on desktop, bottom sheet on mobile */}
          <div
            className="relative inline-flex items-center"
            onMouseEnter={() => !isMobileDevice && setIsHovered(true)}
            onMouseLeave={() => !isMobileDevice && setIsHovered(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isMobileDevice) setIsBottomSheetOpen(true);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Timetable information"
            >
              <Info size={20} className="shrink-0" />
            </button>

            {/* Desktop hover popover */}
            {isHovered && !isMobileDevice && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 text-left animate-slideDown">
                <h4 className="text-sm font-bold text-[#0b2447] mb-2">About Timetable</h4>
                <ul className="text-xs text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
                  <li><strong>Periods:</strong> 7 class periods per day, Monday through Saturday.</li>
                  <li><strong>Short Break:</strong> 11:10–11:20 AM between Period 2 and Period 3.</li>
                  <li><strong>Lunch Break:</strong> 01:00–02:00 PM between Period 4 and Period 5.</li>
                  <li>Active period is highlighted during live class hours.</li>
                  <li>Timetable is managed by your department and updates automatically.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          View your weekly class schedule and academic periods.
        </p>
      </header>

      {/* Loading */}
      {loading && (
        <div className="border border-slate-200 bg-white rounded-sm px-6 py-10 flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm font-medium">Syncing schedule…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="border border-red-200 bg-red-50 rounded-sm px-6 py-8 text-center">
          <p className="text-sm font-semibold text-red-700">Failed to load timetable</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
          <button
            onClick={fetchTimetable}
            className="mt-4 px-4 py-1.5 bg-[#0b3578] text-white text-xs font-bold rounded hover:bg-blue-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Timetable */}
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
