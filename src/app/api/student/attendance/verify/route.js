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

    // --- PIN / TOKEN VALIDATION ---
    if (pin) {
      if (String(pin) !== String(session.session_pin)) {
        return apiError('Invalid PIN. Please enter the 4-digit code shown by the faculty.', 403);
      }
    } else if (token) {
      if (token !== session.session_token) {
        return apiError('Invalid verification token or QR code.', 403);
      }
    }

    // --- GPS ACCURACY CHECK ---
    if (accuracy !== undefined && accuracy === 0) {
      console.warn(`[Geo] Suspicious accuracy (0) from student ${user.roll_no}. Possible mock.`);
      return apiError('Location accuracy error. Please ensure GPS is enabled and not mocked.', 403);
    }

    if (accuracy !== undefined && accuracy > 100) {
      return apiError('Low location accuracy (>100m). Please move to a clearer area or disable WiFi for better GPS.', 403);
    }

    // 3. Strict Geofencing check (50 meters radius)
    if (session.latitude === null || session.longitude === null) {
      return apiError('Faculty location not recorded. Please ask faculty to restart the session with GPS enabled.', 403);
    }

    const allowedRadius = 50; 
    const distanceOk = isWithinRange(
      parseFloat(session.latitude), parseFloat(session.longitude),
      parseFloat(latitude), parseFloat(longitude),
      allowedRadius
    );

    if (!distanceOk) {
      return apiError(`Location mismatch. You must be within 50m of the classroom to mark attendance.`, 403);
    }

    // --- ACTION B: PERSISTENT DEVICE FINGERPRINTING & PROXY DETECTION ---
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    
    const uaHash = crypto.createHash('md5').update(userAgent).digest('hex');
    const finalDeviceId = device_id || crypto.createHash('sha256').update(userAgent + ipAddress).digest('hex');

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
