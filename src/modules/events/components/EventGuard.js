'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function EventGuard({
  eventKey = 'chess',
  children,
  fallback = null,
  isAdmin = false
}) {
  const [isEnabled, setIsEnabled] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const res = await fetch(`/api/events/config?event_key=${eventKey}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await res.json();
        if (isMounted) {
          setIsEnabled(Boolean(data?.is_enabled));
        }
      } catch (_err) {
        if (isMounted) setIsEnabled(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [eventKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Checking Event Availability...</p>
      </div>
    );
  }

  // Admins bypass the guard to manage/preview
  if (isEnabled || isAdmin) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-600">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Event Inactive
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          The KUCET Chess Championship is currently disabled or has not commenced yet. Please check back later or contact the student affairs council.
        </p>
      </div>
      <div className="pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Home
        </Link>
      </div>
    </div>
  );
}
