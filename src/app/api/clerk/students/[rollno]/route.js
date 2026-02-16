import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req, context) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const params = await context.params;
    const { rollno } = params;
    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    const rows = await query(`
      SELECT s.*, CASE WHEN si.pfp IS NOT NULL THEN 1 ELSE 0 END as has_pfp 
      FROM students s 
      LEFT JOIN student_images si ON s.id = si.student_id 
      WHERE s.roll_no = ?`, [rollno]);

    if (!rows || rows.length === 0) {
      return apiError('Student not found', 404);
    }
    
    const student = rows[0];
    if (student.has_pfp) {
        student.pfp = `/api/student/image/${student.roll_no}`;
    } else {
        student.pfp = null;
    }
    delete student.has_pfp;

    return apiResponse({ student });
  } catch (err) {
    console.error('Fetch Student Error:', err);
    return apiError('Server error', 500, err.message);
  }
}

export async function PUT(req, context) {
  const user = await getAuthUser('clerk');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const params = await context.params;
    const { rollno } = params;
    const body = await req.json();
    const { name, gender, mobile, email, date_of_birth } = body;

    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    const checkRows = await query('SELECT roll_no FROM students WHERE roll_no = ?', [rollno]);
    if (checkRows.length === 0) {
      return apiError('Student not found', 404);
    }

    // Build dynamic update for only allowed students columns
    const updates = [];
    const paramsArr = [];
    if (typeof name !== 'undefined') { updates.push('name = ?'); paramsArr.push(name === '' ? null : name); }
    if (typeof gender !== 'undefined') { updates.push('gender = ?'); paramsArr.push(gender === '' ? null : gender); }
    if (typeof mobile !== 'undefined') { updates.push('mobile = ?'); paramsArr.push(mobile === '' ? null : mobile); }
    if (typeof email !== 'undefined') { updates.push('email = ?'); paramsArr.push(email === '' ? null : email); }
    if (typeof date_of_birth !== 'undefined') { updates.push('date_of_birth = ?'); paramsArr.push(date_of_birth === '' ? null : toMySQLDate(date_of_birth)); }

    if (updates.length === 0) {
      return apiError('No updatable fields provided', 400);
    }

    const sql = `UPDATE students SET ${updates.join(', ')} WHERE roll_no = ?`;
    const result = await query(sql, [...paramsArr, rollno]);

    if (result.affectedRows === 0) {
      return apiError('No changes made or update failed', 400);
    }

    return apiResponse({ success: true, message: 'Student details updated successfully' });
  } catch (err) {
    console.error('Update Student Error:', err);
    return apiError('Server error', 500, err.message);
  }
}
