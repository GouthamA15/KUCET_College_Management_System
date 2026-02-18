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

    const requests = rows.map(row => ({
      id: row.id,
      status: row.status,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      new_signature: row.new_signature ? `data:image/png;base64,${row.new_signature.toString('base64')}` : null,
      new_pfp: row.new_pfp ? `data:image/png;base64,${row.new_pfp.toString('base64')}` : null
    }));

    return apiResponse({ data: requests });
  } catch (err) {
    console.error('Profile requests fetch error:', err);
    return apiError('Server error', 500, err.message);
  }
}
