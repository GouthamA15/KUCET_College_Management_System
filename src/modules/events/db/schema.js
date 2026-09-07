import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  boolean,
  datetime,
  timestamp,
  decimal,
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

/**
 * Quiz Questions Table
 * Question bank for technical quiz events.
 */
export const quizQuestions = mysqlTable('quiz_questions', {
  id: int('id').primaryKey().autoincrement(),
  event_key: varchar('event_key', { length: 64 }).notNull().default('quiz'),
  question_text: text('question_text').notNull(),
  options_json: json('options_json').notNull(), // Array of strings: ["Option A", "Option B", "Option C", "Option D"]
  correct_option_index: int('correct_option_index').notNull(), // 0, 1, 2, or 3
  explanation: text('explanation'),
  marks: decimal('marks', { precision: 5, scale: 2 }).notNull().default('1.00'),
  negative_marks: decimal('negative_marks', { precision: 5, scale: 2 }).notNull().default('0.00'),
  category: varchar('category', { length: 64 }).notNull().default('Computer Science'),
  difficulty: varchar('difficulty', { length: 32 }).notNull().default('MEDIUM'), // 'EASY' | 'MEDIUM' | 'HARD'
  question_order: int('question_order').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  quizEventIdx: index('quiz_questions_event_idx').on(table.event_key, table.is_active),
  quizCategoryIdx: index('quiz_questions_category_idx').on(table.category),
}));

/**
 * Quiz Sessions Table
 * Represents a student/participant's test sitting.
 */
export const quizSessions = mysqlTable('quiz_sessions', {
  id: int('id').primaryKey().autoincrement(),
  event_key: varchar('event_key', { length: 64 }).notNull().default('quiz'),
  session_code: varchar('session_code', { length: 64 }).notNull(),
  user_id: varchar('user_id', { length: 64 }).notNull(),
  user_type: varchar('user_type', { length: 32 }).notNull().default('student'),
  display_name: varchar('display_name', { length: 128 }).notNull(),
  department: varchar('department', { length: 64 }),
  email: varchar('email', { length: 128 }),
  status: varchar('status', { length: 32 }).notNull().default('IN_PROGRESS'), // 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'DISQUALIFIED'
  total_questions: int('total_questions').notNull().default(0),
  total_attempted: int('total_attempted').notNull().default(0),
  total_correct: int('total_correct').notNull().default(0),
  total_incorrect: int('total_incorrect').notNull().default(0),
  total_unanswered: int('total_unanswered').notNull().default(0),
  score: decimal('score', { precision: 6, scale: 2 }).notNull().default('0.00'),
  max_possible_score: decimal('max_possible_score', { precision: 6, scale: 2 }).notNull().default('0.00'),
  percentage: decimal('percentage', { precision: 5, scale: 2 }).notNull().default('0.00'),
  started_at: datetime('started_at').notNull(),
  expires_at: datetime('expires_at').notNull(),
  submitted_at: datetime('submitted_at'),
  time_taken_seconds: int('time_taken_seconds').notNull().default(0),
  ip_address: varchar('ip_address', { length: 64 }),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionCodeIdx: uniqueIndex('quiz_session_code_idx').on(table.session_code),
  sessionUserIdx: index('quiz_session_user_idx').on(table.event_key, table.user_id),
  sessionStatusIdx: index('quiz_session_status_idx').on(table.event_key, table.status),
  leaderboardIdx: index('quiz_leaderboard_idx').on(table.event_key, table.score, table.time_taken_seconds),
}));

/**
 * Quiz Answers Table
 * Stores candidate responses for each question in a session.
 */
export const quizAnswers = mysqlTable('quiz_answers', {
  id: int('id').primaryKey().autoincrement(),
  session_id: int('session_id').notNull(),
  question_id: int('question_id').notNull(),
  selected_option_index: int('selected_option_index'),
  is_marked_for_review: boolean('is_marked_for_review').notNull().default(false),
  is_correct: boolean('is_correct'),
  marks_awarded: decimal('marks_awarded', { precision: 5, scale: 2 }).notNull().default('0.00'),
  time_spent_seconds: int('time_spent_seconds').notNull().default(0),
  answered_at: datetime('answered_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sessionQuestionUniqueIdx: uniqueIndex('quiz_session_question_idx').on(table.session_id, table.question_id),
  sessionAnswersIdx: index('quiz_session_answers_idx').on(table.session_id),
}));
