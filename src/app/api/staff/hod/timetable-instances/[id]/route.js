import { wrapHandler, apiError } from '@/lib/api-utils';
import { db } from '@/db';
import { timetableInstances, branchTimetable, syllabusSubjects, staffAccounts } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { FacultyService } from '@/services/FacultyService';
import { isAcademicScopeAllowed } from '@/lib/academic-authorization';

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
});

export const GET = wrapHandler({
  auth: ['hod', 'faculty'],
  handler: async (req, { user, context }) => {
    const params = await context.params;
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);
    
    const id = parseInt(params.id);
    const [instance] = await db.select().from(timetableInstances).where(eq(timetableInstances.id, id));
    if (!instance) return apiError('Not found', 404);

    if (!isAcademicScopeAllowed(user, { branch: instance.branch, semester: instance.semester })) {
      return apiError('Forbidden: Outside authorized scope', 403);
    }
    
    const entries = await db.select({
      id: branchTimetable.id,
      branch: branchTimetable.branch,
      semester: branchTimetable.semester,
      day_of_week: branchTimetable.day_of_week,
      period_number: branchTimetable.period_number,
      subject_code: branchTimetable.subject_code,
      faculty_id: branchTimetable.faculty_id,
      academic_year: branchTimetable.academic_year,
      room_no: branchTimetable.room_no,
      display_name: sql`COALESCE(${syllabusSubjects.subject_name}, ${branchTimetable.subject_code})`,
      faculty_name: staffAccounts.name
    })
    .from(branchTimetable)
    .leftJoin(syllabusSubjects, eq(branchTimetable.subject_code, syllabusSubjects.subject_code))
    .leftJoin(staffAccounts, eq(branchTimetable.faculty_id, staffAccounts.id))
    .where(eq(branchTimetable.timetable_instance_id, id));
    
    return { data: { instance, entries } };
  }
});

export const PUT = wrapHandler({
  auth: ['hod', 'faculty'],
  handler: async (req, { user, context }) => {
    const params = await context.params;
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);
    
    const id = parseInt(params.id);
    const json = await req.json();
    const { status } = updateStatusSchema.parse(json);
    
    const [instance] = await db.select().from(timetableInstances).where(eq(timetableInstances.id, id));
    if (!instance) return apiError('Not found', 404);

    if (!isAcademicScopeAllowed(user, { branch: instance.branch, semester: instance.semester })) {
      return apiError('Forbidden: Outside authorized scope', 403);
    }

    await db.update(timetableInstances)
      .set({ status, updated_by: user.id, updated_at: sql`NOW()`, published_at: status === 'PUBLISHED' ? sql`NOW()` : undefined })
      .where(eq(timetableInstances.id, id));
      
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('TIMETABLE_CHANGED', { branch: instance.branch });
    } catch (_e) {
      // Ignore SSE broadcast error
    }
      
    return { success: true };
  }
});
