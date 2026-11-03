import { wrapHandler, apiError, apiResponse } from '@/lib/api-utils';
import { db } from '@/db';
import { branchTimetable, timetableInstances, syllabusSubjects, timetableSlotFaculty, staffAccounts, staffAccountRoles, staffRoles } from '@/db/schema';
import { eq, and, sql, or, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { isAcademicScopeAllowed } from '@/lib/academic-authorization';

const entrySchema = z.object({
  day_of_week: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
  period_number: z.number().int().min(1).max(7),
  period_numbers: z.array(z.number().int().min(1).max(7)).optional(),
  batch_number: z.number().int().min(0).max(2).default(0),
  subject_code: z.string().min(1),
  faculty_id: z.number().int().positive().nullable().optional(),
  additional_faculty_ids: z.array(z.number().int().positive()).optional().default([]),
  room_no: z.string().optional()
});

export const POST = wrapHandler({
  auth: ['hod', 'faculty'],
  handler: async (req, { user, context }) => {
    const params = await context.params;
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);
    
    const instanceId = parseInt(params.id);
    const json = await req.json();
    const parsed = entrySchema.parse(json);
    
    // Check if instance exists and belongs to user's scope
    const [instance] = await db.select().from(timetableInstances).where(eq(timetableInstances.id, instanceId));
    if (!instance) return apiError('Timetable instance not found', 404);

    if (!isAcademicScopeAllowed(user, { branch: instance.branch, semester: instance.semester })) {
      return apiError('Forbidden: Outside authorized scope', 403);
    }
    
    const { day_of_week, subject_code, faculty_id, additional_faculty_ids = [], room_no } = parsed;
    const batch_number = parsed.batch_number !== undefined ? parsed.batch_number : 0;
    const targetPeriods = parsed.period_numbers && parsed.period_numbers.length > 0 ? parsed.period_numbers : [parsed.period_number];

    const allFacultyIds = Array.from(new Set([faculty_id, ...additional_faculty_ids].filter(Boolean)));

    // Validate faculty selection
    if (allFacultyIds.length > 0) {
      const activeFaculty = await db.select({ id: staffAccounts.id })
        .from(staffAccounts)
        .innerJoin(staffAccountRoles, eq(staffAccountRoles.staff_account_id, staffAccounts.id))
        .innerJoin(staffRoles, eq(staffAccountRoles.role_id, staffRoles.id))
        .where(and(
          inArray(staffAccounts.id, allFacultyIds),
          eq(staffAccounts.account_status, 'ACTIVE'),
          or(
            eq(staffRoles.role_code, 'FACULTY'),
            eq(staffRoles.role_code, 'faculty'),
            eq(staffRoles.role_code, 'HOD'),
            eq(staffRoles.role_code, 'hod')
          )
        ));

      if (activeFaculty.length < allFacultyIds.length) {
        return apiError('One or more selected faculty members are inactive or invalid.', 400);
      }
    }

    // Process each target period
    for (const period of targetPeriods) {
      // Find existing slot with same day, period, and batch_number
      const existingSlot = await db.select().from(branchTimetable).where(
        or(
          and(
            eq(branchTimetable.timetable_instance_id, instanceId),
            eq(branchTimetable.day_of_week, day_of_week),
            eq(branchTimetable.period_number, period),
            eq(branchTimetable.batch_number, batch_number)
          ),
          and(
            eq(branchTimetable.branch, instance.branch),
            eq(branchTimetable.semester, instance.semester),
            eq(branchTimetable.day_of_week, day_of_week),
            eq(branchTimetable.period_number, period),
            eq(branchTimetable.academic_year, instance.academic_year),
            eq(branchTimetable.batch_number, batch_number)
          )
        )
      ).limit(1);
      const existingSlotId = existingSlot[0]?.id || null;

      // Check conflict for each assigned faculty member
      for (const fId of allFacultyIds) {
        const conflictWhere = [
          eq(branchTimetable.faculty_id, fId),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, period),
          or(
            eq(timetableInstances.status, 'PUBLISHED'),
            eq(branchTimetable.timetable_instance_id, instanceId)
          )
        ];

        if (existingSlotId) {
          conflictWhere.push(ne(branchTimetable.id, existingSlotId));
        }

        const conflictRows = await db.select({
          id: branchTimetable.id,
          subject_code: branchTimetable.subject_code,
          subject_name: syllabusSubjects.subject_name
        })
        .from(branchTimetable)
        .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
        .leftJoin(timetableInstances, eq(branchTimetable.timetable_instance_id, timetableInstances.id))
        .where(and(...conflictWhere))
        .limit(1);

        if (conflictRows.length > 0) {
          return apiError(`Faculty Conflict: Instructor (ID: ${fId}) already assigned during Period ${period} (${day_of_week}).`, 400);
        }
      }

      // Check room conflict if room_no is provided
      if (room_no && typeof room_no === 'string' && room_no.trim()) {
        const trimmedRoom = room_no.trim();
        const roomConflictWhere = [
          eq(branchTimetable.room_no, trimmedRoom),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, period),
          or(
            eq(timetableInstances.status, 'PUBLISHED'),
            eq(branchTimetable.timetable_instance_id, instanceId)
          )
        ];

        if (existingSlotId) {
          roomConflictWhere.push(ne(branchTimetable.id, existingSlotId));
        }

        const roomConflicts = await db.select({
          id: branchTimetable.id,
          subject_code: branchTimetable.subject_code
        })
        .from(branchTimetable)
        .leftJoin(timetableInstances, eq(branchTimetable.timetable_instance_id, timetableInstances.id))
        .where(and(...roomConflictWhere))
        .limit(1);

        if (roomConflicts.length > 0) {
          return apiError(`Room Conflict: Room "${trimmedRoom}" is already booked during Period ${period} (${day_of_week}).`, 400);
        }
      }

      // If saving whole class (batch 0), remove any stale batch 1 or batch 2 slots for this period
      if (batch_number === 0) {
        await db.delete(branchTimetable).where(and(
          eq(branchTimetable.timetable_instance_id, instanceId),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, period),
          ne(branchTimetable.batch_number, 0)
        ));
      } else {
        // If saving Batch 1 or 2, remove whole-class slot (batch 0) for this period to prevent collisions
        await db.delete(branchTimetable).where(and(
          eq(branchTimetable.timetable_instance_id, instanceId),
          eq(branchTimetable.day_of_week, day_of_week),
          eq(branchTimetable.period_number, period),
          eq(branchTimetable.batch_number, 0)
        ));
      }

      // Upsert logic for slot
      const slotData = {
        timetable_instance_id: instanceId,
        branch: instance.branch,
        semester: instance.semester,
        day_of_week,
        period_number: period,
        batch_number,
        subject_code,
        faculty_id: faculty_id || null,
        academic_year: instance.academic_year,
        room_no: room_no || null
      };

      let finalSlotId = existingSlotId;

      if (existingSlotId) {
        await db.update(branchTimetable).set({
          timetable_instance_id: instanceId,
          branch: instance.branch,
          semester: instance.semester,
          academic_year: instance.academic_year,
          batch_number,
          subject_code,
          faculty_id: faculty_id || null,
          room_no: room_no || null,
          version: sql`version + 1`
        }).where(eq(branchTimetable.id, existingSlotId));
      } else {
        const [ins] = await db.insert(branchTimetable).values(slotData);
        finalSlotId = ins.insertId;
      }

      // Populate timetableSlotFaculty for team teaching
      if (finalSlotId) {
        await db.delete(timetableSlotFaculty).where(eq(timetableSlotFaculty.slot_id, finalSlotId));

        const facultyInserts = [];
        if (faculty_id) {
          facultyInserts.push({
            slot_id: finalSlotId,
            faculty_id,
            is_primary: true,
            role: 'INSTRUCTOR'
          });
        }
        for (const addId of additional_faculty_ids) {
          if (addId && addId !== faculty_id) {
            facultyInserts.push({
              slot_id: finalSlotId,
              faculty_id: addId,
              is_primary: false,
              role: 'CO_INSTRUCTOR'
            });
          }
        }
        if (facultyInserts.length > 0) {
          await db.insert(timetableSlotFaculty).values(facultyInserts);
        }
      }
    }
    
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: instance.branch });
    } catch (_e) {
      // Ignore SSE error
    }

    return apiResponse({ success: true, message: 'Timetable slot(s) updated successfully' });
  }
});

export const DELETE = wrapHandler({
  auth: ['hod', 'faculty'],
  handler: async (req, { user, context }) => {
    const params = await context.params;
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);
    
    const instanceId = parseInt(params.id);
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entryId');
    
    if (!entryId) return apiError('entryId is required', 400);
    
    const [instance] = await db.select().from(timetableInstances).where(eq(timetableInstances.id, instanceId));
    if (!instance) return apiError('Timetable instance not found', 404);

    if (!isAcademicScopeAllowed(user, { branch: instance.branch, semester: instance.semester })) {
      return apiError('Forbidden: Outside authorized scope', 403);
    }

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
