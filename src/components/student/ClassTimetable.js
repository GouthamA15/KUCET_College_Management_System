'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
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
    fetchTimetable();
  }, [fetchTimetable]);

  const handleRealtimeUpdate = (data) => {
    if (data.type === 'TIMETABLE_CHANGED') {
      console.log('[StudentTimetable] Server broadcast received, syncing...');
      fetchTimetable();
    }
  };

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const periods = [1, 2, 3, 4, 5, 6, 7];
  const getSlot = (day, p) => schedule.find(s => s.day_of_week === day && s.period_number === p);

  if (loading) return (
    <div className="bg-white rounded-3xl p-20 shadow-xl border border-gray-100 flex flex-col items-center justify-center gap-4">
       <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
       <p className="text-gray-400 font-black uppercase tracking-widest text-xs animate-pulse">Syncing Class Timetable...</p>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-3xl p-20 shadow-xl border border-red-100 flex flex-col items-center justify-center text-center gap-4">
       <div className="text-5xl">⚠️</div>
       <div>
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Resolution Failed</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-2 font-medium">{error}</p>
       </div>
       <button onClick={fetchTimetable} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Try Again</button>
    </div>
  );

  return (
    <>
      <RealtimeListener onUpdate={handleRealtimeUpdate} />
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-indigo-900 p-6 text-white flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="bg-indigo-500/30 text-indigo-100 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-indigo-400/20">Official Schedule</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Departmental Class Timetable</h2>
            <p className="text-indigo-200/70 text-[10px] font-bold uppercase tracking-widest mt-1">
              {meta?.branch} &bull; Semester {meta?.semester}
            </p>
          </div>
          <div className="text-right">
             <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Matrix</div>
             <div className="flex items-center gap-2 text-xs font-black bg-indigo-500/20 text-indigo-100 px-3 py-1 rounded-full border border-indigo-500/20 uppercase">
                Current Cycle
             </div>
          </div>
        </div>

        <div className="overflow-x-auto p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-4 bg-gray-50 border border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">Day</th>
                {periods.map(p => (
                  <th key={p} className="p-4 bg-gray-50 border border-gray-100 min-w-[150px]">
                    <div className="text-gray-800 font-black text-[10px] uppercase tracking-widest mb-1">Period {p}</div>
                    <div className="text-[9px] font-bold text-indigo-600/60 bg-indigo-50 rounded py-0.5 px-2 inline-block">
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
                <tr key={day} className="group">
                  <td className="p-4 border border-gray-100 bg-gray-50 font-black text-gray-700 text-center text-xs group-hover:bg-indigo-50 transition-colors">{day}</td>
                  {periods.map(p => {
                    const slot = getSlot(day, p);
                    const activity = slot ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code) : null;
                    const isInstitutional = !!activity;
                    
                    return (
                      <td key={`${day}-${p}`} className={`p-4 border border-gray-50 text-center transition-all ${slot ? (isInstitutional ? 'bg-amber-50/20' : 'bg-white') : 'bg-gray-50/20'}`}>
                        {slot ? (
                          <div className="animate-in zoom-in-95 duration-300">
                            <div className={`font-black text-[11px] leading-tight mb-1 line-clamp-2 uppercase ${isInstitutional ? 'text-amber-700 font-black' : 'text-indigo-900'}`}>
                              {activity ? activity.name : (slot.display_name || slot.subject_code)}
                            </div>
                            <div className="flex flex-col gap-1">
                               {slot.faculty_name && (
                                 <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                                   {slot.faculty_name}
                                 </div>
                               )}
                               {slot.room_no && (
                                 <div className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded inline-block mx-auto border border-indigo-100/50 uppercase tracking-widest">
                                   Room: {slot.room_no}
                                 </div>
                               )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[9px] font-black text-gray-200 uppercase tracking-widest">No Class</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex flex-wrap gap-10 justify-center">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-lg shadow-sm">🍪</div>
              <div>
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Short Break</div>
                 <div className="text-[11px] font-black text-gray-700 uppercase">11:10 AM - 11:20 AM</div>
              </div>
           </div>
           <div className="w-px h-10 bg-gray-200 hidden sm:block opacity-50"></div>
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-lg shadow-sm">🥗</div>
              <div>
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lunch Break</div>
                 <div className="text-[11px] font-black text-gray-700 uppercase">01:00 PM - 02:00 PM</div>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
