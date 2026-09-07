import React from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight, ShieldCheck, HelpCircle, BookOpen, Layers } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/" className="hover:text-slate-700 transition-colors">
            KUCET CMS
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">Campus Events & Tournaments</span>
        </div>

        {/* Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              Campus Events & Technical Competitions
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Official collegiate academic symposiums, technical assessments, and tournament championships of Kakatiya University College of Engineering and Technology.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#0b3578] border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Official KUCET Event Portal
            </span>
          </div>
        </header>

        {/* Notice Banner */}
        <div className="bg-blue-50 border border-blue-200 text-[#0b3578] px-4 py-3 rounded-lg text-sm font-medium flex items-start gap-2 shadow-xs">
          <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Select an active event below to view event details, rules, registration status, or enter the competition arena. Ensure you have your Roll Number / Hall Ticket ready for participation.
          </span>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Technical Quiz Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0b3578] border border-blue-200">
                  Technical Symposium
                </span>
                <span
                  className={`
                    px-2.5 py-0.5 rounded-full text-xs font-medium border
                    ${
                      isQuizEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }
                  `}
                >
                  {isQuizEnabled ? 'Active / Open' : 'Inactive'}
                </span>
              </div>

              <h2 className="text-lg font-semibold text-gray-800">
                {quizConfig?.event_name || 'KUCET Technical Quiz Championship'}
              </h2>

              <p className="text-xs text-gray-600 leading-relaxed">
                Timed technical assessment covering Core Computer Science concepts including Data Structures, Algorithms, Operating Systems, Computer Networks, and Database Systems.
              </p>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Duration:</span> <span className="font-semibold text-slate-700">15 Minutes</span>
                </div>
                <div>
                  <span className="text-slate-400">Format:</span> <span className="font-semibold text-slate-700">Multiple Choice</span>
                </div>
                <div>
                  <span className="text-slate-400">Scoring:</span> <span className="font-semibold text-slate-700">+2 / -0.5 Neg</span>
                </div>
                <div>
                  <span className="text-slate-400">Eligibility:</span> <span className="font-semibold text-slate-700">All Students</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              {isQuizEnabled ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/events/quiz"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-sm font-medium transition-colors shadow-xs"
                  >
                    <span>Enter Technical Quiz</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/events/quiz/leaderboard"
                    className="px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
                  >
                    Standings
                  </Link>
                </div>
              ) : (
                <div className="py-2.5 px-4 rounded-lg bg-slate-100 text-center text-xs font-medium text-slate-500">
                  Event Currently Inactive
                </div>
              )}
            </div>
          </div>

          {/* Chess Championship Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Mind Sports League
                </span>
                <span
                  className={`
                    px-2.5 py-0.5 rounded-full text-xs font-medium border
                    ${
                      isChessEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }
                  `}
                >
                  {isChessEnabled ? 'Active / Open' : 'Inactive'}
                </span>
              </div>

              <h2 className="text-lg font-semibold text-gray-800">
                {chessConfig?.event_name || 'KUCET Chess Championship'}
              </h2>

              <p className="text-xs text-gray-600 leading-relaxed">
                Official collegiate rapid chess tournament with standardized FIDE rules, live move tracking, round pairings, and arbiter-verified results.
              </p>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Time Control:</span> <span className="font-semibold text-slate-700">15m + 10s Rapid</span>
                </div>
                <div>
                  <span className="text-slate-400">Bracket:</span> <span className="font-semibold text-slate-700">Single Elimination</span>
                </div>
                <div>
                  <span className="text-slate-400">Rules:</span> <span className="font-semibold text-slate-700">Standard FIDE</span>
                </div>
                <div>
                  <span className="text-slate-400">Eligibility:</span> <span className="font-semibold text-slate-700">Students & Staff</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              {isChessEnabled ? (
                <Link
                  href="/events/chess"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-sm font-medium transition-colors shadow-xs"
                >
                  <span>Enter Chess Tournament</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <div className="py-2.5 px-4 rounded-lg bg-slate-100 text-center text-xs font-medium text-slate-500">
                  Event Currently Inactive
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modular Expansion Notice */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" /> Additional Tournament Categories
            </h3>
            <p className="text-xs text-slate-500">
              Future collegiate symposium competitions (Coding Hackathon, Carrom Championship, Academic Debates) will be listed here upon institutional schedule release.
            </p>
          </div>
          <span className="px-3 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium shrink-0">
            Upcoming Schedule
          </span>
        </div>
      </div>
    </div>
  );
}
