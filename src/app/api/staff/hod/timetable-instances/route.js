import { wrapHandler, apiError } from '@/lib/api-utils';
import { db } from '@/db';
import { timetableInstances } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { FacultyService } from '@/services/FacultyService';
import { isAcademicScopeAllowed, getInstitutionalBranches } from '@/lib/academic-authorization';
import { z } from 'zod';

const createInstanceSchema = z.object({
  branch: z.string().trim().min(1, 'Branch is required').max(50),
  semester: z.preprocess((val) => (val !== undefined && val !== null ? Number(val) : undefined), z.number().int().min(1).max(8)),
  academic_year: z.string().regex(/^\d{4}-\d{2}$/, 'Academic year must be in format YYYY-YY')
});

export const GET = wrapHandler({
  auth: ['hod', 'faculty'],
  handler: async (req, { user }) => {
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);
    
    const systemYear = await FacultyService.getCurrentAcademicYear();

    const isHod = !!user.is_hod;
    const isCoordinator = !!user.is_first_year_coordinator;
    const hodBranches = isHod ? await FacultyService.getHodBranches(user.id, user.role) : [];

    if (user.role === 'admin' || user.is_principal) {
      const instances = await db.select().from(timetableInstances);
      return { data: instances, systemYear };
    }

    if (isCoordinator && isHod && hodBranches.length > 0) {
      const allBranches = await getInstitutionalBranches();
      const instances = await db.select()
        .from(timetableInstances)
        .where(or(
          inArray(timetableInstances.branch, hodBranches),
          and(
            inArray(timetableInstances.branch, allBranches),
            inArray(timetableInstances.semester, [1, 2])
          )
        ));
      return { data: instances, systemYear };
    }

    if (isCoordinator) {
      const allBranches = await getInstitutionalBranches();
      const instances = await db.select()
        .from(timetableInstances)
        .where(and(
          inArray(timetableInstances.branch, allBranches),
          inArray(timetableInstances.semester, [1, 2])
        ));
      return { data: instances, systemYear };
    }

    if (hodBranches.length === 0) {
      return { data: [], systemYear };
    }

    const instances = await db.select()
      .from(timetableInstances)
      .where(inArray(timetableInstances.branch, hodBranches));
      
    return { data: instances, systemYear };
  }
});

export const POST = wrapHandler({
  auth: ['hod', 'faculty'],
  handler: async (req, { user }) => {
    const isAuthorized = (user.role === 'faculty' && (user.is_hod || user.is_first_year_coordinator)) || user.role === 'admin';
    if (!isAuthorized) return apiError('Unauthorized', 403);
    
    const json = await req.json();
    if (json.semester === undefined && json.course_semester !== undefined) {
      json.semester = json.course_semester;
    }
    const parsed = createInstanceSchema.parse(json);
    const { branch, semester, academic_year } = parsed;
    
    if (!isAcademicScopeAllowed(user, { branch, semester })) {
      return apiError(`Forbidden - Not authorized for ${branch} Sem ${semester}`, 403);
    }
    
    const existing = await db.select().from(timetableInstances).where(
      and(
        eq(timetableInstances.branch, branch),
        eq(timetableInstances.semester, semester),
        eq(timetableInstances.academic_year, academic_year)
      )
    );
    
    if (existing.length > 0) return apiError('Timetable instance already exists', 409);
    
    const [result] = await db.insert(timetableInstances).values({
      branch,
      semester,
      academic_year,
      status: 'DRAFT',
      created_by: user.id
    });
    
    return { success: true, id: result.insertId };
  }
});
