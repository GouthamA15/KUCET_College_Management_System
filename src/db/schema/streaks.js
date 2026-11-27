import { 
  mysqlTable, varchar, int, boolean, text, timestamp, index, uniqueIndex 
} from 'drizzle-orm/mysql-core';
import { students } from './identity.js';

/**
 * Table: attendance_streak_milestones
 * Configurable milestone tiers for attendance streaks.
 * Designed to be populated when administration supplies milestone thresholds and emoji assets.
 */
export const attendanceStreakMilestones = mysqlTable('attendance_streak_milestones', {
  id: int('id').autoincrement().primaryKey().notNull(),
  milestone_code: varchar('milestone_code', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 100 }).notNull(),
  description: text('description'),
  required_streak: int('required_streak').notNull(),
  emoji_code: varchar('emoji_code', { length: 50 }).notNull(), // e.g. 'fire', 'zap', 'star', 'crown'
  emoji_char: varchar('emoji_char', { length: 16 }).default('🔥').notNull(),
  asset_url: varchar('asset_url', { length: 500 }),
  display_order: int('display_order').default(0).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  reqStreakIdx: index('idx_asm_required_streak').on(table.required_streak),
  activeOrderIdx: index('idx_asm_active_order').on(table.is_active, table.display_order),
}));

/**
 * Table: student_streak_unlocks
 * Idempotent achievement unlocks for students who reach milestone streaks.
 */
export const studentStreakUnlocks = mysqlTable('student_streak_unlocks', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  milestone_id: int('milestone_id').notNull().references(() => attendanceStreakMilestones.id, { onDelete: 'cascade' }),
  unlocked_at: timestamp('unlocked_at').defaultNow().notNull(),
  verified_streak: int('verified_streak').notNull(),
  is_notified: boolean('is_notified').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  studentIdx: index('idx_ssu_student').on(table.student_id),
  milestoneIdx: index('idx_ssu_milestone').on(table.milestone_id),
  uqStudentMilestone: uniqueIndex('uq_student_milestone_unlock').on(table.student_id, table.milestone_id),
}));

/**
 * Table: student_streak_preferences
 * Selected active emoji and notification reminder preferences.
 */
export const studentStreakPreferences = mysqlTable('student_streak_preferences', {
  student_id: int('student_id').primaryKey().notNull().references(() => students.id, { onDelete: 'cascade' }),
  selected_emoji_char: varchar('selected_emoji_char', { length: 16 }).default('🔥').notNull(),
  selected_emoji_code: varchar('selected_emoji_code', { length: 50 }).default('fire').notNull(),
  selected_milestone_id: int('selected_milestone_id'),
  reminders_enabled: boolean('reminders_enabled').default(true).notNull(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  milestoneIdx: index('idx_ssp_milestone').on(table.selected_milestone_id),
}));

/**
 * Table: student_attendance_goals
 * Student-controlled personal attendance goals (completely separate from institutional rules).
 */
export const studentAttendanceGoals = mysqlTable('student_attendance_goals', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  goal_type: varchar('goal_type', { length: 40 }).notNull(), // SEMESTER_ATTENDANCE_PCT, CONSECUTIVE_STREAK, CUMULATIVE_CLASSES, BEAT_PERSONAL_BEST, SUBJECT_ATTENDANCE_PCT
  title: varchar('title', { length: 120 }).notNull(),
  subject_code: varchar('subject_code', { length: 30 }),
  target_value: int('target_value').notNull(),
  baseline_value: int('baseline_value').default(0).notNull(),
  current_value: int('current_value').default(0).notNull(),
  semester: int('semester'),
  academic_year: varchar('academic_year', { length: 20 }),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(), // ACTIVE, COMPLETED, CANCELLED
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  studentStatusIdx: index('idx_sag_student_status').on(table.student_id, table.status),
}));

/**
 * Table: student_streak_notifications
 * Idempotent in-app notifications for milestones, goals, personal bests, and dispute restorations.
 */
export const studentStreakNotifications = mysqlTable('student_streak_notifications', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  event_key: varchar('event_key', { length: 100 }).notNull(),
  category: varchar('category', { length: 40 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  message: text('message').notNull(),
  emoji_char: varchar('emoji_char', { length: 16 }),
  is_read: boolean('is_read').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  uqStudentEvent: uniqueIndex('uq_ssn_student_event').on(table.student_id, table.event_key),
  studentReadIdx: index('idx_ssn_student_read').on(table.student_id, table.is_read, table.created_at),
}));

/**
 * Table: student_streak_reconciliation_logs
 * Auditable history of streak recalculations triggered by dispute approvals or corrections.
 */
export const studentStreakReconciliationLogs = mysqlTable('student_streak_reconciliation_logs', {
  id: int('id').autoincrement().primaryKey().notNull(),
  student_id: int('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  trigger_source: varchar('trigger_source', { length: 50 }).notNull(),
  reference_id: int('reference_id'),
  previous_streak: int('previous_streak').default(0).notNull(),
  new_streak: int('new_streak').default(0).notNull(),
  previous_longest: int('previous_longest').default(0).notNull(),
  new_longest: int('new_longest').default(0).notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  studentCreatedIdx: index('idx_ssrl_student').on(table.student_id, table.created_at),
}));
