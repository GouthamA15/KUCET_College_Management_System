'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Target, Bell, Plus, Check, X, Trash2, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { GOAL_TYPES } from '@/lib/streak-config';

export default function AttendanceAnalyticsAndGoalsPanel({
  analytics,
  recognitionBadges = [],
  mode = 'analytics', // 'analytics' | 'goals'
}) {
  const [goals, setGoals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(mode === 'goals');

  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalType, setGoalType] = useState('SEMESTER_ATTENDANCE_PCT');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('90');
  const [goalSubject, setGoalSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchGoalsAndNotifications = useCallback(async () => {
    try {
      const [gRes, nRes] = await Promise.all([
        fetch('/api/student/attendance/goals'),
        fetch('/api/student/attendance/notifications?limit=20'),
      ]);
      if (gRes.ok) {
        const gJson = await gRes.json();
        setGoals(gJson.goals || []);
      }
      if (nRes.ok) {
        const nJson = await nRes.json();
        setNotifications(nJson.notifications || []);
        setRemindersEnabled(nJson.remindersEnabled !== false);
      }
    } catch (_err) {
      // Non-fatal
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'goals') return;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
        setPushSupported(true);
        if (reg && reg.pushManager) {
          reg.pushManager.getSubscription().then((sub) => {
            setPushSubscribed(Boolean(sub));
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    let active = true;
    (async () => {
      try {
        const [gRes, nRes] = await Promise.all([
          fetch('/api/student/attendance/goals'),
          fetch('/api/student/attendance/notifications?limit=20'),
        ]);
        if (!active) return;
        if (gRes.ok) {
          const gJson = await gRes.json();
          setGoals(gJson.goals || []);
        }
        if (nRes.ok) {
          const nJson = await nRes.json();
          setNotifications(nJson.notifications || []);
          setRemindersEnabled(nJson.remindersEnabled !== false);
        }
      } catch (_err) {
        // Non-fatal
      } finally {
        if (active) setLoadingGoals(false);
      }
    })();
    return () => { active = false; };
  }, [mode]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    const targetNum = parseInt(goalTarget, 10);
    if (!goalTitle.trim() || !Number.isInteger(targetNum) || targetNum <= 0) {
      toast.error('Please enter a valid goal title and positive target.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/student/attendance/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_type: goalType,
          title: goalTitle.trim(),
          target_value: targetNum,
          subject_code: goalType === 'SUBJECT_ATTENDANCE_PCT' ? goalSubject : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create goal');
      toast.success('Personal attendance goal saved!');
      setGoalTitle('');
      setShowNewGoal(false);
      await fetchGoalsAndNotifications();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelGoal = async (id) => {
    try {
      const res = await fetch(`/api/student/attendance/goals?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to cancel goal');
      toast.success('Goal cancelled');
      await fetchGoalsAndNotifications();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/student/attendance/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_READ' }),
      });
      await fetchGoalsAndNotifications();
    } catch (_err) {
      // Ignore
    }
  };

  const handleToggleReminders = async () => {
    const nextVal = !remindersEnabled;
    try {
      const res = await fetch('/api/student/attendance/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_PREFERENCE', reminders_enabled: nextVal }),
      });
      if (res.ok) {
        setRemindersEnabled(nextVal);
        toast.success(nextVal ? 'Milestone reminders enabled' : 'Non-essential reminders paused');
      }
    } catch (_err) {
      // Ignore
    }
  };

  const handleTogglePush = async () => {
    if (!pushSupported) return;
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) await sub.unsubscribe();
        await fetch('/api/notifications/subscribe', { method: 'DELETE' });
        setPushSubscribed(false);
        toast.success('Browser push notifications disabled');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Browser notification permission was not granted. In-app alerts remain active.');
          return;
        }
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          toast.error('Browser push is not configured on this server. In-app alerts remain active.');
          return;
        }
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        });
        const res = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        if (!res.ok) throw new Error('Failed to register push subscription');
        setPushSubscribed(true);
        toast.success('Browser push notifications enabled!');
      }
    } catch (err) {
      toast.error(err.message || 'Could not update browser push settings');
    } finally {
      setPushBusy(false);
    }
  };

  if (mode === 'analytics') {
    const counts = analytics?.counts || { present: 0, ncc: 0, medical: 0, absent: 0, total: 0, rate: 0 };
    const weeklyTrend = analytics?.weeklyTrend || [];
    const monthlyTrend = analytics?.monthlyTrend || [];
    const subjectInsights = analytics?.subjectInsights || [];
    const improvementDelta = analytics?.improvementDelta || 0;

    return (
      <div className="space-y-5">
        {/* Status Distribution & Improvement Card */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Present</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{counts.present}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">NCC (Attended)</div>
            <div className="text-2xl font-black text-blue-800 mt-1">{counts.ncc}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Medical (Attended)</div>
            <div className="text-2xl font-black text-indigo-800 mt-1">{counts.medical}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Absences</div>
            <div className="text-2xl font-black text-rose-700 mt-1">{counts.absent}</div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl border border-slate-200 bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Period Trend</div>
            <div className={`text-2xl font-black mt-1 flex items-center gap-1 ${
              improvementDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {improvementDelta >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span>{improvementDelta > 0 ? `+${improvementDelta}%` : `${improvementDelta}%`}</span>
            </div>
          </div>
        </div>

        {/* Weekly & Monthly Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Weekly Attendance Trend
            </h3>
            {weeklyTrend.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No weekly attendance data yet.</p>
            ) : (
              <div className="space-y-2">
                {weeklyTrend.slice(-6).map((w) => (
                  <div key={w.weekStart} className="space-y-1 text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-slate-600">Week of {w.weekStart}</span>
                      <span className="font-bold text-slate-800 tabular-nums">{w.attended}/{w.total} ({w.rate}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-[#0b3578] rounded-full" style={{ width: `${w.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Monthly Attendance Trend
            </h3>
            {monthlyTrend.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No monthly attendance data yet.</p>
            ) : (
              <div className="space-y-2">
                {monthlyTrend.map((m) => (
                  <div key={m.month} className="space-y-1 text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-slate-600">{m.month}</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {m.attended}/{m.total} ({m.rate}%)
                        {(m.ncc > 0 || m.medical > 0) ? ` • ${m.ncc} NCC, ${m.medical} MED` : ''}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${m.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Subject-Wise Insights */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Subject-Wise Insights (Inclusive of NCC & Medical)
          </h3>
          {subjectInsights.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No subject attendance records yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {subjectInsights.map((sub) => (
                <div key={sub.subjectCode} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{sub.subjectName} <span className="font-mono text-[10px] text-slate-400">({sub.subjectCode})</span></div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Attended: {sub.attended}/{sub.total} • Missed: {sub.absent}
                      {sub.ncc > 0 ? ` • NCC: ${sub.ncc}` : ''}
                      {sub.medical > 0 ? ` • Medical: ${sub.medical}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {sub.trendDelta !== 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sub.trendDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {sub.trendDelta > 0 ? `+${sub.trendDelta}%` : `${sub.trendDelta}%`}
                      </span>
                    )}
                    <span className={`text-sm font-black tabular-nums ${
                      sub.rate >= 75 ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {sub.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // mode === 'goals' (Goals, Recognition Badges & Notifications)
  return (
    <div className="space-y-5">
      {/* Personal Attendance Goals */}
      <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-[#0b3578]" />
              <span>Personal Attendance Goals</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Self-managed goals to track your personal progress. Separate from official college requirements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewGoal(!showNewGoal)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0b3578] text-white hover:bg-[#092a5e] cursor-pointer"
          >
            {showNewGoal ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{showNewGoal ? 'Cancel' : 'New Goal'}</span>
          </button>
        </div>

        {showNewGoal && (
          <form onSubmit={handleCreateGoal} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Goal Type</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  {GOAL_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Value</label>
                <input
                  type="number"
                  min="1"
                  max={goalType.includes('PCT') ? 100 : 1000}
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>
            {goalType === 'SUBJECT_ATTENDANCE_PCT' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject Code</label>
                <input
                  type="text"
                  placeholder="e.g. CS501"
                  value={goalSubject}
                  onChange={(e) => setGoalSubject(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Goal Title</label>
              <input
                type="text"
                placeholder="e.g. Reach 90% semester attendance"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-[#0b3578] text-white font-bold hover:bg-[#092a5e] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Personal Goal'}
            </button>
          </form>
        )}

        {loadingGoals ? (
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ) : goals.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            No personal goals created yet. Click &ldquo;New Goal&rdquo; to set a personal target.
          </div>
        ) : (
          <div className="space-y-2.5">
            {goals.map((g) => (
              <div key={g.id} className="p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{g.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      g.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : g.status === 'CANCELLED'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {g.status}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${g.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-[#0b3578]'}`}
                      style={{ width: `${g.progressPercentage || 0}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Progress: {g.current_value} / {g.target_value} {g.goal_type.includes('PCT') ? '%' : 'classes'}
                  </div>
                </div>
                {g.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => handleCancelGoal(g.id)}
                    aria-label="Cancel goal"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 self-end sm:self-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recognition Categories */}
      <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span>Recognition Categories</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {recognitionBadges.map((b) => (
            <div
              key={b.code}
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                b.unlocked ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50/70 border-slate-200 opacity-75'
              }`}
            >
              <span className={`text-xl select-none ${b.unlocked ? '' : 'grayscale opacity-60'}`}>{b.emoji}</span>
              <div className="min-w-0">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                  <span>{b.title}</span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                    {b.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* In-App Notifications */}
      <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#0b3578]" />
            <span>Achievement & Streak Notifications</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {pushSupported && (
              <button
                type="button"
                disabled={pushBusy}
                onClick={handleTogglePush}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer disabled:opacity-50 ${
                  pushSubscribed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pushBusy ? 'Updating...' : pushSubscribed ? 'Push Alerts: Enabled' : 'Enable Push Alerts'}
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleReminders}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Reminders: {remindersEnabled ? 'On' : 'Paused'}
            </button>
            {notifications.some((n) => !n.is_read) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No streak notifications yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n.id} className={`py-2.5 flex items-start gap-2.5 text-xs ${n.is_read ? 'opacity-70' : ''}`}>
                <span className="text-lg select-none">{n.emoji_char || '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800">{n.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{n.message}</div>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
