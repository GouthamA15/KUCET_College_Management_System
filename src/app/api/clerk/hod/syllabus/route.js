import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester');

    // Fetch subjects for the branch
    let sql = `
      SELECT s.*, ss.semester, ss.is_group, ss.parent_group_code
      FROM syllabus_subjects s
      JOIN syllabus_structure ss ON s.subject_code = ss.subject_code
      WHERE ss.branch = ?
    `;
    const params = [user.branch];

    if (semester) {
      sql += ' AND ss.semester = ?';
      params.push(semester);
    }

    const subjects = await query(sql, params);

    // Fetch all units for these subjects
    const subjectCodes = subjects.map(s => s.subject_code);
    let units = [];
    if (subjectCodes.length > 0) {
      units = await query(
        `SELECT * FROM syllabus_units WHERE subject_code IN (${subjectCodes.map(() => '?').join(',')}) ORDER BY subject_code, unit_order`,
        subjectCodes
      );
    }

    // Combine data
    const data = subjects.map(s => ({
      ...s,
      units: units.filter(u => u.subject_code === s.subject_code)
    }));

    return apiResponse({ data });
  } catch (error) {
    console.error('HOD Syllabus GET Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'faculty' || !user.is_hod) {
      return apiError('Unauthorized', 401);
    }

    const body = await req.json();
    const { action, subject, unit } = body;

    if (action === 'ADD_SUBJECT') {
      const { subject_code, subject_name, subject_type, semester } = subject;
      
      // 1. Insert/Update into syllabus_subjects
      await query(
        'INSERT INTO syllabus_subjects (subject_code, subject_name, subject_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE subject_name = VALUES(subject_name), subject_type = VALUES(subject_type)',
        [subject_code, subject_name, subject_type]
      );

      // 2. Map to branch structure
      await query(
        'INSERT INTO syllabus_structure (branch, semester, subject_code) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE semester = VALUES(semester)',
        [user.branch, semester, subject_code]
      );

      return apiResponse({ success: true, message: 'Subject added/updated successfully' });
    }

    if (action === 'DELETE_SUBJECT') {
      const { subject_code } = subject;
      // Only remove mapping for THIS branch
      await query(
        'DELETE FROM syllabus_structure WHERE branch = ? AND subject_code = ?',
        [user.branch, subject_code]
      );
      return apiResponse({ success: true, message: 'Subject mapping removed' });
    }

    if (action === 'SAVE_UNIT') {
      const { subject_code, unit_order, unit_name, topics } = unit;
      await query(
        `INSERT INTO syllabus_units (subject_code, unit_order, unit_name, topics) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE unit_name = VALUES(unit_name), topics = VALUES(topics)`,
        [subject_code, unit_order, unit_name, JSON.stringify(topics)]
      );
      return apiResponse({ success: true, message: 'Unit saved' });
    }

    if (action === 'DELETE_UNIT') {
        const { id } = unit;
        await query('DELETE FROM syllabus_units WHERE id = ?', [id]);
        return apiResponse({ success: true, message: 'Unit deleted' });
    }

    return apiError('Invalid action', 400);
  } catch (error) {
    console.error('HOD Syllabus POST Error:', error);
    return apiError('Internal Server Error', 500);
  }
}
