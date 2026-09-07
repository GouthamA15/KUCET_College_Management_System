'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Swords,
  CheckCircle,
  ShieldCheck,
  Plus,
  Search,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import Link from 'next/link';
import { notifyEventConfigChanged } from '@/hooks/useEventsStatus';

export default function AdminEventControl({ eventKey = 'chess' }) {
  const [config, setConfig] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('participants'); // 'participants' | 'matches' | 'verify'
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Match creation form state
  const [roundName, setRoundName] = useState('Round 1');
  const [playerWhiteId, setPlayerWhiteId] = useState('');
  const [playerBlackId, setPlayerBlackId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Verification modal state
  const [verifyingMatch, setVerifyingMatch] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Fetch all administrative data
  const loadData = useCallback(async () => {
    try {
      const [cfgRes, partRes, matchRes] = await Promise.all([
        fetch(`/api/events/config?event_key=${eventKey}`),
        fetch(`/api/events/participants?event_key=${eventKey}&limit=100`),
        fetch(`/api/events/matches?event_key=${eventKey}&limit=100`)
      ]);

      const [cfgData, partData, matchData] = await Promise.all([
        cfgRes.json(),
        partRes.json(),
        matchRes.json()
      ]);

      setConfig(cfgData);
      setParticipants(partData.items || []);
      setMatches(matchData.items || []);
    } catch (err) {
      console.error('Failed to load event data:', err);
    } finally {
      setLoading(false);
    }
  }, [eventKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // Master Toggle: Enabled / Disabled
  const handleToggleEvent = async () => {
    if (!config || savingToggle) return;
    setSavingToggle(true);
    const nextState = !config.is_enabled;

    try {
      const res = await fetch('/api/events/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_key: eventKey,
          is_enabled: nextState,
          registration_open: nextState
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update toggle');
      setConfig(data);
      notifyEventConfigChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingToggle(false);
    }
  };

  // Toggle Registration Open/Closed
  const handleToggleRegistration = async () => {
    if (!config || savingToggle) return;
    setSavingToggle(true);
    const nextState = !config.registration_open;

    try {
      const res = await fetch('/api/events/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_key: eventKey,
          registration_open: nextState
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update registration');
      setConfig(data);
      notifyEventConfigChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingToggle(false);
    }
  };

  // Participant Accept / Reject
  const handleParticipantStatus = async (participantId, status) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/participants/${participantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setParticipants((prev) =>
        prev.map((p) => (p.id === data.id ? data : p))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Create Match
  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (!playerWhiteId || !playerBlackId) {
      alert('Please select both White and Black players');
      return;
    }
    if (playerWhiteId === playerBlackId) {
      alert('A player cannot play against themselves');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/events/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_key: eventKey,
          round_name: roundName,
          player_white_id: Number(playerWhiteId),
          player_black_id: Number(playerBlackId),
          scheduled_at: scheduledAt || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create match');

      setMatches((prev) => [data, ...prev]);
      setShowCreateModal(false);
      setPlayerWhiteId('');
      setPlayerBlackId('');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Publish Match
  const handlePublishMatch = async (matchId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish match');

      setMatches((prev) =>
        prev.map((m) => (m.id === data.id ? data : m))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Verify Match Result
  const handleVerifyMatch = async () => {
    if (!verifyingMatch) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/matches/${verifyingMatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          verification_notes: verificationNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify match');

      setMatches((prev) =>
        prev.map((m) => (m.id === data.id ? data : m))
      );
      setVerifyingMatch(null);
      setVerificationNotes('');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const acceptedParticipants = participants.filter((p) => p.status === 'ACCEPTED');
  const filteredParticipants = participants.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesQuery =
      !searchQuery ||
      p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8">
        <RefreshCw className="w-8 h-8 text-[#0b3578] animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Event Control Console...</p>
      </div>
    );
  }

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
        <span className="text-slate-800 font-semibold">Chess Championship Console</span>
      </div>

      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Chess Championship Administration
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Contender approvals, single-elimination bracket pairings, and arbiter result verifications.
          </p>
        </div>

        {/* Master Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleToggleEvent}
            disabled={savingToggle}
            className={`
              px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer
              ${
                config?.is_enabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            `}
          >
            {config?.is_enabled ? 'Deactivate Event' : 'Activate Event'}
          </button>

          <button
            onClick={handleToggleRegistration}
            disabled={savingToggle}
            className={`
              px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer border
              ${
                config?.registration_open
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-blue-50 border-blue-200 text-[#0b3578] hover:bg-blue-100'
              }
            `}
          >
            {config?.registration_open ? 'Close Registrations' : 'Open Registrations'}
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <Users className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Total Registered</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{participants.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-emerald-600 mb-1">
            <CheckCircle className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Accepted Players</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{acceptedParticipants.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-amber-600 mb-1">
            <Swords className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Total Fixtures</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{matches.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-slate-600">Verified Results</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {matches.filter((m) => m.is_verified).length}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-xs w-full sm:w-auto overflow-x-auto">
        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'participants'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Participants & Approvals ({participants.length})
        </button>

        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Match Fixtures ({matches.length})
        </button>

        <button
          onClick={() => setActiveTab('verify')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'verify'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          Result Auditing ({matches.filter((m) => m.status === 'COMPLETED').length})
        </button>
      </div>

      {/* Tab 1: Participants List */}
      {activeTab === 'participants' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search participant by name, roll number, or department..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {['ALL', 'REGISTERED', 'ACCEPTED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`
                    px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer
                    ${statusFilter === st
                      ? 'bg-[#0b3578] text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }
                  `}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Roll Number / ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No participants found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((p) => (
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
                        <td className="py-3 px-4 uppercase text-[11px] font-semibold text-slate-500">
                          {p.user_type}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`
                              px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                              ${p.status === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }
                            `}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {p.status !== 'ACCEPTED' && (
                            <button
                              onClick={() => handleParticipantStatus(p.id, 'ACCEPTED')}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Accept
                            </button>
                          )}
                          {p.status !== 'REJECTED' && (
                            <button
                              onClick={() => handleParticipantStatus(p.id, 'REJECTED')}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          )}
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

      {/* Tab 2: Match Fixtures */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Tournament Fixtures
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0b3578] text-white text-xs font-medium hover:bg-[#0a2d66] transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Match Fixture
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                <Swords className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No matches scheduled yet.</p>
                <p className="text-xs text-slate-500 mt-0.5">Click &ldquo;Create Match Fixture&rdquo; to pair two accepted participants.</p>
              </div>
            ) : (
              matches.map((m) => (
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
                        ${m.status === 'PUBLISHED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : m.status === 'IN_PROGRESS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse'
                          : m.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }
                      `}
                    >
                      {m.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-white border border-slate-400" />
                        <span className="text-xs font-semibold text-gray-800">
                          {m.player_white_name}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase">White</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700" />
                        <span className="text-xs font-semibold text-gray-800">
                          {m.player_black_name}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Black</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                    <span className="font-mono text-slate-400">#{m.match_code}</span>

                    <div className="flex items-center gap-2">
                      {m.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handlePublishMatch(m.id)}
                          disabled={actionLoading}
                          className="px-3 py-1 rounded-lg bg-blue-50 text-[#0b3578] hover:bg-blue-100 font-medium transition-colors cursor-pointer"
                        >
                          Publish to Arena
                        </button>
                      )}

                      <Link
                        href={`/events/chess/match/${m.id}`}
                        className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Enter Arena
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Verification */}
      {activeTab === 'verify' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Match</th>
                    <th className="py-3 px-4">Round</th>
                    <th className="py-3 px-4">Winner</th>
                    <th className="py-3 px-4">Outcome Reason</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {matches.filter((m) => m.status === 'COMPLETED').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No completed matches awaiting verification.
                      </td>
                    </tr>
                  ) : (
                    matches
                      .filter((m) => m.status === 'COMPLETED')
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-gray-800">
                            {m.player_white_name} vs {m.player_black_name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{m.round_name}</td>
                          <td className="py-3 px-4 font-semibold text-[#0b3578] capitalize">
                            {m.winner_side === 'draw' ? 'Draw' : `${m.winner_side} (${m.winner_side === 'white' ? m.player_white_name : m.player_black_name})`}
                          </td>
                          <td className="py-3 px-4 text-slate-600 capitalize">
                            {m.result_reason?.replace('_', ' ') || 'Normal'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`
                                px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                                ${m.is_verified
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }
                              `}
                            >
                              {m.is_verified ? 'Verified' : 'Pending Audit'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!m.is_verified && (
                              <button
                                onClick={() => setVerifyingMatch(m)}
                                className="px-3 py-1 rounded bg-[#0b3578] text-white hover:bg-[#0a2d66] font-medium transition-colors cursor-pointer"
                              >
                                Verify Result
                              </button>
                            )}
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

      {/* Match Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-gray-800">Create Match Pairing</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMatch} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Round Designation</label>
                <input
                  type="text"
                  required
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder="e.g. Round 1, Quarterfinals, Semifinals"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Player 1 (White Pieces) *</label>
                <select
                  required
                  value={playerWhiteId}
                  onChange={(e) => setPlayerWhiteId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                >
                  <option value="">Select accepted player...</option>
                  {acceptedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({p.user_id} - {p.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Player 2 (Black Pieces) *</label>
                <select
                  required
                  value={playerBlackId}
                  onChange={(e) => setPlayerBlackId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                >
                  <option value="">Select accepted player...</option>
                  {acceptedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({p.user_id} - {p.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Scheduled Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-[#0b3578] hover:bg-[#0a2d66] text-white font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Create Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Dialog Modal */}
      {verifyingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-gray-800">Verify Official Result</h3>
              <button onClick={() => setVerifyingMatch(null)} className="p-1 rounded text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-600">
                Match: <strong className="text-gray-800">{verifyingMatch.player_white_name} vs {verifyingMatch.player_black_name}</strong>
              </p>
              <p className="text-slate-600">
                Reported Winner: <strong className="text-[#0b3578] capitalize">{verifyingMatch.winner_side}</strong> via <strong className="capitalize">{verifyingMatch.result_reason?.replace('_', ' ')}</strong>
              </p>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-gray-700 mb-1">Arbiter Audit Notes</label>
              <textarea
                rows={3}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="e.g. Fair play verified, confirmed by both players."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0b3578]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setVerifyingMatch(null)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleVerifyMatch}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors shadow-xs cursor-pointer"
              >
                Seal & Verify Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
