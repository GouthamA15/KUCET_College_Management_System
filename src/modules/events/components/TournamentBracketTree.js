'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Trophy, Swords, CheckCircle2, ArrowRight, ShieldCheck, Crown } from 'lucide-react';

/**
 * Standardize round grouping order from earliest to Final.
 */
function getRoundWeight(roundName = '') {
  const lower = roundName.toLowerCase();
  if (lower.includes('round 1') || lower.includes('prelim') || lower.includes('qualification')) return 1;
  if (lower.includes('quarter') || lower.includes('1/4')) return 2;
  if (lower.includes('semi') || lower.includes('1/2')) return 3;
  if (lower.includes('final')) return 4;
  return 5;
}

export default function TournamentBracketTree({
  matches = [],
  config = null,
  currentUserId = null,
  isAdmin = false
}) {
  // Group matches by normalized round
  const rounds = useMemo(() => {
    const map = new Map();
    matches.forEach((m) => {
      const rName = m.round_name || 'Round 1';
      if (!map.has(rName)) {
        map.set(rName, []);
      }
      map.get(rName).push(m);
    });

    const sortedRounds = Array.from(map.entries())
      .map(([name, matchGroup]) => ({
        name,
        matches: matchGroup.sort((a, b) => (a.id || 0) - (b.id || 0)),
        weight: getRoundWeight(name)
      }))
      .sort((a, b) => a.weight - b.weight);

    return sortedRounds;
  }, [matches]);

  // Extract champion info from config or verified final match
  const champion = useMemo(() => {
    if (config?.rules_json?.champion) {
      return config.rules_json.champion;
    }
    const finalMatch = matches.find((m) => {
      const r = (m.round_name || '').toLowerCase();
      return r.includes('final') && !r.includes('semi') && !r.includes('quarter');
    });

    if (finalMatch && finalMatch.is_verified && finalMatch.winner_side && finalMatch.winner_side !== 'draw') {
      const isWhite = finalMatch.winner_side === 'white';
      return {
        student_name: isWhite ? finalMatch.player_white_name : finalMatch.player_black_name,
        roll_number: isWhite ? finalMatch.player_white_user_id : finalMatch.player_black_user_id,
        participant_id: isWhite ? finalMatch.player_white_id : finalMatch.player_black_id,
        reason: finalMatch.result_reason
      };
    }
    return null;
  }, [config, matches]);

  if (matches.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-sm border border-gray-300 shadow-sm space-y-3">
        <Swords className="w-10 h-10 mx-auto text-gray-300" />
        <h3 className="text-sm font-semibold text-gray-800">Bracket Tree Not Yet Generated</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
          {isAdmin
            ? 'Accepted participants must be seeded into tournament fixtures. Use the "Start Tournament" action above to generate the elimination bracket.'
            : 'Tournament arbiters are finalizing participant pairings. Once fixtures are generated, the complete bracket tree will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visual Header Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-sm border border-gray-200 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>Elimination Tournament Tree</span>
            <span className="text-xs font-normal text-gray-500">• Single Elimination Progression</span>
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Follow the live progression of contenders from preliminary brackets into the championship final.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-gray-600 font-medium">Live In-Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0b3578]" />
            <span className="text-gray-600 font-medium">Scheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-gray-600 font-medium">Verified Winner</span>
          </div>
        </div>
      </div>

      {/* Horizontally Scrollable Bracket Tree */}
      <div className="overflow-x-auto pb-4 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-gray-300">
        <div className="inline-flex items-stretch gap-6 sm:gap-8 min-w-full p-2">
          {rounds.map((round) => (
            <div key={round.name} className="flex flex-col w-72 sm:w-80 shrink-0 space-y-4">
              {/* Round Header */}
              <div className="bg-[#0b3578] text-white px-3.5 py-2 rounded-t-sm shadow-xs flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {round.name}
                </span>
                <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded text-white">
                  {round.matches.length} {round.matches.length === 1 ? 'Match' : 'Matches'}
                </span>
              </div>

              {/* Match Cards for this Round */}
              <div className="flex-1 flex flex-col justify-around gap-4 bg-slate-50/70 p-3 rounded-b-sm border border-slate-200 border-t-0">
                {round.matches.map((m) => {
                  const isWhiteWinner = m.winner_side === 'white';
                  const isBlackWinner = m.winner_side === 'black';
                  const isConcluded = m.status === 'COMPLETED' || m.status === 'VERIFIED';
                  const isLive = m.status === 'IN_PROGRESS';

                  const userIsWhite = currentUserId && String(m.player_white_user_id || '').toLowerCase() === currentUserId;
                  const userIsBlack = currentUserId && String(m.player_black_user_id || '').toLowerCase() === currentUserId;
                  const isMyMatch = userIsWhite || userIsBlack;

                  return (
                    <div
                      key={m.id}
                      className={`relative bg-white rounded-sm border transition-all shadow-xs ${
                        isMyMatch
                          ? 'border-[#0b3578] ring-2 ring-[#0b3578]/25 shadow-sm'
                          : isLive
                          ? 'border-emerald-300 ring-1 ring-emerald-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Match Header Bar */}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/90 border-b border-gray-100 text-[10px]">
                        <span className="font-mono text-gray-500 font-semibold">#{m.match_code}</span>
                        <div className="flex items-center gap-1.5">
                          {isMyMatch && (
                            <span className="px-1.5 py-0.2 rounded bg-[#0b3578] text-white font-bold uppercase">
                              You
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold uppercase tracking-wide ${
                              isLive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isConcluded
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {isLive ? 'LIVE' : m.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Contenders Rows */}
                      <div className="divide-y divide-gray-100 text-xs">
                        {/* White Player */}
                        <div
                          className={`flex items-center justify-between px-3 py-2 transition-colors ${
                            isWhiteWinner
                              ? 'bg-emerald-50/60 font-bold text-emerald-950'
                              : isConcluded && isBlackWinner
                              ? 'opacity-60 text-gray-500 line-through'
                              : 'text-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="w-3 h-3 rounded-full bg-white border border-gray-400 shrink-0" title="White" />
                            <span className="truncate">
                              {m.player_white_name}
                              {userIsWhite && <span className="text-[#0b3578] font-bold ml-1">(You)</span>}
                            </span>
                          </div>
                          {isWhiteWinner && (
                            <span className="flex items-center gap-0.5 text-emerald-700 font-bold text-[10px] shrink-0 bg-emerald-100 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Winner
                            </span>
                          )}
                        </div>

                        {/* Black Player */}
                        <div
                          className={`flex items-center justify-between px-3 py-2 transition-colors ${
                            isBlackWinner
                              ? 'bg-emerald-50/60 font-bold text-emerald-950'
                              : isConcluded && isWhiteWinner
                              ? 'opacity-60 text-gray-500 line-through'
                              : 'text-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 shrink-0" title="Black" />
                            <span className="truncate">
                              {m.player_black_name}
                              {userIsBlack && <span className="text-[#0b3578] font-bold ml-1">(You)</span>}
                            </span>
                          </div>
                          {isBlackWinner && (
                            <span className="flex items-center gap-0.5 text-emerald-700 font-bold text-[10px] shrink-0 bg-emerald-100 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Winner
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/50 border-t border-gray-100">
                        <span className="text-[10px] text-gray-400 capitalize">
                          {m.result_reason ? m.result_reason.replace('_', ' ') : 'Single Game'}
                        </span>

                        <Link
                          href={`/events/chess/match/${m.id}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors shadow-2xs ${
                            isLive
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : isMyMatch
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold'
                              : 'bg-white hover:bg-gray-100 border border-gray-300 text-gray-700'
                          }`}
                        >
                          <span>{isLive ? 'Watch Live' : 'Open Arena'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Column: Champion Pod */}
          <div className="flex flex-col w-72 sm:w-80 shrink-0 space-y-4">
            <div className="bg-amber-500 text-slate-950 px-3.5 py-2 rounded-t-sm shadow-xs flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-slate-950" /> Tournament Champion
              </span>
              <span className="text-[10px] bg-slate-950 text-amber-300 px-2 py-0.5 rounded uppercase">
                Podium
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center bg-amber-50/40 p-6 rounded-b-sm border border-amber-300 border-t-0 text-center space-y-3">
              {champion ? (
                <>
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center shadow-sm">
                      <Trophy className="w-8 h-8 text-amber-600 animate-bounce" />
                    </div>
                    <span className="absolute -top-1 -right-1 p-1 rounded-full bg-amber-500 text-slate-950">
                      <Crown className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                      Official Winner
                    </span>
                    <h4 className="text-base font-bold text-gray-900 mt-1.5">
                      {champion.student_name}
                    </h4>
                    {champion.roll_number && (
                      <p className="text-xs font-mono text-gray-600 mt-0.5 font-semibold">
                        Roll: {champion.roll_number}
                      </p>
                    )}
                    {champion.branch && (
                      <p className="text-[11px] text-gray-500 font-medium">
                        Dept: {champion.branch}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 w-full border-t border-amber-200/60 flex items-center justify-center gap-1.5 text-xs text-amber-800 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Verified by Arbiters</span>
                  </div>
                </>
              ) : (
                <div className="space-y-2 py-6">
                  <Trophy className="w-12 h-12 mx-auto text-amber-300" />
                  <p className="text-xs font-semibold text-gray-700">Championship in Progress</p>
                  <p className="text-[11px] text-gray-500 max-w-xs mx-auto leading-relaxed">
                    The final round winner will be officially crowned upon arbiter verification.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
