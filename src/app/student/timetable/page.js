'use client';

import { useEffect, useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import RealtimeListener from '@/components/RealtimeListener';
import UniversalTimetable from '@/components/timetable/UniversalTimetable';

export default function StudentTimetablePage() {
  const [schedule, setSchedule] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm pb-10">
      <RealtimeListener onUpdate={handleRealtimeUpdate} />

      <header className="mb-4">
        <div className="relative flex min-h-9 items-center justify-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#0b3578]">Time table</h1>
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
