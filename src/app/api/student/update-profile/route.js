import { query, getDb } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function POST(req) {
  const user = await getAuthUser('student');

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const body = await req.json();
    const { rollno } = body; 

    if (!rollno) {
      return apiError('Missing rollno', 400);
    }

    const db = getDb();

    // Update mobile in students table if provided
    if (body.phone) {
      const [result] = await db.execute('UPDATE students SET mobile = ? WHERE roll_no = ?', [body.phone, rollno]);
      if (result.affectedRows === 0) {
        // This could just mean the value is the same, so not necessarily an error.
        // We can log this or decide to send a specific message.
        console.log(`No mobile number updated for rollno: ${rollno}. Student not found or data is the same.`);
      }
    }
    
    // Now, handle personal details
    const studentRows = await query('SELECT id FROM students WHERE roll_no = ?', [rollno]);
    if (!studentRows || studentRows.length === 0) {
      return apiError('Student not found', 404);
    }
    const student_id = studentRows[0].id;

    // Allowed fields for personal details
    const fields = [
      'father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','annual_income','aadhaar_no','address','seat_allotted_category','identification_marks'
    ];

    // Filter provided fields to only what's allowed
    const providedFields = fields.filter(f => body.hasOwnProperty(f));
    if (providedFields.length > 0) {
        const values = providedFields.map(f => body[f] || null);

        // Check if personal details record exists
        const exist = await query('SELECT id FROM student_personal_details WHERE student_id = ?', [student_id]);

        if (exist && exist.length > 0) {
            // Update existing record
            const setClause = providedFields.map(f => `${f} = ?`).join(', ');
            const params = [...values, student_id];
            await query(`UPDATE student_personal_details SET ${setClause} WHERE student_id = ?`, params);
        } else {
            // Insert new record
            const placeholders = providedFields.map(() => '?').join(', ');
            const sql = `INSERT INTO student_personal_details (student_id, ${providedFields.join(',')}) VALUES (?, ${placeholders})`;
            await query(sql, [student_id, ...values]);
        }
    }


    return apiResponse({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    return apiError('Server error', 500, err.message);
  }
}