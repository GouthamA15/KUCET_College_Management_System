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
  X,
  Trophy,
  Play,
  RotateCw
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
  const [roundName, setRoundName] = useState('Final');
  const [playerWhiteId, setPlayerWhiteId] = useState('');
  const [playerBlackId, setPlayerBlackId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Result recording modal state (Arbiter reporting)
  const [recordingMatch, setRecordingMatch] = useState(null);
  const [resultWinnerSide, setResultWinnerSide] = useState('white');
  const [resultReason, setResultReason] = useState('checkmate');

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

  // Automated Tournament Start / Fixture Generation
  const handleGenerateFixtures = async () => {
    if (acceptedParticipants.length < 2 || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/events/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_key: eventKey,
          action: 'generate_fixtures'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate tournament fixtures');

      await loadData();
      setActiveTab('matches');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Create Match modal with smart pre-population
  const openCreateModal = () => {
    if (acceptedParticipants.length === 2) {
      setPlayerWhiteId(String(acceptedParticipants[0].id));
      setPlayerBlackId(String(acceptedParticipants[1].id));
      setRoundName('Final');
    } else {
      setPlayerWhiteId('');
      setPlayerBlackId('');
      setRoundName(acceptedParticipants.length <= 4 ? 'Semifinals' : 'Round 1');
    }
    setScheduledAt('');
    setShowCreateModal(true);
  };

  // Manual Create Match
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

      await loadData();
      setShowCreateModal(false);
      setPlayerWhiteId('');
      setPlayerBlackId('');
      setActiveTab('matches');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Start / Publish Match (SCHEDULED -> READY)
  const handleStartMatch = async (matchId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start match');

      setMatches((prev) =>
        prev.map((m) => (m.id === data.id ? data : m))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Match
  const handleCancelMatch = async (matchId) => {
    if (!confirm('Are you sure you want to cancel this match?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          cancellation_reason: 'Cancelled by tournament arbiter'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel match');

      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Arbiter Submit Match Result
  const handleSubmitMatchResult = async (e) => {
    e?.preventDefault();
    if (!recordingMatch) return;

    setActionLoading(true);
    try {
      const winnerId = resultWinnerSide === 'white'
        ? recordingMatch.player_white_id
        : resultWinnerSide === 'black'
        ? recordingMatch.player_black_id
        : null;

      const res = await fetch(`/api/events/matches/${recordingMatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_result',
          winner_side: resultWinnerSide,
          winner_id: winnerId,
          result_reason: resultReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record match result');

      await loadData();
      setRecordingMatch(null);
      setActiveTab('verify');
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Verify Match Result (Result Auditing)
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

      await loadData();
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

  const rules = typeof config?.rules_json === 'string' ? JSON.parse(config?.rules_json || '{}') : (config?.rules_json || {});
  const isTournamentCompleted = rules.tournament_status === 'COMPLETED';
  const champion = rules.champion;

  const completedMatches = matches.filter((m) => m.status === 'COMPLETED');
  const activeMatches = matches.filter((m) => ['SCHEDULED', 'READY', 'PUBLISHED', 'STARTED', 'IN_PROGRESS'].includes(m.status));

  // Determine if next round can be generated (when all current round matches are completed & verified)
  const canGenerateNextRound = !isTournamentCompleted && matches.length > 0 && activeMatches.length === 0 && completedMatches.length > 0 && completedMatches.every(m => m.is_verified);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8">
        <RefreshCw className="w-8 h-8 text-[#0b3578] animate-spin mb-3" />
        <p className="text-xs font-semibold text-gray-500">Loading Event Control Console...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-sm">
      {/* Page Header — standard KUCET layout */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
              Chess Championship Administration
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide border ${
                config?.is_enabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {config?.is_enabled ? 'Event Active' : 'Event Inactive'}
            </span>
            {isTournamentCompleted && (
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
                Concluded
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Contender approvals, tournament fixture pairings, and arbiter result verifications.
          </p>
        </div>

        {/* Master Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleToggleEvent}
            disabled={savingToggle}
            className={`
              px-3.5 py-2 rounded-md text-xs font-medium transition-colors shadow-xs cursor-pointer
              ${
                config?.is_enabled
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            `}
          >
            {config?.is_enabled ? 'Deactivate Event' : 'Activate Event'}
          </button>

          <button
            onClick={handleToggleRegistration}
            disabled={savingToggle || isTournamentCompleted}
            className={`
              px-3.5 py-2 rounded-md text-xs font-medium transition-colors shadow-xs cursor-pointer border
              ${
                config?.registration_open
                  ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'bg-blue-50 border-blue-200 text-[#0b3578] hover:bg-blue-100'
              }
              ${isTournamentCompleted ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {config?.registration_open ? 'Close Registrations' : 'Open Registrations'}
          </button>
        </div>
      </header>

      {/* Official Champion / Tournament Completed Banner */}
      {isTournamentCompleted && champion && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 px-2 py-0.5 rounded text-amber-900">
                  Tournament Concluded
                </span>
                <span className="text-xs font-semibold text-amber-800">
                  Official Champion Declared
                </span>
              </div>
              <p className="text-base font-bold text-gray-900 mt-0.5">
                {champion.name} <span className="font-mono text-xs font-normal text-gray-600">({champion.userId})</span> — <span className="text-xs font-medium text-gray-700">{champion.department || 'Kakatiya University'}</span>
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-amber-800 shrink-0">
            <p className="font-semibold capitalize">Winner via {champion.resultReason?.replace('_', ' ')}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Audited & Verified Result</p>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <Users className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-gray-600">Total Registered</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{participants.length}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center text-emerald-600 mb-1">
            <CheckCircle className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-gray-600">Accepted Players</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{acceptedParticipants.length}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center text-amber-600 mb-1">
            <Swords className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-gray-600">Total Fixtures</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{matches.length}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center text-[#0b3578] mb-1">
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold text-gray-600">Verified Results</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {matches.filter((m) => m.is_verified).length}
          </p>
        </div>
      </div>

      {/* Tabs Navigation — standard KUCET styling */}
      <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-xs w-full sm:w-auto overflow-x-auto">
        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'participants'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Participants & Approvals ({participants.length})
        </button>

        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Match Fixtures ({matches.length})
        </button>

        <button
          onClick={() => setActiveTab('verify')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'verify'
              ? 'bg-blue-50 text-[#0b3578] font-semibold shadow-xs'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Result Auditing ({completedMatches.length})
        </button>
      </div>

      {/* Tab 1: Participants List */}
      {activeTab === 'participants' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search participant by name, roll number, or department..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {['ALL', 'REGISTERED', 'ACCEPTED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`
                    px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer
                    ${statusFilter === st
                      ? 'bg-[#0b3578] text-white font-semibold shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Roll Number / ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No participants found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          {p.display_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-600">
                          {p.user_id}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {p.department || '—'}
                        </td>
                        <td className="py-3 px-4 uppercase text-[11px] font-semibold text-gray-500">
                          {p.user_type}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`
                              px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                              ${p.status === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'REJECTED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                            >
                              <Check className="w-3 h-3" /> Accept
                            </button>
                          )}
                          {p.status !== 'REJECTED' && (
                            <button
                              onClick={() => handleParticipantStatus(p.id, 'REJECTED')}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 font-medium hover:bg-red-100 transition-colors cursor-pointer"
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                Tournament Fixtures & Match Schedule
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {acceptedParticipants.length} accepted contender(s) eligible for tournament pairings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Start Tournament / Generate Initial Fixture */}
              {acceptedParticipants.length >= 2 && matches.length === 0 && !isTournamentCompleted && (
                <button
                  onClick={handleGenerateFixtures}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Swords className="w-4 h-4" />
                  <span>Start Tournament ({acceptedParticipants.length === 2 ? 'Generate Final Fixture' : 'Generate Fixtures'})</span>
                </button>
              )}

              {/* Generate Next Round Fixtures (Multi-round advancement) */}
              {canGenerateNextRound && (
                <button
                  onClick={handleGenerateFixtures}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Generate Next Round Fixtures</span>
                </button>
              )}

              {/* Manual Create Match Fixture */}
              {!isTournamentCompleted && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Create Match Fixture
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.length === 0 ? (
              <div className="col-span-2 py-12 text-center bg-white rounded-lg border border-gray-200 p-6 space-y-3 shadow-xs">
                <Swords className="w-10 h-10 mx-auto text-gray-300" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">No matches scheduled yet</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    {acceptedParticipants.length >= 2
                      ? `${acceptedParticipants.length} accepted contenders ready (${acceptedParticipants[0]?.display_name} and ${acceptedParticipants[1]?.display_name}). Click "Start Tournament" to create the official fixture.`
                      : `Waiting for at least 2 accepted contenders to start the tournament. Currently accepted: ${acceptedParticipants.length}.`}
                  </p>
                </div>
                {acceptedParticipants.length >= 2 && !isTournamentCompleted && (
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateFixtures}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Tournament — Generate Fixture ({acceptedParticipants[0]?.display_name} vs {acceptedParticipants[1]?.display_name})</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className="text-xs font-semibold uppercase text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {m.round_name}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                        ${m.status === 'PUBLISHED' || m.status === 'READY' || m.status === 'STARTED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : m.status === 'IN_PROGRESS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : m.status === 'COMPLETED'
                          ? 'bg-gray-100 text-gray-700 border border-gray-200'
                          : m.status === 'CANCELLED'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }
                      `}
                    >
                      {m.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 rounded-md bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-white border border-gray-400" />
                        <div>
                          <span className="text-xs font-semibold text-gray-800">
                            {m.player_white_name}
                          </span>
                          <span className="text-[11px] font-mono text-gray-500 ml-1.5">
                            ({m.player_white_user_id})
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 uppercase">White</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-md bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gray-900 border border-gray-700" />
                        <div>
                          <span className="text-xs font-semibold text-gray-800">
                            {m.player_black_name}
                          </span>
                          <span className="text-[11px] font-mono text-gray-500 ml-1.5">
                            ({m.player_black_user_id})
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 uppercase">Black</span>
                    </div>
                  </div>

                  {m.status === 'COMPLETED' && (
                    <div className="p-2.5 rounded-md bg-amber-50/60 border border-amber-200 text-xs">
                      <span className="font-semibold text-gray-800">Outcome: </span>
                      <span className="capitalize text-amber-900 font-medium">
                        {m.winner_side === 'draw'
                          ? 'Match Drawn'
                          : `${m.winner_side} (${m.winner_side === 'white' ? m.player_white_name : m.player_black_name}) Wins via ${m.result_reason?.replace('_', ' ')}`}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 text-xs">
                    <span className="font-mono text-gray-400 text-[11px]">#{m.match_code}</span>

                    <div className="flex items-center gap-2">
                      {/* Start Match button */}
                      {m.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handleStartMatch(m.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors cursor-pointer shadow-xs"
                        >
                          <Play className="w-3 h-3" /> Start Match
                        </button>
                      )}

                      {/* Record Result button (for arbiter) */}
                      {['READY', 'STARTED', 'IN_PROGRESS'].includes(m.status) && (
                        <button
                          onClick={() => {
                            setRecordingMatch(m);
                            setResultWinnerSide('white');
                            setResultReason('checkmate');
                          }}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[#0b3578] text-white hover:bg-[#0a2d66] font-medium transition-colors cursor-pointer shadow-xs"
                        >
                          <Trophy className="w-3 h-3" /> Record Result
                        </button>
                      )}

                      {/* Audit Result button */}
                      {m.status === 'COMPLETED' && !m.is_verified && (
                        <button
                          onClick={() => {
                            setVerifyingMatch(m);
                            setActiveTab('verify');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700 font-medium transition-colors cursor-pointer shadow-xs"
                        >
                          Verify Result
                        </button>
                      )}

                      {/* Cancel match button */}
                      {['SCHEDULED', 'READY', 'STARTED'].includes(m.status) && (
                        <button
                          onClick={() => handleCancelMatch(m.id)}
                          disabled={actionLoading}
                          className="px-2 py-1 rounded-md bg-white border border-gray-200 text-red-600 hover:bg-red-50 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}

                      <Link
                        href={`/events/chess/match/${m.id}`}
                        className="px-3 py-1 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors shadow-xs"
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Match</th>
                    <th className="py-3 px-4">Round</th>
                    <th className="py-3 px-4">Winner</th>
                    <th className="py-3 px-4">Outcome Reason</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {matches.filter((m) => m.status === 'COMPLETED').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No completed matches awaiting verification.
                      </td>
                    </tr>
                  ) : (
                    matches
                      .filter((m) => m.status === 'COMPLETED')
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-gray-800">
                            {m.player_white_name} vs {m.player_black_name}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{m.round_name}</td>
                          <td className="py-3 px-4 font-semibold text-[#0b3578] capitalize">
                            {m.winner_side === 'draw' ? 'Draw' : `${m.winner_side} (${m.winner_side === 'white' ? m.player_white_name : m.player_black_name})`}
                          </td>
                          <td className="py-3 px-4 text-gray-600 capitalize">
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
                            {!m.is_verified ? (
                              <button
                                onClick={() => setVerifyingMatch(m)}
                                className="px-3 py-1 rounded-md bg-[#0b3578] text-white hover:bg-[#0a2d66] font-medium transition-colors cursor-pointer shadow-xs"
                              >
                                Verify Result
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-medium inline-flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Sealed
                              </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-gray-300 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="text-base font-semibold text-gray-800">Create Match Pairing</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded text-gray-400 hover:text-gray-600 cursor-pointer">
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
                  placeholder="e.g. Final, Semifinals, Round 1"
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Player 1 (White Pieces) *</label>
                <select
                  required
                  value={playerWhiteId}
                  onChange={(e) => setPlayerWhiteId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
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
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
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
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Create Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Match Outcome Modal (Arbiter reporting) */}
      {recordingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-gray-300 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="text-base font-semibold text-gray-800">Record Match Result</h3>
              <button onClick={() => setRecordingMatch(null)} className="p-1 rounded text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitMatchResult} className="space-y-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200 space-y-1">
                <p className="font-semibold text-gray-800">
                  {recordingMatch.player_white_name} (White) vs {recordingMatch.player_black_name} (Black)
                </p>
                <p className="text-[11px] text-gray-500 font-mono">
                  Round: {recordingMatch.round_name} • Match #{recordingMatch.match_code}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1.5">Match Winner</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setResultWinnerSide('white')}
                    className={`p-2.5 rounded-md border text-center font-medium transition-colors cursor-pointer ${
                      resultWinnerSide === 'white'
                        ? 'bg-blue-50 border-[#0b3578] text-[#0b3578] font-semibold'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    White Wins
                    <span className="block text-[10px] text-gray-500 font-normal truncate mt-0.5">
                      {recordingMatch.player_white_name}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultWinnerSide('black')}
                    className={`p-2.5 rounded-md border text-center font-medium transition-colors cursor-pointer ${
                      resultWinnerSide === 'black'
                        ? 'bg-blue-50 border-[#0b3578] text-[#0b3578] font-semibold'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Black Wins
                    <span className="block text-[10px] text-gray-500 font-normal truncate mt-0.5">
                      {recordingMatch.player_black_name}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultWinnerSide('draw')}
                    className={`p-2.5 rounded-md border text-center font-medium transition-colors cursor-pointer ${
                      resultWinnerSide === 'draw'
                        ? 'bg-blue-50 border-[#0b3578] text-[#0b3578] font-semibold'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Draw
                    <span className="block text-[10px] text-gray-500 font-normal mt-0.5">
                      Tie (½ - ½)
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Outcome Reason</label>
                <select
                  value={resultReason}
                  onChange={(e) => setResultReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
                >
                  <option value="checkmate">Checkmate</option>
                  <option value="resignation">Resignation</option>
                  <option value="timeout">Time Forfeit / Flag Fell</option>
                  <option value="stalemate">Stalemate (Draw)</option>
                  <option value="draw_agreement">Mutual Draw Agreement</option>
                  <option value="threefold_repetition">Threefold Repetition (Draw)</option>
                  <option value="insufficient_material">Insufficient Material (Draw)</option>
                  <option value="admin_decision">Arbiter Decision / Rule Enforcement</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setRecordingMatch(null)}
                  className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-md bg-[#0b3578] hover:bg-[#0a2d66] text-white font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Submit Match Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Dialog Modal */}
      {verifyingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-gray-300 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="text-base font-semibold text-gray-800">Verify Official Result</h3>
              <button onClick={() => setVerifyingMatch(null)} className="p-1 rounded text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-gray-600">
                Match: <strong className="text-gray-800">{verifyingMatch.player_white_name} vs {verifyingMatch.player_black_name}</strong>
              </p>
              <p className="text-gray-600">
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
                className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0b3578] focus:border-[#0b3578]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => setVerifyingMatch(null)}
                className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleVerifyMatch}
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors shadow-xs cursor-pointer"
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
