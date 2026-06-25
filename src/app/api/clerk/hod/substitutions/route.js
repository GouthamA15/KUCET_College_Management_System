import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubstitutions, 
  facultySubjectAssignments, 
  clerks 
} from '@/db/schema';
import { eq, and, desc, _sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    const query = db.select({
      id: facultySubstitutions.id,
      original_assignment_id: facultySubstitutions.original_assignment_id,
      substitute_faculty_id: facultySubstitutions.substitute_faculty_id,
      substitution_date: facultySubstitutions.substitution_date,
      substitute_name: clerks.name,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      semester: facultySubjectAssignments.course_semester
    })
    .from(facultySubstitutions)
    .innerJoin(clerks, eq(facultySubstitutions.substitute_faculty_id, clerks.id))
    .innerJoin(facultySubjectAssignments, eq(facultySubstitutions.original_assignment_id, facultySubjectAssignments.id))
    .where(eq(facultySubjectAssignments.branch, user.branch));

    if (date) {
      query.where(eq(facultySubstitutions.substitution_date, date));
    }

    const results = await query.orderBy(desc(facultySubstitutions.substitution_date));

    return apiResponse({ data: results });
  } catch (error) {
    logger.error('Fetch Substitutions Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { assignment_id, substitute_faculty_id, date } = await req.json();

    if (!assignment_id || !substitute_faculty_id || !date) {
      return apiError('Missing required fields', 400);
    }

    // Verify assignment belongs to HOD's branch
    const asgn = await db.select()
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.id, assignment_id),
        eq(facultySubjectAssignments.branch, user.branch)
      ))
      .limit(1);

    if (asgn.length === 0) {
      return apiError('Assignment not found in your branch', 404);
    }

    // Create substitution
    await db.insert(facultySubstitutions).values({
      original_assignment_id: assignment_id,
      substitute_faculty_id: substitute_faculty_id,
      substitution_date: date,
      created_by_clerk_id: user.id
    });

    return apiResponse({ message: 'Substitution created successfully' });
  } catch (error) {
    logger.error('Create Substitution Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id'));

    if (!id) {
      return apiError('Missing substitution ID', 400);
    }

    // Verify ownership via branch
    const subst = await db.select()
      .from(facultySubstitutions)
      .innerJoin(facultySubjectAssignments, eq(facultySubstitutions.original_assignment_id, facultySubjectAssignments.id))
      .where(and(
        eq(facultySubstitutions.id, id),
        eq(facultySubjectAssignments.branch, user.branch)
      ))
      .limit(1);

    if (subst.length === 0) {
      return apiError('Substitution not found or unauthorized', 404);
    }

    await db.delete(facultySubstitutions).where(eq(facultySubstitutions.id, id));

    return apiResponse({ message: 'Substitution removed successfully' });
  } catch (error) {
    logger.error('Delete Substitution Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
