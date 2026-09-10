import { wrapHandler, apiError } from '@/lib/api-utils';
import { db } from '@/db';
import { timetableInstances, branchTimetable, syllabusSubjects, staffAccounts } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { FacultyService } from '@/services/FacultyService';

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
});

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (req, { user, context }) => {
    const params = await context.params;
    if (!user || !user.is_hod) return apiError('Unauthorized', 403);
    
    const hodBranches = await FacultyService.getHodBranches(user.id, user.role);
    if (hodBranches.length === 0) return apiError('Unauthorized', 403);
    
    const id = parseInt(params.id);
    const [instance] = await db.select().from(timetableInstances).where(and(
      eq(timetableInstances.id, id),
      inArray(timetableInstances.branch, hodBranches)
    ));
    if (!instance) return apiError('Not found', 404);
    
    const entries = await db.select({
      id: branchTimetable.id,
      branch: branchTimetable.branch,
      semester: branchTimetable.semester,
      section: branchTimetable.section,
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
  auth: 'hod',
  handler: async (req, { user, context }) => {
    const params = await context.params;
    if (!user || !user.is_hod) return apiError('Unauthorized', 403);
    
    const hodBranches = await FacultyService.getHodBranches(user.id, user.role);
    if (hodBranches.length === 0) return apiError('Unauthorized', 403);
    
    const id = parseInt(params.id);
    const json = await req.json();
    const { status } = updateStatusSchema.parse(json);
    
    // Validate HOD owns the instance
    const [instance] = await db.select().from(timetableInstances).where(and(
      eq(timetableInstances.id, id),
      inArray(timetableInstances.branch, hodBranches)
    ));
    if (!instance) return apiError('Not found', 404);

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
