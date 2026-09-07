'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import EventGuard from '@/modules/events/components/EventGuard';
import QuizPlayerView from '@/modules/events/games/quiz/QuizPlayerView';

function QuizPlayInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    async function initSession() {
      try {
        let userId = searchParams.get('userId');
        let displayName = searchParams.get('name');
        let department = searchParams.get('dept');

        if (!userId && typeof window !== 'undefined') {
          const stored = localStorage.getItem('kucet_quiz_candidate');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              userId = parsed.user_id;
              displayName = parsed.display_name;
              department = parsed.department;
            } catch (_e) {
              /* ignore parse error */
            }
          }
        }

        if (!userId) {
          router.replace('/events/quiz');
          return;
        }

        const res = await fetch('/api/events/quiz/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            display_name: displayName || 'Candidate',
            department: department || 'General',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || data?.message || 'Failed to initialize session');
        }

        setSessionData(data);
      } catch (err) {
        setError(err.message || 'Unable to load quiz session.');
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Initializing Quiz Assessment...
        </h2>
        <p className="text-xs text-slate-500 mt-1">Loading questions & synchronizing server timer</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Assessment Unavailable
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="/events/quiz"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Quiz Lobby
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <QuizPlayerView
      session={sessionData?.session}
      questions={sessionData?.questions || []}
      savedAnswers={sessionData?.savedAnswers || {}}
      remainingSeconds={sessionData?.remainingSeconds || 900}
      isResumed={sessionData?.isResumed || false}
    />
  );
}

export default function QuizPlayPage() {
  return (
    <EventGuard eventKey="quiz">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center p-6">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          }
        >
          <QuizPlayInner />
        </Suspense>
      </div>
    </EventGuard>
  );
}
