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
    
    // Check if session_number column exists
    const [colInfo] = await db.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_sessions'`
    );
    const columns = colInfo.map(c => c.COLUMN_NAME);
    const hasSessionNumber = columns.includes('session_number');

    const [sessions] = await db.execute(
      `SELECT id, session_pin, session_token, expires_at ${hasSessionNumber ? ', session_number' : ''}
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
    const { assignment_id, latitude, longitude, accuracy, attendance_date, session_number } = body;

    if (!assignment_id || !attendance_date) {
      return apiError('Missing assignment_id or attendance_date', 400);
    }

    const db = getDb();

    // 1. Verify assignment belongs to faculty
    const [assignments] = await db.execute(
      'SELECT id, branch, subject_code FROM faculty_subject_assignments WHERE id = ? AND faculty_id = ?',
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
    const hasSessionNumber = columns.includes('session_number');

    let result;
    const insertCols = ['assignment_id', 'faculty_id', 'session_pin', 'session_token', 'latitude', 'longitude', 'expires_at'];
    const insertVals = [assignment_id, user.id, sessionPin, sessionToken, latitude ?? null, longitude ?? null, expiresAtSql];
    
    if (hasAttendanceDate) {
      insertCols.push('attendance_date');
      insertVals.push(attendance_date);
    }
    if (hasAccuracy) {
      insertCols.push('accuracy');
      insertVals.push(accuracy ?? null);
    }
    if (hasSessionNumber) {
      insertCols.push('session_number');
      insertVals.push(session_number || 1);
    }

    const sql = `INSERT INTO attendance_sessions (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`;
    [result] = await db.execute(sql, insertVals);

    // --- REAL-TIME: Notify Students/HOD ---
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('SESSION_STARTED', { 
        assignment_id, 
        faculty_id: user.id, 
        branch: assignments[0].branch,
        subject_code: assignments[0].subject_code,
        sessionId: result.insertId,
        session_number: session_number || 1
      });
    } catch (sseErr) {
      console.warn('[SSE] Broadcast failed:', sseErr);
    }

    return apiResponse({
      message: 'Session created successfully',
      session: {
        id: result.insertId,
        session_pin: sessionPin,
        session_token: sessionToken,
        expires_at: expiresAtSql,
        session_number: session_number || 1
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

    // --- REAL-TIME: Notify Students/HOD ---
    try {
      const [asgn] = await db.execute('SELECT branch FROM faculty_subject_assignments WHERE id = ?', [assignment_id]);
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('SESSION_ENDED', { 
        assignment_id, 
        faculty_id: user.id, 
        branch: asgn[0]?.branch || user.branch 
      });
    } catch (sseErr) {
      console.warn('[SSE] Broadcast failed:', sseErr);
    }

    return apiResponse({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('End Session Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
