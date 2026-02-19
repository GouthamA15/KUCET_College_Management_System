import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const url = new URL(request.url);
    const rollno = url.searchParams.get('rollno');
    if (!rollno) {
      return apiError('Roll number required', 400);
    }

    if (user.roll_no !== rollno) {
        return apiError('Forbidden: You can only view your own requests.', 403);
    }

      const sql = `SELECT sr.request_id, sr.certificate_type, sr.status, sr.reject_reason, sr.created_at
                   FROM student_requests sr
                   JOIN students s ON sr.student_id = s.id
                   WHERE s.roll_no = ?
                   ORDER BY sr.created_at DESC
                   LIMIT 1`;

    const rows = await query(sql, [rollno]);
    if (!rows || rows.length === 0) {
      return apiResponse({ success: true, latestRequest: null });
    }

    const r = rows[0];
    // Normalize status to exact expected values (map uppercase DB values to Title Case)
    const normalized = (r.status || '').toString().toLowerCase();
    const status = normalized === 'approved' ? 'Approved' :
                   normalized === 'rejected' ? 'Rejected' :
                   'Pending';

    const latestRequest = {
      request_id: r.request_id,
      certificate_type: r.certificate_type,
      status,
      reject_reason: r.reject_reason || null,
      created_at: r.created_at,
      updated_at: r.updated_at || null,
    };

    return apiResponse({ success: true, latestRequest });
  } catch (error) {
    console.error('Failed to fetch latest request', error);
    return apiError('Failed to fetch latest request', 500);
  }
}
