// src/components/student/ClassTimetable.js
'use client';

import { useState, useEffect, useCallback } from 'react';
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
    } catch (e) {
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

  const handleRealtimeUpdate = (data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      fetchTimetable();
    }
  };

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
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
      <div className="bg-white border border-slate-300 shadow-md rounded-sm overflow-hidden">
        
        {/* Formal Header */}
        <div className="bg-[#0b3578] px-6 py-4 border-b border-blue-900 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Departmental Class Matrix</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Formal Schedule Configuration</span>
              <span className="text-blue-300 text-[10px] font-bold uppercase tracking-widest border-l border-blue-700 pl-3">
                {meta?.branch || 'General'} — Semester {meta?.semester || 'N/A'}
              </span>
            </div>
          </div>
          <div className="bg-blue-900/50 px-4 py-2 border border-blue-700/50 rounded-sm">
             <span className="block text-[9px] font-black text-blue-300 uppercase tracking-tighter">Academic Status</span>
             <span className="text-[11px] font-bold text-white uppercase tracking-widest">Active Session</span>
          </div>
        </div>

        {/* High-Density Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-slate-200 text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 border-r border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest text-center w-20">Day</th>
                {periods.map(p => (
                  <th key={p} className="p-4 border-r border-slate-200 min-w-[140px]">
                    <div className="text-slate-800 font-bold text-[11px] uppercase">Period {p}</div>
                    <div className="text-[10px] font-medium text-slate-500 mt-0.5">
                      {p === 1 && '09:30 - 10:20'}
                      {p === 2 && '10:20 - 11:10'}
                      {p === 3 && '11:20 - 12:10'}
                      {p === 4 && '12:10 - 01:00'}
                      {p === 5 && '02:00 - 02:50'}
                      {p === 6 && '02:50 - 03:40'}
                      {p === 7 && '03:40 - 04:30'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 border-r border-slate-200 bg-slate-50 font-bold text-slate-700 text-center text-sm">{day}</td>
                  {periods.map(p => {
                    const slot = getSlot(day, p);
                    const activity = slot ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code) : null;
                    const isInstitutional = !!activity;
                    
                    return (
                      <td key={`${day}-${p}`} className={`p-4 border-r border-slate-100 align-top ${slot ? (isInstitutional ? 'bg-amber-50/10' : 'bg-white') : 'bg-slate-50/30'}`}>
                        {slot ? (
                          <div className="flex flex-col gap-1.5">
                            <div className={`font-bold text-[12px] leading-tight uppercase tracking-tight ${isInstitutional ? 'text-amber-800' : 'text-slate-900'}`}>
                              {activity ? activity.name : (slot.display_name || slot.subject_code)}
                            </div>
                            <div className="space-y-1">
                               {slot.faculty_name && (
                                 <div className="text-[10px] font-medium text-slate-500 uppercase">
                                   ID: {slot.faculty_name}
                                 </div>
                               )}
                               {slot.room_no && (
                                 <div className="text-[10px] font-bold text-blue-700 uppercase bg-blue-50 px-1.5 py-0.5 inline-block rounded-sm">
                                   Room: {slot.room_no}
                                 </div>
                               )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest block text-center mt-2">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Institutional Breaks Notice */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-x-12 gap-y-4 justify-center">
           <div className="flex items-center gap-3">
              <span className="text-[14px]">⏱</span>
              <div>
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none">Interval I</div>
                 <div className="text-[11px] font-bold text-slate-700 uppercase mt-1">Short Break (11:10 AM - 11:20 AM)</div>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <span className="text-[14px]">⌛</span>
              <div>
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none">Interval II</div>
                 <div className="text-[11px] font-bold text-slate-700 uppercase mt-1">Lunch Recess (01:00 PM - 02:00 PM)</div>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
