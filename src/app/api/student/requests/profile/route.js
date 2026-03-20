import logger from '@/lib/logger';
import { db } from '@/db';
import { studentProfileRequests } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const rows = await db.query.studentProfileRequests.findMany({
      where: eq(studentProfileRequests.student_id, user.student_id),
      orderBy: [desc(studentProfileRequests.created_at)]
    });

    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    const requests = rows.map(row => ({
      ...row,
      new_signature: imageHelper(row.new_signature),
      new_pfp: imageHelper(row.new_pfp)
    }));

    return apiResponse({ data: requests });
  } catch (err) {
    logger.error('Profile requests fetch error:', err);
    return apiError('Server error', 500, err.message);
  }
}
