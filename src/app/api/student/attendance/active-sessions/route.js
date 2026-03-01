import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

/**
 * GET /api/student/attendance/active-sessions?ids=1,2,3
 * Returns active attendance sessions for the provided assignment IDs
 */
export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return apiResponse({ data: [] });
    }

    const assignmentIds = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (assignmentIds.length === 0) {
      return apiResponse({ data: [] });
    }

    const db = getDb();
    // Fetch active sessions AND check if this specific student has already verified for them
    const [sessions] = await db.execute(
      `SELECT asess.assignment_id, fsa.subject_name, fsa.subject_code
       FROM attendance_sessions asess
       JOIN faculty_subject_assignments fsa ON asess.assignment_id = fsa.id
       LEFT JOIN attendance_session_logs asl ON asess.id = asl.session_id AND asl.student_id = ? AND asl.status = 'SUCCESS'
       WHERE asess.assignment_id IN (${assignmentIds.map(() => '?').join(',')}) 
       AND asess.is_active = 1 
       AND asess.expires_at > NOW()
       AND asl.id IS NULL`, // Only return sessions where no 'SUCCESS' log exists for this student
      [user.student_id, ...assignmentIds]
    );

    return apiResponse({ data: sessions });
  } catch (error) {
    console.error('Fetch Active Sessions Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
