import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, BookOpen } from 'lucide-react';
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
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Page Header — standard KUCET layout */}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-800">Campus Events & Tournaments</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-blue-50 text-[#0b3578] border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Official KUCET Event Portal
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Official collegiate academic symposiums, technical assessments, and tournament championships of Kakatiya University College of Engineering & Technology.
        </p>
      </header>

      {/* Notice Banner */}
      {!isChessEnabled && !isQuizEnabled ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-md text-sm font-medium flex items-start gap-2 shadow-xs">
          <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <span>
            All collegiate tournaments and assessment events are currently closed or undergoing administrative scheduling. Please check back when new events are activated by the administration.
          </span>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 text-[#0b3578] px-4 py-3 rounded-md text-sm font-medium flex items-start gap-2 shadow-xs">
          <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Select an active event below to view event details, rules, registration status, or enter the competition arena. Registration is automatic and authenticated via your student session.
          </span>
        </div>
      )}

      {/* Events Grid — standard KUCET cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Technical Quiz Card */}
        <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#0b3578] border border-blue-200 uppercase tracking-wide">
                Technical Symposium
              </span>
              <span
                className={`
                  px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide border
                  ${
                    isQuizEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }
                `}
              >
                {isQuizEnabled ? 'Active / Open' : 'Inactive'}
              </span>
            </div>

            <h2 className="text-base font-semibold text-gray-800">
              {quizConfig?.event_name || 'KUCET Technical Quiz Championship'}
            </h2>

            <p className="text-xs text-gray-600 leading-relaxed">
              Timed technical assessment covering Core Computer Science concepts including Data Structures, Algorithms, Operating Systems, Computer Networks, and Database Systems.
            </p>

            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="text-gray-400">Duration:</span> <span className="font-semibold text-gray-700">15 Minutes</span>
              </div>
              <div>
                <span className="text-gray-400">Format:</span> <span className="font-semibold text-gray-700">Multiple Choice</span>
              </div>
              <div>
                <span className="text-gray-400">Scoring:</span> <span className="font-semibold text-gray-700">+2 / -0.5 Neg</span>
              </div>
              <div>
                <span className="text-gray-400">Eligibility:</span> <span className="font-semibold text-gray-700">All Students</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            {isQuizEnabled ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/events/quiz"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs sm:text-sm font-medium transition-colors shadow-xs"
                >
                  <span>Enter Technical Quiz</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/events/quiz/leaderboard"
                  className="px-3.5 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-medium transition-colors"
                >
                  Standings
                </Link>
              </div>
            ) : (
              <div className="py-2 px-3 rounded-md bg-gray-100 text-center text-xs font-medium text-gray-500">
                Event Currently Inactive
              </div>
            )}
          </div>
        </div>

        {/* Chess Championship Card */}
        <div className="bg-white border border-gray-300 rounded-sm p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wide">
                Mind Sports League
              </span>
              <span
                className={`
                  px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide border
                  ${
                    isChessEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }
                `}
              >
                {isChessEnabled ? 'Active / Open' : 'Inactive'}
              </span>
            </div>

            <h2 className="text-base font-semibold text-gray-800">
              {chessConfig?.event_name || 'KUCET Chess Championship'}
            </h2>

            <p className="text-xs text-gray-600 leading-relaxed">
              Official collegiate rapid chess tournament with standardized FIDE rules, live move tracking, round pairings, and arbiter-verified results.
            </p>

            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="text-gray-400">Time Control:</span> <span className="font-semibold text-gray-700">15m + 10s Rapid</span>
              </div>
              <div>
                <span className="text-gray-400">Bracket:</span> <span className="font-semibold text-gray-700">Single Elimination</span>
              </div>
              <div>
                <span className="text-gray-400">Rules:</span> <span className="font-semibold text-gray-700">Standard FIDE</span>
              </div>
              <div>
                <span className="text-gray-400">Eligibility:</span> <span className="font-semibold text-gray-700">Students & Staff</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            {isChessEnabled ? (
              <Link
                href="/events/chess"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs sm:text-sm font-medium transition-colors shadow-xs"
              >
                <span>Enter Chess Tournament</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="py-2 px-3 rounded-md bg-gray-100 text-center text-xs font-medium text-gray-500">
                Event Currently Inactive
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
