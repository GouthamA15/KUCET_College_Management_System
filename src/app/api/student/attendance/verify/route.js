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
    const { assignment_id, session_id, pin, token, latitude, longitude, accuracy, device_id } = body;

    if ((!assignment_id && !session_id) || (!pin && !token) || latitude === undefined || longitude === undefined) {
      return apiError('Location and Verification Data (PIN/QR) are required.', 400);
    }

    const db = getDb();

    // 1. Fetch the active session
    // We prioritize session_id if provided for ambiguity resolution in shared subjects
    let sessionQuery = `
      SELECT id, assignment_id, session_pin, session_token, latitude, longitude, expires_at 
      FROM attendance_sessions 
      WHERE ${session_id ? 'id = ?' : 'assignment_id = ?'} 
      AND is_active = 1 AND expires_at > NOW()
    `;
    const sessionParams = [session_id || assignment_id];

    const [sessions] = await db.execute(sessionQuery, sessionParams);

    if (sessions.length === 0) {
      return apiError('No active attendance session found or session expired.', 404);
    }

    const session = sessions[0];

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

    // --- ACTION B: PERSISTENT DEVICE FINGERPRINTING & PROXY DETECTION ---
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    
    // Create a server-side fingerprint (IP + UserAgent) to catch Incognito/Browser switching
    const uaHash = crypto.createHash('md5').update(userAgent).digest('hex');
    const finalDeviceId = device_id || crypto.createHash('sha256').update(userAgent + ipAddress).digest('hex');

    // 1. Check if this specific client-side Device ID has already been used for this session
    const [idLogs] = await db.execute(
      'SELECT student_id FROM attendance_session_logs WHERE session_id = ? AND device_hash = ? AND status = "SUCCESS"',
      [session.id, finalDeviceId]
    );

    if (idLogs.length > 0 && idLogs[0].student_id !== user.student_id) {
      return apiError('Proxy blocked: This device (UUID) has already been used for another student in this session.', 403);
    }

    // 2. Check if this specific IP + User-Agent combination has already been used
    // This catches students using different browsers or Incognito on the SAME physical device
    const [proxyLogs] = await db.execute(
      'SELECT student_id FROM attendance_session_logs WHERE session_id = ? AND ip_address = ? AND ua_hash = ? AND status = "SUCCESS"',
      [session.id, ipAddress, uaHash]
    );

    if (proxyLogs.length > 0 && proxyLogs[0].student_id !== user.student_id) {
      return apiError('Proxy blocked: Another student has already verified from this device/network signature in this session.', 403);
    }

    // 5. Record the log with all fingerprinting markers
    await db.execute(
      'INSERT INTO attendance_session_logs (session_id, student_id, device_hash, ip_address, ua_hash, status) VALUES (?, ?, ?, ?, ?, "SUCCESS") ON DUPLICATE KEY UPDATE status = "SUCCESS", device_hash = VALUES(device_hash), ip_address = VALUES(ip_address), ua_hash = VALUES(ua_hash)',
      [session.id, user.student_id, finalDeviceId, ipAddress, uaHash]
    );

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
    console.error('Attendance Verification Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
