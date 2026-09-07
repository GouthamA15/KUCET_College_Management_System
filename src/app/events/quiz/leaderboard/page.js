'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  ArrowLeft,
  Search,
  RefreshCw,
  Zap
} from 'lucide-react';

export default function QuizLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/events/quiz/leaderboard?limit=100');
      const data = await res.json();
      setLeaderboard(data?.leaderboard || []);
    } catch (_e) {
      // error handling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch('/api/events/quiz/leaderboard?limit=100');
        const data = await res.json();
        if (isMounted) {
          setLeaderboard(data?.leaderboard || []);
        }
      } catch (_e) {
        // error handling
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const departments = Array.from(new Set(leaderboard.map((e) => e.department))).filter(Boolean);

  const filtered = leaderboard.filter((entry) => {
    const matchesSearch =
      entry.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      entry.user_id?.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || entry.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-400/30">
              <Trophy className="w-3.5 h-3.5" /> Official Standings
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Technical Quiz Leaderboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Live tournament rankings across all departments with deterministic tie-breaking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/events/quiz"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
            >
              <Zap className="w-3.5 h-3.5" /> Enter Quiz Arena
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Events Hub
            </Link>
          </div>
        </div>

        {/* Podium Top 3 Cards */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Rank 2 */}
            {top3[1] && (
              <div className="order-2 sm:order-1 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md text-center space-y-3 relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto text-xl font-black">
                  🥈
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2nd Place</span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {top3[1].display_name}
                  </h3>
                  <p className="text-xs text-slate-400">{top3[1].department || 'General'}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-black text-blue-600 dark:text-blue-400">
                  {top3[1].score.toFixed(1)} Pts • {top3[1].percentage.toFixed(0)}%
                </div>
              </div>
            )}

            {/* Rank 1 */}
            {top3[0] && (
              <div className="order-1 sm:order-2 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-7 text-white shadow-xl text-center space-y-3 relative overflow-hidden sm:-translate-y-2">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-amber-100 flex items-center justify-center mx-auto text-2xl font-black border border-white/30">
                  🏆
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">
                    Grand Champion (1st)
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    {top3[0].display_name}
                  </h3>
                  <p className="text-xs text-amber-100">{top3[0].department || 'General'}</p>
                </div>
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl text-xs font-black text-white">
                  {top3[0].score.toFixed(1)} Pts • {top3[0].percentage.toFixed(0)}% Accuracy
                </div>
              </div>
            )}

            {/* Rank 3 */}
            {top3[2] && (
              <div className="order-3 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md text-center space-y-3 relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-700 flex items-center justify-center mx-auto text-xl font-black">
                  🥉
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">3rd Place</span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {top3[2].display_name}
                  </h3>
                  <p className="text-xs text-slate-400">{top3[2].department || 'General'}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-black text-blue-600 dark:text-blue-400">
                  {top3[2].score.toFixed(1)} Pts • {top3[2].percentage.toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or roll number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                />
              </div>

              {departments.length > 0 && (
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={fetchLeaderboard}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="Refresh Standings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Full Standings Table */}
          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading tournament standings...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No results match your search or filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
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
                  {filtered.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3.5 px-4 font-black">
                        {entry.rank === 1 ? (
                          <span className="text-amber-500">🏆 #1</span>
                        ) : entry.rank === 2 ? (
                          <span className="text-slate-400">🥈 #2</span>
                        ) : entry.rank === 3 ? (
                          <span className="text-amber-700">🥉 #3</span>
                        ) : (
                          <span className="text-slate-500">#{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {entry.display_name}
                        </span>
                        <span className="text-[10px] text-slate-400">{entry.user_id}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300">
                        {entry.department || 'General'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-blue-600 dark:text-blue-400">
                        {entry.score.toFixed(1)} / {entry.max_possible_score.toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                        {entry.percentage.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                        {Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s
                      </td>
                      <td className="py-3.5 px-4 text-right text-[11px] text-slate-400">
                        {entry.submitted_at ? new Date(entry.submitted_at).toLocaleTimeString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
