'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Swords,
  Users,
  ExternalLink,
  CheckCircle,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import ParticipantRegistrationModal from './ParticipantRegistrationModal';
import TournamentBracketTree from './TournamentBracketTree';

export default function TournamentLobby({ eventKey = 'chess', currentUser = null }) {
  const [config, setConfig] = useState(null);
  const [matches, setMatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'completed' | 'roster' | 'rules'
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState(null);

  const loadLobby = useCallback(async () => {
    try {
      const [cfgRes, matchRes, partRes] = await Promise.all([
        fetch(`/api/events/config?event_key=${eventKey}`),
        fetch(`/api/events/matches?event_key=${eventKey}&limit=100`),
        fetch(`/api/events/participants?event_key=${eventKey}&limit=100`)
      ]);

      const [cfgData, matchData, partData] = await Promise.all([
        cfgRes.json(),
        matchRes.json(),
        partRes.json()
      ]);

      setConfig(cfgData);
      setMatches(matchData.items || []);
      setParticipants(partData.items || []);
    } catch (err) {
      console.error('Failed to load lobby:', err);
    } finally {
      setLoading(false);
    }
  }, [eventKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLobby();
  }, [loadLobby]);

  const currentUserId = String(currentUser?.roll_no || currentUser?.id || currentUser?.staffId || '').toLowerCase();
  const userRegistration = participants.find((p) => String(p.user_id || '').toLowerCase() === currentUserId);

  const myMatch = matches.find((m) => {
    if (m.status === 'COMPLETED' || m.status === 'CANCELLED') return false;
    const isW = String(m.player_white_user_id || '').toLowerCase() === currentUserId || (userRegistration && m.player_white_id === userRegistration.id);
    const isB = String(m.player_black_user_id || '').toLowerCase() === currentUserId || (userRegistration && m.player_black_id === userRegistration.id);
    return isW || isB;
  });

  const handleOneClickRegister = async () => {
    if (!currentUser) return;
    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await fetch('/api/events/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_key: eventKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete registration');
      await loadLobby();
    } catch (err) {
      setRegisterError(err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const activeMatches = matches.filter((m) => m.status === 'IN_PROGRESS' || m.status === 'PUBLISHED' || m.status === 'SCHEDULED');
  const completedMatches = matches.filter((m) => m.status === 'COMPLETED');

  const tabs = [
    { id: 'matches', label: 'Active Fixtures & Live Arena', count: activeMatches.length },
    { id: 'bracket', label: 'Tournament Tree Bracket', count: matches.length },
    { id: 'completed', label: 'Completed Matches', count: completedMatches.length },
    { id: 'roster', label: 'Contenders Roster', count: participants.length },
    { id: 'rules', label: 'Tournament Rules' },
  ];

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
        <header className="mb-4">
          <div className="h-8 bg-gray-200 animate-pulse w-64 rounded mb-2"></div>
          <div className="h-4 bg-gray-100 animate-pulse w-96 rounded"></div>
        </header>
        <div className="flex gap-2 mb-3">
          <div className="h-9 w-28 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-9 w-28 bg-gray-200 animate-pulse rounded"></div>
        </div>
        <div className="h-64 bg-white border border-gray-200 rounded p-6 animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Page Header — standard KUCET format */}
      <header className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-800">
                {config?.event_name || 'KUCET Chess Championship'}
              </h1>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Official rapid tournament brackets with FIDE regulations, live interactive clock, and verified arbiter scoring.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/events"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Events
            </Link>

            {!currentUser ? (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs sm:text-sm font-medium transition-colors shadow-xs"
              >
                <Users className="w-4 h-4" /> Student Login
              </Link>
            ) : config?.registration_open && !userRegistration ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOneClickRegister}
                  disabled={registering}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs sm:text-sm font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {registering ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>1-Click Register</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="px-3 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                  title="Add optional notes / rating"
                >
                  Options
                </button>
              </div>
            ) : userRegistration ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Enrolled ({userRegistration.status})</span>
              </div>
            ) : (
              <span className="text-xs text-gray-500 font-medium px-3 py-1.5 bg-gray-100 rounded-md border border-gray-200">
                Registration Closed
              </span>
            )}
          </div>
        </div>
      </header>

      {registerError && (
        <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{registerError}</span>
        </div>
      )}

      {/* Spotlight: Logged-in Contender's Active Match */}
      {myMatch && (
        <div className="rounded-sm border border-blue-300 bg-gradient-to-r from-[#0b3578] via-[#0d4191] to-[#1253b8] text-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                  Your Match is Scheduled / Live
                </span>
                <span className="px-2 py-0.5 rounded bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                  {myMatch.round_name} • #{myMatch.match_code}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] font-semibold uppercase tracking-wider">
                  {myMatch.status.replace('_', ' ')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{myMatch.player_white_name}</span>
                <span className="text-xs font-normal text-blue-200">vs</span>
                <span>{myMatch.player_black_name}</span>
              </h2>
              <p className="text-xs text-blue-100">
                You are playing as <span className="font-bold underline">{String(myMatch.player_white_user_id || '').toLowerCase() === currentUserId ? 'White (First Move)' : 'Black'}</span> against <span className="font-bold">{String(myMatch.player_white_user_id || '').toLowerCase() === currentUserId ? myMatch.player_black_name : myMatch.player_white_name}</span>. Click below to enter the live interactive match arena.
              </p>
            </div>

            <div className="shrink-0">
              <Link
                href={`/events/chess/match/${myMatch.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs sm:text-sm font-bold tracking-wide transition-all shadow-sm hover:shadow cursor-pointer"
              >
                <span>Enter Chess Arena</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Stats Grid — matching KUCET metric summary style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Fixtures</span>
            <Swords className="w-4 h-4 text-[#0b3578]" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{activeMatches.length}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed Matches</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{completedMatches.length}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered Contenders</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{participants.length}</p>
        </div>
      </div>

      {/* Tabs — standard KUCET tabs pattern */}
      <div className="md:hidden flex flex-wrap items-center gap-2 pb-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-3 py-2 rounded-md text-xs sm:text-sm transition-colors cursor-pointer ${
              activeTab === id ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-2 mb-4">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === id ? 'bg-[#0b3578] text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                  activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content 1: Active Fixtures */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          {activeMatches.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-sm border border-gray-300 shadow-sm">
              <Swords className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800">
                No Live Fixtures in Progress
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Next round pairings are currently being organized by tournament arbiters. Check back shortly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMatches.map((m) => {
                const isThisMyMatch = Boolean(currentUserId && (
                  String(m.player_white_user_id || '').toLowerCase() === currentUserId ||
                  String(m.player_black_user_id || '').toLowerCase() === currentUserId ||
                  (userRegistration && (m.player_white_id === userRegistration.id || m.player_black_id === userRegistration.id))
                ));
                const isWhitePlayer = Boolean(currentUserId && (
                  String(m.player_white_user_id || '').toLowerCase() === currentUserId ||
                  (userRegistration && m.player_white_id === userRegistration.id)
                ));
                const isBlackPlayer = Boolean(currentUserId && (
                  String(m.player_black_user_id || '').toLowerCase() === currentUserId ||
                  (userRegistration && m.player_black_id === userRegistration.id)
                ));

                return (
                  <div
                    key={m.id}
                    className={`rounded-sm border p-4 sm:p-5 shadow-sm space-y-4 transition-all ${
                      isThisMyMatch
                        ? 'bg-blue-50/40 border-[#0b3578] ring-2 ring-[#0b3578]/20'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {m.round_name}
                        </span>
                        {isThisMyMatch && (
                          <span className="text-[10px] font-bold uppercase text-white bg-[#0b3578] px-2 py-0.5 rounded shadow-xs">
                            Your Match
                          </span>
                        )}
                      </div>
                      <span
                        className={`
                          px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide
                          ${m.status === 'IN_PROGRESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }
                        `}
                      >
                        {m.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-white border border-gray-400" />
                          <span className="text-xs font-semibold text-gray-800">
                            {m.player_white_name} {isWhitePlayer && <span className="text-[#0b3578] font-bold">(You)</span>}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium uppercase">White</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700" />
                          <span className="text-xs font-semibold text-gray-800">
                            {m.player_black_name} {isBlackPlayer && <span className="text-[#0b3578] font-bold">(You)</span>}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Black</span>
                      </div>
                    </div>

                    <div className="pt-2.5 flex items-center justify-between border-t border-gray-100">
                      <span className="text-[11px] font-mono text-gray-400">
                        #{m.match_code}
                      </span>

                      <Link
                        href={`/events/chess/match/${m.id}`}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-xs cursor-pointer ${
                          isThisMyMatch
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold ring-1 ring-amber-500'
                            : 'bg-[#0b3578] hover:bg-[#0a2d66] text-white font-medium'
                        }`}
                      >
                        <span>{isThisMyMatch ? 'Enter Your Arena' : 'Enter Arena'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Tournament Tree Bracket */}
      {activeTab === 'bracket' && (
        <TournamentBracketTree
          matches={matches}
          config={config}
          currentUserId={currentUserId}
          isAdmin={false}
        />
      )}

      {/* Tab Content 2: Completed Matches */}
      {activeTab === 'completed' && (
        <div className="bg-white rounded-sm border border-gray-300 overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-100">
            {completedMatches.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p className="text-xs font-semibold">No completed matches recorded yet.</p>
              </div>
            ) : (
              completedMatches.map((m) => (
                <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-800 uppercase">
                        {m.round_name}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        #{m.match_code}
                      </span>
                      {m.is_verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Official Result
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-800">
                      {m.player_white_name} vs {m.player_black_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      Winner: {m.winner_side === 'draw' ? 'Draw' : `${m.winner_side} (${m.winner_side === 'white' ? m.player_white_name : m.player_black_name})`} via {m.result_reason?.replace('_', ' ')}
                    </p>
                  </div>

                  <Link
                    href={`/events/chess/match/${m.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Replay
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: Contenders Roster — standard KUCET table */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-sm border border-gray-300 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 table-auto text-left text-xs">
              <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 text-left">Contender</th>
                  <th className="py-2.5 px-3 text-left">Roll Number / ID</th>
                  <th className="py-2.5 px-3 text-left">Department</th>
                  <th className="py-2.5 px-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {participants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      No contenders registered yet.
                    </td>
                  </tr>
                ) : (
                  participants.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-gray-800">
                        {p.display_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">
                        {p.user_id}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {p.department || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`
                            px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                            ${p.status === 'ACCEPTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }
                          `}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 4: Rules — standard KUCET content container */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-sm border border-gray-300 p-4 sm:p-6 shadow-sm space-y-3 text-xs text-gray-700">
          <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">
            Official FIDE Rapid Rules & Tournament Code of Conduct
          </h3>
          <ul className="list-disc pl-5 space-y-2 leading-relaxed">
            <li><strong>Standard Legal Moves:</strong> All games are validated with standard FIDE chess rules, including castling, en passant, and pawn promotions.</li>
            <li><strong>Time Control:</strong> 15 minutes initial clock with 10-second increment per move.</li>
            <li><strong>Tie-breaks:</strong> In knockout rounds, drawn games proceed to an Armageddon blitz playoff.</li>
            <li><strong>Fair Play Policy:</strong> Use of external chess engines, assistance software, or second-device consultation results in immediate disqualification.</li>
            <li><strong>Verification:</strong> All match outcomes are sealed and audited by the tournament committee.</li>
          </ul>
        </div>
      )}

      {/* Registration Modal */}
      <ParticipantRegistrationModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={() => loadLobby()}
        eventKey={eventKey}
        currentUser={currentUser}
      />
    </div>
  );
}
