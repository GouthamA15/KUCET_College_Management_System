import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  boolean,
  datetime,
  timestamp,
  uniqueIndex,
  index
} from 'drizzle-orm/mysql-core';

/**
 * Event Configuration Table (Generic for tournament games)
 * Stores global event state, rules, and the master ENABLED/DISABLED toggle.
 */
export const eventConfigs = mysqlTable('event_configs', {
  id: int('id').primaryKey().autoincrement(),
  event_key: varchar('event_key', { length: 64 }).notNull(), // e.g., 'chess'
  event_name: varchar('event_name', { length: 128 }).notNull(),
  description: text('description'),
  is_enabled: boolean('is_enabled').default(false).notNull(), // Master Admin Toggle
  registration_open: boolean('registration_open').default(false).notNull(),
  rules_json: json('rules_json'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  eventKeyIdx: uniqueIndex('event_key_unique_idx').on(table.event_key),
}));

/**
 * Event Participants Table
 * Tracks students/staff registered for an event.
 */
export const eventParticipants = mysqlTable('event_participants', {
  id: int('id').primaryKey().autoincrement(),
  event_key: varchar('event_key', { length: 64 }).notNull().default('chess'),
  user_id: varchar('user_id', { length: 64 }).notNull(), // roll_no or staff id
  user_type: varchar('user_type', { length: 32 }).notNull().default('student'), // 'student' | 'staff'
  display_name: varchar('display_name', { length: 128 }).notNull(),
  email: varchar('email', { length: 128 }),
  department: varchar('department', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('REGISTERED'), // 'REGISTERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'
  seed_number: int('seed_number'),
  notes: text('notes'),
  registered_at: timestamp('registered_at').defaultNow().notNull(),
  reviewed_at: datetime('reviewed_at'),
  reviewed_by: varchar('reviewed_by', { length: 128 }),
}, (table) => ({
  eventUserIdx: uniqueIndex('event_user_unique_idx').on(table.event_key, table.user_id),
  eventStatusIdx: index('event_status_idx').on(table.event_key, table.status),
}));

/**
 * Event Matches Table
 * Represents an individual fixture/match between two participants.
 */
export const eventMatches = mysqlTable('event_matches', {
  id: int('id').primaryKey().autoincrement(),
  event_key: varchar('event_key', { length: 64 }).notNull().default('chess'),
  match_code: varchar('match_code', { length: 32 }).notNull(), // e.g. 'CHESS-M-001'
  round_name: varchar('round_name', { length: 64 }).notNull().default('Round 1'),
  
  // White Player
  player_white_id: int('player_white_id'),
  player_white_name: varchar('player_white_name', { length: 128 }).notNull(),
  player_white_user_id: varchar('player_white_user_id', { length: 64 }).notNull(),
  
  // Black Player
  player_black_id: int('player_black_id'),
  player_black_name: varchar('player_black_name', { length: 128 }).notNull(),
  player_black_user_id: varchar('player_black_user_id', { length: 64 }).notNull(),
  
  // Status & Timing
  status: varchar('status', { length: 32 }).notNull().default('SCHEDULED'), // 'SCHEDULED' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
  scheduled_at: datetime('scheduled_at'),
  started_at: datetime('started_at'),
  ended_at: datetime('ended_at'),
  
  // Result
  winner_id: int('winner_id'), // participant id or null for draw
  winner_side: varchar('winner_side', { length: 16 }), // 'white' | 'black' | 'draw'
  result_reason: varchar('result_reason', { length: 64 }), // 'checkmate' | 'resignation' | 'stalemate' | 'draw_agreement' | 'timeout' | 'admin_decision'
  
  // Verification
  is_verified: boolean('is_verified').default(false).notNull(),
  verified_by: varchar('verified_by', { length: 128 }),
  verified_at: datetime('verified_at'),
  verification_notes: text('verification_notes'),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  matchCodeIdx: uniqueIndex('match_code_unique_idx').on(table.match_code),
  matchStatusIdx: index('match_status_idx').on(table.event_key, table.status),
  whitePlayerIdx: index('white_player_idx').on(table.player_white_user_id),
  blackPlayerIdx: index('black_player_idx').on(table.player_black_user_id),
}));

/**
 * Chess Games Table
 * Stores real-time chess engine state, FEN, PGN, turns, and captured pieces.
 */
export const chessGames = mysqlTable('chess_games', {
  id: int('id').primaryKey().autoincrement(),
  match_id: int('match_id').notNull(),
  fen: varchar('fen', { length: 255 }).notNull().default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  pgn: text('pgn'),
  current_turn: varchar('current_turn', { length: 8 }).notNull().default('w'), // 'w' | 'b'
  move_count: int('move_count').default(0).notNull(),
  halfmove_clock: int('halfmove_clock').default(0).notNull(),
  is_check: boolean('is_check').default(false).notNull(),
  is_checkmate: boolean('is_checkmate').default(false).notNull(),
  is_stalemate: boolean('is_stalemate').default(false).notNull(),
  is_draw: boolean('is_draw').default(false).notNull(),
  draw_offer_side: varchar('draw_offer_side', { length: 8 }), // 'w' | 'b' | null
  captured_pieces: json('captured_pieces'),
  last_move_san: varchar('last_move_san', { length: 16 }),
  last_move_from: varchar('last_move_from', { length: 8 }),
  last_move_to: varchar('last_move_to', { length: 8 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  matchIdIdx: uniqueIndex('chess_game_match_id_idx').on(table.match_id),
}));

/**
 * Chess Moves Table
 * Detailed chronological log of every move executed in a chess game.
 */
export const chessMoves = mysqlTable('chess_moves', {
  id: int('id').primaryKey().autoincrement(),
  game_id: int('game_id').notNull(),
  match_id: int('match_id').notNull(),
  move_number: int('move_number').notNull(),
  side: varchar('side', { length: 4 }).notNull(), // 'w' | 'b'
  player_user_id: varchar('player_user_id', { length: 64 }).notNull(),
  san: varchar('san', { length: 16 }).notNull(), // e.g. 'e4', 'Nf3', 'O-O', 'Qxd7#'
  from_square: varchar('from_square', { length: 4 }).notNull(), // e.g. 'e2'
  to_square: varchar('to_square', { length: 4 }).notNull(), // e.g. 'e4'
  promotion: varchar('promotion', { length: 4 }), // 'q', 'r', 'b', 'n'
  fen_after: varchar('fen_after', { length: 255 }).notNull(),
  time_spent_ms: int('time_spent_ms'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  gameMoveIdx: index('chess_game_move_idx').on(table.game_id, table.move_number),
  matchIdx: index('chess_match_moves_idx').on(table.match_id),
}));

/**
 * Event Audit Logs Table
 * Tracks administrative actions (toggling events, verifying matches, disqualifications).
 */
export const eventAuditLogs = mysqlTable('event_audit_logs', {
  id: int('id').primaryKey().autoincrement(),
  event_key: varchar('event_key', { length: 64 }).notNull().default('chess'),
  action: varchar('action', { length: 64 }).notNull(),
  actor_id: varchar('actor_id', { length: 64 }).notNull(),
  actor_type: varchar('actor_type', { length: 32 }).notNull().default('ADMIN'),
  target_id: varchar('target_id', { length: 64 }),
  target_type: varchar('target_type', { length: 64 }),
  details: json('details'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventAuditIdx: index('event_audit_key_idx').on(table.event_key, table.action),
}));
