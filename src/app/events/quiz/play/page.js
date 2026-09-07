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
        const sessionCode = searchParams.get('session_code');

        const res = await fetch('/api/events/quiz/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_key: 'quiz',
            session_code: sessionCode || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            router.replace('/events/quiz');
            return;
          }
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <RefreshCw className="w-8 h-8 text-[#0b3578] animate-spin mb-3" />
        <h2 className="text-sm font-semibold text-gray-800">
          Initializing Quiz Assessment...
        </h2>
        <p className="text-xs text-slate-500 mt-1">Synchronizing server timer and question bank</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-slate-200 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Assessment Unavailable
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{error}</p>
          </div>
          <div className="pt-2">
            <Link
              href="/events/quiz"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs"
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
      <div className="min-h-screen bg-slate-50">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center p-6">
              <RefreshCw className="w-8 h-8 text-[#0b3578] animate-spin" />
            </div>
          }
        >
          <QuizPlayInner />
        </Suspense>
      </div>
    </EventGuard>
  );
}
