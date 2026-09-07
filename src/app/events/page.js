import React from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { EventConfigService } from '@/modules/events/services/EventConfigService';

export const dynamic = 'force-dynamic';

export default async function EventsCatalogPage() {
  let chessConfig = null;
  try {
    chessConfig = await EventConfigService.getEventConfig('chess');
  } catch (_e) {
    chessConfig = { is_enabled: false };
  }

  const isChessEnabled = Boolean(chessConfig?.is_enabled);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5" /> Campus Activities & Esports
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            KUCET Tournament Hub
          </h1>
          <p className="text-sm text-slate-500 max-w-xl mt-1">
            Official competitive collegiate gaming and mind sports leagues for Kakatiya University students and faculty.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chess Event Card */}
          <div className="bg-gradient-to-br from-[#002A5C] via-[#0b3578] to-[#1e498c] rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between space-y-8 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-6 translate-y-6">
              <Trophy className="w-64 h-64" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/30">
                  Mind Sports Championship
                </span>
                <span
                  className={`
                    px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                    ${isChessEnabled ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' : 'bg-white/10 text-slate-300'}
                  `}
                >
                  {isChessEnabled ? '● Live Event' : 'Inactive'}
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight">
                {chessConfig?.event_name || 'KUCET Chess Championship'}
              </h2>

              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
                Compete in rapid chess tournament brackets with official FIDE rules, live interactive boards, and verified rankings.
              </p>
            </div>

            <div className="relative z-10">
              {isChessEnabled ? (
                <Link
                  href="/events/chess"
                  className="inline-flex items-center justify-between w-full px-5 py-3 rounded-2xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-300 shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
                >
                  <span>Enter Chess Tournament</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <div className="py-3 px-4 rounded-2xl bg-white/10 text-center text-xs font-bold text-blue-200">
                  Currently Disabled by Administration
                </div>
              )}
            </div>
          </div>

          {/* Reserved Slot for Future Games */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-8 opacity-60">
            <div className="space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                Modular Expansion Slot
              </span>
              <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                Future Tournament 2
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Additional multiplayer collegiate games will be activated for campus fests and technical symposiums.
              </p>
            </div>

            <div className="py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-bold text-slate-400">
              Registration Not Open
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
