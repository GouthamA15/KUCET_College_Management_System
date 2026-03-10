'use client';

import { useState, useEffect, useCallback } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export default function StudentActivityBar() {
  const [activeActivity, setActiveActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/student/current-activity');
      const data = await res.json();
      if (res.ok && data.active) {
        setActiveActivity(data);
      } else {
        setActiveActivity(null);
      }
    } catch (e) {
      console.error('Failed to sync current student activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const handleRealtimeUpdate = (data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      fetchActivity();
    }
  };

  if (loading || !activeActivity) return <RealtimeListener onUpdate={handleRealtimeUpdate} />;

  const { activity, period } = activeActivity;

  return (
    <>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      <div className="bg-indigo-950 border-b border-white/5 shadow-2xl relative overflow-hidden animate-in slide-in-from-top duration-500">
        <div className="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>
        
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-white/5 rounded-full border border-white/10">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
               </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Ongoing Lecture</span>
                 <span className="text-[10px] font-bold text-white/30 uppercase">&bull; Period {period}</span>
              </div>
              <h3 className="text-white font-black tracking-tight leading-none uppercase text-sm md:text-base">
                {activity.subject_name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="text-right border-r border-white/10 pr-6">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-0.5">Location</p>
                <p className="text-white font-black text-sm uppercase">{activity.room_no || 'TBD'}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-0.5">Faculty</p>
                <p className="text-white font-black text-xs uppercase truncate max-w-[150px]">{activity.faculty_name || 'Unassigned'}</p>
             </div>
          </div>
        </div>
      </div>
    </>
  );
}
