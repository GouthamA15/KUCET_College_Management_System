'use client';

import { useState, useEffect, useCallback } from 'react';
import RealtimeListener from '@/components/RealtimeListener';
import UniversalTimetable from '@/components/timetable/UniversalTimetable';

/**
 * PersonalSchedule — pure timetable data + render component.
 * Does NOT include a page heading. The page heading lives in the
 * consuming page (time-table/page.js). This component is also
 * embedded in the faculty dashboard as a widget.
 */
export default function PersonalSchedule() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMySchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/faculty/my-timetable');
      const data = await res.json();
      if (res.ok) {
        setSchedule(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch schedule');
      }
    } catch (_e) {
      setError('Network error — could not sync your schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => fetchMySchedule(), 0);
    return () => clearTimeout(id);
  }, [fetchMySchedule]);

  const handleRealtimeUpdate = (data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      console.info('[FacultySchedule] Server broadcast received, syncing…');
      fetchMySchedule();
    }
  };

  if (loading) return (
    <div className="border border-slate-200 bg-white px-6 py-10 flex items-center gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-[#0b3578] border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <span className="text-sm font-medium">Synchronising teaching schedule…</span>
    </div>
  );

  if (error) return (
    <div className="border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="text-sm font-semibold text-red-700">Failed to load schedule</p>
      <p className="text-xs text-red-500 mt-1">{error}</p>
      <button
        onClick={fetchMySchedule}
        className="mt-4 px-4 py-1.5 bg-[#0b3578] text-white text-xs font-bold rounded hover:bg-blue-900 transition-colors"
      >
        Retry
      </button>
    </div>
  );

  return (
    <>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      <UniversalTimetable
        data={schedule}
        isEditable={false}
        subtitle={schedule.length > 0 ? `${schedule.length} periods assigned this semester` : ''}
      />
    </>
  );
}
