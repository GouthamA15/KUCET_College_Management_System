import { wrapHandler, apiError, apiResponse } from '@/lib/api-utils';
import { db } from '@/db';
import { branchTimetable, timetableInstances, syllabusSubjects } from '@/db/schema';
import { eq, and, sql, or, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';

const entrySchema = z.object({
  day_of_week: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
  period_number: z.number().int().min(1).max(7),
  subject_code: z.string().min(1),
  faculty_id: z.number().int().positive().nullable().optional(),
  room_no: z.string().optional()
});

import { FacultyService } from '@/services/FacultyService';

export const POST = wrapHandler({
  auth: 'hod',
  handler: async (req, { user, context }) => {
    const params = await context.params;
    if (!user || !user.is_hod) return apiError('Unauthorized', 403);
    
    const hodBranches = await FacultyService.getHodBranches(user.id);
    if (hodBranches.length === 0) return apiError('Unauthorized', 403);
    
    const instanceId = parseInt(params.id);
    const json = await req.json();
    const parsed = entrySchema.parse(json);
    
    // Check if instance exists and belongs to user's branch
    const [instance] = await db.select().from(timetableInstances).where(
      and(eq(timetableInstances.id, instanceId), inArray(timetableInstances.branch, hodBranches))
    );
    if (!instance) return apiError('Timetable instance not found', 404);
    
    const { day_of_week, period_number, subject_code, faculty_id, room_no } = parsed;

    // Check existing slot in this instance or matching unique key
    const existingSlot = await db.select().from(branchTimetable).where(
      or(
        and(
          eq(branchTimetable.timetable_instance_id, instanceId),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, period_number)
        ),
        and(
          eq(branchTimetable.branch, instance.branch),
          eq(branchTimetable.semester, instance.semester),
          eq(branchTimetable.section, instance.section || 'A'),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, period_number),
          eq(branchTimetable.academic_year, instance.academic_year)
        )
      )
    ).limit(1);
    const existingSlotId = existingSlot[0]?.id || null;

    if (faculty_id) {
      const { staffAccounts, staffAccountRoles, staffRoles } = await import('@/db/schema');
      const [legit] = await db.select({ id: staffAccounts.id })
        .from(staffAccounts)
        .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
        .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
        .where(and(
          eq(staffAccounts.id, faculty_id),
          eq(staffAccounts.account_status, 'ACTIVE'),
          or(
            eq(staffRoles.role_code, 'FACULTY'),
            eq(staffRoles.role_code, 'faculty'),
            eq(staffRoles.role_code, 'HOD'),
            eq(staffRoles.role_code, 'hod')
          )
        )).limit(1);

      if (!legit) {
        return apiError('Invalid faculty selection. Must be an active faculty member.', 400);
      }

      const conflictWhere = [
        eq(branchTimetable.faculty_id, faculty_id),
        eq(branchTimetable.day_of_week, day_of_week),
        eq(branchTimetable.period_number, period_number),
        or(
          eq(timetableInstances.status, 'PUBLISHED'),
          eq(branchTimetable.timetable_instance_id, instanceId)
        )
      ];

      // Exclude the slot currently being updated to prevent self-conflict
      if (existingSlotId) {
        conflictWhere.push(ne(branchTimetable.id, existingSlotId));
      }

      const conflictRows = await db.select({
        id: branchTimetable.id,
        subject_code: branchTimetable.subject_code,
        subject_name: syllabusSubjects.subject_name,
        instance_id: branchTimetable.timetable_instance_id
      })
      .from(branchTimetable)
      .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
      .leftJoin(timetableInstances, eq(branchTimetable.timetable_instance_id, timetableInstances.id))
      .where(and(...conflictWhere))
      .limit(1);

      if (conflictRows.length > 0) {
        return apiError(`Faculty Conflict: Instructor already assigned during this period.`, 400);
      }
    }

    // Upsert logic for this instance, day, period
    const slotData = {
      timetable_instance_id: instanceId,
      branch: instance.branch,
      semester: instance.semester,
      section: instance.section || 'A',
      day_of_week,
      period_number,
      subject_code,
      faculty_id: faculty_id || null,
      academic_year: instance.academic_year,
      room_no: room_no || null
    };

    if (existingSlotId) {
      await db.update(branchTimetable).set({
        timetable_instance_id: instanceId,
        branch: instance.branch,
        semester: instance.semester,
        section: instance.section || 'A',
        academic_year: instance.academic_year,
        subject_code,
        faculty_id: faculty_id || null,
        room_no: room_no || null,
        version: sql`version + 1`
      }).where(eq(branchTimetable.id, existingSlotId));
    } else {
      await db.insert(branchTimetable).values(slotData);
    }
    
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: instance.branch });
    } catch (_e) {
      // Ignore SSE error
    }

    return apiResponse({ success: true, message: 'Slot updated' });
  }
});

export const DELETE = wrapHandler({
  auth: 'hod',
  handler: async (req, { user, context }) => {
    const params = await context.params;
    if (!user || !user.is_hod) return apiError('Unauthorized', 403);
    
    const hodBranches = await FacultyService.getHodBranches(user.id);
    if (hodBranches.length === 0) return apiError('Unauthorized', 403);
    
    const instanceId = parseInt(params.id);
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entryId');
    
    if (!entryId) return apiError('entryId is required', 400);
    
    // Check if instance exists and belongs to user's branch
    const [instance] = await db.select().from(timetableInstances).where(
      and(eq(timetableInstances.id, instanceId), inArray(timetableInstances.branch, hodBranches))
    );
    if (!instance) return apiError('Timetable instance not found', 404);

    await db.delete(branchTimetable).where(and(
      eq(branchTimetable.id, parseInt(entryId)),
      eq(branchTimetable.timetable_instance_id, instanceId)
    ));
    
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: instance.branch });
    } catch (_e) {
      // Ignore SSE error
    }

    return apiResponse({ success: true, message: 'Slot deleted' });
  }
});
