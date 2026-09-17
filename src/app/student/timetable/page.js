'use client';

import { useEffect, useCallback, useState } from 'react';
import { CalendarDays, Clock3, Info, RefreshCw, X } from 'lucide-react';
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
    <div className="w-full max-w-7xl mx-auto space-y-5 text-sm pb-10">
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      {bottomSheet}

      <header className="relative overflow-hidden rounded-2xl border border-[#17488e] bg-[#0b3578] px-3.5 py-3.5 text-white shadow-[0_16px_36px_rgba(11,53,120,0.18)] sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(255,255,255,0.2),transparent_28%),linear-gradient(135deg,#0b3578_0%,#174a9c_58%,#2667bd_100%)]" />
        <div className="relative flex flex-col gap-3.5 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CalendarDays size={15} className="text-blue-100 sm:h-[17px] sm:w-[17px]" />
              <h1 className="text-xl font-bold tracking-tight sm:text-3xl">Time table</h1>

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
                  className="rounded-full p-1 text-blue-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none sm:p-1.5"
                  aria-label="Timetable information"
                >
                  <Info size={16} className="shrink-0 sm:h-[18px] sm:w-[18px]" />
                </button>

                {isHovered && !isMobileDevice && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 text-left text-slate-700 shadow-xl animate-slideDown">
                    <h4 className="mb-2 text-sm font-bold text-[#0b2447]">About timetable</h4>
                    <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-600">
                      <li><strong>Periods:</strong> 7 class periods, Monday through Saturday.</li>
                      <li><strong>Breaks:</strong> Short break after Period 2 and lunch after Period 4.</li>
                      <li>The current period is highlighted during live class hours.</li>
                      <li>Your department manages updates automatically.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold sm:gap-2 sm:text-xs">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-2">
              <Clock3 size={14} className="text-blue-100 sm:h-[15px] sm:w-[15px]" />
              <span>{meta?.semester ? `Semester ${meta.semester}` : 'Current semester'}</span>
            </div>
            {subtitle && <span className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 backdrop-blur-sm sm:px-3 sm:py-2">{subtitle.split(' · ')[0]}</span>}
          </div>
        </div>
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
