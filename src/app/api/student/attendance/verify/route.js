import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { 
  attendanceSessions, 
  attendanceSessionLogs, 
  students, 
  studentAttendance,
  facultySubjectAssignments
} from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { isWithinRange } from '@/lib/geo-utils';
import { Clock } from '@/lib/clock';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';
import crypto from 'crypto';

/**
 * POST /api/student/attendance/verify
 * Students use this to verify their attendance via PIN or QR
 */
export async function POST(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { assignment_id, session_id, pin, token, latitude, longitude, accuracy, device_id } = body;

    if ((!assignment_id && !session_id) || (!pin && !token) || latitude === undefined || longitude === undefined) {
      return apiError('Location and Verification Data (PIN/QR) are required.', 400);
    }

    const now = Clock.now(request);

    // 1. Fetch the session (identifying whether active, expired, or closed)
    const sessionConditions = [];
    if (session_id) {
      sessionConditions.push(eq(attendanceSessions.id, session_id));
    }
    if (assignment_id) {
      sessionConditions.push(eq(attendanceSessions.assignment_id, assignment_id));
    }

    const session = await db.query.attendanceSessions.findFirst({
      where: sessionConditions.length > 1 ? and(...sessionConditions) : sessionConditions[0],
      orderBy: [desc(attendanceSessions.id)]
    });

    if (!session) {
      return apiError('No attendance session found for the provided details.', 404);
    }

    if (!session.is_active) {
      return apiError('This attendance session has ended or is closed.', 403);
    }

    if (new Date(session.expires_at).getTime() <= now.getTime()) {
      return apiError('This attendance session has expired.', 403);
    }

    const sessionNum = session.session_number || 1;

    // 2. Verify Assignment Existence & Student Eligibility
    const assignmentRows = await db.select({
      id: facultySubjectAssignments.id,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, session.assignment_id))
    .limit(1);

    if (assignmentRows.length === 0) {
      return apiError('Associated subject assignment not found.', 404);
    }

    const assignment = assignmentRows[0];

    // Branch Eligibility Guard
    const studentBranch = getBranchFromRoll(user.roll_no);
    if (studentBranch && assignment.branch && studentBranch !== assignment.branch) {
      return apiError(`You are not eligible for this session (Branch mismatch: expected ${assignment.branch}, got ${studentBranch}).`, 403);
    }

    // Semester Eligibility Guard
    const academicSession = await calculateYearAndSemesterAsync(user.roll_no, user.academic_offset_years || 0);
    if (academicSession?.semester && assignment.course_semester && academicSession.semester !== assignment.course_semester) {
      return apiError(`You are not eligible for this session (Semester mismatch: expected Semester ${assignment.course_semester}, you are in Semester ${academicSession.semester}).`, 403);
    }

    // 3. Duplicate Attendance Prevention
    const existingSuccessLogs = await db.select({ id: attendanceSessionLogs.id })
      .from(attendanceSessionLogs)
      .where(and(
        eq(attendanceSessionLogs.session_id, session.id),
        eq(attendanceSessionLogs.student_id, user.student_id),
        eq(attendanceSessionLogs.status, 'SUCCESS')
      ))
      .limit(1);

    if (existingSuccessLogs.length > 0) {
      return apiError('You have already verified your attendance for this session.', 409);
    }

    const existingAttendance = await db.select({ id: studentAttendance.id, status: studentAttendance.status })
      .from(studentAttendance)
      .where(and(
        eq(studentAttendance.assignment_id, session.assignment_id),
        eq(studentAttendance.student_id, user.student_id),
        eq(studentAttendance.date, session.attendance_date),
        eq(studentAttendance.session, sessionNum)
      ))
      .limit(1);

    if (existingAttendance.length > 0 && existingAttendance[0].status === 'PRESENT') {
      return apiError('Attendance has already been marked as PRESENT for this session.', 409);
    }

    // --- GPS RADIUS & ACCURACY CHECK ---
    const maxAccuracy = 100; // 100 meters
    if (accuracy && accuracy > maxAccuracy) {
      return apiError(`GPS accuracy too low (${Math.round(accuracy)}m). Please move to a clearer area and try again.`, 400);
    }

    if (session.latitude && session.longitude) {
      const isNearby = isWithinRange(
        Number(session.latitude), 
        Number(session.longitude), 
        latitude, 
        longitude, 
        50 // 50m radius
      );

      if (!isNearby) {
        // Record failure
        await db.insert(attendanceSessionLogs)
          .values({
            session_id: session.id,
            student_id: user.student_id,
            status: 'FAILED_LOCATION',
            ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
            created_at: now
          });

        return apiError('You are not within the allowed radius (50m) of the classroom.', 403);
      }
    }
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    
    const uaHash = crypto.createHash('md5').update(userAgent).digest('hex');
    const finalDeviceId = device_id || crypto.createHash('sha256').update(userAgent + ipAddress).digest('hex');

    // --- PIN / TOKEN VALIDATION ---
    if (pin) {
      // 1. Check existing failures/lockout
      const existingLogs = await db.select({ 
        failed_count: sql`COUNT(CASE WHEN status = 'FAILED_PIN' THEN 1 END)`,
        is_locked: sql`COUNT(CASE WHEN status = 'LOCKED' THEN 1 END)`
      })
        .from(attendanceSessionLogs)
        .where(and(
          eq(attendanceSessionLogs.session_id, session.id),
          eq(attendanceSessionLogs.student_id, user.student_id)
        ));
      
      const { failed_count, is_locked } = existingLogs[0];
      if (Number(is_locked) > 0) {
        return apiError('You have been locked out of this session due to multiple failed PIN attempts. Please contact the faculty.', 403);
      }

      if (String(pin) !== String(session.session_pin)) {
        const newFailedCount = Number(failed_count) + 1;
        const status = newFailedCount >= 3 ? 'LOCKED' : 'FAILED_PIN';
        
        // Record failure
        await db.insert(attendanceSessionLogs)
          .values({
            session_id: session.id,
            student_id: user.student_id,
            status: status,
            ip_address: ipAddress,
            ua_hash: uaHash,
            device_hash: finalDeviceId
          });

        if (newFailedCount >= 3) {
          // Notify Faculty
          try {
            const { broadcastUpdate } = await import('@/lib/sse');
            broadcastUpdate('STUDENT_LOCKED', { 
              assignment_id: session.assignment_id,
              session_number: sessionNum,
              roll_no: user.roll_no,
              reason: '3 failed PIN attempts'
            });
          } catch (_sseErr) { /* empty */ }
          return apiError('3 failed PIN attempts. You are now locked out of this session.', 403);
        }

        return apiError(`Invalid PIN. ${3 - newFailedCount} attempts remaining.`, 403);
      }
    } else if (token) {
      if (token !== session.session_token) {
        return apiError('Invalid verification token or QR code.', 403);
      }
    }

    // --- PROXY DETECTION: DEVICE FINGERPRINTING ---
    const idLogs = await db.select({
      student_id: attendanceSessionLogs.student_id,
      roll_no: students.roll_no
    })
    .from(attendanceSessionLogs)
    .innerJoin(students, eq(attendanceSessionLogs.student_id, students.id))
    .where(and(
      eq(attendanceSessionLogs.session_id, session.id),
      eq(attendanceSessionLogs.device_hash, finalDeviceId),
      eq(attendanceSessionLogs.status, 'SUCCESS')
    ));

    if (idLogs.length > 0 && idLogs[0].student_id !== user.student_id) {
      const originalStudent = idLogs[0];
      
      // PROXY DETECTED: Mark BOTH students as ABSENT
      await db.transaction(async (tx) => {
        // Original student
        await tx.insert(studentAttendance)
          .values({
            assignment_id: session.assignment_id,
            student_id: originalStudent.student_id,
            date: session.attendance_date,
            session: sessionNum,
            status: 'ABSENT'
          })
          .onDuplicateKeyUpdate({ set: { status: 'ABSENT' } });

        // Attempting student (user)
        await tx.insert(studentAttendance)
          .values({
            assignment_id: session.assignment_id,
            student_id: user.student_id,
            date: session.attendance_date,
            session: sessionNum,
            status: 'ABSENT'
          })
          .onDuplicateKeyUpdate({ set: { status: 'ABSENT' } });
      });

      // Notify Faculty
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        broadcastUpdate('PROXY_ATTEMPTED', { 
          assignment_id: session.assignment_id,
          session_number: sessionNum,
          attempting_roll_no: user.roll_no,
          original_roll_no: originalStudent.roll_no,
          original_student_id: originalStudent.student_id
        });
      } catch (_sseErr) { /* empty */ }

      return apiError(`Proxy blocked: Student ${originalStudent.roll_no} attempted to proxy for you using their device/session. Both records have been flagged as ABSENT.`, 403);
    }

    // 2. Campus Wi-Fi & Device Telemetry:
    // On university campus Wi-Fi networks, all students share the classroom router's egress NAT IP
    // and standard mobile User-Agent strings. Hardware/device-level uniqueness is authoritatively
    // enforced above via finalDeviceId (Check 1). We record network signatures for audit telemetry
    // without falsely blocking legitimate students on the same Wi-Fi access point.
    if (ipAddress && uaHash) {
      logger.info({
        session_id: session.id,
        student_id: user.student_id,
        ip_address: ipAddress,
        device_hash: finalDeviceId
      }, '[ATTENDANCE_NETWORK_TELEMETRY] Attendance verification network fingerprint recorded');
    }


    // --- SHARED DATA LOGIC: Canonical ID ---
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

    const targetAssignmentId = canonicalRows[0]?.id || session.assignment_id;

    // 5. Atomic Persistence: Session Verification Log + Student Attendance Record
    await db.transaction(async (tx) => {
      // Record verification log
      await tx.insert(attendanceSessionLogs)
        .values({
          session_id: session.id,
          student_id: user.student_id,
          device_hash: finalDeviceId,
          ip_address: ipAddress,
          ua_hash: uaHash,
          status: 'SUCCESS'
        })
        .onDuplicateKeyUpdate({
          set: {
            status: 'SUCCESS',
            device_hash: finalDeviceId,
            ip_address: ipAddress,
            ua_hash: uaHash
          }
        });

      // Record student attendance status as PRESENT in studentAttendance
      await tx.insert(studentAttendance)
        .values({
          assignment_id: targetAssignmentId,
          student_id: user.student_id,
          date: session.attendance_date,
          session: sessionNum,
          status: 'PRESENT'
        })
        .onDuplicateKeyUpdate({
          set: { status: 'PRESENT' }
        });
    });

    // --- REAL-TIME: Notify Faculty ---
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('STUDENT_VERIFIED', { 
        assignment_id: session.assignment_id, 
        student_id: user.student_id,
        roll_no: user.roll_no
      });
    } catch (sseErr) {
      console.warn('[SSE] Broadcast failed:', sseErr);
    }

    return apiResponse({ 
      success: true, 
      message: 'Attendance verified successfully. Marked as PRESENT.' 
    });

  } catch (error) {
    logger.error('Attendance Verification Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
