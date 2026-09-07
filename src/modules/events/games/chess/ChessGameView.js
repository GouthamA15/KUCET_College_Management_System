'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ChessBoard from './ChessBoard';
import { renderPiece, PIECE_VALUES, playChessSound } from './chess-utils';
import { Trophy, ShieldAlert, Flag, Handshake, RefreshCw, Eye, CheckCircle2, RotateCw, ArrowLeft, GitBranch, X } from 'lucide-react';
import Link from 'next/link';
import { subscribeToRealtimeEvents } from '@/components/RealtimeListener';
import { REALTIME_EVENTS } from '@/lib/events/realtime-events';
import TournamentBracketTree from '../../components/TournamentBracketTree';

export default function ChessGameView({ matchId, currentUser = null }) {
  const [matchData, setMatchData] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [manualOrientation, setManualOrientation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [showBracketModal, setShowBracketModal] = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [tournamentConfig, setTournamentConfig] = useState(null);

  const prevFenRef = useRef(null);

  // Fetch latest game state
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/matches/${matchId}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch match');

      const nextFen = data?.game?.fen;
      if (nextFen && prevFenRef.current && prevFenRef.current !== nextFen) {
        if (data?.game?.is_checkmate || data?.match?.status === 'COMPLETED') {
          playChessSound('victory');
        } else if (data?.game?.is_check) {
          playChessSound('check');
        } else if (data?.game?.last_move_captured) {
          playChessSound('capture');
        } else {
          playChessSound('move');
        }
      }
      prevFenRef.current = nextFen;

      setMatchData(data);
      setLegalMoves(data.legalMoves || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  // Load tournament bracket matches on demand
  const loadTournamentBracket = useCallback(async () => {
    try {
      const [mRes, cRes] = await Promise.all([
        fetch('/api/events/matches?event_key=chess&limit=100'),
        fetch('/api/events/config?event_key=chess')
      ]);
      const [mData, cData] = await Promise.all([mRes.json(), cRes.json()]);
      setTournamentMatches(mData.items || []);
      setTournamentConfig(cData);
    } catch (e) {
      console.error('Failed to load bracket data:', e);
    }
  }, []);

  // Multi-tier Real-time Synchronizer:
  // 1. Socket.IO (Direct low-latency push from server)
  // 2. Supabase Realtime Broadcast channel (fallback in dev/hybrid)
  // 3. Browser BroadcastChannel (cross-tab local zero-latency sync)
  // 4. Background safety poll (every 5s instead of 2.5s)
  useEffect(() => {
    // Initial fetch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGameState();

    // 1. Socket.IO canonical event subscription
    const unsubscribeSocket = subscribeToRealtimeEvents((event) => {
      const eventType = event?.type;
      const payload = event?.payload || {};

      if (
        (eventType === REALTIME_EVENTS.CHESS_MOVE_PLAYED ||
         eventType === REALTIME_EVENTS.CHESS_GAME_OVER ||
         eventType === REALTIME_EVENTS.CHESS_ACTION) &&
        String(payload.matchId || payload.match_id) === String(matchId)
      ) {
        // Instant sync upon opponent move or action
        fetchGameState();
      }
    });

    // 2. Cross-tab BroadcastChannel for 0ms same-browser tabs (e.g. testing with 2 student sessions)
    let localChannel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        localChannel = new BroadcastChannel(`chess_match_${matchId}`);
        localChannel.onmessage = (msg) => {
          if (msg.data?.action === 'move_played' || msg.data?.action === 'action_taken') {
            fetchGameState();
          }
        };
      }
    } catch (_e) {
      // BroadcastChannel unavailable
    }

    // 3. Supabase Realtime client listener (if credentials exist)
    let supabaseChannel = null;
    const subUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const subKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (subUrl && subKey) {
      import('@supabase/supabase-js')
        .then(({ createClient }) => {
          const supabase = createClient(subUrl, subKey);
          supabaseChannel = supabase.channel('kucet-updates');
          supabaseChannel
            .on('broadcast', { event: REALTIME_EVENTS.CHESS_MOVE_PLAYED }, (event) => {
              if (String(event?.payload?.matchId) === String(matchId)) {
                fetchGameState();
              }
            })
            .on('broadcast', { event: REALTIME_EVENTS.CHESS_GAME_OVER }, (event) => {
              if (String(event?.payload?.matchId) === String(matchId)) {
                fetchGameState();
              }
            })
            .on('broadcast', { event: REALTIME_EVENTS.CHESS_ACTION }, (event) => {
              if (String(event?.payload?.matchId) === String(matchId)) {
                fetchGameState();
              }
            })
            .subscribe();
        })
        .catch((_err) => {
          // ignore Supabase load error
        });
    }

    // 4. Background safety poll interval (fallback)
    const interval = setInterval(fetchGameState, 5000);

    return () => {
      unsubscribeSocket();
      clearInterval(interval);
      if (localChannel) localChannel.close();
      if (supabaseChannel) supabaseChannel.unsubscribe();
    };
  }, [fetchGameState, matchId]);

  const match = matchData?.match;
  const game = matchData?.game;

  // Determine current user role in match
  const currentUserId = String(currentUser?.roll_no || currentUser?.id || currentUser?.staffId || '');
  const isWhite = match && String(match.player_white_user_id) === currentUserId;
  const isBlack = match && String(match.player_black_user_id) === currentUserId;
  const isPlayer = isWhite || isBlack;
  const isSpectator = !isPlayer;

  // Board orientation
  const orientation = manualOrientation || (isBlack ? 'black' : 'white');

  // Turn detection
  const currentTurn = game?.current_turn || 'w';
  const isMyTurn = isPlayer && ((isWhite && currentTurn === 'w') || (isBlack && currentTurn === 'b'));

  // Move handler
  const handleMove = async ({ from, to, promotion }) => {
    if (!isPlayer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/events/matches/${matchId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, promotion })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to make move');

      setMatchData(data);
      setLegalMoves(data.legalMoves || []);

      // Notify other tabs immediately
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`chess_match_${matchId}`);
          bc.postMessage({ action: 'move_played', from, to });
          bc.close();
        }
      } catch (_e) {
        // ignore
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action handler (Resign, Offer Draw, Accept/Decline Draw)
  const handleAction = async (action) => {
    if (!isPlayer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/events/matches/${matchId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setMatchData(data);
      setLegalMoves(data.legalMoves || []);
      setShowResignModal(false);

      // Notify other tabs immediately
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(`chess_match_${matchId}`);
          bc.postMessage({ action: 'action_taken', type: action });
          bc.close();
        }
      } catch (_e) {
        // ignore
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate material advantages
  const materialAdvantage = useMemo(() => {
    if (!game?.captured_pieces) return { white: 0, black: 0, whiteDiff: 0, blackDiff: 0 };
    const whitePoints = (game.captured_pieces.white || []).reduce((sum, p) => sum + (PIECE_VALUES[p] || 0), 0);
    const blackPoints = (game.captured_pieces.black || []).reduce((sum, p) => sum + (PIECE_VALUES[p] || 0), 0);
    return {
      whiteDiff: whitePoints - blackPoints,
      blackDiff: blackPoints - whitePoints
    };
  }, [game]);

  // Last move
  const lastMove = game?.last_move_from && game?.last_move_to ? {
    from: game.last_move_from,
    to: game.last_move_to
  } : null;

  // Format PGN / move history
  const gamePgn = game?.pgn || '';
  const parsedMoves = useMemo(() => {
    if (!gamePgn) return [];
    const rawTokens = gamePgn.replace(/\[.*?\]/g, '').trim().split(/\s+/).filter(Boolean);
    const moves = [];
    let currentPair = null;

    for (let i = 0; i < rawTokens.length; i++) {
      const token = rawTokens[i];
      if (token.includes('.')) {
        const moveNum = token.split('.')[0];
        const whiteSan = token.split('.')[1] || rawTokens[++i];
        currentPair = { num: moveNum, white: whiteSan, black: '' };
        moves.push(currentPair);
      } else if (currentPair && !currentPair.black) {
        currentPair.black = token;
      }
    }
    return moves;
  }, [gamePgn]);

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto p-12 text-center">
        <RefreshCw className="w-8 h-8 text-[#0b3578] animate-spin mb-3 mx-auto" />
        <p className="text-xs font-semibold text-gray-500">Loading Chess Match Arena...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="w-full max-w-xl mx-auto my-8 p-6 bg-rose-50 border border-rose-200 rounded-sm text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-semibold text-rose-900">Match Unavailable</h2>
        <p className="text-xs text-rose-700">{error || 'Match does not exist or has been completed.'}</p>
        <div className="pt-2">
          <Link
            href="/events/chess"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b3578] hover:bg-[#0a2d66] text-white rounded-md text-xs font-medium transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Tournament
          </Link>
        </div>
      </div>
    );
  }

  const isGameCompleted = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const hasDrawOffer = game?.draw_offer_side && isPlayer;
  const opponentOfferedDraw = (isWhite && game?.draw_offer_side === 'b') || (isBlack && game?.draw_offer_side === 'w');
  const myDrawOfferPending = (isWhite && game?.draw_offer_side === 'w') || (isBlack && game?.draw_offer_side === 'b');

  const isAdminUser = currentUser?.role === 'admin' || (typeof document !== 'undefined' && (document.cookie || '').includes('admin_logged_in=true'));
  const backHref = isAdminUser ? '/admin/events/chess' : '/events/chess';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 text-sm">
      {/* Top Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="p-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
            title={isAdminUser ? "Back to Admin Chess Control" : "Back to Tournament Hub"}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {match.round_name}
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                #{match.match_code}
              </span>
            </div>
            <h1 className="text-lg font-semibold text-gray-800 mt-0.5">
              {match.player_white_name} vs {match.player_black_name}
            </h1>
          </div>
        </div>

        {/* Status Badges & Bracket Modal Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadTournamentBracket();
              setShowBracketModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 shadow-xs cursor-pointer transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#0b3578]" />
            <span>Bracket Tree</span>
          </button>

          {isSpectator && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
              <Eye className="w-3.5 h-3.5" /> Spectator Mode
            </span>
          )}

          {match.is_verified && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified Result
            </span>
          )}

          <span
            className={`
              px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide border
              ${match.status === 'IN_PROGRESS'
                ? 'bg-blue-50 text-[#0b3578] border-blue-200'
                : match.status === 'COMPLETED'
                ? 'bg-gray-100 text-gray-800 border-gray-300'
                : 'bg-amber-50 text-amber-800 border-amber-200'
              }
            `}
          >
            {match.status.replace('_', ' ')}
          </span>
        </div>
      </header>

      {/* Main Arena Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Chessboard Area (Cols 1-7) */}
        <div className="lg:col-span-7 flex flex-col items-center space-y-3">
          {/* Opponent Player Bar */}
          <div className="w-full max-w-[500px] flex items-center justify-between p-3 rounded-sm bg-gray-50 border border-gray-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${orientation === 'white' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-400'}`} />
              <div>
                <p className="text-xs font-bold text-gray-800 leading-none">
                  {orientation === 'white' ? match.player_black_name : match.player_white_name}
                </p>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                  {orientation === 'white' ? 'Playing Black' : 'Playing White'}
                </p>
              </div>
            </div>

            {/* Captured pieces by opponent */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 max-w-[140px] overflow-x-auto">
                {(orientation === 'white' ? game?.captured_pieces?.black : game?.captured_pieces?.white)?.map((p, idx) => (
                  <span key={idx} className="w-4 h-4 text-gray-700">
                    {renderPiece(orientation === 'white' ? p.toUpperCase() : p.toLowerCase())}
                  </span>
                ))}
              </div>
              {orientation === 'white' && materialAdvantage.blackDiff > 0 && (
                <span className="text-[10px] font-bold text-gray-600 bg-gray-200 px-1 rounded">
                  +{materialAdvantage.blackDiff}
                </span>
              )}
              {orientation === 'black' && materialAdvantage.whiteDiff > 0 && (
                <span className="text-[10px] font-bold text-gray-600 bg-gray-200 px-1 rounded">
                  +{materialAdvantage.whiteDiff}
                </span>
              )}
            </div>
          </div>

          {/* Interactive Chess Board */}
          <ChessBoard
            fen={game?.fen}
            legalMoves={legalMoves}
            onMove={handleMove}
            isInteractive={isPlayer && !isGameCompleted && isMyTurn && !isSubmitting}
            orientation={orientation}
            lastMove={lastMove}
            isCheck={game?.is_check}
            currentTurn={currentTurn}
          />

          {/* User Player Bar */}
          <div className="w-full max-w-[500px] flex items-center justify-between p-3 rounded-sm bg-gray-50 border border-gray-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${orientation === 'white' ? 'bg-white border border-gray-400' : 'bg-slate-900 border border-slate-700'}`} />
              <div>
                <p className="text-xs font-bold text-gray-800 leading-none">
                  {orientation === 'white' ? match.player_white_name : match.player_black_name} {isPlayer && <span className="text-blue-700 text-xs">(You)</span>}
                </p>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                  {orientation === 'white' ? 'Playing White' : 'Playing Black'}
                </p>
              </div>
            </div>

            {/* Captured pieces by user */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 max-w-[140px] overflow-x-auto">
                {(orientation === 'white' ? game?.captured_pieces?.white : game?.captured_pieces?.black)?.map((p, idx) => (
                  <span key={idx} className="w-4 h-4 text-gray-700">
                    {renderPiece(orientation === 'white' ? p.toLowerCase() : p.toUpperCase())}
                  </span>
                ))}
              </div>
              {orientation === 'white' && materialAdvantage.whiteDiff > 0 && (
                <span className="text-[10px] font-bold text-gray-600 bg-gray-200 px-1 rounded">
                  +{materialAdvantage.whiteDiff}
                </span>
              )}
              {orientation === 'black' && materialAdvantage.blackDiff > 0 && (
                <span className="text-[10px] font-bold text-gray-600 bg-gray-200 px-1 rounded">
                  +{materialAdvantage.blackDiff}
                </span>
              )}
            </div>
          </div>

          {/* Quick Board Tools */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setManualOrientation(orientation === 'white' ? 'black' : 'white')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 shadow-xs cursor-pointer transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" /> Flip Board ({orientation === 'white' ? 'White' : 'Black'})
            </button>
          </div>
        </div>

        {/* Right: Game Info, Live Moves & Match Controls (Cols 8-12) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Turn & Outcome Banner */}
          <div
            className={`
              p-4 rounded-sm border shadow-sm transition-all
              ${isGameCompleted
                ? 'bg-amber-50 border-amber-200'
                : isMyTurn
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-white border-gray-300'
              }
            `}
          >
            {isGameCompleted ? (
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {match.winner_side === 'draw'
                      ? 'Match Drawn'
                      : `${match.winner_side === 'white' ? match.player_white_name : match.player_black_name} Wins!`}
                  </h3>
                  <p className="text-xs text-gray-600 capitalize mt-0.5">
                    Result: {match.result_reason?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                    Current Turn
                  </p>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mt-0.5">
                    <span className={`w-3 h-3 rounded-full ${currentTurn === 'w' ? 'bg-white border border-gray-400' : 'bg-slate-900'}`} />
                    {currentTurn === 'w' ? 'White to move' : 'Black to move'}
                  </h3>
                </div>

                {isPlayer && (
                  <div>
                    <span
                      className={`
                        inline-block text-xs font-semibold px-2.5 py-1 rounded
                        ${isMyTurn ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'}
                      `}
                    >
                      {isMyTurn ? 'Your Turn' : 'Waiting...'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {game?.is_check && !isGameCompleted && (
              <div className="mt-3 py-1.5 px-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> Check!
              </div>
            )}
          </div>

          {/* Pending Draw Offer Box */}
          {hasDrawOffer && !isGameCompleted && (
            <div className="p-3.5 rounded-sm bg-amber-50 border border-amber-200">
              {opponentOfferedDraw ? (
                <div>
                  <p className="text-xs font-semibold text-amber-900 mb-2">
                    Your opponent has offered a mutual draw.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction('accept_draw')}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                    >
                      Accept Draw
                    </button>
                    <button
                      onClick={() => handleAction('decline_draw')}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ) : myDrawOfferPending ? (
                <p className="text-xs text-amber-800">
                  Draw offer sent to opponent. Awaiting response.
                </p>
              ) : null}
            </div>
          )}

          {/* Notation & Move History — standard KUCET box */}
          <div className="bg-white rounded-sm border border-gray-300 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-xs font-semibold text-gray-700">Official Move History</span>
              <span className="text-[11px] text-gray-400 font-mono">{parsedMoves.length} moves</span>
            </div>

            <div className="h-44 overflow-y-auto space-y-1 text-xs font-mono pr-1 custom-scrollbar">
              {parsedMoves.length === 0 ? (
                <p className="text-gray-400 italic text-center py-8">Game starting...</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {parsedMoves.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 px-1.5 rounded hover:bg-gray-50">
                      <span className="text-gray-400 w-6 text-right">{m.num}.</span>
                      <span className="font-semibold text-gray-800 w-12">{m.white}</span>
                      <span className="font-semibold text-gray-700">{m.black || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* In-Game Action Buttons (Only active players) */}
          {isPlayer && !isGameCompleted && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResignModal(true)}
                disabled={isSubmitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-medium transition-colors cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5 text-rose-600" /> Resign Match
              </button>

              <button
                onClick={() => handleAction('offer_draw')}
                disabled={isSubmitting || hasDrawOffer}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <Handshake className="w-3.5 h-3.5 text-gray-500" /> Offer Draw
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resign Confirmation Modal */}
      {showResignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-md p-6 max-w-sm w-full border border-gray-300 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Confirm Resignation</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to concede this match? This will immediately record a loss and advance your opponent.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowResignModal(false)}
                className="px-3.5 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('resign')}
                className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
              >
                Yes, Resign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament Tree Bracket Modal */}
      {showBracketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-md max-w-5xl w-full border border-gray-300 shadow-2xl space-y-4 p-4 sm:p-6 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[#0b3578]" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-none">Tournament Tree Visualizer</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Live knockout tree progression and match outcomes</p>
                </div>
              </div>
              <button
                onClick={() => setShowBracketModal(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1">
              <TournamentBracketTree
                matches={tournamentMatches.length > 0 ? tournamentMatches : [match]}
                config={tournamentConfig}
                currentUserId={currentUserId}
                isAdmin={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
