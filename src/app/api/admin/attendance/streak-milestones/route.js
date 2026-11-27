import { db } from '@/db';
import { attendanceStreakMilestones, studentStreakUnlocks } from '@/db/schema';
import { asc, eq, ne, and, sql } from 'drizzle-orm';
import { wrapHandler, apiError, logAudit } from '@/lib/api-utils';
import { z } from 'zod';

const createMilestoneSchema = z.object({
  milestone_code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_]+$/i, 'Code must be alphanumeric/underscore'),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  required_streak: z.number().int().positive(),
  emoji_code: z.string().trim().min(1).max(50),
  emoji_char: z.string().trim().min(1).max(16),
  asset_url: z.string().trim().max(500).nullable().optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const updateMilestoneSchema = createMilestoneSchema.partial().extend({
  id: z.number().int().positive(),
});

export const GET = wrapHandler({
  auth: 'admin',
  handler: async () => {
    const milestones = await db
      .select()
      .from(attendanceStreakMilestones)
      .orderBy(asc(attendanceStreakMilestones.required_streak), asc(attendanceStreakMilestones.display_order));

    let unlockDistribution = [];
    try {
      unlockDistribution = await db
        .select({
          milestone_id: studentStreakUnlocks.milestone_id,
          unlockCount: sql`COUNT(*)`,
        })
        .from(studentStreakUnlocks)
        .groupBy(studentStreakUnlocks.milestone_id);
    } catch (_err) {
      unlockDistribution = [];
    }

    const distMap = new Map(unlockDistribution.map((d) => [Number(d.milestone_id), Number(d.unlockCount || 0)]));
    const enriched = milestones.map((m) => ({
      ...m,
      unlockCount: distMap.get(Number(m.id)) || 0,
    }));

    return { success: true, milestones: enriched };
  },
});

export const POST = wrapHandler({
  auth: 'admin',
  schema: createMilestoneSchema,
  handler: async ({ data, user, req }) => {
    // Check uniqueness of milestone_code and required_streak
    const existingCode = await db
      .select({ id: attendanceStreakMilestones.id })
      .from(attendanceStreakMilestones)
      .where(eq(attendanceStreakMilestones.milestone_code, data.milestone_code))
      .limit(1);

    if (existingCode.length > 0) {
      return apiError(`Milestone code '${data.milestone_code}' already exists.`, 409);
    }

    const existingStreak = await db
      .select({ id: attendanceStreakMilestones.id })
      .from(attendanceStreakMilestones)
      .where(eq(attendanceStreakMilestones.required_streak, data.required_streak))
      .limit(1);

    if (existingStreak.length > 0) {
      return apiError(`A milestone with threshold ${data.required_streak} already exists.`, 409);
    }

    const [inserted] = await db
      .insert(attendanceStreakMilestones)
      .values({
        milestone_code: data.milestone_code,
        title: data.title,
        description: data.description || null,
        required_streak: data.required_streak,
        emoji_code: data.emoji_code,
        emoji_char: data.emoji_char,
        asset_url: data.asset_url || null,
        display_order: data.display_order ?? data.required_streak,
        is_active: data.is_active ?? true,
      });

    await logAudit(req, {
      userId: user?.id || 0,
      userType: 'ADMIN',
      action: 'CREATE_STREAK_MILESTONE',
      targetId: inserted?.insertId || 0,
      targetType: 'attendance_streak_milestone',
      after: data,
    });

    return {
      success: true,
      id: inserted?.insertId,
      message: 'Attendance streak milestone created successfully.',
    };
  },
});

export const PUT = wrapHandler({
  auth: 'admin',
  schema: updateMilestoneSchema,
  handler: async ({ data }) => {
    const { id, ...fields } = data;

    if (fields.milestone_code) {
      const dupCode = await db
        .select({ id: attendanceStreakMilestones.id })
        .from(attendanceStreakMilestones)
        .where(and(
          eq(attendanceStreakMilestones.milestone_code, fields.milestone_code),
          ne(attendanceStreakMilestones.id, id)
        ))
        .limit(1);
      if (dupCode.length > 0) {
        return apiError(`Milestone code '${fields.milestone_code}' is already in use.`, 409);
      }
    }

    if (fields.required_streak !== undefined) {
      const dupStreak = await db
        .select({ id: attendanceStreakMilestones.id })
        .from(attendanceStreakMilestones)
        .where(and(
          eq(attendanceStreakMilestones.required_streak, fields.required_streak),
          ne(attendanceStreakMilestones.id, id)
        ))
        .limit(1);
      if (dupStreak.length > 0) {
        return apiError(`Threshold ${fields.required_streak} is already assigned to another milestone.`, 409);
      }
    }

    await db
      .update(attendanceStreakMilestones)
      .set(fields)
      .where(eq(attendanceStreakMilestones.id, id));

    return { success: true, message: 'Milestone updated successfully.' };
  },
});

export const DELETE = wrapHandler({
  auth: 'admin',
  handler: async ({ req }) => {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '', 10);
    if (!Number.isInteger(id) || id <= 0) {
      return apiError('Valid milestone id is required.', 400);
    }

    // Soft-deactivate to preserve existing student achievement unlock history
    await db
      .update(attendanceStreakMilestones)
      .set({ is_active: false })
      .where(eq(attendanceStreakMilestones.id, id));

    return { success: true, message: 'Milestone deactivated successfully.' };
  },
});
