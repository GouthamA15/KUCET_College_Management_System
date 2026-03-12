"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';

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
        const res = await fetch('/api/clerk/scholarship/window');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load window');
        const win = data.window;
        if (isMounted && win) {
          setHasWindow(true);
          setStartDate(win.startDate || '');
          setEndDate(win.endDate || '');
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
      const res = await fetch('/api/clerk/scholarship/window', {
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
      const res = await fetch('/api/clerk/scholarship/window', {
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
    <section className="mt-6">
      <div className="rounded-xl border border-indigo-100 shadow-sm bg-white p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Scholarship Submission Window</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure the active period for accepting scholarship applications.
            </p>
          </div>
          <div className="text-sm font-semibold">
            <span className="mr-2 text-gray-500">Status:</span>
            <span className={status === 'OPEN' ? 'text-green-700' : 'text-red-600'}>
              {status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={disabled}
            />
          </div>
        </div>

        {hasWindow && (
          <div className="mb-4 text-xs text-gray-500">
            Current window: {formatDate(startDate)}  {formatDate(endDate)}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Window'}
          </button>
          <button
            type="button"
            onClick={handleExtend}
            disabled={disabled || !hasWindow}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md disabled:opacity-60"
          >
            Extend Deadline (+7 days)
          </button>
        </div>
      </div>
    </section>
  );
}
