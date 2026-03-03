import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
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
    const { assignment_id, pin, token, latitude, longitude, accuracy, device_id } = body;

    if (!assignment_id || (!pin && !token) || latitude === undefined || longitude === undefined) {
      return apiError('Location and Verification Data (PIN/QR) are required.', 400);
    }

    const db = getDb();

    // 1. Fetch the active session
    let sessionQuery = `
      SELECT id, session_pin, session_token, latitude, longitude, accuracy as faculty_accuracy, expires_at 
      FROM attendance_sessions 
      WHERE assignment_id = ? AND is_active = 1 AND expires_at > NOW()
    `;
    const sessionParams = [assignment_id];

    const [sessions] = await db.execute(sessionQuery, sessionParams);

    if (sessions.length === 0) {
      return apiError('No active attendance session found or session expired.', 404);
    }

    const session = sessions[0];

    // --- ACTION C: GPS ACCURACY CHECK (SPOOF DETECTION) ---
    // Accuracy of 0 or 1 is often a sign of a mocked location app
    if (accuracy !== undefined && (accuracy <= 1 || accuracy === 0)) {
      return apiError('Mocked location detected. Please disable GPS spoofing apps.', 403);
    }

    // 3. Strict Geofencing check (50 meters radius)
    if (session.latitude === null || session.longitude === null) {
      return apiError('Faculty location not recorded. Please ask faculty to restart the session with GPS enabled.', 403);
    }

    // Strict 50m Rule
    const allowedRadius = 50; 

    const distanceOk = isWithinRange(
      parseFloat(session.latitude), parseFloat(session.longitude),
      parseFloat(latitude), parseFloat(longitude),
      allowedRadius
    );

    if (!distanceOk) {
      return apiError(`Location mismatch. You must be within 50m of the classroom to mark attendance.`, 403);
    }

    // --- ACTION B: PERSISTENT DEVICE FINGERPRINTING ---
    const finalDeviceId = device_id || crypto.createHash('sha256').update(request.headers.get('user-agent') + (request.headers.get('x-forwarded-for') || '127.0.0.1')).digest('hex');

    // Check if this specific device ID has already been used for this session
    const [deviceLogs] = await db.execute(
      'SELECT student_id FROM attendance_session_logs WHERE session_id = ? AND device_hash = ? AND status = "SUCCESS"',
      [session.id, finalDeviceId]
    );

    if (deviceLogs.length > 0 && deviceLogs[0].student_id !== user.student_id) {
      return apiError('Proxy blocked: This device has already been used to mark attendance for another student.', 403);
    }

    // 5. Record the log with the unique device ID
    await db.execute(
      'INSERT INTO attendance_session_logs (session_id, student_id, device_hash, status) VALUES (?, ?, ?, "SUCCESS") ON DUPLICATE KEY UPDATE status = "SUCCESS"',
      [session.id, user.student_id, finalDeviceId]
    );

    return apiResponse({ 
      success: true, 
      message: 'Attendance verified successfully. The faculty will finalize the records.' 
    });

  } catch (error) {
    console.error('Attendance Verification Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
