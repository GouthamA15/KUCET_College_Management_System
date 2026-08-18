"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/date';

export default function ScholarshipMetricsCards({ refreshToken = 0 }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchMetrics() {
      setLoading(true);
      try {
        const res = await fetch('/api/staff/scholarship/metrics');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load metrics');
        if (isMounted) setMetrics(data);
      } catch (err) {
        console.error(err);
        toast.error(err.message || 'Failed to load scholarship metrics');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchMetrics();
    return () => { isMounted = false; };
  }, [refreshToken]);

  const windowStatus = metrics?.windowStatus || 'CLOSED';
  const isWindowOpen = String(windowStatus).toUpperCase() === 'OPEN';

  const items = [
    {
      key: 'pendingHardCopies',
      label: 'Pending Hard Copies',
      value: metrics?.pendingHardCopies ?? '--',
      suffix: 'Students',
      accent: 'border-l-amber-400',
    },
    {
      key: 'pendingThumbs',
      label: 'Pending Thumb Updates',
      value: metrics?.pendingThumbs ?? '--',
      suffix: 'Students',
      accent: 'border-l-orange-400',
    },
    {
      key: 'totalRecords',
      label: 'Total Scholarship Records',
      value: metrics?.totalRecords ?? '--',
      suffix: 'Records',
      accent: 'border-l-slate-300',
    },
    {
      key: 'windowStatus',
      label: 'Submission Window Status',
      value: windowStatus,
      suffix: metrics?.windowEndDate ? `Until ${formatDate(metrics.windowEndDate)}` : null,
      accent: isWindowOpen ? 'border-l-emerald-400' : 'border-l-rose-400',
      valueTone: isWindowOpen ? 'text-emerald-700' : 'text-rose-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {items.map((item) => (
        <div
          key={item.key}
          className={`bg-white p-4 px-5 rounded-xl border border-slate-200 border-l-4 ${item.accent} shadow-sm flex flex-col justify-between h-24`}
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-2xl font-extrabold tracking-tight ${item.valueTone || 'text-slate-800'}`}>
              {loading ? (
                <span className="inline-block h-6 w-12 bg-slate-50 rounded animate-pulse" />
              ) : (
                item.value
              )}
            </span>
            {item.suffix && !loading && (
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.suffix}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
