'use client';
import { useState, Fragment } from 'react';

const INSTITUTIONAL_ACTIVITIES = [
  { code: 'SPORTS', name: 'Sports & Athletics' },
  { code: 'MINI_PROJECT', name: 'Mini Projects' },
  { code: 'EXTRA_CURRICULAR', name: 'Extra Curricular Activities' },
  { code: 'SEMINAR', name: 'Seminars / Workshops' },
  { code: 'LIB', name: 'Library Period' }
];

const PERIOD_TIMES = {
  1: '09:30AM to 10:20AM',
  2: '10:20AM to 11:10AM',
  3: '11:20AM to 12:10PM',
  4: '12:10PM to 01:00PM',
  5: '02:00PM to 02:50PM',
  6: '02:50PM to 03:40PM',
  7: '03:40PM to 04:30PM',
};

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function isSlotActiveNow(day, p) {
  const now = new Date();
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  if (dayNames[now.getDay()] !== day) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  const ranges = { 1: [570, 620], 2: [620, 670], 3: [680, 730], 4: [730, 780], 5: [840, 890], 6: [890, 940], 7: [940, 990] };
  const [s, e] = ranges[p] || [0, 0];
  return m >= s && m < e;
}

/**
 * UniversalTimetable
 * Props:
 *   data        â€“ array of timetable slot objects
 *   isEditable  â€“ if true, clicking a cell calls onEditSlot; shows "Available" affordance
 *   onEditSlot  â€“ (day, period, existingSlot|null) => void
 *   subtitle    â€“ optional subtitle shown in the table header row
 */
export default function UniversalTimetable({ data = [], onEditSlot = null, isEditable = false, subtitle = '' }) {
  const [activeMobileDay, setActiveMobileDay] = useState('MON');

  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const getSlot = (day, p) => data.find(s => s.day_of_week === day && Number(s.period_number) === Number(p));

  const getDisplayName = (slot) => {
    const act = INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code);
    if (act) return act.name;
    return slot.display_name || slot.subject_name || slot.subject_code || 'â€”';
  };

  const isActivity = (slot) => slot && INSTITUTIONAL_ACTIVITIES.some(a => a.code === slot.subject_code);

  // Touch swipe for mobile
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const dist = touchStart - touchEnd;
    const idx = DAYS.indexOf(activeMobileDay);
    if (dist > 50 && idx < DAYS.length - 1) setActiveMobileDay(DAYS[idx + 1]);
    else if (dist < -50 && idx > 0) setActiveMobileDay(DAYS[idx - 1]);
  };

  const shouldShowGrid = isEditable || data.length > 0;

  return (
    <div className="w-full border border-slate-200 bg-white rounded-sm overflow-hidden">

      {/* Compact subtitle bar — only when subtitle provided */}
      {subtitle && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500">{subtitle}</span>
        </div>
      )}

      {/* Empty state */}
      {!shouldShowGrid && (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No timetable published</p>
          <p className="text-xs text-slate-400 mt-1">
            Your timetable for this academic context has not been configured yet.
          </p>
        </div>
      )}

      {/* 🖥️ DESKTOP TABLE — md and above */}
      {shouldShowGrid && (
        <div className="hidden md:block overflow-x-auto pb-6">
          <table className="w-full border-collapse text-center min-w-[900px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200">
                {/* Day column header */}
                <th className="sticky left-0 z-30 bg-slate-200 border-r border-slate-300 w-16 px-3 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-widest text-center shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                  Day
                </th>
                  {PERIODS.map(p => (
                    <Fragment key={p}>
                      <th className="px-2 py-3 border-r border-slate-300 bg-slate-200 text-center w-[120px] max-w-[140px]">
                        <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Period {p}</div>
                        <div className="text-[10px] font-medium text-slate-500 mt-1 tabular-nums">{PERIOD_TIMES[p]}</div>
                      </th>
                      {p === 2 && (
                        <th className="px-1.5 py-3 border-r border-slate-300 bg-slate-200/80 w-[36px] min-w-[36px] select-none text-center align-middle">
                          <div className="text-[10px] text-slate-500 font-bold tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>SHORT BREAK</div>
                        </th>
                      )}
                      {p === 4 && (
                        <th className="px-1.5 py-3 border-r border-slate-300 bg-slate-200/80 w-[36px] min-w-[36px] select-none text-center align-middle">
                          <div className="text-[10px] text-slate-500 font-bold tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>LUNCH BREAK</div>
                        </th>
                      )}
                    </Fragment>
                  ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors group">
                  <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50/60 border-r border-slate-200 text-center px-2 py-3 text-[11px] font-bold text-[#0b3578] uppercase tracking-wider shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                    {day}
                  </td>
                  {PERIODS.map(p => {
                    const slot = getSlot(day, p);
                    const act = slot ? isActivity(slot) : false;
                    const active = !isEditable && isSlotActiveNow(day, p);

                    return (
                      <Fragment key={`${day}-${p}`}>
                        <td
                          onClick={() => isEditable && onEditSlot && onEditSlot(day, p, slot)}
                          className={[
                            'px-2 py-3 border-r border-slate-200 align-middle h-[70px] transition-colors relative',
                            isEditable ? 'cursor-pointer hover:bg-blue-50/40 group/cell' : '',
                            active ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-300/50' : '',
                            !active && slot && act ? 'bg-amber-50/30' : '',
                          ].join(' ')}
                        >
                          {slot ? (
                            <div className="flex flex-col justify-center items-center h-full text-center">
                              <p className={`text-[12px] leading-[1.4] font-medium break-words whitespace-normal ${act ? 'text-amber-800' : 'text-slate-800'}`}>
                                {getDisplayName(slot)}
                              </p>
                            </div>
                          ) : (
                            <div className={`h-full flex flex-col items-center justify-center ${isEditable ? 'opacity-0 group-hover/cell:opacity-100 transition-opacity' : ''}`}>
                              {isEditable ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-[18px] text-slate-400 font-light leading-none">+</span>
                                  <span className="text-[10px] text-slate-400 font-medium mt-1">Add class</span>
                                </div>
                              ) : (
                                <span className="text-[12px] text-slate-300 select-none">—</span>
                              )}
                            </div>
                          )}
                        </td>
                        {p === 2 && (
                          <td className="border-r border-slate-300 bg-slate-100/50 text-center text-slate-300 w-[36px] select-none pointer-events-none"></td>
                        )}
                        {p === 4 && (
                          <td className="border-r border-slate-300 bg-slate-100/50 text-center text-slate-300 w-[36px] select-none pointer-events-none"></td>
                        )}
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ðŸ“± MOBILE: Day selector + period list â€” below md */}
      {shouldShowGrid && (
        <div className="md:hidden">
          {/* Compact scrollable day selector */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-3 py-2">
            <div className="flex gap-1 overflow-x-auto hide-scrollbar">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setActiveMobileDay(day)}
                  aria-pressed={activeMobileDay === day}
                  className={[
                    'flex-shrink-0 px-3 py-1.5 rounded text-[11px] font-bold transition-colors border',
                    activeMobileDay === day
                      ? 'bg-[#0b3578] text-white border-[#0b3578]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Period list for selected day */}
          <div
            className="px-3 py-3 space-y-2"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEndHandler}
          >
            {/* Short break notice between P2 and P3 */}
            {/* Lunch break notice between P4 and P5 */}
            {PERIODS.map(p => {
              const slot = getSlot(activeMobileDay, p);
              const act = slot ? isActivity(slot) : false;
              const active = !isEditable && isSlotActiveNow(activeMobileDay, p);

              return (
                <div key={p}>
                  {/* Break dividers */}
                  {p === 3 && (
                    <div className="py-2 px-3 my-2 bg-amber-50/50 border border-amber-200/50 rounded flex justify-between items-center text-[10px] text-amber-700 font-bold tracking-wide shadow-sm">
                      <div className="flex items-center gap-1.5"><span className="text-[12px]">☕</span> Short Break</div>
                      <span>11:10—11:20</span>
                    </div>
                  )}
                  {p === 5 && (
                    <div className="py-2 px-3 my-2 bg-emerald-50/50 border border-emerald-200/50 rounded flex justify-between items-center text-[10px] text-emerald-700 font-bold tracking-wide shadow-sm">
                      <div className="flex items-center gap-1.5"><span className="text-[12px]">🍱</span> Lunch Break</div>
                      <span>01:00—02:00</span>
                    </div>
                  )}

                  <div
                    onClick={() => isEditable && onEditSlot && onEditSlot(activeMobileDay, p, slot)}
                    className={[
                      'flex items-start gap-3 px-3 py-2.5 rounded border transition-colors relative',
                      isEditable ? 'cursor-pointer active:scale-[0.99]' : '',
                      active ? 'bg-blue-50 border-blue-300' : slot ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 border-dashed',
                    ].join(' ')}
                  >
                    {/* Period badge */}
                    <div className={[
                      'flex-shrink-0 w-12 text-center pt-0.5',
                    ].join(' ')}>
                      <div className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-blue-600' : 'text-slate-400'}`}>P{p}</div>
                      <div className={`text-[9px] font-medium tabular-nums leading-tight mt-0.5 ${active ? 'text-blue-500' : 'text-slate-400'}`}>
                        {PERIOD_TIMES[p].split(' to ')[0]}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center items-center text-center">
                      {slot ? (
                        <p className={`text-[13px] font-medium leading-[1.3] break-words whitespace-normal ${act ? 'text-amber-800' : 'text-slate-800'}`}>
                          {getDisplayName(slot)}
                        </p>
                      ) : isEditable ? (
                        <p className="text-[12px] text-[#0b3578] font-medium py-0.5 flex items-center justify-center gap-1.5 opacity-80">
                          <span className="text-[16px] leading-none">+</span> Add class
                        </p>
                      ) : (
                        <p className="text-[12px] text-slate-400 italic py-0.5 text-center">
                          Free period
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shouldShowGrid && data.length > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-6 px-4 pb-4">
          <h4 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Subject & Faculty</h4>
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 font-semibold text-slate-700 border-r border-slate-200 w-1/2">Subject</th>
                  <th className="px-4 py-2 font-semibold text-slate-700 w-1/2">Faculty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {Object.values(data.reduce((acc, slot) => {
                  const act = INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code);
                  if (act) return acc;
                  const key = slot.subject_code;
                  if (!acc[key]) {
                    acc[key] = { subjectName: slot.display_name || slot.subject_name || slot.subject_code, faculties: new Set() };
                  }
                  if (slot.faculty_name) {
                    acc[key].faculties.add(slot.faculty_name);
                  }
                  return acc;
                }, {})).filter(item => item.faculties.size > 0).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200 break-words">{item.subjectName}</td>
                    <td className="px-4 py-2 text-slate-500 break-words">{Array.from(item.faculties).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

