'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  ArrowLeft,
  Search,
  RefreshCw,
  Medal,
  Clock
} from 'lucide-react';

export default function QuizLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
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
    <div className="space-y-6 text-sm">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Technical Quiz — Tournament Standings
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Official collegiate rankings evaluated by total score and completion speed.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <Link
            href="/events/quiz"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-sm"
          >
            Enter Quiz Arena
          </Link>

          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Events Hub
          </Link>
        </div>
      </header>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rank 1 */}
          {top3[0] && (
            <div className="bg-white rounded-sm border border-amber-300 p-5 shadow-sm space-y-2 relative order-1 md:order-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Trophy className="w-3.5 h-3.5 text-amber-600" /> Rank #1 (Champion)
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {top3[0].percentage.toFixed(0)}% Accuracy
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">{top3[0].display_name}</h3>
                <p className="text-xs text-gray-500 font-mono">
                  {top3[0].user_id} {top3[0].department ? `• ${top3[0].department}` : ''}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Score: <strong className="text-[#0b3578] text-sm">{top3[0].score.toFixed(1)}</strong> Pts</span>
                <span className="text-gray-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {Math.floor(top3[0].time_taken_seconds / 60)}m {top3[0].time_taken_seconds % 60}s
                </span>
              </div>
            </div>
          )}

          {/* Rank 2 */}
          {top3[1] && (
            <div className="bg-white rounded-sm border border-gray-300 p-5 shadow-sm space-y-2 relative order-2 md:order-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  <Medal className="w-3.5 h-3.5 text-gray-500" /> Rank #2
                </span>
                <span className="text-xs font-semibold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                  {top3[1].percentage.toFixed(0)}%
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">{top3[1].display_name}</h3>
                <p className="text-xs text-gray-500 font-mono">
                  {top3[1].user_id} {top3[1].department ? `• ${top3[1].department}` : ''}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Score: <strong className="text-gray-800">{top3[1].score.toFixed(1)}</strong> Pts</span>
                <span className="text-gray-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {Math.floor(top3[1].time_taken_seconds / 60)}m {top3[1].time_taken_seconds % 60}s
                </span>
              </div>
            </div>
          )}

          {/* Rank 3 */}
          {top3[2] && (
            <div className="bg-white rounded-sm border border-gray-300 p-5 shadow-sm space-y-2 relative order-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50/60 text-amber-900 border border-amber-200">
                  <Medal className="w-3.5 h-3.5 text-amber-700" /> Rank #3
                </span>
                <span className="text-xs font-semibold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                  {top3[2].percentage.toFixed(0)}%
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">{top3[2].display_name}</h3>
                <p className="text-xs text-gray-500 font-mono">
                  {top3[2].user_id} {top3[2].department ? `• ${top3[2].department}` : ''}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Score: <strong className="text-gray-800">{top3[2].score.toFixed(1)}</strong> Pts</span>
                <span className="text-gray-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {Math.floor(top3[2].time_taken_seconds / 60)}m {top3[2].time_taken_seconds % 60}s
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-sm border border-gray-300 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search contender name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-600 whitespace-nowrap">Department:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-xs rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <div className="bg-white rounded-sm border border-gray-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Contender</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4 text-center">Accuracy</th>
                <th className="py-3 px-4 text-center">Time Taken</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0b3578]" />
                    <span>Loading standings...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No assessment results recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-bold">
                      {entry.rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                          1
                        </span>
                      ) : entry.rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">
                          2
                        </span>
                      ) : entry.rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                          3
                        </span>
                      ) : (
                        <span className="text-gray-500 font-medium">#{entry.rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800">{entry.display_name}</td>
                    <td className="py-3 px-4 font-mono text-gray-600">{entry.user_id}</td>
                    <td className="py-3 px-4 text-gray-600">{entry.department || '—'}</td>
                    <td className="py-3 px-4 text-center font-bold text-[#0b3578]">
                      {entry.score.toFixed(1)} <span className="text-gray-400 font-normal">/ {entry.max_possible_score.toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-gray-700">
                      {entry.percentage.toFixed(0)}%
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-gray-600">
                      {Math.floor(entry.time_taken_seconds / 60)}m {entry.time_taken_seconds % 60}s
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`
                          px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                          ${
                            entry.status === 'SUBMITTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }
                        `}
                      >
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
  );
}
