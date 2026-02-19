import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden: Only admission clerks can view drafts.', 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const status = searchParams.get('status') || 'DRAFT';

    let sql = `
      SELECT id, name, father_name, exam_rank, entrance_exam, branch, created_at 
      FROM student_admission_drafts
      WHERE status = ?
    `;
    const params = [status];

    if (branch) {
      sql += " AND branch = ?";
      params.push(branch);
    }

    sql += " ORDER BY name ASC";
    
    const drafts = await query(sql, params);
    
    return apiResponse({ data: drafts });

  } catch (error) {
    console.error('Error fetching admission drafts:', error);
    return apiError('Failed to fetch admission drafts.', 500);
  }
}
