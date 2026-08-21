import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  staffAccounts 
} from '@/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(_req) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      faculty_id: facultySubjectAssignments.faculty_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      course_semester: facultySubjectAssignments.course_semester,
      faculty_name: staffAccounts.name
    })
    .from(facultySubjectAssignments)
    .innerJoin(staffAccounts, eq(facultySubjectAssignments.faculty_id, staffAccounts.id))
    .where(and(
      eq(facultySubjectAssignments.branch, user.branch),
      eq(facultySubjectAssignments.is_active, true)
    ))
    .orderBy(desc(facultySubjectAssignments.course_semester), asc(facultySubjectAssignments.subject_name));

    return apiResponse({ data: assignments });
  } catch (error) {
    logger.error('Subject Assignments GET Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const { faculty_id, subject_code, subject_name, semester, academic_year } = await req.json();

    if (!faculty_id || !subject_code || !semester) {
      return apiError('Missing required fields', 400);
    }

    await db.insert(facultySubjectAssignments).values({
      faculty_id: parseInt(faculty_id),
      subject_code: subject_code,
      subject_name: subject_name,
      branch: user.branch,
      course_semester: parseInt(semester),
      academic_term: (parseInt(semester) % 2 === 0 ? 2 : 1),
      academic_year: academic_year || '2025-26',
      is_active: true
    })
    .onDuplicateKeyUpdate({
      set: {
        faculty_id: sql`VALUES(faculty_id)`,
        is_active: true
      }
    });

    return apiResponse({ success: true, message: 'Faculty assigned successfully' });
  } catch (error) {
    logger.error('Subject Assignments POST Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(req) {
    try {
      const user = await getAuthUser('hod');
      if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
        return apiError('Unauthorized', 401);
      }
  
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
  
      if (!id) return apiError('Missing assignment ID', 400);

      await db.update(facultySubjectAssignments)
        .set({ is_active: false })
        .where(and(
          eq(facultySubjectAssignments.id, id),
          eq(facultySubjectAssignments.branch, user.branch)
        ));
  
      return apiResponse({ success: true, message: 'Assignment revoked' });
    } catch (error) {
      logger.error('Subject Assignments DELETE Error:', error);
      return apiError('Internal Server Error', 500);
    }
}
