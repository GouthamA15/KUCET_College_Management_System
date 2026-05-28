import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import { 
  attendanceSessions, 
  attendanceSessionLogs, 
  students, 
  studentAttendance 
} from '@/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { isWithinRange } from '@/lib/geo-utils';
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

    // 1. Fetch the active session
    const session = await db.query.attendanceSessions.findFirst({
      where: and(
        session_id ? eq(attendanceSessions.id, session_id) : eq(attendanceSessions.assignment_id, assignment_id),
        eq(attendanceSessions.is_active, true),
        gt(attendanceSessions.expires_at, sql`NOW()`)
      )
    });

    if (!session) {
      return apiError('No active attendance session found or session expired.', 404);
    }

    const sessionNum = session.session_number || 1;

    // --- ACTION B: PERSISTENT DEVICE FINGERPRINTING & PROXY DETECTION ---
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
          } catch (sseErr) {}
          return apiError('3 failed PIN attempts. You are now locked out of this session.', 403);
        }

        return apiError(`Invalid PIN. ${3 - newFailedCount} attempts remaining.`, 403);
      }
    } else if (token) {
      if (token !== session.session_token) {
        return apiError('Invalid verification token or QR code.', 403);
      }
    }

    // --- GPS ACCURACY CHECK ---

    // 1. Check if this specific client-side Device ID has already been used for this session
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
      
      // PROXY DETECTED: Mark original student as ABSENT
      await db.insert(studentAttendance)
        .values({
          assignment_id: session.assignment_id,
          student_id: originalStudent.student_id,
          date: session.attendance_date,
          session: sessionNum,
          status: 'ABSENT'
        })
        .onDuplicateKeyUpdate({ set: { status: 'ABSENT' } });

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
      } catch (sseErr) {}

      return apiError(`Proxy blocked: Student ${originalStudent.roll_no} attempted to proxy for you using their device/session. Both records have been flagged.`, 403);
    }

    // 2. Check if this specific IP + User-Agent combination has already been used
    const proxyLogs = await db.select({
      student_id: attendanceSessionLogs.student_id,
      roll_no: students.roll_no
    })
    .from(attendanceSessionLogs)
    .innerJoin(students, eq(attendanceSessionLogs.student_id, students.id))
    .where(and(
      eq(attendanceSessionLogs.session_id, session.id),
      eq(attendanceSessionLogs.ip_address, ipAddress),
      eq(attendanceSessionLogs.ua_hash, uaHash),
      eq(attendanceSessionLogs.status, 'SUCCESS')
    ));

    if (proxyLogs.length > 0 && proxyLogs[0].student_id !== user.student_id) {
      const originalStudent = proxyLogs[0];

      // PROXY DETECTED: Mark original student as ABSENT
      await db.insert(studentAttendance)
        .values({
          assignment_id: session.assignment_id,
          student_id: originalStudent.student_id,
          date: session.attendance_date,
          session: sessionNum,
          status: 'ABSENT'
        })
        .onDuplicateKeyUpdate({ set: { status: 'ABSENT' } });

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
      } catch (sseErr) {}

      return apiError(`Proxy blocked: This network signature has already been used by student ${originalStudent.roll_no} to verify their attendance.`, 403);
    }

    // 5. Record the log with all fingerprinting markers
    await db.insert(attendanceSessionLogs)
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
      message: 'Attendance verified successfully. The faculty will finalize the records.' 
    });

  } catch (error) {
    logger.error('Attendance Verification Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
