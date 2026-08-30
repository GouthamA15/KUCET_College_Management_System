'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { WifiOff, ServerCrash, RefreshCw, CheckCircle2, AlertTriangle, User, CreditCard, Calendar } from 'lucide-react';

function subscribeOnline(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getServerSnapshot() {
  return true;
}

export default function OfflineClient() {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // 'server_ok' | 'server_down' | null

  const testServerHealth = useCallback(async () => {
    setIsChecking(true);
    setCheckResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/health', {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setCheckResult('server_ok');
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 1200);
      } else {
        setCheckResult('server_down');
      }
    } catch (_err) {
      setCheckResult('server_down');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (isOnline) {
      const timer = setTimeout(() => {
        if (isMounted) {
          testServerHealth();
        }
      }, 50);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [isOnline, testServerHealth]);

  const handleManualReload = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('kucet_chunk_retry_ts');
      } catch (err) {
        void err;
      }
      window.location.reload();
    }
  };

  return (
    <div className="max-w-md w-full text-center space-y-6 bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-xl backdrop-blur">
      {/* Icon & Title based on diagnosed state */}
      {!isOnline ? (
        <>
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">You are Offline</h1>
            <p className="text-sm text-slate-400">
              Your device is not connected to the internet. You can still access saved offline shortcuts below.
            </p>
          </div>
        </>
      ) : checkResult === 'server_ok' ? (
        <>
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Connection Restored</h1>
            <p className="text-sm text-emerald-400">
              Campus server is reachable. Reloading portal...
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto">
            <ServerCrash className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Server Temporarily Unreachable</h1>
            <p className="text-sm text-slate-400">
              Your internet is active, but the KUCET campus server or Tailscale network endpoint is momentarily reconnecting.
            </p>
          </div>
        </>
      )}

      {/* Diagnostics / Status indicator */}
      {isOnline && checkResult === 'server_down' && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-300">
            <span className="font-semibold">Tailscale / Server Status:</span> Reconnecting or under deployment restart. Please wait a few seconds and try again.
          </div>
        </div>
      )}

      {/* Quick offline shortcuts */}
      <div className="grid grid-cols-1 gap-3 pt-2">
        <Link
          href="/student/requests/id-card"
          className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600/50 transition-colors text-left"
        >
          <User className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-white">Digital ID Card</div>
            <div className="text-xs text-slate-400">View offline identity card</div>
          </div>
        </Link>

        <Link
          href="/student/finances"
          className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600/50 transition-colors text-left"
        >
          <CreditCard className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-white">Fee Receipts</div>
            <div className="text-xs text-slate-400">View saved payment history</div>
          </div>
        </Link>

        <Link
          href="/student/academics"
          className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl border border-slate-600/50 transition-colors text-left"
        >
          <Calendar className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-white">Weekly Timetable</div>
            <div className="text-xs text-slate-400">Check class schedules</div>
          </div>
        </Link>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={testServerHealth}
          disabled={isChecking}
          className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Test Connection'}
        </button>

        <button
          onClick={handleManualReload}
          className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-sm transition-colors cursor-pointer"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
