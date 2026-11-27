'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AttendanceCalendarPanel({ calendarDays = [] }) {
  const initialMonth = useMemo(() => {
    if (calendarDays.length > 0 && /^\d{4}-\d{2}/.test(calendarDays[0].date)) {
      return calendarDays[0].date.slice(0, 7);
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [calendarDays]);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(() => (calendarDays.length > 0 ? calendarDays[0].date : null));

  const dayMap = useMemo(() => {
    const map = new Map();
    for (const d of calendarDays) {
      map.set(d.date, d);
    }
    return map;
  }, [calendarDays]);

  const [yearNum, monthNum] = currentMonth.split('-').map(Number);

  const monthLabel = useMemo(() => {
    const dt = new Date(Date.UTC(yearNum, monthNum - 1, 1));
    return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [yearNum, monthNum]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(Date.UTC(yearNum, monthNum - 1, 1));
    const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
    // Monday = 0 ... Sunday = 6
    const startOffset = (firstDay.getUTCDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ empty: true, key: `pad-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        empty: false,
        day,
        dateStr,
        summary: dayMap.get(dateStr) || null,
      });
    }
    return cells;
  }, [yearNum, monthNum, dayMap]);

  const changeMonth = (delta) => {
    const dt = new Date(Date.UTC(yearNum, monthNum - 1 + delta, 1));
    setCurrentMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const selectedDayData = selectedDate ? dayMap.get(selectedDate) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Calendar Grid */}
      <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#0b3578]" />
            <span>{monthLabel}</span>
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1">
              {wd}
            </div>
          ))}

          {calendarGrid.map((cell) => {
            if (cell.empty) {
              return <div key={cell.key} className="h-11 sm:h-12" />;
            }
            const s = cell.summary;
            const isSelected = selectedDate === cell.dateStr;
            const hasClasses = s && s.total > 0;
            const allAttended = hasClasses && s.absent === 0;
            const someAbsent = hasClasses && s.absent > 0;

            return (
              <button
                type="button"
                key={cell.dateStr}
                onClick={() => setSelectedDate(cell.dateStr)}
                aria-label={`${cell.dateStr}${hasClasses ? `: ${s.attended} attended, ${s.absent} missed` : ': no conducted classes'}`}
                className={`h-11 sm:h-12 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#0b3578] bg-blue-50 ring-1 ring-[#0b3578] font-bold text-[#0b3578]'
                    : hasClasses
                      ? allAttended
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-50'
                        : 'border-rose-200 bg-rose-50/50 text-rose-900 hover:bg-rose-50'
                      : 'border-slate-100 bg-slate-50/40 text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className="leading-none text-[11px]">{cell.day}</span>
                {hasClasses && (
                  <div className="flex items-center gap-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        allAttended ? 'bg-emerald-500' : someAbsent && s.attended > 0 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                    />
                    {(s.ncc > 0 || s.medical > 0) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="NCC / Medical" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[10.5px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> All Attended</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Mixed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Missed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> NCC / Medical</span>
        </div>
      </div>

      {/* Selected Day Details */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="border-b border-slate-100 pb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Scheduled Sessions
          </div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">
            {selectedDate || 'Select a date'}
          </div>
        </div>

        {selectedDayData && selectedDayData.sessions.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {[...selectedDayData.sessions]
              .sort((a, b) => (Number(b.sessionNumber) || 0) - (Number(a.sessionNumber) || 0))
              .map((sess, i) => (
                <div
                  key={`${sess.sessionId || sess.date}_${sess.sessionNumber}_${i}`}
                  className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                    sess.isAttended ? 'bg-slate-50/70 border-slate-200' : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {sess.isAttended ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{sess.subjectName}</div>
                      <div className="text-[11px] text-slate-500">
                        Period {sess.sessionNumber} • {sess.subjectCode}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      sess.status === 'PRESENT'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : sess.status === 'NCC' || sess.status === 'MEDICAL'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {sess.status}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No finalized attendance sessions recorded for this date.
          </div>
        )}
      </div>
    </div>
  );
}
