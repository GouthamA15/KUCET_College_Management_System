'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Trophy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_STREAK_EMOJI } from '@/lib/streak-config';

export default function StreakRewardsModal({
  isOpen,
  onClose,
  streakData,
  onEmojiSelected,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const currentStreak = streakData?.currentStreak || 0;
  const longestStreak = streakData?.longestStreak || 0;
  const selectedEmoji = streakData?.selectedEmoji || DEFAULT_STREAK_EMOJI;
  const unlockedMilestones = streakData?.unlockedMilestones || [];

  const handleSelectDefault = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: DEFAULT_STREAK_EMOJI.char,
          emoji_code: DEFAULT_STREAK_EMOJI.code,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to select emoji');
      toast.success('Default Flame emoji activated!');
      if (onEmojiSelected) onEmojiSelected({ char: DEFAULT_STREAK_EMOJI.char, code: DEFAULT_STREAK_EMOJI.code });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectMilestone = async (milestone) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: milestone.emoji_char,
          emoji_code: milestone.emoji_code,
          milestone_id: milestone.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to select custom emoji');
      toast.success(`${milestone.title} emoji activated!`);
      if (onEmojiSelected) onEmojiSelected({ char: milestone.emoji_char, code: milestone.emoji_code });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-[#0b3578]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">
                Streak Emojis & Milestones
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Current: <span className="font-bold text-[#0b3578]">{currentStreak} classes</span> • Best: <span className="font-bold text-slate-700">{longestStreak} classes</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Active Selection Display */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-3xl select-none leading-none">{selectedEmoji.char}</span>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Display Emoji
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {selectedEmoji.char === DEFAULT_STREAK_EMOJI.char ? DEFAULT_STREAK_EMOJI.name : 'Custom Milestone Reward'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          </div>

          {/* Collection Grid */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Available Streak Rewards</span>
              <span className="text-[10px] font-semibold text-slate-500">
                {1 + unlockedMilestones.length} available
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Default Flame Option */}
              <div
                onClick={!isSubmitting ? handleSelectDefault : undefined}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  selectedEmoji.char === DEFAULT_STREAK_EMOJI.char
                    ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl select-none">{DEFAULT_STREAK_EMOJI.char}</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      {DEFAULT_STREAK_EMOJI.name}
                      <span className="text-[10px] font-semibold text-slate-400">• Default</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Standard attendance flame awarded to all students.
                    </div>
                  </div>
                </div>
                {selectedEmoji.char === DEFAULT_STREAK_EMOJI.char ? (
                  <Check className="w-4 h-4 text-blue-600" />
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Select
                  </button>
                )}
              </div>

              {/* Unlocked Milestones (if any) */}
              {unlockedMilestones.map((m) => {
                const isSelected = selectedEmoji.char === m.emoji_char;
                return (
                  <div
                    key={m.id || m.milestone_code}
                    onClick={!isSubmitting ? () => handleSelectMilestone(m) : undefined}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl select-none">{m.emoji_char}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {m.title}
                          <span className="text-[10px] font-semibold text-emerald-600">• Unlocked</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {m.description || `Awarded for achieving ${m.required_streak} consecutive classes.`}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-blue-600" />
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Select
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty / Institutional Notice */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
              Institutional Milestones & Custom Artwork
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Official attendance streak tiers and custom emoji artwork will be announced by college administration. All attended classes are actively verified in your sequence and will count towards milestone tiers as they are published.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
