import React from 'react';

/**
 * High-quality vector SVG icons for all chess pieces.
 */
export const ChessPieceIcons = {
  // White Pieces
  wK: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="none" fillRule="evenodd" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" stroke="#fff" />
        <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#fff" stroke="#1e293b" />
        <path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-4c-6-1.5-16-1.5-22 0v4z" fill="#fff" stroke="#1e293b" />
        <path d="M11.5 33c5.5-2 16.5-2 22 0l1-4.5c-6.5-2-17.5-2-24 0l1 4.5z" fill="#fff" stroke="#1e293b" />
        <path d="M12 28.5c5.5-2 15.5-2 21 0l2-6c-7-2-18-2-25 0l2 6z" fill="#fff" stroke="#1e293b" />
      </g>
    </svg>
  ),
  wQ: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="#fff" fillRule="evenodd" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm16.5 4.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM12 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm25 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25l-7-11 2 12z" strokeLinecap="butt" />
        <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
        <path d="M11 38.5a35 35 1 0 0 23 0" fill="none" />
      </g>
    </svg>
  ),
  wR: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="#fff" fillRule="evenodd" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm2-4.5V14h17v17.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" strokeLinecap="butt" />
        <path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" fill="none" stroke="#64748b" strokeWidth="1" />
      </g>
    </svg>
  ),
  wB: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="none" fillRule="evenodd" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <g fill="#fff" strokeLinecap="butt">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
          <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        </g>
        <path d="M17.5 26h10M15 30h15" stroke="#64748b" strokeLinejoin="miter" />
        <path d="M22.5 15.5v5M20 18h5" stroke="#64748b" strokeLinejoin="miter" />
      </g>
    </svg>
  ),
  wN: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="none" fillRule="evenodd" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff" />
        <path d="M24 18c.338 2.378-1.43 3.65-3.5 3-1.5-.5-3.5-.5-4.5 1.5-1.5 3 1.5 3.5 2.5 4 1.5.5 1.5 2 0 3-1.5 1-3.5 0-4.5-1.5-1.5-2-1.5-4-.5-6.5 1.5-3 5-4.5 8.5-4.5 2 0 2-1 2-1z" fill="#fff" />
        <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#1e293b" stroke="#1e293b" />
        <path d="M14.93 15.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#1e293b" stroke="#1e293b" />
      </g>
    </svg>
  ),
  wP: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Black Pieces
  bK: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="none" fillRule="evenodd" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" stroke="#cbd5e1" />
        <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#1e293b" stroke="#0f172a" />
        <path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-4c-6-1.5-16-1.5-22 0v4z" fill="#1e293b" stroke="#0f172a" />
        <path d="M11.5 33c5.5-2 16.5-2 22 0l1-4.5c-6.5-2-17.5-2-24 0l1 4.5z" fill="#1e293b" stroke="#0f172a" />
        <path d="M12 28.5c5.5-2 15.5-2 21 0l2-6c-7-2-18-2-25 0l2 6z" fill="#1e293b" stroke="#0f172a" />
        <path d="M22.5 30v4M17 32h11" stroke="#cbd5e1" strokeWidth="1" />
      </g>
    </svg>
  ),
  bQ: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="#1e293b" fillRule="evenodd" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm16.5 4.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM12 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm25 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25l-7-11 2 12z" strokeLinecap="butt" />
        <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
        <path d="M11 38.5a35 35 1 0 0 23 0" fill="none" stroke="#cbd5e1" strokeWidth="1" />
      </g>
    </svg>
  ),
  bR: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="#1e293b" fillRule="evenodd" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm2-4.5V14h17v17.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" strokeLinecap="butt" />
        <path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" fill="none" stroke="#94a3b8" strokeWidth="1" />
      </g>
    </svg>
  ),
  bB: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="none" fillRule="evenodd" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <g fill="#1e293b" strokeLinecap="butt">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
          <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        </g>
        <path d="M17.5 26h10M15 30h15" stroke="#94a3b8" strokeLinejoin="miter" strokeWidth="1" />
        <path d="M22.5 15.5v5M20 18h5" stroke="#94a3b8" strokeLinejoin="miter" strokeWidth="1" />
      </g>
    </svg>
  ),
  bN: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <g fill="none" fillRule="evenodd" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#1e293b" />
        <path d="M24 18c.338 2.378-1.43 3.65-3.5 3-1.5-.5-3.5-.5-4.5 1.5-1.5 3 1.5 3.5 2.5 4 1.5.5 1.5 2 0 3-1.5 1-3.5 0-4.5-1.5-1.5-2-1.5-4-.5-6.5 1.5-3 5-4.5 8.5-4.5 2 0 2-1 2-1z" fill="#1e293b" />
        <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#cbd5e1" stroke="#cbd5e1" />
        <path d="M14.93 15.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#cbd5e1" stroke="#cbd5e1" />
      </g>
    </svg>
  ),
  bP: (props) => (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow-sm select-none" {...props}>
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function renderPiece(pieceChar) {
  if (!pieceChar) return null;
  const isWhite = pieceChar === pieceChar.toUpperCase();
  const key = `${isWhite ? 'w' : 'b'}${pieceChar.toUpperCase()}`;
  const IconComponent = ChessPieceIcons[key];
  return IconComponent ? <IconComponent /> : null;
}

/**
 * Calculates material values for captured pieces
 */
export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};
