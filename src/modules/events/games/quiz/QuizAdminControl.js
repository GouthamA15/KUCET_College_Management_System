'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  X,
  Settings,
  Users,
  Clock,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

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

  // Fetch Questions
  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const res = await fetch('/api/events/quiz/questions?active_only=false');
      const data = await res.json();
      setQuestions(data?.questions || []);
    } catch (_err) {
      toast.error('Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  // Fetch Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/events/quiz/leaderboard?limit=100');
      const data = await res.json();
      setLeaderboard(data?.leaderboard || []);
    } catch (_err) {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Fetch Sessions
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/events/quiz/admin/sessions');
      const data = await res.json();
      setSessions(data?.sessions || []);
    } catch (_err) {
      toast.error('Failed to load student sessions');
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

  // Master Toggle: Enable / Disable Quiz
  const handleToggleMaster = async () => {
    const newState = !config?.is_enabled;
    const toastId = toast.loading('Updating event status...');
    try {
      const res = await fetch('/api/events/quiz/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: newState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update config');
      setConfig(data);
      toast.success(newState ? 'Technical Quiz is now Live' : 'Technical Quiz is now Inactive', { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    const toastId = toast.loading('Saving configuration...');
    try {
      const res = await fetch('/api/events/quiz/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules_json: {
            duration_minutes: parseInt(settingsForm.duration_minutes, 10),
            passing_percentage: parseFloat(settingsForm.passing_percentage),
            marks_per_question: parseFloat(settingsForm.marks_per_question),
            negative_marking: parseFloat(settingsForm.negative_marking),
            max_attempts_per_user: parseInt(settingsForm.max_attempts_per_user, 10),
            show_instant_result: Boolean(settingsForm.show_instant_result),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');
      setConfig(data);
      toast.success('Quiz settings updated successfully', { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setSavingSettings(false);
    }
  };

  // Open Question Modal for Create
  const handleOpenCreateQuestion = () => {
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
    setShowQuestionModal(true);
  };

  // Open Question Modal for Edit
  const handleOpenEditQuestion = (q) => {
    setEditingQuestion(q);
    const rawOptions = Array.isArray(q.options_json)
      ? q.options_json
      : typeof q.options_json === 'string'
      ? JSON.parse(q.options_json)
      : ['', '', '', ''];

    setQuestionForm({
      question_text: q.question_text || '',
      options: rawOptions.length >= 4 ? rawOptions : [...rawOptions, '', '', ''].slice(0, 4),
      correct_option_index: q.correct_option_index ?? 0,
      explanation: q.explanation || '',
      marks: parseFloat(q.marks) || 2.0,
      negative_marks: parseFloat(q.negative_marks) || 0.0,
      category: q.category || 'Computer Science',
      difficulty: q.difficulty || 'MEDIUM',
      is_active: Boolean(q.is_active),
    });
    setShowQuestionModal(true);
  };

  // Save Question (Create or Update)
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!questionForm.question_text.trim()) {
      toast.error('Question text cannot be empty');
      return;
    }

    const cleanOptions = questionForm.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      toast.error('Please provide at least 2 valid options');
      return;
    }

    const toastId = toast.loading('Saving question...');
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
        toast.success('Question updated successfully', { id: toastId });
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
        toast.success('Question added to bank', { id: toastId });
      }

      setShowQuestionModal(false);
      fetchQuestions();
    } catch (_err) {
      toast.error('Error saving question', { id: toastId });
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    const toastId = toast.loading('Removing question...');
    try {
      const res = await fetch(`/api/events/quiz/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Question removed from bank', { id: toastId });
      fetchQuestions();
    } catch (_err) {
      toast.error('Failed to delete question', { id: toastId });
    }
  };

  // Reset Student Session
  const handleResetSession = async (sessionId, studentName) => {
    if (!confirm(`Reset attempt for ${studentName}? This will permanently delete their answers and allow them to retake the quiz.`)) {
      return;
    }
    const toastId = toast.loading(`Resetting session for ${studentName}...`);
    try {
      const res = await fetch('/api/events/quiz/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error('Reset failed');
      toast.success(`Session reset for ${studentName}`, { id: toastId });
      fetchSessions();
    } catch (_err) {
      toast.error('Failed to reset session', { id: toastId });
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
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin" className="hover:text-slate-700 transition-colors">
          Super Admin
        </Link>
        <span>/</span>
        <Link href="/admin/events" className="hover:text-slate-700 transition-colors">
          Events Management
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">Technical Quiz Console</span>
      </div>

      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Technical Quiz Administration
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Question bank authoring, dynamic scoring parameters, candidate attempt auditing, and live standings.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleToggleMaster}
            className={`
              px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs cursor-pointer
              ${
                config?.is_enabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            `}
          >
            {config?.is_enabled ? 'Deactivate Quiz Event' : 'Activate Quiz Event'}
          </button>
        </div>
      </header>

      {/* Top 4 Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <FileQuestion className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Question Bank</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{questions.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-emerald-600 mb-1">
            <Users className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Submissions</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-amber-600 mb-1">
            <Trophy className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Ranked Contenders</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{leaderboard.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Event Status</span>
          </div>
          <p className="text-sm font-bold mt-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                config?.is_enabled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {config?.is_enabled ? 'Active / Open' : 'Inactive / Closed'}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-xs w-full sm:w-auto overflow-x-auto">
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'questions'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Question Bank ({questions.length})
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Candidate Submissions ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Standings ({leaderboard.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Settings & Rules
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QUESTION BANK */}
      {/* ========================================================================= */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search questions or categories..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              <select
                value={questionCategory}
                onChange={(e) => setQuestionCategory(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
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
              onClick={handleOpenCreateQuestion}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Question Text</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Marks</th>
                    <th className="py-3 px-4 text-center">Difficulty</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingQuestions ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0b3578]" />
                        <span>Loading question bank...</span>
                      </td>
                    </tr>
                  ) : filteredQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No questions found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredQuestions.map((q, idx) => (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-semibold text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-4 font-medium text-gray-800 max-w-md truncate">
                          {q.question_text}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{q.category}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          +{q.marks} {q.negative_marks > 0 ? `/ -${q.negative_marks}` : ''}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              q.difficulty === 'EASY'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : q.difficulty === 'HARD'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {q.difficulty}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              q.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {q.is_active ? 'Active' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditQuestion(q)}
                              className="p-1 rounded text-slate-500 hover:text-[#0b3578] hover:bg-slate-100 cursor-pointer"
                              title="Edit Question"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CANDIDATE SUBMISSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate name, roll number, or session code..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
              />
            </div>
            <button
              onClick={fetchSessions}
              disabled={loadingSessions}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-center">Accuracy</th>
                    <th className="py-3 px-4 text-center">Time Taken</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingSessions ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0b3578]" />
                        <span>Loading student sessions...</span>
                      </td>
                    </tr>
                  ) : filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No candidate attempts recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-800">{s.display_name}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{s.user_id}</td>
                        <td className="py-3 px-4 text-slate-600">{s.department || '—'}</td>
                        <td className="py-3 px-4 text-center font-bold text-[#0b3578]">
                          {s.score} / {s.max_possible_score}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {s.percentage}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">
                          {Math.floor(s.time_taken_seconds / 60)}m {s.time_taken_seconds % 60}s
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              s.status === 'SUBMITTED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : s.status === 'EXPIRED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-blue-50 text-[#0b3578] border border-blue-200'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleResetSession(s.id, s.display_name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
                            title="Reset attempt and allow re-test"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset Attempt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STANDINGS */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Live Official Standings
            </h3>
            <button
              onClick={fetchLeaderboard}
              disabled={loadingLeaderboard}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaderboard ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Contender</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-center">Accuracy</th>
                    <th className="py-3 px-4 text-center">Time Taken</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingLeaderboard ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0b3578]" />
                        <span>Loading tournament rankings...</span>
                      </td>
                    </tr>
                  ) : leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No submissions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-bold">
                          {entry.rank <= 3 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                              {entry.rank}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium">#{entry.rank}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-800">{entry.display_name}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{entry.user_id}</td>
                        <td className="py-3 px-4 text-slate-600">{entry.department || '—'}</td>
                        <td className="py-3 px-4 text-center font-bold text-[#0b3578]">
                          {entry.score.toFixed(1)} / {entry.max_possible_score.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {entry.percentage.toFixed(0)}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">
                          {Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SETTINGS & RULES */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-3xl space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#0b3578]" /> Quiz Engine Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure exam duration, evaluation metrics, negative marking weights, and student attempt thresholds.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={settingsForm.duration_minutes}
                  onChange={(e) => setSettingsForm({ ...settingsForm, duration_minutes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Passing Percentage (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settingsForm.passing_percentage}
                  onChange={(e) => setSettingsForm({ ...settingsForm, passing_percentage: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Marks per Correct Answer
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={settingsForm.marks_per_question}
                  onChange={(e) => setSettingsForm({ ...settingsForm, marks_per_question: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Negative Mark Deductions
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={settingsForm.negative_marking}
                  onChange={(e) => setSettingsForm({ ...settingsForm, negative_marking: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUESTION CREATE / EDIT MODAL */}
      {/* ========================================================================= */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-gray-800">
                {editingQuestion ? 'Edit Question Details' : 'Add New Question to Bank'}
              </h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Question Statement *</label>
                <textarea
                  required
                  rows={3}
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                  placeholder="e.g. What is the time complexity of QuickSort in the average case?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block font-semibold text-gray-700">
                  Multiple Choice Options (Select radio button for the correct key) *
                </label>
                {questionForm.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct_option"
                      checked={questionForm.correct_option_index === optIdx}
                      onChange={() => setQuestionForm({ ...questionForm, correct_option_index: optIdx })}
                      className="text-[#0b3578] focus:ring-[#0b3578] cursor-pointer"
                    />
                    <span className="w-5 font-bold text-slate-500">{String.fromCharCode(65 + optIdx)}</span>
                    <input
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...questionForm.options];
                        newOpts[optIdx] = e.target.value;
                        setQuestionForm({ ...questionForm, options: newOpts });
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + optIdx)} text`}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                    />
                  </div>
                ))}
              </div>

              {/* Explanation */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Explanation / Solution Rationale (Displayed on scorecard)
                </label>
                <textarea
                  rows={2}
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  placeholder="e.g. QuickSort partitions the array around a pivot..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              {/* Category, Difficulty, Marks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Difficulty</label>
                  <select
                    value={questionForm.difficulty}
                    onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Marks (+ / -)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={questionForm.marks}
                      onChange={(e) => setQuestionForm({ ...questionForm, marks: e.target.value })}
                      placeholder="Marks"
                      className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                    />
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={questionForm.negative_marks}
                      onChange={(e) => setQuestionForm({ ...questionForm, negative_marks: e.target.value })}
                      placeholder="Neg"
                      className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active_check"
                  checked={questionForm.is_active}
                  onChange={(e) => setQuestionForm({ ...questionForm, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-[#0b3578] focus:ring-[#0b3578]"
                />
                <label htmlFor="is_active_check" className="font-semibold text-gray-700">
                  Active (Include in candidate assessments)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
