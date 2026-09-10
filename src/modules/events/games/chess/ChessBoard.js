'use client';

import React, { useState, useMemo } from 'react';
import { renderPiece, ChessPieceIcons } from './chess-utils';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export default function ChessBoard({
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  legalMoves = [],
  onMove,
  isInteractive = true,
  orientation = 'white',
  lastMove = null,
  isCheck = false,
  currentTurn = 'w'
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // Parse FEN into 8x8 grid
  const boardGrid = useMemo(() => {
    const grid = {};
    const [placement] = (fen || '').split(' ');
    const rows = (placement || '').split('/');

    for (let r = 0; r < 8; r++) {
      const rowStr = rows[r] || '';
      let fileIdx = 0;
      for (const char of rowStr) {
        if (char >= '1' && char <= '8') {
          const emptyCount = parseInt(char, 10);
          for (let i = 0; i < emptyCount; i++) {
            const square = `${FILES[fileIdx]}${RANKS[r]}`;
            grid[square] = null;
            fileIdx++;
          }
        } else {
          const square = `${FILES[fileIdx]}${RANKS[r]}`;
          grid[square] = char;
          fileIdx++;
        }
      }
    }
    return grid;
  }, [fen]);

  // Find king in check square
  const inCheckSquare = useMemo(() => {
    if (!isCheck) return null;
    const targetKing = currentTurn === 'w' ? 'K' : 'k';
    for (const [sq, piece] of Object.entries(boardGrid)) {
      if (piece === targetKing) return sq;
    }
    return null;
  }, [isCheck, currentTurn, boardGrid]);

  // Valid destinations for currently selected square
  const validDestinations = useMemo(() => {
    if (!selectedSquare || !Array.isArray(legalMoves)) return [];
    return legalMoves
      .filter((m) => m.from === selectedSquare)
      .map((m) => ({
        to: m.to,
        isCapture: !!m.captured || !!m.san?.includes('x'),
        isPromotion: !!m.promotion || m.flags?.includes('p') || m.flags?.includes('cp')
      }));
  }, [selectedSquare, legalMoves]);

  const displayedRanks = orientation === 'black' ? [...RANKS].reverse() : RANKS;
  const displayedFiles = orientation === 'black' ? [...FILES].reverse() : FILES;

  const handleSquareClick = (square) => {
    if (!isInteractive) return;

    const piece = boardGrid[square];
    const isPieceOfTurn = piece && (
      (currentTurn === 'w' && piece === piece.toUpperCase()) ||
      (currentTurn === 'b' && piece === piece.toLowerCase())
    );

    // If square is already selected, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    // Check if clicking a valid move destination
    if (selectedSquare) {
      const destination = validDestinations.find((d) => d.to === square);
      if (destination) {
        // Check for promotion condition (pawn moving to 8th or 1st rank)
        const selectedPiece = boardGrid[selectedSquare];
        const isPawn = selectedPiece?.toLowerCase() === 'p';
        const isPromotionRank = square.endsWith('8') || square.endsWith('1');

        if (isPawn && isPromotionRank) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        // Execute regular move
        if (typeof onMove === 'function') {
          onMove({ from: selectedSquare, to: square });
        }
        setSelectedSquare(null);
        return;
      }
    }

    // Selecting a piece of active turn
    if (isPieceOfTurn) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const handleSelectPromotion = (promotionPiece) => {
    if (pendingPromotion && typeof onMove === 'function') {
      onMove({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: promotionPiece
      });
    }
    setPendingPromotion(null);
    setSelectedSquare(null);
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Chessboard Container */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-950/80 bg-amber-950/90 p-2 sm:p-3">
        {/* The 8x8 Grid */}
        <div className="grid grid-cols-8 grid-rows-8 w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] md:w-[500px] md:h-[500px] rounded-lg overflow-hidden border border-amber-900/40">
          {displayedRanks.map((rank, rIdx) =>
            displayedFiles.map((file, fIdx) => {
              const square = `${file}${rank}`;
              const isLight = (fIdx + rIdx) % 2 === 0;
              const piece = boardGrid[square];
              const isSelected = selectedSquare === square;
              const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
              const destination = validDestinations.find((d) => d.to === square);
              const isKingInCheck = inCheckSquare === square;

              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  className={`
                    relative flex items-center justify-center cursor-pointer transition-all duration-150
                    ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}
                    ${isSelected ? 'ring-4 ring-amber-400 ring-inset z-10 brightness-110' : ''}
                    ${isLastMoveSquare && !isSelected ? 'bg-sky-400/40' : ''}
                    ${isKingInCheck ? 'bg-red-500/60 animate-pulse ring-4 ring-red-600 ring-inset' : ''}
                    hover:brightness-105 active:scale-[0.98]
                  `}
                >
                  {/* Coordinate labels */}
                  {fIdx === 0 && (
                    <span
                      className={`
                        absolute top-0.5 left-1 text-[9px] sm:text-[11px] font-bold leading-none pointer-events-none
                        ${isLight ? 'text-[#b58863]' : 'text-[#f0d9b5]'}
                      `}
                    >
                      {rank}
                    </span>
                  )}
                  {rIdx === 7 && (
                    <span
                      className={`
                        absolute bottom-0.5 right-1 text-[9px] sm:text-[11px] font-bold leading-none pointer-events-none
                        ${isLight ? 'text-[#b58863]' : 'text-[#f0d9b5]'}
                      `}
                    >
                      {file}
                    </span>
                  )}

                  {/* Destination indicator */}
                  {destination && (
                    <div
                      className={`
                        absolute z-10 pointer-events-none
                        ${destination.isCapture
                          ? 'w-full h-full border-4 border-emerald-500/80 rounded-none bg-emerald-500/20'
                          : 'w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-600/80 shadow-md ring-2 ring-white/50'
                        }
                      `}
                    />
                  )}

                  {/* Chess Piece */}
                  {piece && (
                    <div
                      className={`
                        relative w-[85%] h-[85%] flex items-center justify-center transition-transform
                        ${isSelected ? 'scale-110' : ''}
                      `}
                    >
                      {renderPiece(piece)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Promotion Dialog Modal */}
      {pendingPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Pawn Promotion
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Choose a piece to promote your pawn:
            </p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { type: 'q', label: 'Queen' },
                { type: 'r', label: 'Rook' },
                { type: 'b', label: 'Bishop' },
                { type: 'n', label: 'Knight' },
              ].map(({ type, label }) => {
                const pieceKey = `${currentTurn === 'w' ? 'w' : 'b'}${type.toUpperCase()}`;
                const PieceIcon = ChessPieceIcons[pieceKey];

                return (
                  <button
                    key={type}
                    onClick={() => handleSelectPromotion(type)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 group-hover:scale-110 transition-transform">
                      {PieceIcon ? <PieceIcon /> : null}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
