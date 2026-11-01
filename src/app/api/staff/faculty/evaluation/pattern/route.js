import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  studentMarks, 
  syllabusSubjects, 
  facultySubstitutions,
  auditLogs
} from '@/db/schema';
import { eq, and, or, asc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { resolveCanonicalSubjectType } from '@/lib/academic-utils';
import { 
  THEORY_ASSESSMENT_PATTERNS, 
  getTheoryPattern, 
  checkPatternSwitchCompatibility 
} from '@/lib/evaluation-utils';
import { z } from 'zod';

/**
 * Checks authorization for a user against a specific faculty subject assignment.
 */
async function authorizeAssignmentAccess(user, assignment) {
  if (user.role === 'admin' || user.is_principal) {
    return true;
  }
  if (assignment.staff_account_id === user.id) {
    return true;
  }
  if (user.is_hod) {
    const authorizedBranches = (user.authorized_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());
    const asgnBranch = String(assignment.branch || '').toUpperCase();
    if (authorizedBranches.includes(asgnBranch) || !assignment.branch) {
      return true;
    }
  }
  if (user.is_first_year_coordinator && (assignment.course_semester === 1 || assignment.course_semester === 2)) {
    return true;
  }
  // Check substitute assignment
  const sub = await db.select({ id: facultySubstitutions.id })
    .from(facultySubstitutions)
    .where(and(
      eq(facultySubstitutions.original_assignment_id, assignment.id),
      eq(facultySubstitutions.substitute_faculty_id, user.id)
    ))
    .limit(1);
  return sub.length > 0;
}

export async function GET(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignmentIdStr = searchParams.get('assignment_id') || searchParams.get('id');
    const assignmentId = assignmentIdStr ? parseInt(assignmentIdStr, 10) : null;

    if (!assignmentId || Number.isNaN(assignmentId)) {
      return apiError('Missing or invalid assignment_id parameter', 400);
    }

    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      staff_account_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_term: facultySubjectAssignments.academic_term,
      academic_year: facultySubjectAssignments.academic_year,
      mid_max: facultySubjectAssignments.mid_max,
      canonical_subject_type: syllabusSubjects.subject_type
    })
    .from(facultySubjectAssignments)
    .leftJoin(syllabusSubjects, eq(facultySubjectAssignments.subject_code, syllabusSubjects.subject_code))
    .where(eq(facultySubjectAssignments.id, assignmentId))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    const isAuthorized = await authorizeAssignmentAccess(user, assignment);
    if (!isAuthorized) {
      return apiError('Forbidden: You are not authorized for this assignment evaluation', 403);
    }

    const classification = resolveCanonicalSubjectType({
      subject_code: assignment.subject_code,
      subject_name: assignment.subject_name,
      canonical_subject_type: assignment.canonical_subject_type
    });

    if (classification.is_lab) {
      return apiResponse({
        assignment_id: assignment.id,
        is_lab: true,
        subject_type: 'lab',
        message: 'Practical subjects strictly use Execution (10), Writing (10), and Record (5) assessment components.'
      });
    }

    // Resolve canonical assignment ID
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, assignment.subject_code),
        eq(facultySubjectAssignments.branch, assignment.branch),
        eq(facultySubjectAssignments.course_semester, assignment.course_semester),
        eq(facultySubjectAssignments.academic_year, assignment.academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);

    const canonicalId = canonicalRows[0]?.id || assignment.id;

    // Fetch existing marks for this subject evaluation
    const existingMarks = await db.select({
      id: studentMarks.id,
      student_id: studentMarks.student_id,
      is_published: studentMarks.is_published,
      mid1_marks: studentMarks.mid1_marks,
      mid2_marks: studentMarks.mid2_marks,
      assignment_marks: studentMarks.assignment_marks
    })
    .from(studentMarks)
    .where(eq(studentMarks.assignment_id, canonicalId));

    const isPublished = existingMarks.some(m => Boolean(m.is_published));
    const hasSavedMarks = existingMarks.some(m => 
      (m.mid1_marks !== null && m.mid1_marks !== undefined && m.mid1_marks !== '') ||
      (m.mid2_marks !== null && m.mid2_marks !== undefined && m.mid2_marks !== '') ||
      (m.assignment_marks !== null && m.assignment_marks !== undefined && m.assignment_marks !== '')
    );

    const currentPattern = getTheoryPattern(assignment.mid_max);
    const isLocked = isPublished || hasSavedMarks;

    const isSuperAdmin = user.role === 'admin' || Boolean(user.is_principal);
    const hodBranches = (user.authorized_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());
    const asgnBranch = String(assignment.branch || '').toUpperCase();
    const isHodAuthorized = Boolean(user.is_hod) && (hodBranches.includes(asgnBranch) || !assignment.branch);
    const canOverride = (isSuperAdmin || isHodAuthorized) && !isPublished;
    const canChange = !isLocked && !isPublished;

    return apiResponse({
      assignment_id: assignment.id,
      canonical_id: canonicalId,
      subject_code: assignment.subject_code,
      subject_name: assignment.subject_name,
      branch: assignment.branch,
      course_semester: assignment.course_semester,
      academic_year: assignment.academic_year,
      is_lab: false,
      subject_type: 'theory',
      current_pattern: currentPattern,
      has_saved_pattern: Boolean(currentPattern),
      has_saved_marks: hasSavedMarks,
      is_locked: isLocked,
      is_published: isPublished,
      can_change: canChange,
      can_override: canOverride,
      available_patterns: Object.values(THEORY_ASSESSMENT_PATTERNS)
    });
  } catch (error) {
    logger.error('Assessment Pattern Query Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const json = await request.json();
    const patternSchema = z.object({
      assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
      pattern_id: z.string().optional(),
      mid_max: z.number().int().optional(),
      reason: z.string().optional(),
      is_override: z.boolean().optional()
    });

    const parsed = patternSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(parsed.error.errors?.[0]?.message || 'Invalid input data', 400);
    }

    const { assignment_id, pattern_id, mid_max, reason } = parsed.data;
    const targetPattern = getTheoryPattern(pattern_id || mid_max);

    if (!targetPattern) {
      return apiError('Invalid assessment pattern specified. Must be one of Pattern 1 (20 + 10), Pattern 2 (25 + 5), or Pattern 3 (30 for Mids).', 400);
    }

    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      staff_account_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      mid_max: facultySubjectAssignments.mid_max,
      canonical_subject_type: syllabusSubjects.subject_type
    })
    .from(facultySubjectAssignments)
    .leftJoin(syllabusSubjects, eq(facultySubjectAssignments.subject_code, syllabusSubjects.subject_code))
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];
    const isAuthorized = await authorizeAssignmentAccess(user, assignment);
    if (!isAuthorized) {
      return apiError('Forbidden: You are not authorized for this assignment evaluation', 403);
    }

    const classification = resolveCanonicalSubjectType({
      subject_code: assignment.subject_code,
      subject_name: assignment.subject_name,
      canonical_subject_type: assignment.canonical_subject_type
    });

    if (classification.is_lab) {
      return apiError('Pattern selection applies only to theoretical subjects. Practical subjects use the Execution, Writing, and Record format.', 400);
    }

    // Resolve canonical assignment ID
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, assignment.subject_code),
        eq(facultySubjectAssignments.branch, assignment.branch),
        eq(facultySubjectAssignments.course_semester, assignment.course_semester),
        eq(facultySubjectAssignments.academic_year, assignment.academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);

    const canonicalId = canonicalRows[0]?.id || assignment.id;

    // Check if marks are already published
    const publishedMarks = await db.select({ id: studentMarks.id })
      .from(studentMarks)
      .where(and(
        eq(studentMarks.assignment_id, canonicalId),
        eq(studentMarks.is_published, true)
      ))
      .limit(1);

    if (publishedMarks.length > 0) {
      return apiError('Marks for this subject have already been published. Assessment pattern cannot be modified.', 403);
    }

    // Fetch existing marks to evaluate saved marks & pattern lock
    const existingMarks = await db.select({
      id: studentMarks.id,
      mid1_marks: studentMarks.mid1_marks,
      mid2_marks: studentMarks.mid2_marks,
      assignment_marks: studentMarks.assignment_marks
    })
    .from(studentMarks)
    .where(eq(studentMarks.assignment_id, canonicalId));

    // A student mark is saved if any component has non-null/non-empty value (including numeric 0)
    const hasSavedMarks = existingMarks.some(m => 
      (m.mid1_marks !== null && m.mid1_marks !== undefined && m.mid1_marks !== '') ||
      (m.mid2_marks !== null && m.mid2_marks !== undefined && m.mid2_marks !== '') ||
      (m.assignment_marks !== null && m.assignment_marks !== undefined && m.assignment_marks !== '')
    );

    const isSuperAdmin = user.role === 'admin' || Boolean(user.is_principal);
    const hodBranches = (user.authorized_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());
    const asgnBranch = String(assignment.branch || '').toUpperCase();
    const isHodAuthorized = Boolean(user.is_hod) && (hodBranches.includes(asgnBranch) || !assignment.branch);

    if (hasSavedMarks) {
      // Ordinary faculty are strictly forbidden from changing patterns once marks are saved
      if (!isSuperAdmin && !isHodAuthorized) {
        return apiError(
          'Assessment pattern is permanently locked because marks have already been saved for this subject. Only an HOD or Super Admin can override this pattern.',
          403,
          { code: 'PATTERN_LOCKED_MARKS_EXIST' }
        );
      }

      // HOD or Super Admin override requires a non-empty, meaningful reason (min 5 chars)
      const cleanReason = (reason || '').trim();
      if (!cleanReason || cleanReason.length < 5) {
        return apiError('A valid, non-empty reason (minimum 5 characters) is required for an administrative pattern override.', 400);
      }

      // Enforce compatibility so existing marks are not silently corrupted
      const compatibility = checkPatternSwitchCompatibility(existingMarks, targetPattern);
      if (!compatibility.compatible) {
        return apiError(compatibility.reason, 422);
      }
    }

    const oldPattern = getTheoryPattern(assignment.mid_max);
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1').trim().slice(0, 45);
    const userAgent = (request.headers.get('user-agent') || 'Unknown Device').slice(0, 500);
    const auditActorType = user.role === 'admin' ? 'admin' : 'staff';
    const action = hasSavedMarks ? 'OVERRIDE_ASSESSMENT_PATTERN' : 'SET_ASSESSMENT_PATTERN';

    // Execute pattern update and audit log in a single atomic transaction
    await db.transaction(async (tx) => {
      await tx.update(facultySubjectAssignments)
        .set({ mid_max: targetPattern.midMax })
        .where(or(
          eq(facultySubjectAssignments.id, assignment.id),
          eq(facultySubjectAssignments.id, canonicalId)
        ));

      // Insert audit record atomically
      await tx.insert(auditLogs).values({
        user_id: user.id,
        user_type: auditActorType,
        action,
        target_id: String(canonicalId),
        target_type: 'assignment',
        payload_before: {
          pattern_id: oldPattern?.id || null,
          mid_max: assignment.mid_max
        },
        payload_after: {
          pattern_id: targetPattern.id,
          mid_max: targetPattern.midMax,
          is_override: hasSavedMarks,
          reason: hasSavedMarks ? (reason || '').trim() : null,
          actor_id: user.id,
          actor_role: user.role,
          is_hod: Boolean(user.is_hod)
        },
        ip_address: ip,
        user_agent: userAgent
      });
    });

    return apiResponse({
      message: `Assessment pattern successfully set to ${targetPattern.name}`,
      pattern: targetPattern,
      mid_max: targetPattern.midMax,
      is_locked: hasSavedMarks
    });
  } catch (error) {
    logger.error('Assessment Pattern Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
