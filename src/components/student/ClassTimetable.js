// src/components/student/ClassTimetable.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import RealtimeListener from '@/components/RealtimeListener';

const INSTITUTIONAL_ACTIVITIES = [
  { code: 'SPORTS', name: 'Sports & Athletics' },
  { code: 'MINI_PROJECT', name: 'Mini Projects' },
  { code: 'EXTRA_CURRICULAR', name: 'Extra Curricular Activities' },
  { code: 'SEMINAR', name: 'Seminars / Workshops' },
  { code: 'LIB', name: 'Library Period' }
];

export default function ClassTimetable() {
  const [schedule, setSchedule] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [_isMobile, setIsMobile] = useState(false);
  const [_scrollLeft, setScrollLeft] = useState(0);
  const [_dayColWidth, setDayColWidth] = useState(0);

  const scrollContainerRef = useRef(null);
  const dayHeaderRef = useRef(null);

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
      setError('Network error - could not sync timetable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchTimetable();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchTimetable]);

  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (dayHeaderRef.current) {
      setDayColWidth(dayHeaderRef.current.offsetWidth || 0);
    }
  }, [loading]);

  const _handleScroll = (event) => {
    setScrollLeft(event.target.scrollLeft || 0);
  };

  const handleRealtimeUpdate = (data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      fetchTimetable();
    }
  };

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayShortMap = { 'MON': 'M', 'TUE': 'T', 'WED': 'W', 'THU': 'T', 'FRI': 'F', 'SAT': 'S' };
  const periods = [1, 2, 3, 4, 5, 6, 7];
  const getSlot = (day, p) => schedule.find(s => s.day_of_week === day && s.period_number === p);

  if (loading) return (
    <div className="bg-white border border-slate-300 p-12 text-center shadow-sm">
       <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Requesting Institutional Schedule Data...</p>
    </div>
  );

  if (error) return (
    <div className="bg-white border border-rose-200 p-12 text-center shadow-sm">
       <h3 className="text-lg font-bold text-rose-800 uppercase tracking-tight">System Access Error</h3>
       <p className="text-sm text-slate-600 mt-2">{error}</p>
       <button onClick={fetchTimetable} className="mt-6 px-6 py-2 bg-[#0b3578] text-white font-bold hover:bg-blue-900 transition-all uppercase tracking-widest text-xs">Re-authenticate & Retry</button>
    </div>
  );

  return (
    <>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      
      {/* Unified Institutional Matrix Card */}
      <div className="bg-white border border-slate-300 shadow-md rounded-sm overflow-hidden w-full max-w-full">
        
        {/* Formal Header */}
        <div className="bg-[#0b3578] px-4 md:px-6 py-3 border-b border-blue-900 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base md:text-xl font-bold text-white uppercase tracking-tight">Departmental Class Matrix</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
              <span className="text-blue-300 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                {meta?.branch || 'General'} — Sem {meta?.semester || 'N/A'}
              </span>
            </div>
          </div>
          <div className="bg-blue-900/50 px-3 py-1 border border-blue-700/50 rounded-sm self-start md:self-auto">
             <span className="text-[9px] md:text-[11px] font-bold text-white uppercase tracking-widest">Active Session</span>
          </div>
        </div>

        {/* High-Density Matrix Table Wrapper */}
        <div className="relative w-full overflow-hidden">
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto overflow-y-hidden w-full scrollbar-none"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th 
                    className="sticky left-0 z-30 bg-slate-100 border-r border-slate-300 text-slate-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center w-[35px] md:w-20 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]"
                  >
                    <div className="py-3 px-1">Day</div>
                  </th>
                  {periods.map(p => (
                    <th key={p} className="p-2 md:p-4 border-r border-slate-200 min-w-[95px] md:min-w-[150px]">
                      <div className="text-slate-800 font-bold text-[9px] md:text-[11px] uppercase">P{p}</div>
                      <div className="text-[8px] md:text-[10px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">
                        {p === 1 && '09:30-10:20'}
                        {p === 2 && '10:20-11:10'}
                        {p === 3 && '11:20-12:10'}
                        {p === 4 && '12:10-01:00'}
                        {p === 5 && '02:00-02:50'}
                        {p === 6 && '02:50-03:40'}
                        {p === 7 && '03:40-04:30'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                    <td className="sticky left-0 z-20 bg-white border-r border-slate-300 font-black text-[#0b3578] text-center text-[11px] md:text-sm shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50">
                      <span className="hidden md:inline">{day}</span>
                      <span className="md:hidden">{dayShortMap[day]}</span>
                    </td>
                    {periods.map(p => {
                      const slot = getSlot(day, p);
                      const activity = slot ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code) : null;
                      const isInstitutional = !!activity;
                      
                      return (
                        <td key={`${day}-${p}`} className={`p-2 md:p-4 border-r border-slate-100 align-top h-24 md:h-32 ${slot ? (isInstitutional ? 'bg-amber-50/20' : 'bg-white') : 'bg-slate-50/30'}`}>
                          {slot ? (
                            <div className="flex flex-col gap-1 h-full max-w-[85px] md:max-w-none">
                              <div className={`font-bold text-[9px] md:text-[12px] leading-tight uppercase tracking-tight line-clamp-3 ${isInstitutional ? 'text-amber-800' : 'text-slate-900'}`}>
                                {activity ? activity.name : (slot.display_name || slot.subject_code)}
                              </div>
                              <div className="mt-auto pt-1.5 space-y-0.5">
                                 {slot.faculty_name && (
                                   <div className="text-[7px] md:text-[10px] font-medium text-slate-400 uppercase truncate">
                                     {slot.faculty_name}
                                   </div>
                                 )}
                                 {slot.room_no && (
                                   <div className="text-[7px] md:text-[9px] font-bold text-blue-700 uppercase bg-blue-50/50 px-1 py-0.5 inline-block border border-blue-100/50">
                                     {slot.room_no}
                                   </div>
                                 )}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center opacity-10">
                              <span className="text-[10px] font-bold text-slate-300">—</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Institutional Breaks Notice */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-row gap-4 md:gap-12 justify-center items-center">
           <div className="flex items-center gap-2">
              <span className="text-[12px] opacity-40">⏱</span>
              <div>
                 <div className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">Short Break</div>
                 <div className="text-[8px] md:text-[11px] font-bold text-slate-700 uppercase mt-0.5">11:10 - 11:20 AM</div>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[12px] opacity-40">🍱</span>
              <div>
                 <div className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">Lunch Break</div>
                 <div className="text-[8px] md:text-[11px] font-bold text-slate-700 uppercase mt-0.5">01:00 - 02:00 PM</div>
              </div>
           </div>
        </div>
      </div>
      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}