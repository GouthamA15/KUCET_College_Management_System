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
 * Selected active emoji for display beside the student profile.
 */
export const studentStreakPreferences = mysqlTable('student_streak_preferences', {
  student_id: int('student_id').primaryKey().notNull().references(() => students.id, { onDelete: 'cascade' }),
  selected_emoji_char: varchar('selected_emoji_char', { length: 16 }).default('🔥').notNull(),
  selected_emoji_code: varchar('selected_emoji_code', { length: 50 }).default('fire').notNull(),
  selected_milestone_id: int('selected_milestone_id'),
  updated_at: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  milestoneIdx: index('idx_ssp_milestone').on(table.selected_milestone_id),
}));
