"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDateTime } from '@/lib/date';
import { Clock, isTimeMachineEnabled } from '@/lib/clock';
import Header from '@/components/Header';
import HeaderMobileView from '@/components/Header-MobileView';

export default function TimeMachine() {
  const isEnabled = isTimeMachineEnabled();

  const [mockDate, setMockDate] = useState('');
  const [isFrozen, setIsFrozen] = useState(false);
  const [realDisplay, setRealDisplay] = useState('SYNCING...');
  const [appDisplay, setAppDisplay] = useState('SYNCING...');
  const [statusBadge, setStatusBadge] = useState({ text: 'REAL TIME', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' });
  const [activePeriodText, setActivePeriodText] = useState('Checking...');
  const [offsetText, setOffsetText] = useState('0ms');

  useEffect(() => {
    if (!isEnabled) return;

    let initTimer = setTimeout(() => {
      // Load initial mock date from cookie
      const match = document.cookie.match(/(?:^|;\s*)dev_mock_date=([^;]+)/);
      if (match) {
        try {
          const decoded = decodeURIComponent(match[1]);
          if (decoded.startsWith('{') && decoded.endsWith('}')) {
            const parsed = JSON.parse(decoded);
            const target = parsed.target || parsed.iso || parsed.date;
            setIsFrozen(parsed.frozen === true);
            if (target) {
              const d = new Date(target);
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const hours = String(d.getHours()).padStart(2, '0');
              const minutes = String(d.getMinutes()).padStart(2, '0');
              setMockDate(`${year}-${month}-${day}T${hours}:${minutes}`);
            }
          } else {
            const d = new Date(decoded);
            if (!isNaN(d.getTime())) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const hours = String(d.getHours()).padStart(2, '0');
              const minutes = String(d.getMinutes()).padStart(2, '0');
              setMockDate(`${year}-${month}-${day}T${hours}:${minutes}`);
              setIsFrozen(true);
            }
          }
        } catch (e) {
          console.error("Failed to parse mock date cookie", e);
        }
      }
    }, 0);

    const updateDisplay = () => {
      const realNow = Clock.getRealNow();
      const appNow = Clock.now();
      const isTraveling = Clock.isTimeTraveling();
      const offsetMs = Clock.getOffset();

      setRealDisplay(formatDateTime(realNow, { showSeconds: true }));
      setAppDisplay(formatDateTime(appNow, { showSeconds: true }));

      // Active Period
      const period = Clock.currentPeriod(appNow);
      const parts = Clock.getISTParts(appNow);
      if (parts.dayOfWeek === 0) {
        setActivePeriodText('Sunday (Weekend)');
      } else if (period) {
        setActivePeriodText(`Period ${period} Active`);
      } else {
        setActivePeriodText('Outside College Hours');
      }

      // Status Badge and Offset
      if (!isTraveling) {
        setStatusBadge({
          text: 'REAL TIME',
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        });
        setOffsetText('0ms (Synchronized)');
      } else {
        const isFuture = offsetMs > 0;
        const absOffsetSec = Math.floor(Math.abs(offsetMs) / 1000);
        const days = Math.floor(absOffsetSec / 86400);
        const hours = Math.floor((absOffsetSec % 86400) / 3600);
        const minutes = Math.floor((absOffsetSec % 3600) / 60);
        const seconds = absOffsetSec % 60;

        let formattedOffset = '';
        if (days > 0) formattedOffset += `${days}d `;
        if (hours > 0) formattedOffset += `${hours}h `;
        if (minutes > 0) formattedOffset += `${minutes}m `;
        formattedOffset += `${seconds}s`;

        setOffsetText(`${isFuture ? '+' : '-'}${formattedOffset}`);

        if (isFuture) {
          setStatusBadge({
            text: 'FUTURE TRAVEL',
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          });
        } else {
          setStatusBadge({
            text: 'PAST TRAVEL',
            color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          });
        }
      }
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);
    return () => {
      clearInterval(interval);
      if (initTimer) clearTimeout(initTimer);
    };
  }, [isEnabled]);

  if (!isEnabled) {
    return (
      <>
        <HeaderMobileView />
        <Header />
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="text-center">
            <h1 className="text-4xl font-black text-red-500 mb-4">403 - Forbidden</h1>
            <p className="text-gray-400 font-medium">Developer Time Machine is disabled in this environment.</p>
            <Link href="/" className="mt-6 inline-block bg-blue-600 px-4 sm:px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs">Return Home</Link>
          </div>
        </div>
      </>
    );
  }

  const setTime = (dateTimeStr, forceFrozen = false) => {
    if (!dateTimeStr) {
      document.cookie = "dev_mock_date=; path=/; max-age=0";
      toast.success("Clock restored to real system time");
      setMockDate('');
    } else {
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) {
        toast.error("Invalid date selected");
        return;
      }

      const payload = {
        target: date.toISOString(),
        setAt: Date.now(),
        frozen: forceFrozen || isFrozen,
      };

      const cookieVal = encodeURIComponent(JSON.stringify(payload));
      document.cookie = `dev_mock_date=${cookieVal}; path=/; max-age=86400`;
      toast.success(`Time traveled to ${formatDateTime(date)}`);
      setMockDate(dateTimeStr);
    }
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <>
      <HeaderMobileView />
      <Header />
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-[#1a1a1a] p-4 sm:p-10 rounded-[2.5rem] shadow-2xl border border-white/5 max-w-lg w-full relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 blur-[100px] rounded-full"></div>

          <div className="flex items-center justify-between mb-2 relative z-10">
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              🕒 Time Machine
            </h1>
            <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-black border ${statusBadge.color}`}>
              {statusBadge.text}
            </span>
          </div>
          <p className="text-gray-400 text-xs mb-6 font-medium leading-relaxed">
            Temporal simulation authority for KUCET CMS. Controls business logic, lecture period detection, and academic calendar while preserving real DB audit timestamps.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Real System Clock</label>
              <div className="text-sm font-black text-gray-300 tracking-tight tabular-nums">
                {realDisplay}
              </div>
            </div>

            <div className="bg-blue-950/30 p-4 rounded-2xl border border-blue-500/20 backdrop-blur-md">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Application Clock</label>
              <div className="text-sm font-black text-white tracking-tight tabular-nums">
                {appDisplay}
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 mb-6 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Timetable Status</span>
              <span className="font-bold text-emerald-400">{activePeriodText}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Temporal Offset</span>
              <span className="font-mono font-bold text-gray-300">{offsetText}</span>
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Date & Time</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-gray-400 select-none">
                  <input
                    type="checkbox"
                    checked={isFrozen}
                    onChange={(e) => setIsFrozen(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-blue-600 focus:ring-0"
                  />
                  <span>Freeze Moment</span>
                </label>
              </div>
              <input
                type="datetime-local"
                value={mockDate}
                onChange={(e) => setMockDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 ring-blue-500 outline-none font-bold transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setTime(mockDate)} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-blue-900/20"
              >
                Set Simulated Time
              </button>
              <button 
                onClick={() => setTime('')} 
                className="bg-white/5 hover:bg-white/10 text-gray-300 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl transition-all active:scale-95 border border-white/10"
              >
                Reset to Real Time
              </button>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h3 className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">Timetable & Academic Presets</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button onClick={() => setTime('2026-03-10T09:30')} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left transition-all">
                  <div className="text-xs font-bold text-white">Period 1 (Start)</div>
                  <div className="text-[10px] text-gray-400">10-03-2026 • 09:30 AM</div>
                </button>

                <button onClick={() => setTime('2026-03-10T11:15')} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left transition-all">
                  <div className="text-xs font-bold text-white">Tea Break</div>
                  <div className="text-[10px] text-gray-400">10-03-2026 • 11:15 AM</div>
                </button>

                <button onClick={() => setTime('2026-03-10T11:30')} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left transition-all">
                  <div className="text-xs font-bold text-white">Period 3</div>
                  <div className="text-[10px] text-gray-400">10-03-2026 • 11:30 AM</div>
                </button>

                <button onClick={() => setTime('2026-03-10T13:30')} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left transition-all">
                  <div className="text-xs font-bold text-white">Lunch Break</div>
                  <div className="text-[10px] text-gray-400">10-03-2026 • 01:30 PM</div>
                </button>

                <button onClick={() => setTime('2026-03-10T14:15')} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left transition-all">
                  <div className="text-xs font-bold text-white">Period 5</div>
                  <div className="text-[10px] text-gray-400">10-03-2026 • 02:15 PM</div>
                </button>

                <button onClick={() => setTime('2026-03-10T17:00')} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left transition-all">
                  <div className="text-xs font-bold text-white">After College Hours</div>
                  <div className="text-[10px] text-gray-400">10-03-2026 • 05:00 PM</div>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center flex items-center justify-center gap-4">
            <Link href="/staff/faculty/dashboard" className="text-[10px] font-black text-blue-400/80 hover:text-blue-400 uppercase tracking-widest transition-colors">&larr; Faculty Console</Link>
            <span className="text-gray-600">•</span>
            <Link href="/student" className="text-[10px] font-black text-blue-400/80 hover:text-blue-400 uppercase tracking-widest transition-colors">Student Portal &rarr;</Link>
          </div>
        </div>
      </div>
    </>
  );
}
