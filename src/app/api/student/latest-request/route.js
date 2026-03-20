import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, students } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
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

    const rows = await db.select({
      request_id: studentRequests.request_id,
      certificate_type: studentRequests.certificate_type,
      status: studentRequests.status,
      reject_reason: studentRequests.reject_reason,
      created_at: studentRequests.created_at,
      updated_at: studentRequests.updated_at
    })
    .from(studentRequests)
    .innerJoin(students, eq(studentRequests.student_id, students.id))
    .where(eq(students.roll_no, rollno))
    .orderBy(desc(studentRequests.created_at))
    .limit(1);

    if (!rows || rows.length === 0) {
      return apiResponse({ success: true, latestRequest: null });
    }

    const r = rows[0];
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
    logger.error('Failed to fetch latest request', error);
    return apiError('Failed to fetch latest request', 500);
  }
}
