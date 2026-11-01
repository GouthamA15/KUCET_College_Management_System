import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  facultySubjectAssignments, 
  studentAttendance, 
  attendanceSessions,
  collegeInfo as collegeInfoTable,
  facultySubstitutions
} from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { isSemesterActive } from '@/lib/academic-utils';
import { Clock, getNow } from '@/lib/clock';
import crypto from 'crypto';
import { z } from 'zod';

export async function POST(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const json = await request.json();

    // --- ZERO TRUST VALIDATION ---
    const attendanceSchema = z.object({
      assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      session: z.number().int().min(1).max(8),
      topic_covered: z.string().trim().max(500).optional().nullable(),
      attendance_data: z.array(z.object({
        student_id: z.number().int().positive(),
        status: z.enum(['PRESENT', 'ABSENT', 'NCC', 'MEDICAL'])
      })).min(1, "Attendance data cannot be empty")
    });

    const validatedData = attendanceSchema.parse(json);
    const { assignment_id, date, session, topic_covered, attendance_data } = validatedData;

    // 1. Verify assignment existence and get details
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_id: facultySubjectAssignments.staff_account_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];

    // 2. Authorization logic (Primary Faculty, HOD, Substitute, or Admin)
    let isAuthorized = false;

    if (assignment.faculty_id === user.id || user.role === 'admin') {
      isAuthorized = true;
    } else if (user.is_principal || user.is_hod) {
      const authorizedBranches = user.authorized_branches || (user.branch ? [user.branch] : []);
      if (authorizedBranches.includes(assignment.branch) || user.branch === assignment.branch) {
        isAuthorized = true;
      }
    } else {
      // Check for active substitution on this date
      const substitution = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id),
          eq(facultySubstitutions.substitution_date, date)
        ))
        .limit(1);
      
      if (substitution.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Unauthorized to mark attendance for this assignment', 403);
    }

    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, course_semester),
        eq(facultySubjectAssignments.academic_year, academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    // Check if assignment is active
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance locked.', 403);
    }

    // --- ACADEMIC CALENDAR & MAKEUP CLASS VALIDATION ---
    try {
      const { AttendanceService } = await import('@/services/AttendanceService');
      if (typeof AttendanceService?.validateAttendanceDate === 'function') {
        await AttendanceService.validateAttendanceDate({
          assignmentId: assignment_id,
          date,
          sessionNumber: session,
          academicYear: academic_year,
          semester: course_semester,
          tx: db
        });
      }
    } catch (valErr) {
      return apiError(valErr.message, 403);
    }

    // Transaction & Consolidated Atomic Persistence
    const submissionTime = Clock?.now ? Clock.now(request) : (typeof getNow === 'function' ? getNow(request) : new Date());

    const totalStudents = attendance_data.length;
    const presentCount = attendance_data.filter(i => i.status === 'PRESENT').length;
    const absentCount = attendance_data.filter(i => i.status === 'ABSENT').length;
    const cleanTopic = (topic_covered && topic_covered.trim().length >= 2) ? topic_covered.trim().slice(0, 500) : null;

    let targetSessionId = null;
    let savedTopic = cleanTopic;

    await db.transaction(async (tx) => {
      // 1. Resolve or upsert the session metadata record atomically
      const sessionRows = await tx.select({
        id: attendanceSessions.id,
        topic_covered: attendanceSessions.topic_covered
      })
      .from(attendanceSessions)
      .where(and(
        eq(attendanceSessions.assignment_id, targetAssignmentId),
        eq(attendanceSessions.attendance_date, date),
        eq(attendanceSessions.session_number, session)
      ))
      .limit(1);

      const existingSession = Array.isArray(sessionRows) ? sessionRows[0] : null;
      const topicToPersist = cleanTopic || existingSession?.topic_covered || null;
      savedTopic = topicToPersist;

      if (existingSession) {
        targetSessionId = existingSession.id;
        await tx.update(attendanceSessions)
          .set({
            submitted_at: submissionTime,
            is_active: false,
            total_students: totalStudents,
            present_count: presentCount,
            absent_count: absentCount,
            topic_covered: topicToPersist
          })
          .where(eq(attendanceSessions.id, targetSessionId));
      } else {
        const [insRes] = await tx.insert(attendanceSessions).values({
          assignment_id: targetAssignmentId,
          attendance_date: date,
          session_number: session,
          faculty_id: user.id,
          submitted_at: submissionTime,
          is_active: false,
          session_pin: '0000',
          session_token: crypto.randomBytes(32).toString('hex'),
          expires_at: submissionTime,
          total_students: totalStudents,
          present_count: presentCount,
          absent_count: absentCount,
          topic_covered: topicToPersist
        });
        targetSessionId = insRes.insertId;
      }

      // 2. Bulk upsert attendance records linking directly to session_id with unique constraint
      const values = attendance_data.map(item => ({
        session_id: targetSessionId,
        student_id: item.student_id,
        assignment_id: targetAssignmentId,
        date: date,
        session: session,
        status: item.status,
        submitted_at: submissionTime
      }));

      await tx.insert(studentAttendance)
        .values(values)
        .onDuplicateKeyUpdate({
          set: { 
            status: sql`VALUES(status)`,
            submitted_at: sql`VALUES(submitted_at)`,
            session_id: sql`VALUES(session_id)`
          }
        });
    });

    // AUTO-SAVE TOPIC COVERED if provided
    if (cleanTopic) {
      try {
        const { AttendanceService } = await import('@/services/AttendanceService');
        const topicResult = await AttendanceService.updateLectureTopic({
          assignmentId: assignment_id,
          date,
          sessionNumber: session,
          topicCovered: cleanTopic,
          user
        });
        savedTopic = topicResult.topic_covered;
      } catch (topicErr) {
        logger.warn({ err: topicErr }, 'Auto-saving lecture topic alongside attendance failed');
      }
    }

    // REAL-TIME: Notify HOD/Faculty
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('ATTENDANCE_SAVED', { 
        faculty_id: user.id, 
        branch: assignment.branch 
      });
    } catch (sseErr) {
      console.warn('[SSE] Broadcast failed:', sseErr);
    }

    // DOMAIN EVENT: Trigger batched cache invalidation asynchronously
    Promise.resolve().then(async () => {
      try {
        const { EventBus, DOMAIN_EVENTS } = await import('@/lib/events/EventBus');
        const studentIds = attendance_data.map(item => item.student_id);
        EventBus.publish(DOMAIN_EVENTS.ATTENDANCE_BATCH_SUBMITTED, {
          assignment_id: targetAssignmentId,
          session_id: targetSessionId,
          date,
          session,
          student_ids: studentIds
        });
      } catch (ebErr) {
        logger.warn({ err: ebErr }, '[EventBus] Attendance batch publish failed');
      }
    }).catch(() => {});

    return apiResponse({ message: 'Attendance updated successfully', topic_covered: savedTopic });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Attendance Update Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin')) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id_raw = searchParams.get('assignment_id');
    const date = searchParams.get('date');
    const session_raw = searchParams.get('session');

    // --- ZERO TRUST VALIDATION (Query Params) ---
    const deleteSchema = z.object({
      assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      session: z.preprocess(v => Number(v), z.number().int().min(1).max(8))
    });

    const validatedData = deleteSchema.parse({
      assignment_id: assignment_id_raw,
      date,
      session: session_raw
    });

    const { assignment_id, session } = validatedData;

    // 1. Verify assignment existence and get details
    const assignments = await db.select({
      subject_code: facultySubjectAssignments.subject_code,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      faculty_id: facultySubjectAssignments.staff_account_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const assignment = assignments[0];

    // 2. Authorization logic (Primary Faculty, HOD, or Substitute)
    let isAuthorized = false;

    if (assignment.faculty_id === user.id) {
      isAuthorized = true;
    } else if (user.is_hod && user.branch === assignment.branch) {
      isAuthorized = true;
    } else {
      // Check for active substitution on this date
      const substitution = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id),
          eq(facultySubstitutions.substitution_date, date)
        ))
        .limit(1);
      
      if (substitution.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return apiError('Unauthorized to delete attendance for this assignment', 403);
    }

    const { subject_code, branch, course_semester, academic_year } = assignment;

    // --- SHARED DATA LOGIC: Canonical ID ---
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, course_semester),
        eq(facultySubjectAssignments.academic_year, academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);
    
    const targetAssignmentId = canonicalRows[0]?.id || assignment_id;

    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1)).limit(1);
    const collegeInfo = collegeRows[0] || null;

    if (!await isSemesterActive(course_semester, academic_year, collegeInfo)) {
      return apiError('Semester has ended. Attendance locked.', 403);
    }

    await db.transaction(async (tx) => {
      await tx.delete(studentAttendance)
        .where(and(
          eq(studentAttendance.assignment_id, targetAssignmentId),
          eq(studentAttendance.date, date),
          eq(studentAttendance.session, session)
        ));

      // Reset submitted_at in attendanceSessions
      await tx.update(attendanceSessions)
        .set({ submitted_at: null })
        .where(and(
          eq(attendanceSessions.assignment_id, targetAssignmentId),
          eq(attendanceSessions.attendance_date, date),
          eq(attendanceSessions.session_number, session)
        ));
    });

    return apiResponse({ message: 'Attendance for the selected date has been deleted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error('Attendance Delete Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
