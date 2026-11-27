'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, Calendar, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useStudent } from '@/context/StudentContext';
import StreakRewardsModal from './StreakRewardsModal';
import { DEFAULT_STREAK_EMOJI } from '@/lib/streak-config';

export default function AttendanceStreakCard() {
  const { streakData, refreshStreak } = useStudent();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentStreak = streakData?.currentStreak || 0;
  const longestStreak = streakData?.longestStreak || 0;
  const totalAttended = streakData?.totalAttendedClasses || 0;
  const totalEligible = streakData?.totalEligibleClasses || 0;
  const selectedEmoji = streakData?.selectedEmoji || DEFAULT_STREAK_EMOJI;
  const milestoneProgress = streakData?.milestoneProgress || null;
  const nextMilestone = streakData?.nextMilestone || null;
  const recentAchievement = streakData?.recentAchievement || null;

  return (
    <>
      <section className="rounded-xl lg:rounded-sm border border-slate-200 bg-white overflow-hidden shadow-xs">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-white px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg select-none leading-none shrink-0">
              {selectedEmoji.char}
            </span>
            <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.14em] sm:tracking-[0.18em] truncate">
              Attendance Streak & Milestones
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span>Emoji Collection</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Current Streak */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
              currentStreak > 0
                ? 'bg-gradient-to-br from-orange-50/60 to-amber-50/30 border-orange-200/90 shadow-2xs'
                : 'bg-slate-50/80 border-slate-200/80 text-slate-500'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Current Streak
                </span>
                <span className={`text-base select-none leading-none ${currentStreak > 0 ? 'motion-safe:animate-pulse' : 'grayscale opacity-60'}`}>
                  {selectedEmoji.char}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className={`text-3xl font-black tracking-tight leading-none ${
                  currentStreak > 0 ? 'text-orange-600' : 'text-slate-600'
                }`}>
                  {currentStreak}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  consecutive classes
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                {currentStreak > 0
                  ? 'Active sequence across all periods.'
                  : 'Streak reset. Attend your next class to reignite!'}
              </p>
            </div>

            {/* 2. Personal Best */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Personal Best
                </span>
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-black tracking-tight text-slate-800 leading-none">
                  {longestStreak}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  record classes
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                Highest verified consecutive attendance.
              </p>
            </div>

            {/* 3. Class Attendance Coverage */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Conducted Classes
                </span>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black tracking-tight text-slate-800 leading-none">
                  {totalAttended} <span className="text-slate-400 text-lg">/ {totalEligible}</span>
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                {totalEligible > 0
                  ? `${Math.round((totalAttended / totalEligible) * 100)}% of finalized semester periods attended.`
                  : 'Classes awaiting finalized attendance.'}
              </p>
            </div>
          </div>

          {/* Most Recent Achievement */}
          {recentAchievement && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-200/70 text-xs">
              <span className="flex items-center gap-1.5 text-amber-900 font-semibold truncate">
                <span className="text-sm select-none">{recentAchievement.emoji_char}</span>
                <span className="truncate">Latest Achievement: {recentAchievement.title}</span>
              </span>
              <span className="text-[10px] font-bold text-amber-700 shrink-0">
                {recentAchievement.required_streak} classes
              </span>
            </div>
          )}

          {/* Milestone Progress or Announcement Banner */}
          {nextMilestone && milestoneProgress ? (
            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-blue-900">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm select-none leading-none">{nextMilestone.emoji_char}</span>
                  <span>Next: {nextMilestone.title}</span>
                </span>
                <span className="text-[11px] font-extrabold text-blue-700 tabular-nums">
                  {milestoneProgress.current} / {milestoneProgress.target} classes
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-[#0b3578] rounded-full transition-all duration-500"
                  style={{ width: `${milestoneProgress.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-blue-800/80">
                <span>{milestoneProgress.remaining} more consecutive classes to unlock</span>
                <Link
                  href="/student/academics?tab=attendance"
                  className="font-bold text-[#0b3578] hover:underline shrink-0 inline-flex items-center gap-1"
                >
                  Full Class Timeline <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span className="text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Streak actively tracked across all daily timetable periods.
              </span>
              <Link
                href="/student/academics?tab=attendance"
                className="text-[11px] font-bold text-[#0b3578] hover:underline shrink-0 inline-flex items-center gap-1"
              >
                Full Class Timeline <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Rewards Collection Modal */}
      <StreakRewardsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        streakData={streakData}
        onEmojiSelected={refreshStreak}
      />
    </>
  );
}
