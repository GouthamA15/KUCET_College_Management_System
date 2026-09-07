'use client';

import React, { useState, useEffect } from 'react';
import QuizAdminControl from '@/modules/events/games/quiz/QuizAdminControl';
import { RefreshCw } from 'lucide-react';

export default function AdminQuizEventPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/events/quiz/config');
        const data = await res.json();
        setConfig(data);
      } catch (_e) {
        // fallback
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Quiz Console...</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <QuizAdminControl initialConfig={config} />
    </div>
  );
}
