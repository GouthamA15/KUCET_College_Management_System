'use client';

import { useState, useEffect, useCallback } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

export default function FacultyActivityBar() {
  const [activeActivity, setActiveActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/clerk/faculty/current-activity');
      const data = await res.json();
      if (res.ok && data.active) {
        setActiveActivity(data);
      } else {
        setActiveActivity(null);
      }
    } catch (e) {
      console.error('Failed to sync current activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    
    // Smart timer for next period transition
    const calculateNextTransition = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hours * 100 + minutes;

      const transitions = [930, 1020, 1110, 1120, 1210, 1300, 1400, 1450, 1540, 1630];
      const nextTransition = transitions.find(t => t > currentTime);

      if (nextTransition) {
        const nextHours = Math.floor(nextTransition / 100);
        const nextMinutes = nextTransition % 100;
        const nextDate = new Date();
        nextDate.setHours(nextHours, nextMinutes, 0, 0);
        
        const delay = nextDate.getTime() - now.getTime();
        return setTimeout(() => {
          fetchActivity();
          // Recursively set next timer
          calculateNextTransition();
        }, delay + 1000); // Add 1s buffer
      }
      return null;
    };

    const timer = calculateNextTransition();
    const interval = setInterval(fetchActivity, 5 * 60 * 1000); // 5-min backup
    
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchActivity]);

  const handleRealtimeUpdate = useCallback((data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      console.log('[ActivityBar] Timetable changed, refreshing...');
      fetchActivity();
    }
  }, [fetchActivity]);

  if (loading || !activeActivity) return <RealtimeListener onUpdate={handleRealtimeUpdate} />;

  const { activity, period } = activeActivity;

  return (
    <>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      <div className="bg-[#0b3578] border-b border-white/10 shadow-2xl relative overflow-hidden animate-in slide-in-from-top duration-500">
        <div className="absolute inset-0 bg-blue-600/20 animate-pulse"></div>
        
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-full border border-white/20">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
               </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em]">Live Session</span>
                 <span className="text-[10px] font-bold text-white/40 uppercase">&bull; Period {period}</span>
              </div>
              <h3 className="text-white font-black tracking-tight leading-none uppercase">
                {activity.subject_name || activity.subject_code}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="text-right border-r border-white/10 pr-6">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-0.5">Location</p>
                <p className="text-white font-black text-sm uppercase">{activity.room_no || 'TBD'}</p>
             </div>
             <div className="text-right border-r border-white/10 pr-6">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-0.5">Department</p>
                <p className="text-white font-black text-sm uppercase">{activity.branch}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-0.5">Class</p>
                <p className="text-white font-black text-sm uppercase">Semester {activity.semester}</p>
             </div>
          </div>
        </div>
      </div>
    </>
  );
}
