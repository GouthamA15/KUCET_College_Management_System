'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Trophy, Check, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_STREAK_EMOJI } from '@/lib/streak-config';

export default function StreakRewardsModal({
  isOpen,
  onClose,
  streakData,
  onEmojiSelected,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('milestones'); // 'milestones' | 'badges'

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const currentStreak = streakData?.currentStreak || 0;
  const longestStreak = streakData?.longestStreak || 0;
  const selectedEmoji = streakData?.selectedEmoji || DEFAULT_STREAK_EMOJI;
  const unlockedMilestones = streakData?.unlockedMilestones || [];
  const recognitionBadges = streakData?.recognitionBadges || [];
  const allMilestones = streakData?.allMilestones && streakData.allMilestones.length > 0
    ? streakData.allMilestones
    : unlockedMilestones.map((m) => ({ ...m, isUnlocked: true, remainingClasses: 0 }));

  const unlockedCount = allMilestones.filter((m) => m.isUnlocked).length;

  const activeMilestoneMatch = allMilestones.find(
    (m) => m.isUnlocked && m.emoji_code === selectedEmoji.code && m.emoji_char === selectedEmoji.char
  );
  const activeEmojiLabel = activeMilestoneMatch
    ? `${activeMilestoneMatch.title} (${activeMilestoneMatch.required_streak} classes)`
    : DEFAULT_STREAK_EMOJI.name;

  const isDefaultActive =
    selectedEmoji.code === DEFAULT_STREAK_EMOJI.code &&
    selectedEmoji.char === DEFAULT_STREAK_EMOJI.char;

  const handleSelectDefault = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/student/attendance/streak/select-emoji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji_char: DEFAULT_STREAK_EMOJI.char,
          emoji_code: DEFAULT_STREAK_EMOJI.code,
          milestone_id: null,
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
    if (!milestone.isUnlocked || !milestone.id) return;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-rewards-modal-title"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2 bg-gradient-to-r from-blue-50/60 to-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0b3578]/10 text-[#0b3578] flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-5 h-5 text-[#0b3578]" />
            </div>
            <div className="min-w-0">
              <h3 id="streak-rewards-modal-title" className="text-base font-bold text-slate-800 leading-tight truncate">
                Streak Emojis & Milestones
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Current: <span className="font-bold text-[#0b3578]">{currentStreak} classes</span> • Best: <span className="font-bold text-slate-700">{longestStreak} classes</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Active Selection Display */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl select-none leading-none shrink-0">{selectedEmoji.char}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Display Emoji
                </div>
                <div className="text-sm font-bold text-slate-800 truncate">
                  {activeEmojiLabel}
                </div>
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          </div>

          {/* Collection Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('milestones')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'milestones'
                  ? 'bg-[#0b3578] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Streak Emojis ({unlockedCount}/{allMilestones.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('badges')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'badges'
                  ? 'bg-[#0b3578] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Recognition Badges ({recognitionBadges.filter(b => b.unlocked).length}/{recognitionBadges.length})
            </button>
          </div>

          {activeTab === 'badges' ? (
            <div className="space-y-2.5">
              {recognitionBadges.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Recognition badges will appear as classes are recorded.</p>
              ) : (
                recognitionBadges.map((b) => (
                  <div
                    key={b.code}
                    className={`p-3 rounded-xl border flex items-start gap-3 ${
                      b.unlocked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/70 opacity-75'
                    }`}
                  >
                    <span className={`text-2xl select-none ${b.unlocked ? '' : 'grayscale opacity-60'}`}>{b.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                        <span>{b.title}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                          {b.category}
                        </span>
                        {b.unlocked && (
                          <span className="text-[10px] font-bold text-emerald-700">• Earned</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{b.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Milestone Emoji Collection</span>
              <span className="text-[10px] font-semibold text-slate-500">
                {unlockedCount} / {allMilestones.length} unlocked
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Default Flame Option */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSelectDefault}
                className={`w-full text-left p-3 sm:p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer disabled:opacity-60 ${
                  isDefaultActive
                    ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl select-none shrink-0">{DEFAULT_STREAK_EMOJI.char}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span>{DEFAULT_STREAK_EMOJI.name}</span>
                      <span className="text-[10px] font-semibold text-slate-400">• Default</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Standard attendance flame available to all students.
                    </div>
                  </div>
                </div>
                {isDefaultActive ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                    <Check className="w-4 h-4 text-blue-600" />
                    Active
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-blue-600">
                    Select
                  </span>
                )}
              </button>

              {/* Milestone Tiers (Unlocked & Locked) */}
              {allMilestones.map((m) => {
                const isUnlocked = Boolean(m.isUnlocked);
                const isSelected =
                  isUnlocked &&
                  selectedEmoji.char === m.emoji_char &&
                  selectedEmoji.code === m.emoji_code;

                if (isUnlocked) {
                  return (
                    <button
                      type="button"
                      key={m.id || m.milestone_code}
                      disabled={isSubmitting}
                      onClick={() => handleSelectMilestone(m)}
                      className={`w-full text-left p-3 sm:p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer disabled:opacity-60 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl select-none shrink-0">{m.emoji_char}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            <span>{m.title}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Unlocked • {m.required_streak} classes
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {m.description || `Achieved ${m.required_streak} consecutive attended classes.`}
                          </div>
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                          <Check className="w-4 h-4 text-blue-600" />
                          Active
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs font-semibold text-blue-600">
                          Select
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <div
                    key={m.id || m.milestone_code}
                    aria-disabled="true"
                    className="w-full p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-3 opacity-80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl select-none grayscale opacity-60 shrink-0">{m.emoji_char}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5 flex-wrap">
                          <span>{m.title}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                            {m.required_streak} classes
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {m.remainingClasses > 0
                            ? `${m.remainingClasses} more consecutive classes needed to unlock`
                            : m.description}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Recognition Info */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Streak badges recognize consecutive eligible timetable periods attended. They are non-academic recognition badges only.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
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
