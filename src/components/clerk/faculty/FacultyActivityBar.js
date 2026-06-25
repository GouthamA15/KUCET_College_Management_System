'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export default function FacultyActivityBar() {
  const [activeActivity, setActiveActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const isUnmountedRef = useRef(false);

  const fetchActivity = useCallback(async () => {
    if (isUnmountedRef.current) return;
    try {
      const res = await fetch('/api/clerk/faculty/current-activity');
      const data = await res.json();
      if (isUnmountedRef.current) return;

      if (res.ok && data.active) {
        setActiveActivity(data);
      } else {
        setActiveActivity(null);
      }
    } catch (_e) {
      console.error('Failed to sync current activity');
    } finally {
      if (!isUnmountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    const id = setTimeout(() => {
      fetchActivity();
    }, 0);
    
    // Check for period transitions every 30 seconds
    const interval = setInterval(() => {
      const now = new Date();
      const time = now.getHours() * 100 + now.getMinutes();
      const transitionTimes = [930, 1020, 1110, 1120, 1210, 1300, 1400, 1450, 1540, 1630];
      
      const isTransitionWindow = transitionTimes.some(t => {
        const diff = time - t;
        return diff >= 0 && diff <= 1; // 1 minute window
      });

      if (isTransitionWindow) {
        fetchActivity();
      }
    }, 30000);

    // Backup: Slow refresh every 10 minutes
    const backupInterval = setInterval(fetchActivity, 10 * 60 * 1000);
    
    return () => {
      isUnmountedRef.current = true;
      clearTimeout(id);
      clearInterval(interval);
      clearInterval(backupInterval);
    };
  }, [fetchActivity]);

  const handleRealtimeUpdate = useCallback((data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      console.info('[ActivityBar] Timetable changed, refreshing...');
      fetchActivity();
    }
  }, [fetchActivity]);

  if (loading || !activeActivity) return <RealtimeListener onUpdate={handleRealtimeUpdate} />;

  const { activity, period } = activeActivity;

  return (
    <>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      <div className="bg-[#0b3578] border-b border-white/10 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5"></div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center justify-center w-8 h-8 bg-white/10 border border-white/20">
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
               </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Active Session</span>
                 <span className="text-[9px] font-medium text-white/50 uppercase border-l border-white/20 pl-2">Period {period}</span>
              </div>
              <h3 className="text-white text-sm font-bold tracking-tight leading-tight uppercase mt-0.5">
                {activity.subject_name || activity.subject_code}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-3 md:flex md:items-center gap-2 md:gap-8 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
             <div className="text-center md:text-right md:border-r md:border-white/10 md:pr-8">
                <p className="text-[8px] font-bold text-blue-200 uppercase tracking-widest mb-0.5 opacity-70">Room</p>
                <p className="text-white font-bold text-[11px] uppercase">{activity.room_no || 'TBD'}</p>
             </div>
             <div className="text-center md:text-right md:border-r md:border-white/10 md:pr-8">
                <p className="text-[8px] font-bold text-blue-200 uppercase tracking-widest mb-0.5 opacity-70">Branch</p>
                <p className="text-white font-bold text-[11px] uppercase">{activity.branch}</p>
             </div>
             <div className="text-center md:text-right">
                <p className="text-[8px] font-bold text-blue-200 uppercase tracking-widest mb-0.5 opacity-70">Class</p>
                <p className="text-white font-bold text-[11px] uppercase">Sem {activity.semester}</p>
             </div>
          </div>
        </div>
      </div>
    </>
  );
}
