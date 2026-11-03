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
 *   data        - array of timetable slot objects
 *   isEditable  - if true, clicking a cell calls onEditSlot; shows "Available" affordance
 *   onEditSlot  - (day, period, existingSlot|null) => void
 *   subtitle    - optional subtitle shown in the table header row
 */
export default function UniversalTimetable({ data = [], onEditSlot = null, isEditable = false, subtitle = '' }) {
  const [activeMobileDay, setActiveMobileDay] = useState('MON');

  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const getSlots = (day, p) => data.filter(s => s.day_of_week === day && Number(s.period_number) === Number(p));

  const getDisplayName = (slot) => {
    const act = INSTITUTIONAL_ACTIVITIES.find(a => a.code === slot.subject_code);
    if (act) return act.name;
    return slot.display_name || slot.subject_name || slot.subject_code || '—';
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
    <div className="w-full overflow-hidden rounded-2xl border border-[#dce8f8] bg-white shadow-[0_14px_36px_rgba(11,53,120,0.08)]">

      {/* Compact subtitle bar — only when subtitle provided */}
      {subtitle && (
        <div className="flex items-center justify-between border-b border-[#e6eef9] bg-[#f7faff] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0b3578]">Weekly view</p>
            <span className="mt-0.5 block text-xs font-semibold text-slate-600">{subtitle}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!shouldShowGrid && (
        <div className="px-6 py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#0b3578]">—</div>
          <p className="text-sm font-bold text-slate-800">No timetable published</p>
          <p className="mt-1 text-xs text-slate-500">
            Your timetable for this academic context has not been configured yet.
          </p>
        </div>
      )}

      {/* 🖥️ DESKTOP TABLE — md and above */}
      {shouldShowGrid && (
        <div className="hidden overflow-x-auto pb-5 md:block">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-center">
            <thead>
              <tr className="border-b border-[#e3ebf6] bg-[#f8fbff] text-[10px] font-bold tracking-wider text-slate-500">
                <th className="sticky left-0 z-30 w-[60px] border-r border-[#e3ebf6] bg-[#f8fbff] py-2 text-center text-[#0b3578] shadow-[2px_0_5px_-1px_rgba(11,53,120,0.06)]">
                  Day
                </th>
                {PERIODS.map(p => (
                  <Fragment key={p}>
                    <th className="border-r border-[#e3ebf6] px-1 py-1.5 text-center">
                      <div className="font-extrabold uppercase text-[#0b3578]">Period {p}</div>
                      <div className="mt-0.5 text-[9px] font-medium text-slate-600 tabular-nums leading-none">
                        {PERIOD_TIMES[p]}
                      </div>
                    </th>
                    {p === 2 && (
                      <th className="w-[36px] border-r border-[#e8dfc9] bg-amber-50/70 p-1 text-center align-middle" title="Short Break">
                        <span className="inline-block -rotate-90 select-none text-[8px] font-black uppercase tracking-wider text-amber-700 whitespace-nowrap">
                          Break
                        </span>
                      </th>
                    )}
                    {p === 4 && (
                      <th className="w-[36px] border-r border-[#d7eadf] bg-emerald-50/70 p-1 text-center align-middle" title="Lunch Break">
                        <span className="inline-block -rotate-90 select-none text-[8px] font-black uppercase tracking-wider text-emerald-700 whitespace-nowrap">
                          Lunch
                        </span>
                      </th>
                    )}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="group border-b border-[#edf2f8] transition-colors hover:bg-blue-50/20">
                  <td className="sticky left-0 z-20 border-r border-[#e3ebf6] bg-white px-2 py-3 text-center text-[11px] font-black uppercase tracking-wider text-[#0b3578] shadow-[2px_0_5px_-1px_rgba(11,53,120,0.08)] group-hover:bg-blue-50/30">
                    {day}
                  </td>
                  {PERIODS.map(p => {
                    const slots = getSlots(day, p);
                    const hasSlots = slots.length > 0;
                    const isMultiBatch = slots.length > 1 || (slots.length === 1 && slots[0].batch_number > 0);
                    const active = !isEditable && isSlotActiveNow(day, p);

                    return (
                      <Fragment key={`${day}-${p}`}>
                        <td
                          onClick={() => isEditable && onEditSlot && onEditSlot(day, p, slots[0] || null)}
                          className={[
                            'relative h-[82px] border-r border-[#edf2f8] px-1 py-1.5 align-middle transition-colors',
                            isEditable ? 'group/cell cursor-pointer hover:bg-blue-50/60' : '',
                            active ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-300/60' : '',
                          ].join(' ')}
                        >
                          {hasSlots ? (
                            isMultiBatch ? (
                              <div className="flex flex-col justify-center gap-1 h-full text-center">
                                {slots.map(s => {
                                  const isB1 = s.batch_number === 1;
                                  return (
                                    <div
                                      key={s.id || s.batch_number}
                                      className={`px-1.5 py-1 rounded text-[10px] leading-tight flex items-center justify-between border ${
                                        isB1
                                          ? 'bg-blue-50/90 border-blue-200 text-blue-900'
                                          : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                                      }`}
                                    >
                                      <span className="font-black text-[9px] uppercase tracking-wide mr-1 shrink-0">
                                        {isB1 ? 'B1:' : s.batch_number === 2 ? 'B2:' : ''}
                                      </span>
                                      <span className="font-semibold truncate flex-1 text-center" title={getDisplayName(s)}>
                                        {getDisplayName(s)}
                                      </span>
                                      {s.room_no && (
                                        <span className="text-[8px] text-slate-500 font-normal ml-1 shrink-0">
                                          [{s.room_no}]
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col justify-center items-center h-full text-center">
                                <p className={`max-w-[125px] break-words text-[12px] font-bold leading-[1.35] ${isActivity(slots[0]) ? 'text-amber-800' : 'text-slate-800'}`}>
                                  {getDisplayName(slots[0])}
                                </p>
                                {slots[0].room_no && (
                                  <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    {slots[0].room_no}
                                  </span>
                                )}
                              </div>
                            )
                          ) : (
                            <div className={`h-full flex flex-col items-center justify-center ${isEditable ? 'opacity-0 group-hover/cell:opacity-100 transition-opacity' : ''}`}>
                              {isEditable ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-[18px] text-slate-400 font-light leading-none">+</span>
                                  <span className="text-[10px] text-slate-400 font-medium mt-1">Add class</span>
                                </div>
                              ) : (
                                <span className="select-none text-[12px] text-slate-300">—</span>
                              )}
                            </div>
                          )}
                        </td>
                        {p === 2 && (
                          <td className="w-[36px] select-none border-r border-[#e8dfc9] bg-amber-50/50 text-center text-slate-300 pointer-events-none"></td>
                        )}
                        {p === 4 && (
                          <td className="w-[36px] select-none border-r border-[#d7eadf] bg-emerald-50/50 text-center text-slate-300 pointer-events-none"></td>
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

      {/* Mobile: Day selector + period list - below md */}
      {shouldShowGrid && (
        <div className="md:hidden">
          {/* Compact scrollable day selector */}
          <div className="sticky top-0 z-20 border-b border-[#e6eef9] bg-white px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0b3578]">Select day</span>
              <span className="text-[10px] font-medium text-slate-400">Swipe schedule to browse</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setActiveMobileDay(day)}
                  aria-pressed={activeMobileDay === day}
                  className={[
                    'min-w-[48px] flex-shrink-0 rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors',
                    activeMobileDay === day
                      ? 'border-[#0b3578] bg-[#0b3578] text-white shadow-[0_5px_12px_rgba(11,53,120,0.18)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50',
                  ].join(' ')}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Period list for selected day */}
          <div
            className="space-y-2.5 bg-[#fbfdff] px-3 py-4"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEndHandler}
          >
            {PERIODS.map(p => {
              const slots = getSlots(activeMobileDay, p);
              const hasSlots = slots.length > 0;
              const isMultiBatch = slots.length > 1 || (slots.length === 1 && slots[0].batch_number > 0);
              const active = !isEditable && isSlotActiveNow(activeMobileDay, p);

              return (
                <div key={p}>
                  {p === 3 && (
                    <div className="my-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold tracking-wide text-amber-700 shadow-sm">
                      <div className="flex items-center gap-1.5"><span className="text-[12px]">☕</span> Short Break</div>
                      <span>11:10—11:20</span>
                    </div>
                  )}
                  {p === 5 && (
                    <div className="my-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold tracking-wide text-emerald-700 shadow-sm">
                      <div className="flex items-center gap-1.5"><span className="text-[12px]">🍱</span> Lunch Break</div>
                      <span>01:00—02:00</span>
                    </div>
                  )}

                  <div
                    onClick={() => isEditable && onEditSlot && onEditSlot(activeMobileDay, p, slots[0] || null)}
                    className={[
                      'relative flex items-start gap-3 rounded-xl border px-3.5 py-3.5 transition-colors',
                      isEditable ? 'cursor-pointer active:scale-[0.99]' : '',
                      active ? 'border-emerald-300 bg-emerald-50/70 shadow-[0_5px_14px_rgba(16,185,129,0.12)]' : hasSlots ? 'border-slate-200 bg-white shadow-[0_3px_10px_rgba(11,53,120,0.04)]' : 'border-dashed border-slate-200 bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="flex-shrink-0 w-12 text-center pt-0.5">
                      <div className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-emerald-700' : 'text-slate-700'}`}>P{p}</div>
                      <div className={`text-[9px] font-medium tabular-nums leading-tight mt-0.5 ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {PERIOD_TIMES[p].split(' to ')[0]}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                      {hasSlots ? (
                        isMultiBatch ? (
                          <div className="space-y-1.5">
                            {slots.map(s => (
                              <div
                                key={s.id || s.batch_number}
                                className={`p-2 rounded-lg border text-xs ${
                                  s.batch_number === 1
                                    ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold uppercase text-[10px]">
                                    {s.batch_number === 1 ? 'Batch 1' : s.batch_number === 2 ? 'Batch 2' : 'Whole Class'}
                                  </span>
                                  {s.room_no && <span className="text-[10px] text-slate-500">Room {s.room_no}</span>}
                                </div>
                                <p className="font-bold text-[12px] mt-0.5">{getDisplayName(s)}</p>
                                {s.faculty_name && <p className="text-[10px] text-slate-500 mt-0.5">{s.faculty_name}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <p className={`break-words text-[13px] font-bold leading-[1.3] ${isActivity(slots[0]) ? 'text-amber-800' : 'text-slate-800'}`}>
                                {getDisplayName(slots[0])}
                              </p>
                              {active && <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live</span>}
                            </div>
                            {(slots[0].room_no || slots[0].faculty_name) && (
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                                {slots[0].room_no && <span className="rounded-md bg-slate-100 px-2 py-1">Room {slots[0].room_no}</span>}
                                {slots[0].faculty_name && <span className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1" title={slots[0].faculty_name}>{slots[0].faculty_name}</span>}
                              </div>
                            )}
                          </>
                        )
                      ) : isEditable ? (
                        <p className="text-[12px] text-[#0b3578] font-medium py-0.5 flex items-center justify-center gap-1.5 opacity-80">
                          <span className="text-[16px] leading-none">+</span> Add class
                        </p>
                      ) : (
                        <p className="py-0.5 text-left text-[12px] italic text-slate-400">
                          No lecture scheduled
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
    </div>
  );
}
