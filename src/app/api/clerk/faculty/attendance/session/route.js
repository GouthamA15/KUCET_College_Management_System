import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  attendanceSessions, 
  facultySubjectAssignments,
  facultySubstitutions
} from '@/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
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
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;

    if (!assignment_id) {
      return apiError('Missing assignment_id', 400);
    }

    const sessions = await db.select({
      id: attendanceSessions.id,
      session_pin: attendanceSessions.session_pin,
      session_token: attendanceSessions.session_token,
      expires_at: attendanceSessions.expires_at,
      session_number: attendanceSessions.session_number,
      faculty_id: attendanceSessions.faculty_id
    })
    .from(attendanceSessions)
    .where(and(
      eq(attendanceSessions.assignment_id, assignment_id),
      eq(attendanceSessions.is_active, true),
      gt(attendanceSessions.expires_at, sql`NOW()`)
    ))
    .limit(1);

    if (sessions.length === 0) {
      return apiResponse({ active: false });
    }

    // A session is active, check if the current user is the one who started it OR is authorized
    return apiResponse({ active: true, session: sessions[0] });
  } catch (error) {
    logger.error('Fetch Session Error:', error);
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

    // 1. Verify assignment existence and get details
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      branch: facultySubjectAssignments.branch,
      subject_code: facultySubjectAssignments.subject_code,
      faculty_id: facultySubjectAssignments.faculty_id
    })
    .from(facultySubjectAssignments)
    .where(eq(facultySubjectAssignments.id, assignment_id))
    .limit(1);

    if (assignments.length === 0) {
      return apiError('Assignment not found', 404);
    }

    const targetAssignment = assignments[0];

    // 2. Authorization logic (Primary Faculty, HOD, or Substitute)
    let isAuthorized = false;
    let authType = 'PRIMARY';

    if (targetAssignment.faculty_id === user.id) {
      isAuthorized = true;
    } else if (user.is_hod && user.branch === targetAssignment.branch) {
      isAuthorized = true;
      authType = 'HOD_OVERRIDE';
    } else {
      // Check for active substitution on this date
      const substitution = await db.select()
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, assignment_id),
          eq(facultySubstitutions.substitute_faculty_id, user.id),
          eq(facultySubstitutions.substitution_date, attendance_date)
        ))
        .limit(1);
      
      if (substitution.length > 0) {
        isAuthorized = true;
        authType = 'SUBSTITUTE';
      }
    }

    if (!isAuthorized) {
      return apiError('You are not authorized to start a session for this assignment (Not primary, HOD, or substitute)', 403);
    }

    // 3. Deactivate any existing sessions for this assignment
    await db.update(attendanceSessions)
      .set({ is_active: false })
      .where(eq(attendanceSessions.assignment_id, assignment_id));

    // 4. Generate PIN and Token
    const sessionPin = crypto.randomInt(1000, 9999).toString();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Session valid for 10 minutes by default
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 

    // 5. Create new session
    const [result] = await db.insert(attendanceSessions).values({
      assignment_id: assignment_id,
      faculty_id: user.id,
      session_pin: sessionPin,
      session_token: sessionToken,
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      accuracy: accuracy ? parseFloat(accuracy) : null,
      attendance_date: attendance_date,
      session_number: session_number || 1,
      expires_at: expiresAt,
      is_active: true
    });

    // --- REAL-TIME: Notify Students/HOD ---
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('SESSION_STARTED', { 
        assignment_id, 
        faculty_id: user.id, 
        branch: targetAssignment.branch,
        subject_code: targetAssignment.subject_code,
        sessionId: result.insertId,
        session_number: session_number || 1,
        auth_type: authType
      });
    } catch (sseErr) {
      console.warn('[SSE] Broadcast failed:', sseErr);
    }

    return apiResponse({
      message: `Session created successfully (${authType})`,
      session: {
        id: result.insertId,
        session_pin: sessionPin,
        session_token: sessionToken,
        expires_at: expiresAt,
        session_number: session_number || 1
      }
    });
  } catch (error) {
    logger.error('Create Session Error:', error);
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
    const assignment_id = searchParams.get('assignment_id') ? parseInt(searchParams.get('assignment_id')) : null;

    if (!assignment_id) {
      return apiError('Missing assignment_id', 400);
    }

    await db.update(attendanceSessions)
      .set({ is_active: false })
      .where(and(
        eq(attendanceSessions.assignment_id, assignment_id),
        eq(attendanceSessions.faculty_id, user.id),
        eq(attendanceSessions.is_active, true)
      ));

    // --- REAL-TIME: Notify Students/HOD ---
    try {
      const asgnRows = await db.select({ branch: facultySubjectAssignments.branch })
        .from(facultySubjectAssignments)
        .where(eq(facultySubjectAssignments.id, assignment_id))
        .limit(1);
        
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('SESSION_ENDED', { 
        assignment_id, 
        faculty_id: user.id, 
        branch: asgnRows[0]?.branch || user.branch 
      });
    } catch (sseErr) {
      console.warn('[SSE] Broadcast failed:', sseErr);
    }

    return apiResponse({ message: 'Session ended successfully' });
  } catch (error) {
    logger.error('End Session Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
