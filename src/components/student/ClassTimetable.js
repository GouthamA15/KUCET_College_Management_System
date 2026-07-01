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
  const [activeMobileDay, setActiveMobileDay] = useState(() => {
    const now = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayName = dayNames[now.getDay()];
    return todayName !== 'SUN' ? todayName : 'MON';
  });

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

  const isSlotActiveNow = (day, p) => {
    const now = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    if (dayNames[now.getDay()] !== day) return false;
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let startMin = 0; let endMin = 0;
    if (p === 1) { startMin = 9*60+30; endMin = 10*60+20; }
    else if (p === 2) { startMin = 10*60+20; endMin = 11*60+10; }
    else if (p === 3) { startMin = 11*60+20; endMin = 12*60+10; }
    else if (p === 4) { startMin = 12*60+10; endMin = 13*60+0; }
    else if (p === 5) { startMin = 14*60+0; endMin = 14*60+50; }
    else if (p === 6) { startMin = 14*60+50; endMin = 15*60+40; }
    else if (p === 7) { startMin = 15*60+40; endMin = 16*60+30; }
    
    return currentMinutes >= startMin && currentMinutes < endMin;
  };

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

        {/* High-Density Matrix Table Wrapper - Desktop Only */}
        <div className="relative w-full overflow-hidden hidden md:block">
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

        {/* Institutional Breaks Notice - Desktop Only */}
        <div className="hidden md:flex px-4 py-3 bg-slate-50 border-t border-slate-200 flex-row gap-4 md:gap-12 justify-center items-center">
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

        {/* Mobile Day Selector and Card View (< md breakpoint) */}
        <div className="md:hidden bg-slate-50 border-b border-slate-200 p-3">
          <div className="flex justify-between items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm gap-1">
            {days.map(day => (
              <button
                key={day}
                onClick={() => setActiveMobileDay(day)}
                className={`flex-1 py-2 px-1 rounded-md text-[11px] font-black transition-all ${activeMobileDay === day ? 'bg-[#0b3578] text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="md:hidden p-4 space-y-4 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0b3578]"></span>
              {activeMobileDay} Schedule
            </h3>
            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 border border-slate-200 rounded uppercase tracking-widest">
              {periods.length} Periods
            </span>
          </div>

          <div className="space-y-3">
            {periods.map(p => {
              const slot = getSlot(activeMobileDay, p);
              const activity = slot ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code) : null;
              const isInstitutional = !!activity;
              const isActiveNow = isSlotActiveNow(activeMobileDay, p);

              let timeStr = '';
              if (p === 1) timeStr = '09:30 - 10:20 AM';
              else if (p === 2) timeStr = '10:20 - 11:10 AM';
              else if (p === 3) timeStr = '11:20 - 12:10 PM';
              else if (p === 4) timeStr = '12:10 - 01:00 PM';
              else if (p === 5) timeStr = '02:00 - 02:50 PM';
              else if (p === 6) timeStr = '02:50 - 03:40 PM';
              else if (p === 7) timeStr = '03:40 - 04:30 PM';

              return (
                <div key={p}>
                  {/* Check for Short Break before P3 */}
                  {p === 3 && (
                    <div className="my-3 py-2.5 px-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">☕</span>
                        <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider">Short Break</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700">11:10 - 11:20 AM</span>
                    </div>
                  )}
                  {/* Check for Lunch Break before P5 */}
                  {p === 5 && (
                    <div className="my-3 py-2.5 px-3 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍱</span>
                        <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Lunch Break</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700">01:00 - 02:00 PM</span>
                    </div>
                  )}

                  <div 
                    className={`rounded-xl border transition-all p-4 shadow-sm relative overflow-hidden ${
                      isActiveNow 
                        ? 'bg-blue-50/80 border-[#0b3578] ring-2 ring-[#0b3578]/20 shadow-md' 
                        : slot 
                          ? (isInstitutional ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200') 
                          : 'bg-slate-50/70 border-dashed border-slate-300'
                    }`}
                  >
                    {isActiveNow && (
                      <div className="absolute top-0 right-0 bg-[#0b3578] text-white text-[8px] font-black px-2.5 py-0.5 rounded-bl uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active Now
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center font-black flex-shrink-0 border shadow-xs ${
                          isActiveNow
                            ? 'bg-[#0b3578] text-white border-[#0b3578]'
                            : slot
                              ? (isInstitutional ? 'bg-amber-100/80 text-amber-900 border-amber-200' : 'bg-slate-100 text-[#0b3578] border-slate-200')
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          <span className="text-xs">P{p}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex flex-wrap items-center gap-2">
                            <span>{timeStr}</span>
                            {slot?.room_no && (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight ${
                                isActiveNow ? 'bg-[#0b3578]/10 text-[#0b3578]' : 'bg-slate-100 text-slate-700'
                              }`}>
                                Room {slot.room_no}
                              </span>
                            )}
                          </div>

                          {slot ? (
                            <>
                              <h4 className={`text-sm font-black uppercase tracking-tight leading-snug break-words ${
                                isInstitutional ? 'text-amber-900' : 'text-slate-900'
                              }`}>
                                {activity ? activity.name : (slot.display_name || slot.subject_name || slot.subject_code)}
                              </h4>
                              {slot.subject_code && !isInstitutional && (
                                <div className="text-[10px] font-bold text-[#0b3578] mt-0.5 uppercase tracking-widest">
                                  {slot.subject_code}
                                </div>
                              )}
                              {slot.faculty_name && (
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-600 font-medium truncate">
                                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex-shrink-0">Faculty:</span>
                                  <span className="truncate font-semibold text-slate-800">{slot.faculty_name}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="py-2 flex items-center gap-2 text-slate-400 font-medium text-xs">
                              <span className="italic">Free Period / Self-Study</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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