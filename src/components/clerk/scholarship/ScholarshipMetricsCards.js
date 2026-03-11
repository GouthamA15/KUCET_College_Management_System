"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ScholarshipMetricsCards() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchMetrics() {
      setLoading(true);
      try {
        const res = await fetch('/api/clerk/scholarship/metrics');
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
  }, []);

  const items = [
    {
      key: 'pendingHardCopies',
      label: 'Pending Hard Copies',
      value: metrics?.pendingHardCopies ?? '--',
      suffix: 'Students',
    },
    {
      key: 'pendingThumbs',
      label: 'Pending Thumb Updates',
      value: metrics?.pendingThumbs ?? '--',
      suffix: 'Students',
    },
    {
      key: 'totalRecords',
      label: 'Total Scholarship Records',
      value: metrics?.totalRecords ?? '--',
      suffix: 'Records',
    },
    {
      key: 'windowStatus',
      label: 'Submission Window Status',
      value: metrics?.windowStatus || 'CLOSED',
      suffix: metrics?.windowEndDate ? `Until ${metrics.windowEndDate}` : null,
    },
  ];

  return (
    <section className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-indigo-100 shadow-sm bg-white p-5 flex flex-col justify-between min-h-[96px]"
          >
            <div className="text-sm text-gray-500 mb-1">{item.label}</div>
            <div className="text-2xl font-bold text-indigo-700">
              {loading ? (
                <span className="inline-block h-6 w-16 bg-indigo-50 rounded animate-pulse" />
              ) : (
                item.value
              )}
            </div>
            {item.suffix && !loading && (
              <div className="mt-1 text-xs text-gray-500">{item.suffix}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
