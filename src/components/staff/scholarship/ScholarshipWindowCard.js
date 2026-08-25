"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatDate, toMySQLDate } from '@/lib/date';

export default function ScholarshipWindowCard({ onWindowUpdated }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('CLOSED');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasWindow, setHasWindow] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchWindow() {
      setLoading(true);
      try {
        const res = await fetch('/api/staff/scholarship/window');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load window');
        const win = data.window;
        if (isMounted && win) {
          setHasWindow(true);
          setStartDate(toMySQLDate(win.startDate) || '');
          setEndDate(toMySQLDate(win.endDate) || '');
          setStatus(win.status || 'CLOSED');
        } else if (isMounted) {
          setHasWindow(false);
          setStatus('CLOSED');
        }
      } catch (err) {
        console.error(err);
        toast.error(err.message || 'Failed to load scholarship window');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchWindow();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/staff/scholarship/window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save window');
      const win = data.window;
      setHasWindow(true);
      setStartDate(win.startDate);
      setEndDate(win.endDate);
      setStatus(win.status || 'CLOSED');
      if (typeof onWindowUpdated === 'function') onWindowUpdated();
      toast.success('Scholarship submission window saved');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save scholarship window');
    } finally {
      setSaving(false);
    }
  };

  const handleExtend = async () => {
    if (!endDate) return;
    const current = new Date(endDate);
    if (Number.isNaN(current.getTime())) {
      toast.error('Current end date is invalid');
      return;
    }
    const extended = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    const iso = extended.toISOString().slice(0, 10);
    setEndDate(iso);
    setSaving(true);
    try {
      const res = await fetch('/api/staff/scholarship/window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: startDate || iso, endDate: iso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extend deadline');
      const win = data.window;
      setHasWindow(true);
      setStartDate(win.startDate);
      setEndDate(win.endDate);
      setStatus(win.status || 'CLOSED');
      if (typeof onWindowUpdated === 'function') onWindowUpdated();
      toast.success('Scholarship window deadline extended');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to extend scholarship window');
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || loading;

  return (
    <section className="bg-white rounded-md border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Scholarship Window Management</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              `text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ` +
              (status === 'OPEN'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200')
            }
          >
            {status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="sr-only">Start Date</label>
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578]/30"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="sr-only">End Date</label>
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3578]/20 focus:border-[#0b3578]/30"
            disabled={disabled}
          />
        </div>
      </div>

      {hasWindow && (
        <div className="mt-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {formatDate(startDate)} — {formatDate(endDate)}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled}
          className="px-4 py-2.5 bg-[#0b3578] text-white text-[11px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-[#0b3578]/15 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {saving ? 'Saving…' : 'Save Window'}
        </button>
        <button
          type="button"
          onClick={handleExtend}
          disabled={disabled || !hasWindow}
          className="px-4 py-2.5 bg-white text-slate-700 text-[11px] font-bold uppercase tracking-widest rounded-md border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
        >
          Extend (+7 days)
        </button>
      </div>
    </section>
  );
}
