'use client';

import React, { useState, useEffect } from 'react';
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
  AlertCircle
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
        throw new Error(data?.error || data?.message || 'Failed to initialize quiz session');
      }

      router.push(
        `/events/quiz/play?userId=${encodeURIComponent(formData.user_id.trim())}&name=${encodeURIComponent(
          formData.display_name.trim()
        )}&dept=${encodeURIComponent(formData.department)}`
      );
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
                Collegiate Technical Assessment — Computer Science & Engineering Core Disciplines
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/events/quiz/leaderboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
              >
                <Trophy className="w-4 h-4 text-amber-600" /> View Leaderboard
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> All Events
              </Link>
            </div>
          </header>

          {/* Main Grid: Instructions + Registration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Rules & Guidelines (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
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
                    <strong>Server-Authoritative Timer:</strong> The countdown timer begins automatically upon clicking &quot;Start Technical Quiz&quot;. The remaining duration is tracked by the server.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px] border border-slate-300">
                    2
                  </span>
                  <span>
                    <strong>Real-Time Autosave:</strong> Every selected answer is recorded instantly. In case of accidental disconnection or tab closure, you may resume your attempt within the remaining time window.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px] border border-slate-300">
                    3
                  </span>
                  <span>
                    <strong>Question Navigation & Review:</strong> You can navigate between questions using the Question Palette, mark questions for review, or clear responses at any point before final submission.
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

            {/* Right Column: Candidate Entry Form (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-semibold text-gray-800">Candidate Verification</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your academic credentials to enter the assessment arena.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleStartQuiz} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Roll Number / Hall Ticket Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0123-22-733-001"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-gray-800 uppercase focus:outline-none focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Candidate Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Department / Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578] focus:border-[#0b3578]"
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

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={starting}
                    className="w-full py-2.5 px-4 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg text-sm font-medium transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Anti-cheating device fingerprint and timer integrity active.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </EventGuard>
  );
}
