'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Swords,
  Users,
  BookOpen,
  ExternalLink,
  CheckCircle,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import ParticipantRegistrationModal from './ParticipantRegistrationModal';

export default function TournamentLobby({ eventKey = 'chess', currentUser = null }) {
  const [config, setConfig] = useState(null);
  const [matches, setMatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'completed' | 'roster' | 'rules'
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

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

  const currentUserId = String(currentUser?.roll_no || currentUser?.id || currentUser?.staffId || '');
  const userRegistration = participants.find((p) => String(p.user_id) === currentUserId);

  const activeMatches = matches.filter((m) => m.status === 'IN_PROGRESS' || m.status === 'PUBLISHED');
  const completedMatches = matches.filter((m) => m.status === 'COMPLETED');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8">
        <RefreshCw className="w-8 h-8 text-[#0b3578] animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Chess Tournament Hub...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/" className="hover:text-slate-700 transition-colors">
          KUCET CMS
        </Link>
        <span>/</span>
        <Link href="/events" className="hover:text-slate-700 transition-colors">
          Campus Events
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">Chess Championship</span>
      </div>

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {config?.event_name || 'KUCET Chess Championship'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Official rapid tournament brackets with FIDE regulations, live interactive clock, and verified arbiter scoring.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {config?.registration_open && !userRegistration && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Register For Tournament
            </button>
          )}

          {userRegistration && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Status: {userRegistration.status}</span>
            </div>
          )}
        </div>
      </header>

      {/* Top 3 Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <Swords className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Active Fixtures</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{activeMatches.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-emerald-600 mb-1">
            <CheckCircle className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Completed Games</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{completedMatches.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-amber-600 mb-1">
            <Users className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Registered Contenders</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{participants.length}</p>
        </div>
      </div>

      {/* Lobby Navigation Tabs */}
      <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-xs w-full sm:w-auto overflow-x-auto">
        {[
          { id: 'matches', label: 'Active Fixtures & Live Arena', icon: Swords, count: activeMatches.length },
          { id: 'completed', label: 'Completed Matches', icon: CheckCircle, count: completedMatches.length },
          { id: 'roster', label: 'Contenders Roster', icon: Users, count: participants.length },
          { id: 'rules', label: 'Tournament Rules', icon: BookOpen },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap
              ${activeTab === id
                ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={`
                  px-1.5 py-0.2 rounded-full text-[10px] font-semibold
                  ${activeTab === id ? 'bg-blue-100 text-[#0b3578]' : 'bg-slate-100 text-slate-600'}
                `}
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
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <Swords className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800">
                No Live Fixtures in Progress
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Next round pairings are currently being organized by tournament arbiters. Check back shortly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMatches.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-semibold uppercase text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {m.round_name}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 rounded text-[10px] font-semibold uppercase
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
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-white border border-slate-400" />
                        <span className="text-xs font-semibold text-gray-800">
                          {m.player_white_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">White</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700" />
                        <span className="text-xs font-semibold text-gray-800">
                          {m.player_black_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Black</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[11px] font-mono text-slate-400">
                      #{m.match_code}
                    </span>

                    <Link
                      href={`/events/chess/match/${m.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
                    >
                      Enter Arena <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Completed Matches */}
      {activeTab === 'completed' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {completedMatches.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-xs font-semibold">No completed matches recorded yet.</p>
              </div>
            ) : (
              completedMatches.map((m) => (
                <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-800 uppercase">
                        {m.round_name}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
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
                    <p className="text-xs text-slate-500 capitalize">
                      Winner: {m.winner_side === 'draw' ? 'Draw' : `${m.winner_side} (${m.winner_side === 'white' ? m.player_white_name : m.player_black_name})`} via {m.result_reason?.replace('_', ' ')}
                    </p>
                  </div>

                  <Link
                    href={`/events/chess/match/${m.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Game Replay
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: Contenders Roster */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Contender</th>
                  <th className="py-3 px-4">Roll Number / ID</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {participants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No contenders registered yet.
                    </td>
                  </tr>
                ) : (
                  participants.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {p.display_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {p.user_id}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.department || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`
                            px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                            ${p.status === 'ACCEPTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
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

      {/* Tab Content 4: Rules */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3 text-xs text-slate-700">
          <h3 className="text-sm font-semibold text-gray-800 border-b border-slate-200 pb-2">
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
