'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Trophy,
  Award,
  ArrowLeft,
  AlertCircle,
  UserCheck,
  Loader2,
  LogIn,
  Layers
} from 'lucide-react';
import EventGuard from '@/modules/events/components/EventGuard';

export default function QuizLobbyClient({ currentUser = null, initialConfig = null }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const config = initialConfig;
  const rules = config?.rules_json || {
    duration_minutes: 15,
    marks_per_question: 2,
    negative_marking: 0.5,
    passing_percentage: 50,
  };

  const candidateName = currentUser?.name || currentUser?.full_name || 'KUCET Candidate';
  const candidateId = currentUser?.roll_no || currentUser?.id || currentUser?.staffId || '';
  const candidateDept = currentUser?.branch || currentUser?.department || 'Computer Science & Engineering';

  const handleStartQuiz = async () => {
    if (!currentUser) {
      router.push('/');
      return;
    }

    setStarting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/events/quiz/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_key: 'quiz',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to initialize assessment session');
      }

      router.push('/events/quiz/play');
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred starting the assessment.');
    } finally {
      setStarting(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <EventGuard eventKey="quiz" isAdmin={isAdmin}>
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Link href="/" className="hover:text-slate-700 transition-colors">
              KUCET CMS
            </Link>
            <span>/</span>
            <Link href="/events" className="hover:text-slate-700 transition-colors">
              Campus Events
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Technical Quiz</span>
          </div>

          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">
                {config?.event_name || 'KUCET Technical Quiz Championship'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Collegiate Technical Assessment — Core Engineering Disciplines & Computer Science
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/events/quiz/leaderboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors shadow-xs"
              >
                <Trophy className="w-4 h-4 text-amber-600" /> View Leaderboard
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" /> All Events
              </Link>
            </div>
          </header>

          {/* Main Grid: Instructions + Candidate Verification */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Rules & Guidelines (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0b3578]" /> Assessment Instructions & Guidelines
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Please review the examination regulations carefully before initiating your assessment.
                </p>
              </div>

              {/* 4 Metric Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <Clock className="w-4 h-4 text-[#0b3578] mx-auto mb-1" />
                  <span className="text-[11px] text-slate-500 block">Duration</span>
                  <span className="text-sm font-bold text-slate-800">{rules.duration_minutes} Mins</span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-500 block">Marks / Correct</span>
                  <span className="text-sm font-bold text-slate-800">+{rules.marks_per_question}</span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <AlertTriangle className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-500 block">Negative Mark</span>
                  <span className="text-sm font-bold text-slate-800">-{rules.negative_marking}</span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <Award className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                  <span className="text-[11px] text-slate-500 block">Passing Mark</span>
                  <span className="text-sm font-bold text-slate-800">{rules.passing_percentage}%</span>
                </div>
              </div>

              {/* Numbered Rules List */}
              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px] border border-slate-300">
                    1
                  </span>
                  <span>
                    <strong>Server-Authoritative Timer:</strong> The countdown timer begins automatically upon clicking &quot;Start Technical Assessment&quot;. The remaining duration is enforced by the server.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px] border border-slate-300">
                    2
                  </span>
                  <span>
                    <strong>Real-Time Autosave:</strong> Every selected answer is recorded instantly. In case of accidental disconnection or tab closure, you may resume your attempt within the active time window.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px] border border-slate-300">
                    3
                  </span>
                  <span>
                    <strong>Question Palette & Review:</strong> You can navigate between questions using the Question Palette, mark questions for review, or clear responses at any point before final submission.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px] border border-slate-300">
                    4
                  </span>
                  <span>
                    <strong>Official Ranking:</strong> Leaderboard standings are determined strictly by <em>Total Score</em>. Ties are resolved by the lowest total time taken to complete the assessment.
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Zero-Input Candidate Admit Card (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-semibold text-gray-800">Candidate Admit Card</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identity is automatically verified via your active KUCET portal session.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {currentUser ? (
                <div className="space-y-4">
                  {/* Verified Candidate Info Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Authenticated Candidate
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" /> KUCET Verified
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Candidate Name</span>
                        <span className="text-sm font-semibold text-slate-900">{candidateName}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Roll No / ID</span>
                          <span className="font-mono font-semibold text-slate-800">{candidateId || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Discipline</span>
                          <span className="font-semibold text-slate-800">{candidateDept}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Action Button */}
                  <button
                    type="button"
                    onClick={handleStartQuiz}
                    disabled={starting}
                    className="w-full py-2.5 px-4 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg text-sm font-medium transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Initializing Assessment...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Start Technical Assessment</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>One-click registration is automatically completed upon starting.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      Authentication Required
                    </p>
                    <p className="text-amber-800 leading-relaxed">
                      To ensure examination integrity, you must be logged into your KUCET Student Portal before attempting this technical assessment.
                    </p>
                  </div>

                  <Link
                    href="/"
                    className="w-full py-2.5 px-4 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg text-sm font-medium transition-colors shadow-xs flex items-center justify-center gap-2 text-center"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Student Portal Login</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </EventGuard>
  );
}
