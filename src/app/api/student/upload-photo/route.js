import { getDb } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  const user = await getAuthUser('student');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const body = await req.json();
    const { roll_no, pfp } = body;

    if (!roll_no) {
      return apiError('Missing roll_no', 400);
    }

    // Optional: Validate file size and type if needed (though frontend already does)
    // For now, assuming frontend validation is sufficient

    const db = getDb();
    let pfpValue = null;
    if (pfp) {
      pfpValue = Buffer.from(pfp.split(',')[1], 'base64'); // Remove data URL prefix if present
    }

    // Get student ID first
    const [rows] = await db.execute('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
    if (rows.length === 0) {
      return apiError('Student not found', 404);
    }
    const studentId = rows[0].id;

    if (pfpValue) {
      // Insert or Update image
      await db.execute(
        'INSERT INTO student_images (student_id, pfp) VALUES (?, ?) ON DUPLICATE KEY UPDATE pfp = VALUES(pfp)',
        [studentId, pfpValue]
      );
    } else {
      // Delete image if pfp is null (removed)
      await db.execute('DELETE FROM student_images WHERE student_id = ?', [studentId]);
    }

    return apiResponse({ success: true });
  } catch (err) {
    console.error("Photo upload error:", err);
    return apiError('Server error', 500, err.message);
  }
}
