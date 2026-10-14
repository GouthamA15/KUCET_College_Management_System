import logger from '@/lib/logger';
import { db } from '@/db';
import { facultySubstitutions, facultySubjectAssignments, staffAccounts } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const requestedBranch = searchParams.get('branch');
    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);

    if (user.role !== 'admin' && requestedBranch && authorizedBranches.length > 0 && !authorizedBranches.includes(requestedBranch)) {
      return apiError(`Forbidden - Not authorized for ${requestedBranch} branch.`, 403);
    }

    const branchFilter = requestedBranch 
      ? [requestedBranch] 
      : (authorizedBranches.length > 0 ? authorizedBranches : (user.branch ? [user.branch] : []));

    const conditions = [];
    if (user.role !== 'admin' && branchFilter.length > 0) {
      conditions.push(inArray(facultySubjectAssignments.branch, branchFilter));
    }
    if (date) {
      conditions.push(eq(facultySubstitutions.substitution_date, date));
    }

    const results = await db.select({
      id: facultySubstitutions.id,
      original_assignment_id: facultySubstitutions.original_assignment_id,
      substitute_faculty_id: facultySubstitutions.substitute_faculty_id,
      substitution_date: facultySubstitutions.substitution_date,
      substitute_name: staffAccounts.name,
      subject_name: facultySubjectAssignments.subject_name,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      semester: facultySubjectAssignments.course_semester
    })
    .from(facultySubstitutions)
    .innerJoin(staffAccounts, eq(facultySubstitutions.substitute_faculty_id, staffAccounts.id))
    .innerJoin(facultySubjectAssignments, eq(facultySubstitutions.original_assignment_id, facultySubjectAssignments.id))
    .where(and(...conditions))
    .orderBy(desc(facultySubstitutions.substitution_date));

    return apiResponse({ data: results });
  } catch (error) {
    logger.error('Fetch Substitutions Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('hod');
    if (!user || (!((user.role === 'faculty' && user.is_hod) || user.role === 'admin'))) {
      return apiError('Unauthorized', 401);
    }

    const { assignment_id, substitute_faculty_id, date } = await req.json();

    if (!assignment_id || !substitute_faculty_id || !date) {
      return apiError('Missing required fields', 400);
    }

    // Verify assignment exists
    const asgn = await db.select()
      .from(facultySubjectAssignments)
      .where(eq(facultySubjectAssignments.id, assignment_id))
      .limit(1);

    if (asgn.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && authorizedBranches.length > 0 && !authorizedBranches.includes(asgn[0].branch)) {
      return apiError(`Forbidden. You can only manage substitutions for your authorized branches: ${authorizedBranches.join(', ')}`, 403);
    }

    // Create substitution
    await db.insert(facultySubstitutions).values({
      original_assignment_id: assignment_id,
      substitute_faculty_id: substitute_faculty_id,
      substitution_date: date,
      created_by_staff_id: user.id
    });

    return apiResponse({ message: 'Substitution created successfully' });
  } catch (error) {
    logger.error('Create Substitution Error:', error);
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
    const id = parseInt(searchParams.get('id'));

    if (!id) {
      return apiError('Missing substitution ID', 400);
    }

    // Verify ownership via branch
    const subst = await db.select({
      id: facultySubstitutions.id,
      branch: facultySubjectAssignments.branch
    })
    .from(facultySubstitutions)
    .innerJoin(facultySubjectAssignments, eq(facultySubstitutions.original_assignment_id, facultySubjectAssignments.id))
    .where(eq(facultySubstitutions.id, id))
    .limit(1);

    if (subst.length === 0) {
      return apiError('Substitution not found', 404);
    }

    const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
    if (user.role !== 'admin' && authorizedBranches.length > 0 && !authorizedBranches.includes(subst[0].branch)) {
      return apiError('Forbidden. You do not have authorization to remove this substitution.', 403);
    }

    await db.delete(facultySubstitutions).where(eq(facultySubstitutions.id, id));

    return apiResponse({ message: 'Substitution removed successfully' });
  } catch (error) {
    logger.error('Delete Substitution Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
