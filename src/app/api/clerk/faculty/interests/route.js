import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const db = getDb();
    const [interests] = await db.execute(
      'SELECT * FROM faculty_subject_interests WHERE faculty_id = ? ORDER BY created_at DESC',
      [user.id]
    );

    return apiResponse({ data: interests });
  } catch (error) {
    console.error('Interests Fetch Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty') {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { subject_code, subject_name, branch, semester, academic_year } = body;

    if (!subject_code || !subject_name || !branch || !semester || !academic_year) {
      return apiError('Missing required fields', 400);
    }

    const db = getDb();
    // Check if already exists
    const [existing] = await db.execute(
      'SELECT id FROM faculty_subject_interests WHERE faculty_id = ? AND subject_code = ? AND branch = ? AND semester = ? AND academic_year = ?',
      [user.id, subject_code, branch, semester, academic_year]
    );

    if (existing.length > 0) {
      return apiError('Interest already submitted for this subject', 400);
    }

    await db.execute(
      'INSERT INTO faculty_subject_interests (faculty_id, subject_code, subject_name, branch, semester, academic_year) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, subject_code, subject_name, branch, semester, academic_year]
    );

    return apiResponse({ message: 'Interest submitted successfully' });
  } catch (error) {
    console.error('Interest Submit Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
