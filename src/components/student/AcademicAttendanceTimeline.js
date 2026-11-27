'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, XCircle, Calendar,
  Sparkles, AlertCircle, Search
} from 'lucide-react';
import { useStudent } from '@/context/StudentContext';
import { DEFAULT_STREAK_EMOJI, computeAttendanceAnalytics } from '@/lib/streak-config';
import StreakRewardsModal from './StreakRewardsModal';
import AttendanceCalendarPanel from './AttendanceCalendarPanel';
import AttendanceAnalyticsAndGoalsPanel from './AttendanceAnalyticsAndGoalsPanel';
import {
  AttendanceDisputeModal,
  AttendanceDisputeResponseModal,
  DisputeStatusActions,
  findMatchingDispute,
} from './AttendanceDisputeModal';

export default function AcademicAttendanceTimeline({ overallSubjects = [] }) {
  const { streakData, refreshStreak, attendanceSyncVersion = 0 } = useStudent();

  const [activeSubView, setActiveSubView] = useState('timeline'); // 'timeline' | 'summary'
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [disputes, setDisputes] = useState([]);
  const [selectedDisputeItem, setSelectedDisputeItem] = useState(null);
  const [respondingDispute, setRespondingDispute] = useState(null);

  const currentStreak = streakData?.currentStreak || 0;
  const longestStreak = streakData?.longestStreak || 0;
  const totalAttended = streakData?.totalAttendedClasses || 0;
  const totalEligible = streakData?.totalEligibleClasses || 0;
  const selectedEmoji = streakData?.selectedEmoji || DEFAULT_STREAK_EMOJI;
  const nextMilestone = streakData?.nextMilestone || null;
  const milestoneProgress = streakData?.milestoneProgress || null;

  const fetchHistory = React.useCallback(async (isMounted = { current: true }) => {
    setLoading(true);
    setError(null);
    try {
      const [historyRes, disputesRes] = await Promise.all([
        fetch('/api/student/attendance/streak/history', { cache: 'no-store' }),
        fetch('/api/student/attendance/disputes', { cache: 'no-store' }).catch(() => null),
      ]);
      const json = await historyRes.json();
      if (!historyRes.ok) throw new Error(json.error || 'Failed to load class attendance history');
      if (isMounted.current) {
        setTimeline(json.timeline || []);
        if (disputesRes && disputesRes.ok) {
          try {
            const disputesJson = await disputesRes.json();
            if (disputesJson?.data) setDisputes(disputesJson.data);
          } catch (_dErr) {
            // Ignore malformed dispute payload without breaking timeline
          }
        }
      }
    } catch (err) {
      if (isMounted.current) setError(err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const handleDisputeSuccess = React.useCallback(async () => {
    await fetchHistory();
    if (typeof refreshStreak === 'function') {
      await refreshStreak();
    }
  }, [fetchHistory, refreshStreak]);

  // Initial load
  useEffect(() => {
    const isMounted = { current: true };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory(isMounted);
    return () => { isMounted.current = false; };
  }, [fetchHistory]);

  // Synchronize timeline and disputes whenever streakData or attendanceSyncVersion changes (e.g. via real-time WebSocket event or refreshStreak)
  const streakDataHash = streakData ? `${streakData.currentStreak}-${streakData.totalAttendedClasses}-${streakData.longestStreak}` : null;
  const syncKey = `${streakDataHash ?? 'init'}:${attendanceSyncVersion}`;
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const isMounted = { current: true };
    fetchHistory(isMounted);
    return () => { isMounted.current = false; };
  }, [syncKey, fetchHistory]);

  // Fallback revalidation on tab focus / visibility return (throttled to 15s) in case WebSocket was disconnected
  const lastFocusSyncRef = React.useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocusOrVisible = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 15000) return;
      lastFocusSyncRef.current = now;
      fetchHistory({ current: true });
      if (typeof refreshStreak === 'function') {
        refreshStreak();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [fetchHistory, refreshStreak]);

  // Filtered timeline (preserves server-returned descending chronological order)
  const filteredTimeline = useMemo(() => {
    return timeline.filter((item) => {
      if (selectedSubject !== 'ALL' && item.subjectCode !== selectedSubject) {
        return false;
      }
      if (selectedStatus === 'PRESENT' && !item.isAttended) {
        return false;
      }
      if (selectedStatus === 'ABSENT' && item.isAttended) {
        return false;
      }
      if (startDate && String(item.date) < startDate) {
        return false;
      }
      if (endDate && String(item.date) > endDate) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = String(item.subjectName || '').toLowerCase().includes(q);
        const matchCode = String(item.subjectCode || '').toLowerCase().includes(q);
        const matchTopic = String(item.topic || '').toLowerCase().includes(q);
        const matchDate = String(item.date || '').toLowerCase().includes(q);
        if (!matchSubject && !matchCode && !matchTopic && !matchDate) {
          return false;
        }
      }
      return true;
    });
  }, [timeline, selectedSubject, selectedStatus, startDate, endDate, searchQuery]);

  const visibleTimeline = useMemo(() => {
    return filteredTimeline.slice(0, visibleCount);
  }, [filteredTimeline, visibleCount]);

  const analytics = useMemo(() => {
    return computeAttendanceAnalytics(timeline);
  }, [timeline]);

  const uniqueSubjects = useMemo(() => {
    const map = new Map();
    for (const item of timeline) {
      if (item.subjectCode && !map.has(item.subjectCode)) {
        map.set(item.subjectCode, item.subjectName);
      }
    }
    return Array.from(map.entries());
  }, [timeline]);

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl select-none leading-none">
                {selectedEmoji.char}
              </span>
              <span>Attendance Streaks & History</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Consecutive attendance is tracked across all scheduled timetable periods.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0b3578] bg-blue-50 hover:bg-blue-100/70 border border-blue-200 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Emoji Collection</span>
            </button>
          </div>
        </div>

        {/* 4-Stat Metric Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Current Streak */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
            currentStreak > 0
              ? 'bg-gradient-to-br from-orange-50/70 to-amber-50/30 border-orange-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Current Streak
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-black ${
                currentStreak > 0 ? 'text-orange-600' : 'text-slate-600'
              }`}>
                {currentStreak}
              </span>
              <span className="text-xs font-semibold text-slate-500">classes</span>
            </div>
          </div>

          {/* Personal Best */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Personal Best
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-800">
                {longestStreak}
              </span>
              <span className="text-xs font-semibold text-slate-500">classes</span>
            </div>
          </div>

          {/* Attended Classes */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Attended
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                {totalAttended}
              </span>
              <span className="text-xs font-semibold text-slate-500">classes</span>
            </div>
          </div>

          {/* Overall Percentage */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Overall Rate
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-[#0b3578]">
                {totalEligible > 0 ? `${Math.round((totalAttended / totalEligible) * 100)}%` : '--'}
              </span>
              <span className="text-xs font-semibold text-slate-500">of {totalEligible} held</span>
            </div>
          </div>
        </div>

        {/* Next Milestone Progress Bar */}
        {nextMilestone && milestoneProgress && (
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-blue-900">
              <span className="flex items-center gap-1.5">
                <span className="text-sm select-none leading-none">{nextMilestone.emoji_char}</span>
                <span>Next Milestone: {nextMilestone.title}</span>
              </span>
              <span className="text-[11px] font-extrabold text-blue-700 tabular-nums">
                {milestoneProgress.current} / {milestoneProgress.target} classes
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-blue-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-[#0b3578] rounded-full transition-all duration-500"
                style={{ width: `${milestoneProgress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Sub-Tab Toggle */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubView('timeline')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeSubView === 'timeline'
              ? 'bg-[#0b3578] text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Class Timeline ({timeline.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('calendar')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeSubView === 'calendar'
              ? 'bg-[#0b3578] text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Calendar
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('analytics')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeSubView === 'analytics'
              ? 'bg-[#0b3578] text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Analytics & Insights
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('goals')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeSubView === 'goals'
              ? 'bg-[#0b3578] text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Goals & Badges
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('summary')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeSubView === 'summary'
              ? 'bg-[#0b3578] text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Subject Chart
        </button>
      </div>

      {/* 3. Sub-View: Timeline */}
      {activeSubView === 'timeline' && (
        <div className="space-y-4">
          {/* Controls / Filter Bar */}
          <div className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 text-xs">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search topic, subject or date..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(25); }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0b3578] text-xs"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by subject"
                value={selectedSubject}
                onChange={(e) => { setSelectedSubject(e.target.value); setVisibleCount(25); }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none max-w-full"
              >
                <option value="ALL">All Subjects</option>
                {uniqueSubjects.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} - {name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by status"
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setVisibleCount(25); }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present Only</option>
                <option value="ABSENT">Missed Only</option>
              </select>

              <input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setVisibleCount(25); }}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
              />
              <input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setVisibleCount(25); }}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Timeline List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-600" />
              {error}
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 text-xs space-y-1">
              <Calendar className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="font-semibold text-slate-700">No class sessions match the selected filters</p>
              <p className="text-slate-400">Class sessions will appear here as attendance is submitted by faculty.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleTimeline.map((item, idx) => {
                const isAttended = item.isAttended;
                const existingDispute =
                  item.status === 'ABSENT'
                    ? findMatchingDispute(disputes, {
                        assignmentId: item.assignmentId,
                        date: item.date,
                        sessionNumber: item.sessionNumber,
                      })
                    : null;
                return (
                  <div
                    key={`${item.sessionId || item.date}_${item.sessionNumber}_${idx}`}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                      isAttended
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {/* Left: Class info */}
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isAttended ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-600'
                        }`}>
                          {isAttended ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {item.subjectName}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {item.subjectCode}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              Period {item.sessionNumber}
                            </span>
                            {item.batchNumber > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                Batch {item.batchNumber}
                              </span>
                            )}
                          </div>

                          {item.topic ? (
                            <p className="text-[11.5px] text-slate-600 mt-1 line-clamp-2">
                              <span className="font-medium text-slate-500">Topic: </span>
                              {item.topic}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-0.5 italic">
                              No topic logged for this session
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Date, Status & Streak State */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-[11px] font-semibold text-slate-500">
                          {item.date}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            item.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.status === 'NCC' || item.status === 'MEDICAL'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {item.status}
                          </span>

                          <DisputeStatusActions
                            status={item.status}
                            existingDispute={existingDispute}
                            onOpenDispute={() => setSelectedDisputeItem(item)}
                            onRespond={(dispute) => setRespondingDispute(dispute)}
                          />

                          <span className={`text-xs font-black tabular-nums px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            isAttended
                              ? 'bg-orange-50 border-orange-200 text-orange-700'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}>
                            <span className="text-[11px] select-none">{isAttended ? '🔥' : '⚠️'}</span>
                            <span>{item.streakAfterClass}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Streak Break Warning Bar */}
                    {item.isBreak && (
                      <div className="mt-2.5 pt-2 border-t border-rose-100 flex items-center justify-between text-[11px] text-rose-700">
                        <span className="font-semibold">
                          ⚠️ Streak reset to 0 due to absence in Period {item.sessionNumber}.
                        </span>
                        <span className="text-[10.5px] text-rose-600">
                          Personal best preserved at {longestStreak}.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredTimeline.length > visibleCount && (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 25)}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-[#0b3578] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                  >
                    Load Older Classes ({filteredTimeline.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {activeSubView === 'calendar' && (
        <AttendanceCalendarPanel calendarDays={analytics.calendarDays} />
      )}

      {/* Analytics & Subject Insights View */}
      {activeSubView === 'analytics' && (
        <AttendanceAnalyticsAndGoalsPanel
          mode="analytics"
          analytics={analytics}
          recognitionBadges={streakData?.recognitionBadges || []}
        />
      )}

      {/* Personal Goals, Badges & Notifications View */}
      {activeSubView === 'goals' && (
        <AttendanceAnalyticsAndGoalsPanel
          mode="goals"
          analytics={analytics}
          recognitionBadges={streakData?.recognitionBadges || []}
        />
      )}

      {/* 4. Sub-View: Subject-Wise Summary (Existing Bar Chart) */}
      {activeSubView === 'summary' && (
        <div className="p-4 sm:p-6 rounded-xl border border-slate-200 bg-white space-y-6">
          <h3 className="text-base font-bold text-slate-800">
            Subject-Wise Attendance Distribution
          </h3>

          {overallSubjects.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p className="text-base font-semibold text-slate-700">No attendance records for the current semester</p>
              <p className="text-xs text-slate-500 mt-1">
                Records will appear once faculty begins taking attendance.
              </p>
            </div>
          ) : (
            <>
              {/* Custom Vertical Bar Chart */}
              <div className="relative h-48 sm:h-56 w-full flex items-end justify-between gap-1 sm:gap-3 mb-6 pr-2 sm:pr-4">
                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[10px] sm:text-xs text-gray-800 font-bold pb-6 z-0">
                  <span>100%</span>
                  <span>50%</span>
                  <span>0%</span>
                </div>

                <div className="ml-8 flex-1 flex items-end justify-around h-full pb-6 relative z-10 border-b border-gray-200">
                  {overallSubjects.map((sub, idx) => {
                    const pct = sub.total_classes > 0 ? (sub.attended_classes / sub.total_classes) * 100 : 0;
                    const colors = ['#f97316', '#06b6d4', '#0ea5e9', '#84cc16', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#ef4444', '#10b981'];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={`bar-${sub.subject_code}`} className="w-full max-w-[2.5rem] md:max-w-[3.5rem] mx-1 sm:mx-2 flex flex-col items-center justify-end h-full group">
                        <div 
                          className="w-full rounded-t-sm transition-all duration-700 hover:opacity-80 cursor-pointer shadow-sm" 
                          style={{ height: `${pct}%`, backgroundColor: color }}
                          title={`${sub.subject_name}: ${pct.toFixed(2)}%`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Subject Breakdown List */}
              <div className="divide-y divide-slate-100">
                {overallSubjects.map((sub, idx) => {
                  const pct = sub.total_classes > 0 ? (sub.attended_classes / sub.total_classes) * 100 : 0;
                  const colors = ['#f97316', '#06b6d4', '#0ea5e9', '#84cc16', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#ef4444', '#10b981'];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={`list-${sub.subject_code}`} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">
                            {sub.subject_name}
                          </span>
                          <span className="ml-2 text-[10px] font-mono text-slate-400">
                            ({sub.subject_code})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-mono">
                          {sub.attended_classes || 0} / {sub.total_classes || 0}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-gray-900 w-12 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Rewards Modal */}
      <StreakRewardsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        streakData={streakData}
        onEmojiSelected={refreshStreak}
      />

      {/* Attendance Dispute Modals */}
      <AttendanceDisputeModal
        session={selectedDisputeItem}
        subjectName={selectedDisputeItem?.subjectName}
        subjectCode={selectedDisputeItem?.subjectCode}
        assignmentId={selectedDisputeItem?.assignmentId}
        onClose={() => setSelectedDisputeItem(null)}
        onSuccess={handleDisputeSuccess}
      />

      <AttendanceDisputeResponseModal
        dispute={respondingDispute}
        onClose={() => setRespondingDispute(null)}
        onSuccess={handleDisputeSuccess}
      />
    </div>
  );
}
