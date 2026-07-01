'use client';

import { useState, useEffect, useCallback } from 'react';
import { _toast } from 'react-hot-toast';
import RealtimeListener from '@/components/RealtimeListener';

const INSTITUTIONAL_ACTIVITIES = [
  { code: 'SPORTS', name: 'Sports & Athletics' },
  { code: 'MINI_PROJECT', name: 'Mini Projects' },
  { code: 'EXTRA_CURRICULAR', name: 'Extra Curricular Activities' },
  { code: 'SEMINAR', name: 'Seminars / Workshops' },
  { code: 'LIB', name: 'Library Period' }
];

export default function PersonalSchedule() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMySchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/clerk/faculty/my-timetable');
      const data = await res.json();
      if (res.ok) {
        setSchedule(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch schedule');
      }
    } catch (_e) {
      setError('Network error - could not sync your schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchMySchedule();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchMySchedule]);

  const handleRealtimeUpdate = (data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      console.info('[FacultySchedule] Server broadcast received, syncing...');
      fetchMySchedule();
    }
  };

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const periods = [1, 2, 3, 4, 5, 6, 7];
  const getSlot = (day, p) => schedule.find(s => s.day_of_week === day && s.period_number === p);

  if (loading) return (
    <div className="bg-white p-12 border border-slate-200 flex flex-col items-center justify-center gap-4">
       <div className="w-8 h-8 border-2 border-[#0b3578] border-t-transparent animate-spin"></div>
       <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing Teaching Schedule...</p>
    </div>
  );

  if (error) return (
    <div className="bg-white p-12 border border-red-100 flex flex-col items-center justify-center text-center gap-4">
       <div className="text-3xl">⚠️</div>
       <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Sync Failed</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-medium">{error}</p>
       </div>
       <button onClick={fetchMySchedule} className="mt-2 px-4 py-2 bg-[#0b3578] text-white font-bold text-[10px] uppercase tracking-widest hover:bg-blue-900 transition-all">Try Again</button>
    </div>
  );

  return (
    <>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-[#0b3578] px-6 py-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase">Weekly Teaching Matrix</h2>
            <p className="text-blue-200 text-[9px] font-medium uppercase tracking-widest mt-0.5 opacity-80">Academic Year 2025-26 &bull; Official Registry</p>
          </div>
          <div className="bg-white/10 px-3 py-1 border border-white/20 text-[10px] font-bold uppercase tracking-tighter">
            {schedule.length} Periods Recorded
          </div>
        </div>

        {/* Desktop Matrix Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="p-3 bg-slate-50 border-b border-r border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-widest w-20">Day</th>
                {periods.map(p => (
                  <th key={p} className="p-3 bg-slate-50 border-b border-slate-200">
                    <div className="text-slate-700 font-bold text-[9px] uppercase tracking-widest mb-0.5">Period {p}</div>
                    <div className="text-[8px] font-medium text-slate-400 uppercase tracking-tighter">
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
                <tr key={day}>
                  <td className="p-3 border-b border-r border-slate-200 bg-slate-50/50 font-bold text-slate-600 text-center text-[10px]">{day}</td>
                  {periods.map(p => {
                    const slot = getSlot(day, p);
                    const activity = slot ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code) : null;
                    const isActivity = !!activity;

                    return (
                      <td key={`${day}-${p}`} className={`p-3 border-b border-r border-slate-200 text-center transition-colors ${slot ? (isActivity ? 'bg-amber-50/20' : 'bg-slate-50/30') : 'bg-slate-50/30'}`}>
                        {slot ? (
                          <div className={`flex flex-col gap-1 border rounded-sm px-2.5 py-2 shadow-sm ${isActivity ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                            <div className={`font-bold text-[10px] uppercase leading-tight line-clamp-2 ${isActivity ? 'text-amber-800' : 'text-[#0b3578]'}`}>
                              {activity ? activity.name : (slot.display_name || slot.subject_code)}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                {slot.branch} &bull; S{slot.semester}
                              </div>
                              {slot.room_no && (
                                <div className="text-[8px] font-bold text-emerald-700 tracking-widest uppercase">Room {slot.room_no}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic opacity-70">Free</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Day-by-Day Card Layout */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100 bg-slate-50">
          {days.map(day => {
            const daySlots = periods.map(p => ({ p, slot: getSlot(day, p) })).filter(item => item.slot);
            if (daySlots.length === 0) return null; // hide empty days

            return (
              <div key={day} className="p-4">
                <h3 className="font-bold text-slate-800 mb-3 uppercase tracking-widest text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  {day}
                </h3>
                <div className="flex flex-col gap-3">
                  {daySlots.map(({ p, slot }) => {
                    const activity = INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code);
                    const isActivity = !!activity;
                    
                    let timeStr = '';
                    if (p === 1) timeStr = '09:30 - 10:20';
                    else if (p === 2) timeStr = '10:20 - 11:10';
                    else if (p === 3) timeStr = '11:20 - 12:10';
                    else if (p === 4) timeStr = '12:10 - 01:00';
                    else if (p === 5) timeStr = '02:00 - 02:50';
                    else if (p === 6) timeStr = '02:50 - 03:40';
                    else if (p === 7) timeStr = '03:40 - 04:30';

                    return (
                      <div key={p} className={`flex rounded-lg border shadow-sm overflow-hidden ${isActivity ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                        {/* Period/Time indicator on left */}
                        <div className={`w-16 flex flex-col justify-center items-center py-2 px-1 border-r ${isActivity ? 'bg-amber-100/50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-xs font-black text-slate-700">P{p}</span>
                          <span className="text-[8px] font-bold text-slate-400 mt-0.5 text-center leading-tight">{timeStr}</span>
                        </div>
                        {/* Slot details */}
                        <div className="flex-1 p-3 flex flex-col justify-center">
                          <div className={`font-bold text-xs uppercase leading-snug mb-1 ${isActivity ? 'text-amber-800' : 'text-[#0b3578]'}`}>
                            {activity ? activity.name : (slot.display_name || slot.subject_code)}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                              {slot.branch} &bull; S{slot.semester}
                            </span>
                            {slot.room_no && (
                              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                Room {slot.room_no}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {days.every(day => !periods.some(p => getSlot(day, p))) && (
             <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                No classes scheduled for this week.
             </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-6 justify-center items-center">
           <div className="flex items-center gap-2">
              <span className="text-xs">☕</span>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Short Break: 11:10 AM</div>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-xs">🍱</span>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lunch Break: 01:00 PM</div>
           </div>
        </div>
      </div>
    </>
  );
}
