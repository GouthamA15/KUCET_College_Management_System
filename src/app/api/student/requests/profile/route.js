import { getDb } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const db = getDb();
    
    // Fetch all profile/signature requests for the student
    const [rows] = await db.execute(
      'SELECT id, status, rejection_reason, new_signature, new_pfp, created_at, updated_at ' +
      'FROM student_profile_requests WHERE student_id = ? ORDER BY created_at DESC',
      [user.student_id]
    );

    const requests = rows.map(row => {
      const helper = (val) => {
        if (!val) return null;
        if (typeof val === 'string' && val.startsWith('http')) return val;
        return `data:image/png;base64,${val.toString('base64')}`;
      };

      return {
        id: row.id,
        status: row.status,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
        new_signature: helper(row.new_signature),
        new_pfp: helper(row.new_pfp)
      };
    });

    return apiResponse({ data: requests });
  } catch (err) {
    console.error('Profile requests fetch error:', err);
    return apiError('Server error', 500, err.message);
  }
}
