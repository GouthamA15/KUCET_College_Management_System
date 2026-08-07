'use client';

import React from 'react';
import Link from 'next/link';
import { WifiOff, CreditCard, Calendar, User } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6 bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-xl backdrop-blur">
        <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
          <WifiOff className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">You are Offline</h1>
          <p className="text-sm text-slate-400">
            Internet connection unavailable. You can still access your saved offline academic resources below.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2">
          <Link
            href="/student/requests/id-card"
            className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600/50 transition-colors text-left"
          >
            <User className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold">Digital ID Card</div>
              <div className="text-xs text-slate-400">View offline identity card</div>
            </div>
          </Link>

          <Link
            href="/student/finances"
            className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600/50 transition-colors text-left"
          >
            <CreditCard className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold">Fee Receipts</div>
              <div className="text-xs text-slate-400">View saved payment history</div>
            </div>
          </Link>

          <Link
            href="/student/academics"
            className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600/50 transition-colors text-left"
          >
            <Calendar className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold">Weekly Timetable</div>
              <div className="text-xs text-slate-400">Check class schedules</div>
            </div>
          </Link>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 font-medium rounded-xl text-sm transition-colors"
        >
          Try Reconnecting
        </button>
      </div>
    </div>
  );
}
