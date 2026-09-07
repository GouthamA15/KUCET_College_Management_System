import React from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight, ShieldCheck, Sparkles, Zap, Brain } from 'lucide-react';
import { EventConfigService } from '@/modules/events/services/EventConfigService';

export const dynamic = 'force-dynamic';

export default async function EventsCatalogPage() {
  let chessConfig = null;
  let quizConfig = null;

  try {
    chessConfig = await EventConfigService.getEventConfig('chess');
  } catch (_e) {
    chessConfig = { is_enabled: false };
  }

  try {
    quizConfig = await EventConfigService.getEventConfig('quiz');
  } catch (_e) {
    quizConfig = { is_enabled: false };
  }

  const isChessEnabled = Boolean(chessConfig?.is_enabled);
  const isQuizEnabled = Boolean(quizConfig?.is_enabled);

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
            Official competitive collegiate gaming, technical symposiums, and mind sports leagues for Kakatiya University students and faculty.
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

          {/* Technical Quiz Event Card */}
          <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between space-y-8 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-6 translate-y-6">
              <Zap className="w-64 h-64" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 bg-cyan-400/20 px-3 py-1 rounded-full border border-cyan-400/30">
                  Technical Symposium
                </span>
                <span
                  className={`
                    px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                    ${isQuizEnabled ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' : 'bg-white/10 text-slate-300'}
                  `}
                >
                  {isQuizEnabled ? '● Live Assessment' : 'Inactive'}
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight">
                {quizConfig?.event_name || 'Technical Quiz Championship'}
              </h2>

              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
                Timed competitive assessment covering DSA, Operating Systems, Networks, DB Architecture, and System Design with real-time scoring.
              </p>
            </div>

            <div className="relative z-10">
              {isQuizEnabled ? (
                <Link
                  href="/events/quiz"
                  className="inline-flex items-center justify-between w-full px-5 py-3 rounded-2xl bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-cyan-300 shadow-lg shadow-cyan-400/20 transition-all cursor-pointer"
                >
                  <span>Enter Technical Quiz</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <div className="py-3 px-4 rounded-2xl bg-white/10 text-center text-xs font-bold text-blue-200">
                  Currently Disabled by Administration
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Future Expansion Placeholder */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 opacity-60">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-0.5 rounded-full">
              Modular Expansion Slot
            </span>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Future Tournaments (Carrom, Coding Hackathon, Volleyball)
            </h3>
            <p className="text-xs text-slate-400">
              Additional multiplayer collegiate games will be activated for campus fests.
            </p>
          </div>

          <div className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-bold text-slate-400 shrink-0">
            Registration Not Open
          </div>
        </div>
      </div>
    </div>
  );
}
