'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  FileQuestion,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Search,
  AlertCircle,
  Save,
  RefreshCw,
  X
} from 'lucide-react';

export default function QuizAdminControl({ initialConfig }) {
  const [config, setConfig] = useState(initialConfig || {});
  const [activeTab, setActiveTab] = useState('questions'); // 'questions' | 'leaderboard' | 'sessions' | 'settings'

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionCategory, setQuestionCategory] = useState('ALL');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    options: ['', '', '', ''],
    correct_option_index: 0,
    explanation: '',
    marks: 2.0,
    negative_marks: 0.5,
    category: 'Computer Science',
    difficulty: 'MEDIUM',
    is_active: true,
  });

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    duration_minutes: config?.rules_json?.duration_minutes || 15,
    passing_percentage: config?.rules_json?.passing_percentage || 50,
    marks_per_question: config?.rules_json?.marks_per_question || 2,
    negative_marking: config?.rules_json?.negative_marking || 0.5,
    max_attempts_per_user: config?.rules_json?.max_attempts_per_user || 1,
    show_instant_result: config?.rules_json?.show_instant_result ?? true,
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Questions
  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch('/api/events/quiz/questions?active_only=false');
      const data = await res.json();
      setQuestions(data?.questions || []);
    } catch (_err) {
      showToast('Failed to load questions', 'error');
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  // Fetch Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/events/quiz/leaderboard?limit=100');
      const data = await res.json();
      setLeaderboard(data?.leaderboard || []);
    } catch (_err) {
      showToast('Failed to load leaderboard', 'error');
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Fetch Sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/events/quiz/admin/sessions');
      const data = await res.json();
      setSessions(data?.sessions || []);
    } catch (_err) {
      showToast('Failed to load student sessions', 'error');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (activeTab === 'questions') {
        try {
          const res = await fetch('/api/events/quiz/questions?active_only=false');
          const data = await res.json();
          if (isMounted) {
            setQuestions(data?.questions || []);
            setLoadingQuestions(false);
          }
        } catch (_err) {
          if (isMounted) setLoadingQuestions(false);
        }
      } else if (activeTab === 'leaderboard') {
        try {
          const res = await fetch('/api/events/quiz/leaderboard?limit=100');
          const data = await res.json();
          if (isMounted) {
            setLeaderboard(data?.leaderboard || []);
            setLoadingLeaderboard(false);
          }
        } catch (_err) {
          if (isMounted) setLoadingLeaderboard(false);
        }
      } else if (activeTab === 'sessions') {
        try {
          const res = await fetch('/api/events/quiz/admin/sessions');
          const data = await res.json();
          if (isMounted) {
            setSessions(data?.sessions || []);
            setLoadingSessions(false);
          }
        } catch (_err) {
          if (isMounted) setLoadingSessions(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Toggle Master Quiz State
  const handleToggleMaster = async () => {
    const nextState = !config.is_enabled;
    try {
      const res = await fetch('/api/events/quiz/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: nextState }),
      });
      const data = await res.json();
      setConfig(data);
      showToast(`Technical Quiz tournament ${nextState ? 'Activated' : 'Deactivated'}`);
    } catch (_err) {
      showToast('Failed to toggle quiz state', 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/events/quiz/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules_json: {
            ...config.rules_json,
            duration_minutes: parseInt(settingsForm.duration_minutes, 10),
            passing_percentage: parseInt(settingsForm.passing_percentage, 10),
            marks_per_question: parseFloat(settingsForm.marks_per_question),
            negative_marking: parseFloat(settingsForm.negative_marking),
            max_attempts_per_user: parseInt(settingsForm.max_attempts_per_user, 10),
            show_instant_result: Boolean(settingsForm.show_instant_result),
          },
        }),
      });
      const data = await res.json();
      setConfig(data);
      showToast('Quiz configuration updated successfully');
    } catch (_err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Open Modal for Create / Edit
  const openQuestionModal = (q = null) => {
    if (q) {
      setEditingQuestion(q);
      setQuestionForm({
        question_text: q.question_text || '',
        options: Array.isArray(q.options) ? [...q.options] : ['', '', '', ''],
        correct_option_index: q.correct_option_index ?? 0,
        explanation: q.explanation || '',
        marks: parseFloat(q.marks) || 2.0,
        negative_marks: parseFloat(q.negative_marks) || 0.5,
        category: q.category || 'Computer Science',
        difficulty: q.difficulty || 'MEDIUM',
        is_active: q.is_active ?? true,
      });
    } else {
      setEditingQuestion(null);
      setQuestionForm({
        question_text: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        explanation: '',
        marks: 2.0,
        negative_marks: 0.5,
        category: 'Computer Science',
        difficulty: 'MEDIUM',
        is_active: true,
      });
    }
    setShowQuestionModal(true);
  };

  // Save Question (Create or Edit)
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!questionForm.question_text.trim()) {
      showToast('Question text is required', 'error');
      return;
    }
    const cleanOptions = questionForm.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      showToast('Please provide at least 2 valid options', 'error');
      return;
    }

    try {
      if (editingQuestion) {
        // Update
        const res = await fetch(`/api/events/quiz/questions/${editingQuestion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: questionForm.question_text,
            options: cleanOptions,
            correct_option_index: parseInt(questionForm.correct_option_index, 10),
            explanation: questionForm.explanation,
            marks: parseFloat(questionForm.marks),
            negative_marks: parseFloat(questionForm.negative_marks),
            category: questionForm.category,
            difficulty: questionForm.difficulty,
            is_active: questionForm.is_active,
          }),
        });
        if (!res.ok) throw new Error('Update failed');
        showToast('Question updated successfully');
      } else {
        // Create
        const res = await fetch('/api/events/quiz/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: questionForm.question_text,
            options: cleanOptions,
            correct_option_index: parseInt(questionForm.correct_option_index, 10),
            explanation: questionForm.explanation,
            marks: parseFloat(questionForm.marks),
            negative_marks: parseFloat(questionForm.negative_marks),
            category: questionForm.category,
            difficulty: questionForm.difficulty,
            is_active: questionForm.is_active,
          }),
        });
        if (!res.ok) throw new Error('Create failed');
        showToast('Question added to bank');
      }

      setShowQuestionModal(false);
      fetchQuestions();
    } catch (_err) {
      showToast('Error saving question', 'error');
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/events/quiz/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Question removed from bank');
      fetchQuestions();
    } catch (_err) {
      showToast('Failed to delete question', 'error');
    }
  };

  // Reset Student Session
  const handleResetSession = async (sessionId, studentName) => {
    if (!confirm(`Reset attempt for ${studentName}? This will permanently delete their answers and allow them to retake the quiz.`)) {
      return;
    }
    try {
      const res = await fetch('/api/events/quiz/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error('Reset failed');
      showToast(`Session reset for ${studentName}`);
      fetchSessions();
    } catch (_err) {
      showToast('Failed to reset session', 'error');
    }
  };

  // Filtered Questions
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.question_text?.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.category?.toLowerCase().includes(questionSearch.toLowerCase());
    const matchesCat = questionCategory === 'ALL' || q.category === questionCategory;
    return matchesSearch && matchesCat;
  });

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    if (!sessionSearch.trim()) return true;
    const q = sessionSearch.trim().toLowerCase();
    return (
      s.display_name?.toLowerCase().includes(q) ||
      s.user_id?.toLowerCase().includes(q) ||
      s.session_code?.toLowerCase().includes(q)
    );
  });

  const categories = Array.from(new Set(questions.map((q) => q.category))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`
            fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce
            ${toastMessage.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}
          `}
        >
          {toastMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Top Banner & Master Toggles */}
      <div className="bg-gradient-to-br from-[#002A5C] via-[#0b3578] to-[#1e498c] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-extrabold uppercase tracking-wider border border-amber-400/30">
            <Trophy className="w-3.5 h-3.5" /> Technical Tournament Module
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {config?.event_name || 'KUCET Technical Quiz Console'}
          </h1>
          <p className="text-xs text-blue-100/80 max-w-xl">
            Authoritative question bank management, dynamic scoring configuration, live leaderboard monitoring, and session auditing.
          </p>
        </div>

        {/* Master Switches */}
        <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
          <div className="text-right pr-2 border-r border-white/20">
            <div className="text-xs font-extrabold uppercase tracking-wider text-blue-200">
              Tournament Status
            </div>
            <div className="text-xs font-bold text-white">
              {config?.is_enabled ? 'LIVE / ACTIVE' : 'INACTIVE'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleMaster}
            className={`
              px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer
              ${
                config?.is_enabled
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }
            `}
          >
            {config?.is_enabled ? 'Deactivate Quiz' : 'Activate Quiz'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('questions')}
          className={`
            px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer
            ${
              activeTab === 'questions'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }
          `}
        >
          <FileQuestion className="w-4 h-4" /> Question Bank ({questions.length})
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`
            px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer
            ${
              activeTab === 'leaderboard'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }
          `}
        >
          <Trophy className="w-4 h-4" /> Live Leaderboard ({leaderboard.length})
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`
            px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer
            ${
              activeTab === 'sessions'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }
          `}
        >
          Student Submissions ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`
            px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer
            ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }
          `}
        >
          Tournament Rules & Settings
        </button>
      </div>

      {/* TAB 1: QUESTION BANK */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Question Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={questionCategory}
                onChange={(e) => setQuestionCategory(e.target.value)}
                className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => openQuestionModal()}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          {/* Question Cards List */}
          {loadingQuestions ? (
            <div className="text-center py-12 text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading question bank...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              No questions found matching your criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {q.category}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">+{q.marks} Marks</span>
                      {q.negative_marks > 0 && (
                        <span className="text-xs font-bold text-rose-500">(-{q.negative_marks} Neg)</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openQuestionModal(q)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition cursor-pointer"
                        title="Edit Question"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                    {q.question_text}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options?.map((opt, oIdx) => {
                      const isCorrect = q.correct_option_index === oIdx;
                      return (
                        <div
                          key={oIdx}
                          className={`
                            p-2.5 rounded-xl border flex items-center justify-between
                            ${
                              isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 font-bold text-emerald-900 dark:text-emerald-200'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            }
                          `}
                        >
                          <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                          {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
                      <span className="font-bold">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Official Tournament Rankings
              </h2>
              <p className="text-xs text-slate-500">
                Sorted deterministically: Score DESC → Time Taken ASC → Earliest Submission ASC.
              </p>
            </div>
            <button
              onClick={fetchLeaderboard}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loadingLeaderboard ? (
            <div className="text-center py-12 text-xs text-slate-400">Loading standings...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No submissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-center">Accuracy</th>
                    <th className="py-3 px-4 text-center">Time Taken</th>
                    <th className="py-3 px-4 text-right">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leaderboard.map((entry) => {
                    let rankBadge = (
                      <span className="font-bold text-slate-600 dark:text-slate-400">#{entry.rank}</span>
                    );
                    if (entry.rank === 1) {
                      rankBadge = (
                        <span className="inline-flex items-center gap-1 font-black text-amber-500 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded-full border border-amber-300">
                          🏆 1st
                        </span>
                      );
                    } else if (entry.rank === 2) {
                      rankBadge = (
                        <span className="inline-flex items-center gap-1 font-black text-slate-600 bg-slate-200 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                          🥈 2nd
                        </span>
                      );
                    } else if (entry.rank === 3) {
                      rankBadge = (
                        <span className="inline-flex items-center gap-1 font-black text-amber-700 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full">
                          🥉 3rd
                        </span>
                      );
                    }

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">{rankBadge}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {entry.display_name}
                          </span>
                          <span className="text-[10px] text-slate-400">{entry.user_id}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                          {entry.department || 'General'}
                        </td>
                        <td className="py-3 px-4 text-center font-black text-blue-600 dark:text-blue-400">
                          {entry.score.toFixed(1)} / {entry.max_possible_score.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">
                          {entry.percentage.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">
                          {Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s
                        </td>
                        <td className="py-3 px-4 text-right text-[11px] text-slate-400">
                          {entry.submitted_at ? new Date(entry.submitted_at).toLocaleTimeString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESSIONS AUDITING */}
      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Student Sessions & Attempts
              </h2>
              <p className="text-xs text-slate-500">
                Audit live candidate sessions, view completed results, or reset student attempts.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
              />
            </div>
          </div>

          {loadingSessions ? (
            <div className="text-center py-12 text-xs text-slate-400">Loading attempts...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No session records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Session Code</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-center">Correct/Total</th>
                    <th className="py-3 px-4 text-center">Started</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {s.display_name}
                        </span>
                        <span className="text-[10px] text-slate-400">{s.user_id}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {s.session_code}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`
                            px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                            ${
                              s.status === 'SUBMITTED'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                                : s.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 animate-pulse'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                            }
                          `}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {s.score.toFixed(1)} / {s.max_possible_score.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
                        {s.total_correct} / {s.total_questions}
                      </td>
                      <td className="py-3 px-4 text-center text-[11px] text-slate-400">
                        {new Date(s.started_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleResetSession(s.id, s.display_name)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 text-[11px] font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                          title="Reset student attempt"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS & RULES */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 max-w-2xl"
        >
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Quiz Tournament Parameters
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure timer limits, marking schemes, and candidate access rules.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={settingsForm.duration_minutes}
                onChange={(e) => setSettingsForm({ ...settingsForm, duration_minutes: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Passing Percentage (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settingsForm.passing_percentage}
                onChange={(e) => setSettingsForm({ ...settingsForm, passing_percentage: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Default Marks per Question
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={settingsForm.marks_per_question}
                onChange={(e) => setSettingsForm({ ...settingsForm, marks_per_question: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Negative Marking Penalty
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={settingsForm.negative_marking}
                onChange={(e) => setSettingsForm({ ...settingsForm, negative_marking: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Instant Scorecard Display
              </span>
              <span className="text-[11px] text-slate-500">
                Show detailed solutions and marks immediately upon candidate submission.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settingsForm.show_instant_result}
              onChange={(e) => setSettingsForm({ ...settingsForm, show_instant_result: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* QUESTION MODAL: Create / Edit */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveQuestion}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {editingQuestion ? 'Edit Question' : 'Add New Question to Bank'}
              </h3>
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Question Statement *
              </label>
              <textarea
                required
                rows="3"
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                placeholder="Enter technical question text (code snippets supported)..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
              />
            </div>

            {/* 4 Options */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Answer Options & Correct Key *
              </label>
              {questionForm.options.map((optText, optIdx) => (
                <div key={optIdx} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct_option"
                    checked={questionForm.correct_option_index === optIdx}
                    onChange={() => setQuestionForm({ ...questionForm, correct_option_index: optIdx })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Select as correct option"
                  />
                  <span className="w-6 font-bold text-xs text-slate-500">
                    {String.fromCharCode(65 + optIdx)}.
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={`Option ${String.fromCharCode(65 + optIdx)} text...`}
                    value={optText}
                    onChange={(e) => {
                      const newOpts = [...questionForm.options];
                      newOpts[optIdx] = e.target.value;
                      setQuestionForm({ ...questionForm, options: newOpts });
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>

            {/* Metadata (Category, Difficulty, Marks, Negative) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Category</label>
                <input
                  type="text"
                  value={questionForm.category}
                  onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Difficulty</label>
                <select
                  value={questionForm.difficulty}
                  onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Marks</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={questionForm.marks}
                  onChange={(e) => setQuestionForm({ ...questionForm, marks: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Negative</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={questionForm.negative_marks}
                  onChange={(e) => setQuestionForm({ ...questionForm, negative_marks: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            {/* Explanation */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Solution Explanation (Optional)
              </label>
              <textarea
                rows="2"
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                placeholder="Explain why the selected option is correct..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-md cursor-pointer"
              >
                Save Question
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
