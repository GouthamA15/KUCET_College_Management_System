'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  ToggleLeft,
  ToggleRight,
  Users,
  Swords,
  CheckCircle,
  ShieldCheck,
  Plus,
  Search,
  ExternalLink,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import Link from 'next/link';

export default function AdminEventControl({ eventKey = 'chess' }) {
  const [config, setConfig] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('participants'); // 'participants' | 'matches' | 'verify' | 'settings'
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
          is_enabled: nextState
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update toggle');
      setConfig(data);
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
      alert('Match fixture created successfully!');
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
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <RefreshCw className="w-8 h-8 text-[#002A5C] animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Event Control Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Master Admin Toggle */}
      <div className="bg-gradient-to-r from-[#002A5C] via-[#0b3578] to-[#1e498c] rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-amber-300">
              <Trophy className="w-3.5 h-3.5" /> College Tournament System • Module 1
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {config?.event_name || 'Chess Championship Event'}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/80 max-w-xl">
              Control the live availability of the Chess tournament, register participants, generate round fixtures, and audit game results.
            </p>
          </div>

          {/* Controls Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
            {/* Master Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
                  Chess Event Status
                </p>
                <p className="text-sm font-black flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${config?.is_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {config?.is_enabled ? 'ENABLED' : 'DISABLED'}
                </p>
              </div>

              <button
                onClick={handleToggleEvent}
                disabled={savingToggle}
                className={`
                  p-1 rounded-xl transition-all cursor-pointer
                  ${config?.is_enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-white'}
                `}
                title="Toggle Event Live Availability"
              >
                {config?.is_enabled ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10" />
                )}
              </button>
            </div>

            <div className="hidden sm:block w-px h-10 bg-white/20" />

            {/* Registration Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
                  Registrations
                </p>
                <p className="text-sm font-black flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${config?.registration_open ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  {config?.registration_open ? 'OPEN' : 'CLOSED'}
                </p>
              </div>

              <button
                onClick={handleToggleRegistration}
                disabled={savingToggle}
                className={`
                  p-1 rounded-xl transition-all cursor-pointer
                  ${config?.registration_open ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-white'}
                `}
                title="Toggle Participant Registration"
              >
                {config?.registration_open ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {participants.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">Total Registered</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {acceptedParticipants.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">Accepted Players</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {matches.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">Total Fixtures</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {matches.filter((m) => m.is_verified).length}
              </p>
              <p className="text-xs font-semibold text-slate-500">Verified Results</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'participants', label: 'Participants & Approval', icon: Users, count: participants.length },
          { id: 'matches', label: 'Match Fixtures', icon: Swords, count: matches.length },
          { id: 'verify', label: 'Result Auditing & Verification', icon: ShieldCheck, count: matches.filter((m) => m.status === 'COMPLETED').length },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap
              ${activeTab === id
                ? 'bg-[#002A5C] text-white shadow-md shadow-[#002A5C]/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-800'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span
              className={`
                px-1.5 py-0.5 rounded-full text-[10px] font-black
                ${activeTab === id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}
              `}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Participants List */}
      {activeTab === 'participants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search participant by name, roll number, or department..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {['ALL', 'REGISTERED', 'ACCEPTED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer
                    ${statusFilter === st
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }
                  `}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-extrabold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">User ID / Roll No</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No participants found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {p.display_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {p.user_id}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {p.department || '—'}
                        </td>
                        <td className="py-3 px-4 uppercase text-[11px] font-bold text-slate-500">
                          {p.user_type}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`
                              px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                              ${p.status === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'REJECTED'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Accept
                            </button>
                          )}
                          {p.status !== 'REJECTED' && (
                            <button
                              onClick={() => handleParticipantStatus(p.id, 'REJECTED')}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-bold hover:bg-red-200 transition-colors cursor-pointer"
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
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Tournament Fixtures
            </h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#002A5C] text-white text-xs font-bold hover:bg-[#0b3578] transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create New Match Fixture
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <Swords className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold">No matches scheduled yet.</p>
                <p className="text-xs text-slate-500 mt-0.5">Click &ldquo;Create New Match Fixture&rdquo; to pair two accepted participants.</p>
              </div>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                      {m.round_name}
                    </span>
                    <span
                      className={`
                        px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase
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
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-white border border-slate-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {m.player_white_name}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">White</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-700" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {m.player_black_name}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">Black</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-mono text-slate-400">
                      {m.match_code}
                    </span>

                    <div className="flex gap-2">
                      {m.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handlePublishMatch(m.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Publish Match
                        </button>
                      )}

                      <Link
                        href={`/events/chess/match/${m.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Arena
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Verification & Auditing */}
      {activeTab === 'verify' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Completed Matches Awaiting Official Verification
              </h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {matches.filter((m) => m.status === 'COMPLETED').length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold">No completed matches pending review.</p>
                </div>
              ) : (
                matches
                  .filter((m) => m.status === 'COMPLETED')
                  .map((m) => (
                    <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase text-amber-600">
                            {m.round_name}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            #{m.match_code}
                          </span>
                        </div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {m.player_white_name} vs {m.player_black_name}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">
                          Outcome: {m.winner_side === 'draw' ? 'Draw' : `${m.winner_side} won`} via {m.result_reason?.replace('_', ' ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {m.is_verified ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Verified ({m.verified_by})
                          </span>
                        ) : (
                          <button
                            onClick={() => setVerifyingMatch(m)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                          >
                            Verify & Finalize Result
                          </button>
                        )}

                        <Link
                          href={`/events/chess/match/${m.id}`}
                          target="_blank"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Match Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
              Create Chess Match Fixture
            </h3>

            <form onSubmit={handleCreateMatch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Tournament Round
                </label>
                <select
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Round 1">Round 1</option>
                  <option value="Round 2">Round 2</option>
                  <option value="Quarterfinal">Quarterfinal</option>
                  <option value="Semifinal">Semifinal</option>
                  <option value="Final">Final</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Player 1 (White Pieces)
                </label>
                <select
                  value={playerWhiteId}
                  onChange={(e) => setPlayerWhiteId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select White Player --</option>
                  {acceptedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({p.user_id} • {p.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Player 2 (Black Pieces)
                </label>
                <select
                  value={playerBlackId}
                  onChange={(e) => setPlayerBlackId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Black Player --</option>
                  {acceptedParticipants
                    .filter((p) => String(p.id) !== String(playerWhiteId))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} ({p.user_id} • {p.department})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Scheduled Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#002A5C] text-white text-xs font-bold hover:bg-[#0b3578] cursor-pointer shadow-sm"
                >
                  Generate Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Result Modal */}
      {verifyingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
              Verify Official Match Result
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Confirm and seal the result for match #{verifyingMatch.match_code} ({verifyingMatch.player_white_name} vs {verifyingMatch.player_black_name}).
            </p>

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Verification Notes (Optional)
              </label>
              <textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="e.g., Fair play verified, arbiter confirmed checkmate on move 34."
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVerifyingMatch(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyMatch}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-sm"
              >
                Confirm Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
