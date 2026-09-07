'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  BookOpen,
  Award
} from 'lucide-react';
import EventGuard from '@/modules/events/components/EventGuard';

export default function QuizLobbyPage() {
  const router = useRouter();
  const [config, setConfig] = useState(null);

  const [formData, setFormData] = useState({
    user_id: '',
    display_name: '',
    department: 'CSE',
  });

  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await fetch('/api/events/quiz/config');
        const data = await res.json();
        if (isMounted) setConfig(data);
      } catch (_e) {
        // fallback
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartQuiz = async (e) => {
    e.preventDefault();
    if (!formData.user_id.trim() || !formData.display_name.trim()) {
      setErrorMessage('Please provide your Roll Number and Full Name.');
      return;
    }

    setStarting(true);
    setErrorMessage('');

    try {
      // Store candidate info in localStorage for persistence across reloads
      if (typeof window !== 'undefined') {
        localStorage.setItem('kucet_quiz_candidate', JSON.stringify(formData));
      }

      const res = await fetch('/api/events/quiz/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: formData.user_id.trim(),
          display_name: formData.display_name.trim(),
          department: formData.department,
          user_type: 'student',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to initialize session');
      }

      router.push(`/events/quiz/play?userId=${encodeURIComponent(formData.user_id.trim())}&name=${encodeURIComponent(formData.display_name.trim())}&dept=${encodeURIComponent(formData.department)}`);
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred starting the assessment.');
    } finally {
      setStarting(false);
    }
  };

  const rules = config?.rules_json || {
    duration_minutes: 15,
    marks_per_question: 2,
    negative_marking: 0.5,
    passing_percentage: 50,
  };

  return (
    <EventGuard eventKey="quiz">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#002A5C] via-[#0b3578] to-[#1e498c] p-8 text-white shadow-xl">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-6 translate-y-6">
              <Zap className="w-64 h-64" />
            </div>

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-400/30">
                <Trophy className="w-3.5 h-3.5" /> Collegiate Technical Symposium
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                {config?.event_name || 'KUCET Technical Quiz Championship'}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl leading-relaxed">
                Test your fundamental and advanced knowledge across Data Structures, Algorithms, Operating Systems, Computer Networks, Database Architecture, and System Design in this fast-paced timed assessment.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Column: Assessment Rules & Guidelines (7 cols) */}
            <div className="md:col-span-7 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" /> Assessment Rules & Instructions
                </h2>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60">
                    <Clock className="w-5 h-5 text-blue-600 mb-1" />
                    <span className="font-bold text-slate-900 dark:text-white block">Duration</span>
                    <span className="text-slate-500">{rules.duration_minutes} Minutes</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
                    <span className="font-bold text-slate-900 dark:text-white block">Scoring</span>
                    <span className="text-slate-500">+{rules.marks_per_question} per Correct</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60">
                    <AlertTriangle className="w-5 h-5 text-rose-600 mb-1" />
                    <span className="font-bold text-slate-900 dark:text-white block">Negative Marking</span>
                    <span className="text-slate-500">-{rules.negative_marking} per Incorrect</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60">
                    <Award className="w-5 h-5 text-amber-600 mb-1" />
                    <span className="font-bold text-slate-900 dark:text-white block">Pass Benchmark</span>
                    <span className="text-slate-500">{rules.passing_percentage}% Minimum</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                      1
                    </span>
                    <span>
                      The timer starts automatically once you click <strong>Start Assessment</strong>. The timer is server-authoritative.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                      2
                    </span>
                    <span>
                      All question responses are autosaved in real-time. If you accidentally close your tab or lose connectivity, you can resume immediately within your time window.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                      3
                    </span>
                    <span>
                      You can navigate freely between questions, mark questions for review, and clear selections before final submission.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                      4
                    </span>
                    <span>
                      Official rankings are calculated based on <strong>Total Score</strong>. In case of ties, the candidate who completed the quiz with <strong>lowest time taken</strong> ranks higher.
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <Link
                    href="/events/quiz/leaderboard"
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Trophy className="w-3.5 h-3.5" /> View Live Tournament Leaderboard
                  </Link>

                  <Link
                    href="/events"
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Back to Tournament Hub
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: Candidate Entry Form (5 cols) */}
            <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Candidate Registration
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your credentials to enter the assessment arena.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleStartQuiz} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Roll Number / Hall Ticket *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0123-22-733-001"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Department / Branch
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CSE">Computer Science & Engineering (CSE)</option>
                    <option value="ECE">Electronics & Communication (ECE)</option>
                    <option value="EEE">Electrical & Electronics (EEE)</option>
                    <option value="MECH">Mechanical Engineering (MECH)</option>
                    <option value="CIVIL">Civil Engineering (CIVIL)</option>
                    <option value="IT">Information Technology (IT)</option>
                    <option value="FACULTY">Faculty / Academic Staff</option>
                  </select>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={starting}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {starting ? (
                      'Preparing Assessment...'
                    ) : (
                      <>
                        <span>Start Technical Quiz</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Anti-cheating device fingerprint and timer integrity active.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </EventGuard>
  );
}
