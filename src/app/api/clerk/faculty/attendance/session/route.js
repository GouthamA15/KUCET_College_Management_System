import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

/**
 * GET /api/clerk/faculty/attendance/session?assignment_id=X
 * Check if there is an active session for the assignment
 */
export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');

    if (!assignment_id) {
      return apiError('Missing assignment_id', 400);
    }

    const db = getDb();
    const [sessions] = await db.execute(
      `SELECT id, session_pin, session_token, expires_at 
       FROM attendance_sessions 
       WHERE assignment_id = ? AND is_active = 1 AND expires_at > NOW()`,
      [assignment_id]
    );

    if (sessions.length === 0) {
      return apiResponse({ active: false });
    }

    return apiResponse({ active: true, session: sessions[0] });
  } catch (error) {
    console.error('Fetch Session Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

/**
 * POST /api/clerk/faculty/attendance/session
 * Create a new attendance session
 */
export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { assignment_id, latitude, longitude, accuracy, attendance_date } = body;

    if (!assignment_id || !attendance_date) {
      return apiError('Missing assignment_id or attendance_date', 400);
    }

    const db = getDb();

    // 1. Verify assignment belongs to faculty
    const [assignments] = await db.execute(
      'SELECT id FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
      [assignment_id, user.id]
    );

    if (assignments.length === 0) {
      return apiError('Assignment not found or unauthorized', 404);
    }

    // 2. Deactivate any existing sessions for this assignment
    await db.execute(
      'UPDATE attendance_sessions SET is_active = 0 WHERE assignment_id = ?',
      [assignment_id]
    );

    // 3. Generate PIN and Token
    const sessionPin = crypto.randomInt(1000, 9999).toString();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Session valid for 10 minutes by default
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 
    const expiresAtSql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    // 4. Create new session
    // Check if columns exist for backwards compatibility
    const [colInfo] = await db.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_sessions'`
    );
    const columns = colInfo.map(c => c.COLUMN_NAME);
    const hasAttendanceDate = columns.includes('attendance_date');
    const hasAccuracy = columns.includes('accuracy');

    let result;
    if (hasAttendanceDate && hasAccuracy) {
      [result] = await db.execute(
        `INSERT INTO attendance_sessions 
         (assignment_id, attendance_date, faculty_id, session_pin, session_token, latitude, longitude, accuracy, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [assignment_id, attendance_date, user.id, sessionPin, sessionToken, latitude ?? null, longitude ?? null, accuracy ?? null, expiresAtSql]
      );
    } else if (hasAttendanceDate) {
      [result] = await db.execute(
        `INSERT INTO attendance_sessions 
         (assignment_id, attendance_date, faculty_id, session_pin, session_token, latitude, longitude, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [assignment_id, attendance_date, user.id, sessionPin, sessionToken, latitude ?? null, longitude ?? null, expiresAtSql]
      );
    } else {
      [result] = await db.execute(
        `INSERT INTO attendance_sessions 
         (assignment_id, faculty_id, session_pin, session_token, latitude, longitude, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [assignment_id, user.id, sessionPin, sessionToken, latitude ?? null, longitude ?? null, expiresAtSql]
      );
    }

    return apiResponse({
      message: 'Session created successfully',
      session: {
        id: result.insertId,
        session_pin: sessionPin,
        session_token: sessionToken,
        expires_at: expiresAtSql
      }
    });
  } catch (error) {
    console.error('Create Session Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

/**
 * DELETE /api/clerk/faculty/attendance/session
 * Manually end a session
 */
export async function DELETE(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');

    if (!assignment_id) {
      return apiError('Missing assignment_id', 400);
    }

    const db = getDb();
    await db.execute(
      'UPDATE attendance_sessions SET is_active = 0 WHERE assignment_id = ? AND faculty_id = ? AND is_active = 1',
      [assignment_id, user.id]
    );

    return apiResponse({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('End Session Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
