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
  Info,
  Layers,
  Award
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

  // Toggle mark for review
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

  // ==========================================
  // RENDER COMPLETED SCORECARD VIEW
  // ==========================================
  if (scorecard) {
    const s = scorecard.session || session;
    const finalScore = parseFloat(s.score) || 0;
    const maxScore = parseFloat(s.max_possible_score) || 0;
    const percentage = parseFloat(s.percentage) || 0;
    const isPassed = percentage >= 50;

    return (
      <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 text-sm">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/" className="hover:text-slate-700 transition-colors">
            KUCET CMS
          </Link>
          <span>/</span>
          <Link href="/events" className="hover:text-slate-700 transition-colors">
            Campus Events
          </Link>
          <span>/</span>
          <Link href="/events/quiz" className="hover:text-slate-700 transition-colors">
            Technical Quiz
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">Scorecard</span>
        </div>

        {/* Scorecard Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#0b3578] border border-blue-200 mb-2">
                <Award className="w-3.5 h-3.5" /> Official Assessment Scorecard
              </span>
              <h1 className="text-2xl font-semibold text-gray-800">
                Technical Quiz Assessment Report
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Candidate: <span className="font-semibold text-gray-800">{s.display_name}</span> • Roll No:{' '}
                <span className="font-mono font-semibold text-gray-800">{s.user_id}</span>
                {s.department ? ` • Dept: ${s.department}` : ''}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center min-w-[180px]">
              <span className="text-xs text-slate-500 uppercase font-semibold block">Total Score</span>
              <div className="text-3xl font-bold text-[#0b3578] mt-0.5">
                {finalScore.toFixed(1)} <span className="text-sm font-normal text-slate-500">/ {maxScore.toFixed(1)}</span>
              </div>
              <span
                className={`inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isPassed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {percentage.toFixed(1)}% ({isPassed ? 'Qualified' : 'Completed'})
              </span>
            </div>
          </div>

          {/* Metric Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-emerald-700 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-semibold">Correct</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{s.total_correct || 0}</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-rose-700 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-xs font-semibold">Incorrect</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{s.total_incorrect || 0}</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <HelpCircle className="w-4 h-4" />
                <span className="text-xs font-semibold">Unanswered</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{s.total_unanswered || 0}</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-[#0b3578] mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold">Time Taken</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 font-mono">
                {Math.floor((s.time_taken_seconds || 0) / 60)}m {(s.time_taken_seconds || 0) % 60}s
              </p>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-200">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
            >
              <Home className="w-4 h-4" /> Return to Events Hub
            </Link>

            <Link
              href="/events/quiz/leaderboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs"
            >
              <Trophy className="w-4 h-4 text-amber-300" /> View Tournament Standings <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Detailed Solutions Breakdown */}
        {scorecard.breakdown && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0b3578]" /> Solutions & Evaluation Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review verified correct answers, your submitted selections, and question rationales.
              </p>
            </div>

            <div className="space-y-4">
              {scorecard.breakdown.map((item, idx) => {
                const isCorrect = item.is_correct;
                const isSkipped = item.selected_option_index === null || item.selected_option_index === undefined;

                return (
                  <div
                    key={item.question_id || idx}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-700">Question {idx + 1}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {item.category}
                        </span>
                      </div>

                      <div>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> +{item.marks_awarded} Marks
                          </span>
                        ) : isSkipped ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                            Unanswered (0.0)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3.5 h-3.5" /> {item.marks_awarded} Marks
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                      {item.question_text}
                    </p>

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {item.options?.map((opt, optIdx) => {
                        const isUserChoice = item.selected_option_index === optIdx;
                        const isCorrectOption = item.correct_option_index === optIdx;

                        let optClass = 'bg-white border-slate-200 text-slate-700';
                        if (isCorrectOption) {
                          optClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold';
                        } else if (isUserChoice && !isCorrectOption) {
                          optClass = 'bg-rose-50 border-rose-300 text-rose-900 line-through';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${optClass}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span>{opt}</span>
                            </div>
                            {isCorrectOption && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            {isUserChoice && !isCorrectOption && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    {item.explanation && (
                      <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-xs text-[#0b3578] flex items-start gap-2">
                        <Info className="w-4 h-4 text-[#0b3578] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Explanation: </span>
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

  // ==========================================
  // ACTIVE QUIZ PLAYING VIEW
  // ==========================================
  const currentAnswer = currentQ ? answers[currentQ.id] : null;
  const isMarked = Boolean(currentAnswer?.is_marked_for_review);
  const selectedIndex = currentAnswer?.selected_option_index;

  const isTimerCritical = remainingTime <= 120; // 2 minutes or less

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4 text-sm">
      {/* Top Header Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-gray-800">
            Technical Quiz Assessment Arena
          </h1>
          <p className="text-xs text-gray-600">
            Candidate: <span className="font-semibold text-gray-800">{session?.display_name}</span> (
            <span className="font-mono">{session?.user_id}</span>)
            {session?.department ? ` • Dept: ${session?.department}` : ''}
          </p>
        </div>

        {/* Center/Right: Timer, Autosave, Submit */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {saveStatus === 'saving' && (
            <span className="text-xs font-medium text-amber-600 animate-pulse hidden md:inline">
              Autosaving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs font-medium text-emerald-600 hidden md:inline flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}

          {/* Countdown Clock */}
          <div
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold transition-colors
              ${
                isTimerCritical
                  ? 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
                  : 'bg-slate-50 text-slate-800 border border-slate-200'
              }
            `}
          >
            <Clock className={`w-4 h-4 ${isTimerCritical ? 'text-rose-600' : 'text-[#0b3578]'}`} />
            <span>{formatTime(remainingTime)}</span>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Submit Quiz
          </button>
        </div>
      </div>

      {/* Main Arena Layout: Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Question Workspace (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
          {currentQ ? (
            <>
              {/* Question Header Meta */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-50 text-[#0b3578] border border-blue-200">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {currentQ.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span className="text-emerald-700">+{currentQ.marks} Marks</span>
                  {currentQ.negative_marks > 0 && (
                    <span className="text-rose-600">(-{currentQ.negative_marks} Neg)</span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="text-base font-semibold text-gray-800 leading-relaxed font-sans">
                {currentQ.question_text}
              </div>

              {/* Options Selection List */}
              <div className="space-y-2.5 pt-1">
                {currentQ.options?.map((optText, optIdx) => {
                  const isSelected = selectedIndex === optIdx;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`
                        w-full text-left p-3.5 rounded-lg border transition-colors flex items-center justify-between gap-3 text-sm cursor-pointer
                        ${
                          isSelected
                            ? 'bg-blue-50/70 border-[#0b3578] text-[#0b3578] ring-1 ring-[#0b3578] font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`
                            w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors
                            ${
                              isSelected
                                ? 'bg-[#0b3578] text-white'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }
                          `}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="leading-relaxed">{optText}</span>
                      </div>

                      <div
                        className={`
                          w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors
                          ${
                            isSelected
                              ? 'border-[#0b3578] bg-[#0b3578]'
                              : 'border-slate-300'
                          }
                        `}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Question Action Controls */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleReview}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer border
                      ${
                        isMarked
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isMarked ? 'fill-amber-600 text-amber-600' : ''}`} />
                    {isMarked ? 'Marked for Review' : 'Mark for Review'}
                  </button>

                  {selectedIndex !== null && selectedIndex !== undefined && (
                    <button
                      type="button"
                      onClick={handleClearAnswer}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => handleJumpToQuestion(Math.max(0, currentQuestionIndex - 1))}
                    className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <button
                    type="button"
                    disabled={currentQuestionIndex === questions.length - 1}
                    onClick={() => handleJumpToQuestion(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">No questions available in this assessment.</div>
          )}
        </div>

        {/* Right Column: Question Palette / Navigator (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-sm font-semibold text-gray-800">
              Question Navigator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Click any question number to navigate directly.</p>
          </div>

          {/* Quick Metrics Summary */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="block font-bold text-emerald-700 text-sm">
                {answeredCount}
              </span>
              <span className="text-[10px] text-emerald-800 font-medium">Answered</span>
            </div>

            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="block font-bold text-amber-700 text-sm">
                {reviewCount}
              </span>
              <span className="text-[10px] text-amber-800 font-medium">Review</span>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="block font-bold text-slate-700 text-sm">
                {unansweredCount}
              </span>
              <span className="text-[10px] text-slate-600 font-medium">Unanswered</span>
            </div>
          </div>

          {/* Question Grid Buttons */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {questions.map((q, idx) => {
              const ans = answers[q.id];
              const isAnswered = ans?.selected_option_index !== null && ans?.selected_option_index !== undefined;
              const isMarkedReview = Boolean(ans?.is_marked_for_review);
              const isCurrent = currentQuestionIndex === idx;
              const isVisited = visitedIndices.has(idx);

              let btnStyle = 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';

              if (isMarkedReview) {
                btnStyle = 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
              } else if (isAnswered) {
                btnStyle = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold';
              } else if (isVisited) {
                btnStyle = 'bg-slate-100 text-slate-700 border-slate-300';
              }

              if (isCurrent) {
                btnStyle = 'bg-[#0b3578] text-white border-[#0b3578] font-bold shadow-xs';
              }

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => handleJumpToQuestion(idx)}
                  className={`h-9 rounded-lg text-xs border transition-colors flex items-center justify-center cursor-pointer ${btnStyle}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Palette Legend */}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Marked for Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0b3578] shrink-0" />
              <span>Current Question</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
              <span>Not Answered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Final Submission Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-[#0b3578]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-semibold text-gray-800">
                Confirm Final Submission
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to submit your assessment? Once submitted, your answers will be evaluated and locked permanently.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Questions:</span>
                <span className="font-bold text-slate-800">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Answered Questions:</span>
                <span className="font-bold text-emerald-700">{answeredCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Marked for Review:</span>
                <span className="font-bold text-amber-700">{reviewCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unanswered Questions:</span>
                <span className="font-bold text-slate-800">{unansweredCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back to Questions
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Confirm & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
