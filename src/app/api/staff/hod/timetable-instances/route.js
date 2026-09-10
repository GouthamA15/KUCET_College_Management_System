import { wrapHandler, apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { timetableInstances } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { FacultyService } from '@/services/FacultyService';

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (req, { user }) => {
    if (!user || !user.is_hod) return apiError('Unauthorized', 403);
    
    const hodBranches = await FacultyService.getHodBranches(user.id);
    const systemYear = await FacultyService.getCurrentAcademicYear();
    
    // Allow HOD to see instances for any of their branches
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
  auth: 'hod',
  handler: async (req, { user }) => {
    if (!user || !user.is_hod) return apiError('Unauthorized', 403);
    const { branch, semester, academic_year } = await req.json();
    
    if (!branch || !semester || !academic_year) return apiError('Missing required fields', 400);
    
    const hodBranches = await FacultyService.getHodBranches(user.id);
    
    // Verify the requested branch belongs to the HOD
    if (!hodBranches.includes(branch)) {
      return apiError('Unauthorized for this program', 403);
    }
    
    // Derive year_level from semester
    const year_level = Math.ceil(semester / 2);
    
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
      year_level,
      academic_year,
      status: 'DRAFT',
      created_by: user.id
    });
    
    return { success: true, id: result.insertId };
  }
});
