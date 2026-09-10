import { wrapHandler, apiError } from '@/lib/api-utils';
import { db } from '@/db';
import { timetableInstances } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { FacultyService } from '@/services/FacultyService';
import { z } from 'zod';

const createInstanceSchema = z.object({
  branch: z.string().trim().min(1, 'Branch is required').max(50),
  semester: z.number().int().min(1).max(8),
  academic_year: z.string().regex(/^\d{4}-\d{2}$/, 'Academic year must be in format YYYY-YY')
});

export const GET = wrapHandler({
  auth: 'hod',
  handler: async (req, { user }) => {
    if (!user || !user.is_hod) return apiError('Unauthorized', 403);
    
    const hodBranches = await FacultyService.getHodBranches(user.id, user.role);
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
    
    const json = await req.json();
    const parsed = createInstanceSchema.parse(json);
    const { branch, semester, academic_year } = parsed;
    
    const hodBranches = await FacultyService.getHodBranches(user.id, user.role);
    
    // Verify the requested branch belongs to the HOD
    if (!hodBranches.includes(branch)) {
      return apiError('Unauthorized for this program', 403);
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
