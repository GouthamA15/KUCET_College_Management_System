import { db } from '@/db';
import {
  studentAttendanceGoals,
  studentStreakNotifications,
  studentStreakPreferences,
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { computeAttendanceAnalytics, DEFAULT_STREAK_EMOJI, GOAL_TYPES } from '@/lib/streak-config';

export { GOAL_TYPES };

const NON_ESSENTIAL_NOTIFICATION_CATEGORIES = new Set([
  'NEARING_MILESTONE',
  'WEEKLY_SUMMARY',
  'MONTHLY_SUMMARY',
]);

/**
 * Pure helper to compute current progress value for a personal goal from authoritative streakData.
 */
export function computeGoalCurrentValue(goal, streakData, analytics = null) {
  if (!streakData) return 0;
  const resolvedAnalytics = analytics || computeAttendanceAnalytics(streakData.timeline || []);

  switch (goal.goal_type) {
    case 'SEMESTER_ATTENDANCE_PCT':
      return resolvedAnalytics.counts.rate || 0;
    case 'CONSECUTIVE_STREAK':
    case 'BEAT_PERSONAL_BEST':
      return streakData.currentStreak || 0;
    case 'CUMULATIVE_CLASSES':
      return streakData.totalAttendedClasses || 0;
    case 'SUBJECT_ATTENDANCE_PCT': {
      const sub = resolvedAnalytics.subjectInsights.find(
        (s) => s.subjectCode === goal.subject_code
      );
      return sub ? sub.rate : 0;
    }
    default:
      return 0;
  }
}

export class GoalAndNotificationService {
  static async getNotificationPreference(studentId, dbClient = null) {
    const executor = dbClient || db;
    try {
      const rows = await executor
        .select({ reminders_enabled: studentStreakPreferences.reminders_enabled })
        .from(studentStreakPreferences)
        .where(eq(studentStreakPreferences.student_id, studentId))
        .limit(1);
      if (rows && rows.length > 0) {
        return Boolean(rows[0].reminders_enabled);
      }
    } catch (_err) {
      // Fallback if table/column not yet migrated
    }
    return true;
  }

  static async updateNotificationPreference(studentId, remindersEnabled, dbClient = null) {
    const executor = dbClient || db;
    await executor
      .insert(studentStreakPreferences)
      .values({
        student_id: studentId,
        selected_emoji_char: DEFAULT_STREAK_EMOJI.char,
        selected_emoji_code: DEFAULT_STREAK_EMOJI.code,
        reminders_enabled: Boolean(remindersEnabled),
      })
      .onDuplicateKeyUpdate({
        set: { reminders_enabled: Boolean(remindersEnabled) },
      });
    return { success: true, reminders_enabled: Boolean(remindersEnabled) };
  }

  static async createIdempotentNotification(
    { studentId, rollNo = null, eventKey, category, title, message, emojiChar = null },
    dbClient = null
  ) {
    const executor = dbClient || db;
    if (!studentId || !eventKey) return null;

    try {
      if (NON_ESSENTIAL_NOTIFICATION_CATEGORIES.has(category)) {
        const remindersEnabled = await this.getNotificationPreference(studentId, executor);
        if (!remindersEnabled) return null;
      }

      const safeKey = String(eventKey).slice(0, 100);
      const [insertRes] = await executor
        .insert(studentStreakNotifications)
        .values({
          student_id: studentId,
          event_key: safeKey,
          category: String(category).slice(0, 40),
          title: String(title).slice(0, 150),
          message: String(message),
          emoji_char: emojiChar ? String(emojiChar).slice(0, 16) : null,
          is_read: false,
        })
        .onDuplicateKeyUpdate({
          set: { event_key: safeKey },
        });

      // Only dispatch real-time WebSocket & optional Web Push for newly persisted events (affectedRows === 1)
      const isNewEvent = !insertRes || insertRes.affectedRows === 1;
      if (isNewEvent) {
        // 1. Authenticated room-scoped WebSocket delivery (non-blocking)
        try {
          const { broadcastUpdate } = await import('@/lib/sse');
          await broadcastUpdate(
            'STREAK_NOTIFICATION_CREATED',
            {
              student_id: studentId,
              roll_no: rollNo || undefined,
              event_key: safeKey,
              category,
              title: String(title).slice(0, 150),
              emoji_char: emojiChar || '🔥',
            },
            { room: `user:student:${studentId}` }
          );
        } catch (_wsErr) {
          // Non-fatal: DB inbox remains authoritative
        }

        // 2. Optional PWA Web Push delivery (only if opted-in subscription + VAPID exist; NEVER email)
        if (rollNo) {
          try {
            const { default: PushNotificationService } = await import('@/services/security/PushNotificationService');
            await PushNotificationService.sendToRecipients([rollNo], {
              title: String(title).slice(0, 100),
              body: 'Open your KUCET Attendance Achievement Center to view your update.',
              url: '/student/academics?tab=attendance',
              category: 'attendance',
            });
          } catch (_pushErr) {
            // Non-fatal: Web Push is optional
          }
        }
      }

      return { success: true, eventKey: safeKey, isNewEvent };
    } catch (_err) {
      // Graceful fallback if table is not yet migrated in dev
      return null;
    }
  }

  static async getStudentNotifications(studentId, { unreadOnly = false, limit = 30 } = {}, dbClient = null) {
    const executor = dbClient || db;
    try {
      const conditions = [eq(studentStreakNotifications.student_id, studentId)];
      if (unreadOnly) {
        conditions.push(eq(studentStreakNotifications.is_read, false));
      }
      const rows = await executor
        .select()
        .from(studentStreakNotifications)
        .where(and(...conditions))
        .orderBy(desc(studentStreakNotifications.created_at), desc(studentStreakNotifications.id))
        .limit(Math.min(100, Math.max(1, limit)));

      const remindersEnabled = await this.getNotificationPreference(studentId, executor);
      const unreadCount = (rows || []).filter((r) => !r.is_read).length;

      return { notifications: rows || [], unreadCount, remindersEnabled };
    } catch (_err) {
      return { notifications: [], unreadCount: 0, remindersEnabled: true };
    }
  }

  static async markNotificationsRead(studentId, notificationIds = null, dbClient = null) {
    const executor = dbClient || db;
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      const safeIds = notificationIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
      if (safeIds.length === 0) return { success: true };
      await executor
        .update(studentStreakNotifications)
        .set({ is_read: true })
        .where(and(
          eq(studentStreakNotifications.student_id, studentId),
          inArray(studentStreakNotifications.id, safeIds)
        ));
    } else {
      await executor
        .update(studentStreakNotifications)
        .set({ is_read: true })
        .where(eq(studentStreakNotifications.student_id, studentId));
    }
    return { success: true };
  }

  static async getStudentGoals(studentId, streakData = null, dbClient = null) {
    const executor = dbClient || db;
    try {
      const rows = await executor
        .select()
        .from(studentAttendanceGoals)
        .where(eq(studentAttendanceGoals.student_id, studentId))
        .orderBy(desc(studentAttendanceGoals.created_at), desc(studentAttendanceGoals.id));

      if (!streakData) return rows || [];

      const analytics = computeAttendanceAnalytics(streakData.timeline || []);
      return (rows || []).map((g) => {
        const liveVal = g.status === 'ACTIVE'
          ? computeGoalCurrentValue(g, streakData, analytics)
          : g.current_value;
        const pct = g.target_value > 0
          ? Math.min(100, Math.max(0, Math.round((liveVal / g.target_value) * 100)))
          : 0;
        return {
          ...g,
          current_value: liveVal,
          progressPercentage: pct,
        };
      });
    } catch (_err) {
      return [];
    }
  }

  static async syncGoalsWithStreakData(studentId, streakData, dbClient = null) {
    const executor = dbClient || db;
    if (!studentId || !streakData) return [];

    try {
      const activeGoals = await executor
        .select()
        .from(studentAttendanceGoals)
        .where(and(
          eq(studentAttendanceGoals.student_id, studentId),
          eq(studentAttendanceGoals.status, 'ACTIVE')
        ));

      if (!activeGoals || activeGoals.length === 0) return [];

      const analytics = computeAttendanceAnalytics(streakData.timeline || []);
      const completedNow = [];

      for (const goal of activeGoals) {
        const currentVal = computeGoalCurrentValue(goal, streakData, analytics);
        const isCompleted = currentVal >= goal.target_value;
        const now = new Date();

        await executor
          .update(studentAttendanceGoals)
          .set({
            current_value: currentVal,
            status: isCompleted ? 'COMPLETED' : 'ACTIVE',
            completed_at: isCompleted ? now : null,
          })
          .where(and(
            eq(studentAttendanceGoals.id, goal.id),
            eq(studentAttendanceGoals.student_id, studentId)
          ));

        if (isCompleted) {
          completedNow.push({ ...goal, current_value: currentVal, status: 'COMPLETED', completed_at: now });
          await this.createIdempotentNotification(
            {
              studentId,
              eventKey: `goal_completed_${goal.id}`,
              category: 'GOAL_COMPLETED',
              title: 'Personal Attendance Goal Reached!',
              message: `Congratulations! You achieved your personal goal: "${goal.title}" (${currentVal}/${goal.target_value}).`,
              emojiChar: '🎯',
            },
            executor
          );
        }
      }

      return completedNow;
    } catch (_err) {
      return [];
    }
  }

  static async createGoal(
    { studentId, goalType, title, subjectCode = null, targetValue, semester = null, academicYear = null },
    streakData = null,
    dbClient = null
  ) {
    const executor = dbClient || db;
    if (!GOAL_TYPES.includes(goalType)) {
      throw new Error('Invalid personal goal type.');
    }
    if (!Number.isInteger(targetValue) || targetValue <= 0) {
      throw new Error('Target value must be a positive integer.');
    }
    if ((goalType === 'SEMESTER_ATTENDANCE_PCT' || goalType === 'SUBJECT_ATTENDANCE_PCT') && targetValue > 100) {
      throw new Error('Percentage goals cannot exceed 100%.');
    }
    if (goalType === 'SUBJECT_ATTENDANCE_PCT' && !subjectCode) {
      throw new Error('Subject code is required for a subject attendance goal.');
    }

    const tempGoal = { goal_type: goalType, subject_code: subjectCode };
    const currentValue = streakData ? computeGoalCurrentValue(tempGoal, streakData) : 0;
    const baselineValue = goalType === 'BEAT_PERSONAL_BEST' ? (streakData?.longestStreak || 0) : currentValue;

    if (goalType === 'BEAT_PERSONAL_BEST' && targetValue <= (streakData?.longestStreak || 0)) {
      throw new Error(`Target must exceed your current personal best (${streakData?.longestStreak || 0}).`);
    }

    const isAlreadyMet = currentValue >= targetValue;
    const [inserted] = await executor
      .insert(studentAttendanceGoals)
      .values({
        student_id: studentId,
        goal_type: goalType,
        title: String(title).trim(),
        subject_code: subjectCode || null,
        target_value: targetValue,
        baseline_value: baselineValue,
        current_value: currentValue,
        semester: semester ? Number(semester) : null,
        academic_year: academicYear || null,
        status: isAlreadyMet ? 'COMPLETED' : 'ACTIVE',
        completed_at: isAlreadyMet ? new Date() : null,
      });

    return {
      success: true,
      id: inserted?.insertId,
      status: isAlreadyMet ? 'COMPLETED' : 'ACTIVE',
      current_value: currentValue,
    };
  }

  static async updateGoal({ studentId, goalId, title, targetValue, status }, streakData = null, dbClient = null) {
    const executor = dbClient || db;
    const [existing] = await executor
      .select()
      .from(studentAttendanceGoals)
      .where(and(
        eq(studentAttendanceGoals.id, Number(goalId)),
        eq(studentAttendanceGoals.student_id, studentId)
      ))
      .limit(1);

    if (!existing) {
      throw new Error('Goal not found.');
    }

    const nextTarget = targetValue !== undefined ? Number(targetValue) : existing.target_value;
    if (!Number.isInteger(nextTarget) || nextTarget <= 0) {
      throw new Error('Target value must be a positive integer.');
    }
    if ((existing.goal_type === 'SEMESTER_ATTENDANCE_PCT' || existing.goal_type === 'SUBJECT_ATTENDANCE_PCT') && nextTarget > 100) {
      throw new Error('Percentage goals cannot exceed 100%.');
    }

    let nextStatus = status || existing.status;
    if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(nextStatus)) {
      throw new Error('Invalid goal status.');
    }

    const currentValue = streakData
      ? computeGoalCurrentValue({ ...existing, target_value: nextTarget }, streakData)
      : existing.current_value;

    if (nextStatus === 'ACTIVE' && currentValue >= nextTarget) {
      nextStatus = 'COMPLETED';
    }

    await executor
      .update(studentAttendanceGoals)
      .set({
        title: title !== undefined ? String(title).trim() : existing.title,
        target_value: nextTarget,
        current_value: currentValue,
        status: nextStatus,
        completed_at: nextStatus === 'COMPLETED' ? (existing.completed_at || new Date()) : null,
      })
      .where(and(
        eq(studentAttendanceGoals.id, Number(goalId)),
        eq(studentAttendanceGoals.student_id, studentId)
      ));

    return { success: true, status: nextStatus, current_value: currentValue };
  }
}
