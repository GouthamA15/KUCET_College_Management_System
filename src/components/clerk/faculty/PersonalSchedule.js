'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

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

  const fetchMySchedule = async () => {
    try {
      const res = await fetch('/api/clerk/faculty/my-timetable');
      const data = await res.json();
      if (res.ok) {
        setSchedule(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch schedule');
      }
    } catch (e) {
      setError('Network error - could not sync your schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySchedule();
  }, []);

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const periods = [1, 2, 3, 4, 5, 6, 7];
  const getSlot = (day, p) => schedule.find(s => s.day_of_week === day && s.period_number === p);

  if (loading) return (
    <div className="bg-white rounded-3xl p-20 shadow-xl border border-gray-100 flex flex-col items-center justify-center gap-4">
       <div className="w-12 h-12 border-4 border-[#0b3578] border-t-transparent rounded-full animate-spin"></div>
       <p className="text-gray-400 font-black uppercase tracking-widest text-xs animate-pulse">Syncing Your Teaching Schedule...</p>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-3xl p-20 shadow-xl border border-red-100 flex flex-col items-center justify-center text-center gap-4">
       <div className="text-5xl">⚠️</div>
       <div>
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Sync Failed</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-2 font-medium">{error}</p>
       </div>
       <button onClick={fetchMySchedule} className="mt-4 px-6 py-2 bg-[#0b3578] text-white rounded-xl font-bold hover:bg-blue-900 transition-all shadow-lg shadow-blue-100">Try Again</button>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-[#0b3578] p-6 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black tracking-tight">My Weekly Teaching Schedule</h2>
          <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mt-1">Academic Year 2025-26 (System Sync)</p>
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 text-xs font-black uppercase">
          {schedule.length} Periods / Week
        </div>
      </div>

      <div className="overflow-x-auto p-6">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-4 bg-gray-50 border border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">Day</th>
              {periods.map(p => (
                <th key={p} className="p-4 bg-gray-50 border border-gray-100 min-w-[140px]">
                  <div className="text-gray-800 font-black text-[10px] uppercase tracking-widest mb-1">Period {p}</div>
                  <div className="text-[9px] font-bold text-blue-600/60 bg-blue-50 rounded py-0.5 px-2 inline-block">
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
                <td className="p-4 border border-gray-100 bg-gray-50 font-black text-gray-700 text-center text-xs group-hover:bg-blue-50 transition-colors">{day}</td>
                {periods.map(p => {
                  const slot = getSlot(day, p);
                  const activity = slot ? INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code) : null;
                  const isActivity = !!activity;

                  return (
                    <td key={`${day}-${p}`} className={`p-3 border border-gray-50 text-center transition-all ${slot ? (isActivity ? 'bg-amber-50/20 shadow-inner' : 'bg-white shadow-inner') : 'bg-gray-50/20'}`}>
                      {slot ? (
                        <div className="animate-in zoom-in-95 duration-300">
                          <div className={`font-black text-[10px] uppercase leading-tight mb-1 line-clamp-2 ${isActivity ? 'text-amber-700' : 'text-blue-800'}`}>
                            {activity ? activity.name : (slot.subject_name || slot.subject_code)}
                          </div>
                          <div className="flex flex-col gap-1">
                             <div className="text-[9px] font-black text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 inline-block mx-auto uppercase tracking-tighter">
                               {slot.branch} &bull; S{slot.semester}
                             </div>
                             {slot.room_no && (
                               <div className="text-[9px] font-bold text-emerald-600">Room: {slot.room_no}</div>
                             )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black text-gray-200 uppercase tracking-widest">Free</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-8 justify-center items-center">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-sm shadow-sm">☕</div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Short Break: 11:10 AM</div>
         </div>
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-sm shadow-sm">🍱</div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lunch Break: 01:00 PM</div>
         </div>
      </div>
    </div>
  );
}
