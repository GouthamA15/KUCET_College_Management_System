'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ChessBoard from './ChessBoard';
import { renderPiece, PIECE_VALUES } from './chess-utils';
import { Trophy, ShieldAlert, Flag, Handshake, RefreshCw, Eye, CheckCircle2, RotateCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ChessGameView({ matchId, currentUser = null }) {
  const [matchData, setMatchData] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [manualOrientation, setManualOrientation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);

  // Fetch latest game state
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/matches/${matchId}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch match');

      setMatchData(data);
      setLegalMoves(data.legalMoves || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  // Polling loop (every 2.5s)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGameState();
    const interval = setInterval(fetchGameState, 2500);
    return () => clearInterval(interval);
  }, [fetchGameState]);

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
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate material advantages
  const materialAdvantage = useMemo(() => {
    if (!game?.captured_pieces) return { white: 0, black: 0 };
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
    // Basic SAN extraction
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
      <div className="flex flex-col items-center justify-center min-h-[450px] p-8">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Loading Chess Match Arena...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl text-center">
        <ShieldAlert className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-red-900 dark:text-red-300 mb-1">Match Not Accessible</h2>
        <p className="text-sm text-red-700 dark:text-red-400 mb-4">{error || 'Match does not exist or has been removed.'}</p>
        <Link href="/events/chess" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800">
          <ArrowLeft className="w-4 h-4" /> Return to Tournament
        </Link>
      </div>
    );
  }

  const isGameCompleted = match.status === 'COMPLETED' || match.status === 'ABANDONED';
  const hasDrawOffer = game?.draw_offer_side && isPlayer;
  const opponentOfferedDraw = (isWhite && game?.draw_offer_side === 'b') || (isBlack && game?.draw_offer_side === 'w');
  const myDrawOfferPending = (isWhite && game?.draw_offer_side === 'w') || (isBlack && game?.draw_offer_side === 'b');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/events/chess"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
            title="Back to Tournament Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                {match.round_name}
              </span>
              <span className="text-xs font-mono text-slate-400">
                #{match.match_code}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {match.player_white_name} vs {match.player_black_name}
            </h1>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {isSpectator && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <Eye className="w-3.5 h-3.5" /> Spectator Mode
            </span>
          )}

          {match.is_verified && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified Result
            </span>
          )}

          <span
            className={`
              px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border
              ${match.status === 'IN_PROGRESS'
                ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                : match.status === 'COMPLETED'
                ? 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
              }
            `}
          >
            {match.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Main Arena Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left / Center: Chessboard Area (Cols 1-7) */}
        <div className="lg:col-span-7 flex flex-col items-center space-y-4">
          {/* Opponent Player Bar */}
          <div className="w-full max-w-[500px] flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${orientation === 'white' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-300'}`} />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                  {orientation === 'white' ? match.player_black_name : match.player_white_name}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {orientation === 'white' ? 'Playing Black' : 'Playing White'}
                </p>
              </div>
            </div>

            {/* Captured pieces by opponent */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 max-w-[140px] overflow-x-auto">
                {(orientation === 'white' ? game?.captured_pieces?.black : game?.captured_pieces?.white)?.map((p, idx) => (
                  <span key={idx} className="w-4 h-4 text-slate-700">
                    {renderPiece(orientation === 'white' ? p.toUpperCase() : p.toLowerCase())}
                  </span>
                ))}
              </div>
              {orientation === 'white' && materialAdvantage.blackDiff > 0 && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 dark:bg-slate-700 px-1 rounded">
                  +{materialAdvantage.blackDiff}
                </span>
              )}
              {orientation === 'black' && materialAdvantage.whiteDiff > 0 && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 dark:bg-slate-700 px-1 rounded">
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
          <div className="w-full max-w-[500px] flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${orientation === 'white' ? 'bg-white border border-slate-300' : 'bg-slate-900 border border-slate-700'}`} />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                  {orientation === 'white' ? match.player_white_name : match.player_black_name} {isPlayer && <span className="text-blue-600 text-xs">(You)</span>}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {orientation === 'white' ? 'Playing White' : 'Playing Black'}
                </p>
              </div>
            </div>

            {/* Captured pieces by user */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5 max-w-[140px] overflow-x-auto">
                {(orientation === 'white' ? game?.captured_pieces?.white : game?.captured_pieces?.black)?.map((p, idx) => (
                  <span key={idx} className="w-4 h-4 text-slate-700">
                    {renderPiece(orientation === 'white' ? p.toLowerCase() : p.toUpperCase())}
                  </span>
                ))}
              </div>
              {orientation === 'white' && materialAdvantage.whiteDiff > 0 && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 dark:bg-slate-700 px-1 rounded">
                  +{materialAdvantage.whiteDiff}
                </span>
              )}
              {orientation === 'black' && materialAdvantage.blackDiff > 0 && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 dark:bg-slate-700 px-1 rounded">
                  +{materialAdvantage.blackDiff}
                </span>
              )}
            </div>
          </div>

          {/* Quick Board Tools */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setManualOrientation(orientation === 'white' ? 'black' : 'white')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 shadow-2xs cursor-pointer transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" /> Flip Board ({orientation === 'white' ? 'White' : 'Black'})
            </button>
          </div>
        </div>

        {/* Right: Game Info, Live Moves & Match Controls (Cols 8-12) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Turn & Outcome Banner */}
          <div
            className={`
              p-4 rounded-2xl border shadow-sm transition-all
              ${isGameCompleted
                ? 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/30'
                : isMyTurn
                ? 'bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/20'
                : 'bg-slate-50 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700'
              }
            `}
          >
            {isGameCompleted ? (
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-amber-500 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {match.winner_side === 'draw'
                      ? 'Match Drawn'
                      : `${match.winner_side === 'white' ? match.player_white_name : match.player_black_name} Wins!`}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                    Reason: {match.result_reason?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Current Turn
                  </p>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${currentTurn === 'w' ? 'bg-white border border-slate-400' : 'bg-slate-900'}`} />
                    {currentTurn === 'w' ? 'White to move' : 'Black to move'}
                  </h3>
                </div>

                {isPlayer && (
                  <div className="text-right">
                    <span
                      className={`
                        inline-block text-xs font-bold px-2.5 py-1 rounded-md
                        ${isMyTurn ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}
                      `}
                    >
                      {isMyTurn ? 'Your Turn' : 'Waiting...'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {game?.is_check && !isGameCompleted && (
              <div className="mt-3 py-1.5 px-3 rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" /> Check!
              </div>
            )}
          </div>

          {/* Pending Draw Offer Box */}
          {hasDrawOffer && !isGameCompleted && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              {opponentOfferedDraw ? (
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-2">
                    🤝 Your opponent has offered a mutual draw.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('accept_draw')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                    >
                      Accept Draw
                    </button>
                    <button
                      onClick={() => handleAction('decline_draw')}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-300"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ) : myDrawOfferPending ? (
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  ⏳ Draw offer sent. Waiting for opponent response...
                </p>
              ) : null}
            </div>
          )}

          {/* Move History Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Move History (Algebraic Notation)
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                {parsedMoves.length} Moves
              </span>
            </div>

            <div className="max-h-[220px] overflow-y-auto p-2">
              {parsedMoves.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No moves played yet. White starts the game.
                </p>
              ) : (
                <table className="w-full text-xs font-mono">
                  <tbody>
                    {parsedMoves.map((m) => (
                      <tr key={m.num} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded">
                        <td className="w-12 py-1 pl-2 text-slate-400 font-semibold">{m.num}.</td>
                        <td className="py-1 px-2 font-bold text-slate-800 dark:text-slate-200">{m.white}</td>
                        <td className="py-1 px-2 font-bold text-slate-800 dark:text-slate-200">{m.black}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Player Actions (Resign / Offer Draw) */}
          {isPlayer && !isGameCompleted && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowResignModal(true)}
                disabled={isSubmitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900 cursor-pointer transition-all"
              >
                <Flag className="w-4 h-4" /> Resign Game
              </button>
              <button
                onClick={() => handleAction('offer_draw')}
                disabled={isSubmitting || !!game?.draw_offer_side}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all disabled:opacity-50"
              >
                <Handshake className="w-4 h-4" /> Offer Draw
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resignation Confirmation Modal */}
      {showResignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full text-center">
            <Flag className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Concede Match?
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to resign? Your opponent will be awarded the victory immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResignModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('resign')}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer"
              >
                Confirm Resignation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
