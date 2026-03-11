import { query, getDb } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function POST(req, context) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden', 403);
  }

  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const params = await context.params;
    const { id } = params;
    const { roll_no } = await req.json();

    if (!roll_no) {
      await connection.rollback();
      return apiError('Roll number is required', 400);
    }

    // 1. Fetch the full draft data
    const [draftRows] = await connection.execute('SELECT * FROM student_admission_drafts WHERE id = ? FOR UPDATE', [id]);
    if (!draftRows || draftRows.length === 0) {
      await connection.rollback();
      return apiError('Draft not found', 404);
    }
    const draft = draftRows[0];
    if (draft.status !== 'PROCESSED') {
      await connection.rollback();
      return apiError('Only verified drafts can be finalized', 400);
    }

    // 2. Check if roll_no or email already exists in students table
    const [existing] = await connection.execute('SELECT id FROM students WHERE roll_no = ? OR email = ?', [roll_no, draft.email]);
    if (existing.length > 0) {
      await connection.rollback();
      return apiError('A student with this Roll No or Email already exists.', 409);
    }

    // 3. Insert into students table
    const [studentResult] = await connection.execute(
      `INSERT INTO students (
        admission_no, roll_no, name, date_of_birth, gender, mobile, email, added_by_clerk_id, fee_reimbursement, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [null, roll_no, draft.name, draft.dob, draft.gender, draft.student_mobile, draft.email, user.clerkId, draft.fee_reimbursement]
    );

    const studentId = studentResult.insertId;

    // 4. Insert into personal details
    await connection.execute(
      `INSERT INTO student_personal_details (
        student_id, father_name, mother_name, nationality, religion, category, sub_caste, area_status, mother_tongue, 
        place_of_birth, father_occupation, annual_income, guardian_mobile, aadhaar_no, address, identification_marks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId, draft.father_name, draft.mother_name, draft.nationality, draft.religion, draft.category, 
        draft.sub_caste, draft.area_status, draft.mother_tongue, draft.place_of_birth, draft.father_occupation, 
        draft.annual_income, draft.guardian_mobile, draft.aadhaar_no, draft.permanent_address, 
        `${draft.identification_mark_1 || ''}\n${draft.identification_mark_2 || ''}`.trim()
      ]
    );

    // 5. Insert into academic background
    await connection.execute(
      `INSERT INTO student_academic_background (
        student_id, qualifying_exam, ssc_marks, inter_marks, ranks
      ) VALUES (?, ?, ?, ?, ?)`,
      [studentId, draft.entrance_exam, draft.ssc_marks, draft.inter_diploma_marks, draft.exam_rank]
    );

    // 6. Insert Images if they exist
    if (draft.pfp) {
      await connection.execute('INSERT INTO student_images (student_id, pfp) VALUES (?, ?)', [studentId, draft.pfp]);
    }
    if (draft.signature) {
      await connection.execute('INSERT INTO student_signatures (student_id, signature) VALUES (?, ?)', [studentId, draft.signature]);
    }

    // 7. Mark draft as FINALIZED
    await connection.execute('UPDATE student_admission_drafts SET status = "FINALIZED" WHERE id = ?', [id]);

    await connection.commit();
    return apiResponse({ success: true, studentId, message: 'Student successfully admitted and record created.' });

  } catch (error) {
    await connection.rollback();
    console.error('Finalization error:', error);
    return apiError('Failed to finalize admission.', 500);
  } finally {
    connection.release();
  }
}
