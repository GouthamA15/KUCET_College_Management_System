'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  Trophy,
  HelpCircle,
  ArrowRight,
  Home,
  Check,
  Zap,
  Info,
  Layers,
} from 'lucide-react';

export default function QuizPlayerView({
  session: initialSession,
  questions = [],
  savedAnswers: initialSavedAnswers = {},
  remainingSeconds: initialRemainingSeconds = 900,
  onCompleted,
}) {
  const [session, setSession] = useState(initialSession);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(initialSavedAnswers || {});
  const [visitedIndices, setVisitedIndices] = useState(new Set([0]));
  const [remainingTime, setRemainingTime] = useState(initialRemainingSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [scorecard, setScorecard] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved' | 'error'

  const timerRef = useRef(null);
  const currentQ = questions[currentQuestionIndex] || null;

  // Jump to Question and track visited
  const handleJumpToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setVisitedIndices((prev) => new Set([...prev, index]));
  };

  // Submit test
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || scorecard) return;
    setIsSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch('/api/events/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_code: session?.session_code,
          user_id: session?.user_id,
          submitted_answers: answers,
        }),
      });
      const data = await res.json();
      if (data?.scorecard) {
        setScorecard(data.scorecard);
        setSession(data.scorecard.session || data.session);
        if (onCompleted) onCompleted(data.scorecard);
      }
    } catch (err) {
      console.error('Quiz submission failed:', err);
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  }, [answers, isSubmitting, onCompleted, scorecard, session]);

  // Countdown timer
  useEffect(() => {
    if (scorecard || session?.status === 'SUBMITTED' || session?.status === 'EXPIRED') {
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleSubmit, scorecard, session?.status]);

  // Format seconds into MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Autosave answer to backend
  const handleSelectOption = async (optionIndex) => {
    if (!currentQ || scorecard || session?.status !== 'IN_PROGRESS') return;

    const currentAns = answers[currentQ.id] || {};
    const newAnswers = {
      ...answers,
      [currentQ.id]: {
        ...currentAns,
        selected_option_index: optionIndex,
      },
    };
    setAnswers(newAnswers);
    setSaveStatus('saving');

    try {
      await fetch('/api/events/quiz/save-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_code: session.session_code,
          user_id: session.user_id,
          question_id: currentQ.id,
          selected_option_index: optionIndex,
          is_marked_for_review: Boolean(currentAns.is_marked_for_review),
        }),
      });
      setSaveStatus('saved');
    } catch (_e) {
      setSaveStatus('error');
    }
  };

  // Clear answer
  const handleClearAnswer = async () => {
    if (!currentQ || scorecard) return;

    const currentAns = answers[currentQ.id] || {};
    const newAnswers = {
      ...answers,
      [currentQ.id]: {
        ...currentAns,
        selected_option_index: null,
      },
    };
    setAnswers(newAnswers);
    setSaveStatus('saving');

    try {
      await fetch('/api/events/quiz/save-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_code: session.session_code,
          user_id: session.user_id,
          question_id: currentQ.id,
          selected_option_index: null,
          is_marked_for_review: Boolean(currentAns.is_marked_for_review),
        }),
      });
      setSaveStatus('saved');
    } catch (_e) {
      setSaveStatus('error');
    }
  };

  // Toggle Mark for Review
  const handleToggleReview = async () => {
    if (!currentQ || scorecard) return;

    const currentAns = answers[currentQ.id] || {};
    const updatedReview = !currentAns.is_marked_for_review;

    const newAnswers = {
      ...answers,
      [currentQ.id]: {
        ...currentAns,
        is_marked_for_review: updatedReview,
      },
    };
    setAnswers(newAnswers);
    setSaveStatus('saving');

    try {
      await fetch('/api/events/quiz/save-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_code: session.session_code,
          user_id: session.user_id,
          question_id: currentQ.id,
          selected_option_index: currentAns.selected_option_index ?? null,
          is_marked_for_review: updatedReview,
        }),
      });
      setSaveStatus('saved');
    } catch (_e) {
      setSaveStatus('error');
    }
  };

  // Calculation counts for Question Palette
  const answeredCount = Object.values(answers).filter(
    (a) => a?.selected_option_index !== null && a?.selected_option_index !== undefined
  ).length;
  const reviewCount = Object.values(answers).filter((a) => a?.is_marked_for_review).length;
  const unansweredCount = questions.length - answeredCount;

  // Render Completed Scorecard View
  if (scorecard) {
    const s = scorecard.session || session;
    const finalScore = parseFloat(s.score) || 0;
    const maxScore = parseFloat(s.max_possible_score) || 0;
    const percentage = parseFloat(s.percentage) || 0;
    const isPassed = percentage >= 50;

    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
        {/* Scorecard Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#002A5C] via-[#0b3578] to-[#1e498c] p-8 text-white shadow-2xl">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-6 translate-y-6">
            <Trophy className="w-64 h-64" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-400/30">
                <Trophy className="w-3.5 h-3.5" /> Official Result Card
              </div>
              <h1 className="text-3xl font-black tracking-tight">
                {isPassed ? 'Congratulations! 🎉' : 'Assessment Completed'}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 max-w-md">
                Candidate: <span className="font-bold text-white">{s.display_name}</span> ({s.user_id})
                {s.department ? ` • Dept: ${s.department}` : ''}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-center min-w-[200px]">
              <span className="text-xs uppercase font-extrabold tracking-wider text-blue-200">
                Final Score
              </span>
              <div className="text-4xl font-black text-amber-300 mt-1">
                {finalScore.toFixed(1)} <span className="text-lg text-white/80">/ {maxScore.toFixed(1)}</span>
              </div>
              <div className="text-xs font-bold text-emerald-300 mt-1">
                {percentage.toFixed(1)}% Accuracy
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Correct</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.total_correct || 0}</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Incorrect</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.total_incorrect || 0}</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Unanswered</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.total_unanswered || 0}</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Time Taken</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {Math.floor((s.time_taken_seconds || 0) / 60)}m {(s.time_taken_seconds || 0) % 60}s
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-wrap gap-4 items-center justify-between pt-2">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            <Home className="w-4 h-4" /> Return to Events Hub
          </Link>

          <Link
            href="/events/quiz/leaderboard"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-extrabold uppercase tracking-wider shadow-lg hover:from-amber-400 hover:to-amber-500 transition"
          >
            <Trophy className="w-4 h-4" /> View Live Tournament Leaderboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Question Solutions Breakdown */}
        {scorecard.breakdown && (
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" /> Solutions & Explanation Breakdown
            </h2>

            <div className="space-y-4">
              {scorecard.breakdown.map((item, idx) => {
                const isCorrect = item.is_correct;
                const isSkipped = item.selected_option_index === null || item.selected_option_index === undefined;

                return (
                  <div
                    key={item.question_id || idx}
                    className={`
                      p-6 rounded-2xl border transition-all
                      ${
                        isCorrect
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : isSkipped
                          ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-500">Q{idx + 1}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> +{item.marks_awarded} Marks
                          </span>
                        ) : isSkipped ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                            Unanswered (0.0)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3.5 h-3.5" /> {item.marks_awarded} Marks
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                      {item.question_text}
                    </p>

                    {/* Options list */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {item.options?.map((opt, optIdx) => {
                        const isUserChoice = item.selected_option_index === optIdx;
                        const isCorrectOption = item.correct_option_index === optIdx;

                        let optClass = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
                        if (isCorrectOption) {
                          optClass = 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold';
                        } else if (isUserChoice && !isCorrectOption) {
                          optClass = 'bg-rose-100 dark:bg-rose-950/80 border-rose-500 text-rose-900 dark:text-rose-100 line-through';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${optClass}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span>{opt}</span>
                            </div>
                            {isCorrectOption && <Check className="w-4 h-4 text-emerald-600" />}
                            {isUserChoice && !isCorrectOption && <XCircle className="w-4 h-4 text-rose-600" />}
                          </div>
                        );
                      })}
                    </div>

                    {item.explanation && (
                      <div className="mt-4 p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Explanation: </span>
                          <span>{item.explanation}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active Quiz Playing View
  const currentAnswer = currentQ ? answers[currentQ.id] : null;
  const isMarked = Boolean(currentAnswer?.is_marked_for_review);
  const selectedIndex = currentAnswer?.selected_option_index;

  const isTimerCritical = remainingTime <= 120; // 2 minutes or less

  return (
    <div className="max-w-7xl mx-auto py-4 px-3 sm:px-6 space-y-4">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white leading-tight">
              Technical Symposium Quiz
            </h1>
            <p className="text-xs text-slate-500">
              Candidate: <span className="font-semibold text-slate-700 dark:text-slate-300">{session?.display_name}</span> ({session?.user_id})
            </p>
          </div>
        </div>

        {/* Center: Save Status & Timer */}
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="text-[11px] font-semibold text-amber-500 animate-pulse hidden sm:inline">
              Autosaving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[11px] font-semibold text-emerald-600 hidden sm:inline flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}

          {/* Countdown Clock */}
          <div
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-black transition-colors
              ${
                isTimerCritical
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border border-rose-300 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
              }
            `}
          >
            <Clock className={`w-4 h-4 ${isTimerCritical ? 'text-rose-600' : 'text-blue-600'}`} />
            <span>{formatTime(remainingTime)}</span>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Submit Quiz
          </button>
        </div>
      </div>

      {/* Main Arena Layout: Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Question Workspace (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
          {currentQ ? (
            <>
              {/* Question Header Meta */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {currentQ.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="text-emerald-600 dark:text-emerald-400">+{currentQ.marks} Marks</span>
                  {currentQ.negative_marks > 0 && (
                    <span className="text-rose-500 dark:text-rose-400">(-{currentQ.negative_marks} Neg)</span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed font-sans">
                {currentQ.question_text}
              </div>

              {/* Options Selection List */}
              <div className="space-y-3 pt-2">
                {currentQ.options?.map((optText, optIdx) => {
                  const isSelected = selectedIndex === optIdx;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`
                        w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 cursor-pointer
                        ${
                          isSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-600 text-slate-900 dark:text-white shadow-sm ring-1 ring-blue-600'
                            : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`
                            w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors
                            ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }
                          `}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="text-sm font-medium leading-relaxed">{optText}</span>
                      </div>

                      <div
                        className={`
                          w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                          ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }
                        `}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Question Action Controls */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleReview}
                    className={`
                      px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer
                      ${
                        isMarked
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }
                    `}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isMarked ? 'fill-amber-500' : ''}`} />
                    {isMarked ? 'Marked for Review' : 'Mark for Review'}
                  </button>

                  {selectedIndex !== null && selectedIndex !== undefined && (
                    <button
                      type="button"
                      onClick={handleClearAnswer}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Clear Response
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => handleJumpToQuestion(Math.max(0, currentQuestionIndex - 1))}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <button
                    type="button"
                    disabled={currentQuestionIndex === questions.length - 1}
                    onClick={() => handleJumpToQuestion(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">No questions available.</div>
          )}
        </div>

        {/* Right Column: Question Palette / Navigator (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Question Navigator
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Click any number to jump directly.</p>
          </div>

          {/* Quick Metrics Summary */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900">
              <span className="block font-black text-emerald-600 dark:text-emerald-400 text-base">
                {answeredCount}
              </span>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold">Answered</span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900">
              <span className="block font-black text-amber-600 dark:text-amber-400 text-base">
                {reviewCount}
              </span>
              <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">Review</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="block font-black text-slate-600 dark:text-slate-300 text-base">
                {unansweredCount}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">Unanswered</span>
            </div>
          </div>

          {/* Grid Palette */}
          <div className="grid grid-cols-5 gap-2.5 pt-2">
            {questions.map((q, idx) => {
              const ans = answers[q.id];
              const isAnswered = ans?.selected_option_index !== null && ans?.selected_option_index !== undefined;
              const isMarkedReview = Boolean(ans?.is_marked_for_review);
              const isCurrent = idx === currentQuestionIndex;
              const isVisited = visitedIndices.has(idx);

              let btnClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';

              if (isAnswered && isMarkedReview) {
                btnClass = 'bg-purple-600 text-white border-purple-700 ring-2 ring-amber-400';
              } else if (isAnswered) {
                btnClass = 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
              } else if (isMarkedReview) {
                btnClass = 'bg-amber-500 text-slate-950 font-black border-amber-600 shadow-sm';
              } else if (isVisited) {
                btnClass = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900';
              }

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => handleJumpToQuestion(idx)}
                  className={`
                    h-11 rounded-xl text-xs font-black transition-all relative flex items-center justify-center cursor-pointer border
                    ${btnClass}
                    ${isCurrent ? 'ring-2 ring-offset-2 ring-blue-600 scale-105' : 'hover:scale-105'}
                  `}
                >
                  {idx + 1}
                  {isMarkedReview && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-300" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 shrink-0" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-amber-500 shrink-0" />
              <span>Marked for Review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-rose-100 dark:bg-rose-950 border border-rose-300 shrink-0" />
              <span>Visited (Unanswered)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 shrink-0" />
              <span>Not Visited</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Submit Technical Quiz?
              </h3>
              <p className="text-xs text-slate-500">
                You will not be able to change your answers once finalized.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Total Questions:</span>
                <span className="font-bold text-slate-900 dark:text-white">{questions.length}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Answered Questions:</span>
                <span className="font-bold text-emerald-600">{answeredCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Marked for Review:</span>
                <span className="font-bold text-amber-600">{reviewCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Unanswered Questions:</span>
                <span className="font-bold text-rose-500">{unansweredCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="w-1/2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Continue Quiz
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="w-1/2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? 'Evaluating...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
