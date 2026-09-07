'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowLeft, RefreshCw, Calendar } from 'lucide-react';
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
        <RefreshCw className="w-8 h-8 text-[#0b3578] animate-spin mb-3" />
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
    <div className="w-full max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-xl shadow-sm text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
        <Calendar className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Event Currently Inactive
        </h2>
        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-md mx-auto">
          This collegiate tournament module is currently inactive or scheduled for a future session. Please check back later or contact the student affairs council for official schedules.
        </p>
      </div>
      <div className="pt-2">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> View All Campus Events
        </Link>
      </div>
    </div>
  );
}
