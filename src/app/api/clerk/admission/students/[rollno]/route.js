import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { COLLEGE_CONFIG } from '@/lib/college-config';

// Helper function to handle undefined/empty values and convert them to null
const toNull = (value) => (value === undefined || value === '' ? null : value);

export async function PUT(req, context) {
  const user = await getAuthUser('clerk');

  if (!user || user.role !== 'admission') {
    return apiError('Forbidden: Only admission clerks can update student details', 403);
  }

  // Ensure clerk id is present in token and use it for audit fields
  const clerkId = user?.clerkId || null;
  if (!clerkId) {
    return apiError('Unauthorized: clerk id missing in token', 401);
  }

  try {
    const params = await context.params;
    const { rollno } = params;

    if (!rollno) {
      return apiError('Missing rollno parameter', 400);
    }

    const updatedData = await req.json();
    // Prevent changing clerk tracking from frontend
    if (updatedData.added_by_clerk_id !== undefined) {
      delete updatedData.added_by_clerk_id;
    }
    // Validate blood_group and fee_reimbursement early if provided
    if (updatedData.blood_group !== undefined) {
      const bg = updatedData.blood_group == null ? null : String(updatedData.blood_group).trim();
      const validBloodGroups = COLLEGE_CONFIG.bloodGroups;
      if (bg && !validBloodGroups.includes(bg)) {
        return apiError('Invalid blood group value', 400);
      }
    }
    if (updatedData.fee_reimbursement !== undefined) {
      const fr = updatedData.fee_reimbursement == null ? null : String(updatedData.fee_reimbursement).trim().toUpperCase();
      const validFeeReimbursement = ['YES', 'NO', 'GOV'];
      if (fr && !validFeeReimbursement.includes(fr)) {
        return apiError('Invalid fee_reimbursement value', 400);
      }
    }

    // Find student ID
    const [student] = await query('SELECT id FROM students WHERE roll_no = ?', [rollno]);
    if (!student) {
      return apiError('Student not found', 404);
    }
    const studentId = student.id;

    // --- Update `students` table ---
    const studentUpdateFields = [];
    const studentUpdateValues = [];

    if (updatedData.name !== undefined) { studentUpdateFields.push('name = ?'); studentUpdateValues.push(toNull(updatedData.name)); }
    if (updatedData.admission_no !== undefined) { studentUpdateFields.push('admission_no = ?'); studentUpdateValues.push(toNull(updatedData.admission_no)); }
    if (updatedData.fee_reimbursement !== undefined) { studentUpdateFields.push('fee_reimbursement = ?'); studentUpdateValues.push(toNull(String(updatedData.fee_reimbursement).trim().toUpperCase())); }
    if (updatedData.date_of_birth !== undefined) { studentUpdateFields.push('date_of_birth = ?'); studentUpdateValues.push(toMySQLDate(updatedData.date_of_birth)); }
    if (updatedData.gender !== undefined) { studentUpdateFields.push('gender = ?'); studentUpdateValues.push(toNull(updatedData.gender)); }
    if (updatedData.mobile !== undefined) { studentUpdateFields.push('mobile = ?'); studentUpdateValues.push(toNull(updatedData.mobile)); }
    if (updatedData.email !== undefined) { studentUpdateFields.push('email = ?'); studentUpdateValues.push(toNull(updatedData.email)); }
    // Note: roll_no is typically not updated directly after admission, and it's used as the identifier here.

    if (studentUpdateFields.length > 0) {
      // add audit columns for update
      studentUpdateFields.push('updated_at = NOW()', 'updated_by_clerk_id = ?');
      studentUpdateValues.push(clerkId);
      await query(`UPDATE students SET ${studentUpdateFields.join(', ')} WHERE id = ?`, [...studentUpdateValues, studentId]);
    }

    // --- Update `student_personal_details` table ---
    const personalUpdateFields = [];
    const personalUpdateValues = [];
    const personalInsertValues = [];
    const personalColumns = ['father_name', 'mother_name', 'nationality', 'religion', 'category', 'sub_caste', 'area_status', 'mother_tongue', 'place_of_birth', 'father_occupation', 'annual_income', 'guardian_mobile', 'aadhaar_no', 'address', 'seat_allotted_category', 'identification_marks', 'blood_group'];

    let hasPersonalUpdates = false;
    // Validate and prepare personal columns. blood_group must be one of allowed values when provided.
    personalColumns.forEach(col => {
      if (updatedData[col] !== undefined) {
        if (col === 'aadhaar_no' && updatedData[col] !== null) {
          // Sanitize aadhaar_no: remove all non-digits before storing
          personalUpdateFields.push(`${col} = ?`);
          personalUpdateValues.push(toNull(String(updatedData[col]).replace(/\D/g, '')));
        } else if (col === 'blood_group') {
          const bg = updatedData[col] == null ? null : String(updatedData[col]).trim();
          personalUpdateFields.push(`${col} = ?`);
          personalUpdateValues.push(toNull(bg));
        } else {
          personalUpdateFields.push(`${col} = ?`);
          personalUpdateValues.push(toNull(updatedData[col]));
        }
        hasPersonalUpdates = true;
      }
    });

    if (hasPersonalUpdates) {
        const [existingPersonal] = await query('SELECT id FROM student_personal_details WHERE student_id = ?', [studentId]);
        if (existingPersonal) {
             await query(`UPDATE student_personal_details SET ${personalUpdateFields.join(', ')} WHERE student_id = ?`, [...personalUpdateValues, studentId]);
        } else {
            // If no personal details exist, insert them
            const insertCols = ['student_id'];
            const insertVals = [studentId];
            personalColumns.forEach(col => {
                if (updatedData[col] !== undefined) { // Only include columns present in updatedData
                    insertCols.push(col);
                    if (col === 'aadhaar_no' && updatedData[col] !== null) {
                        insertVals.push(toNull(String(updatedData[col]).replace(/\D/g, '')));
                    } else {
                        insertVals.push(toNull(updatedData[col]));
                    }
                }
            });
            if (insertCols.length > 1) { // More than just student_id
                await query(`INSERT INTO student_personal_details (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`, insertVals);
            }
        }
    }

    // --- Update `student_academic_background` table ---
    const academicUpdateFields = [];
    const academicUpdateValues = [];
    const academicColumns = ['qualifying_exam', 'previous_college_details', 'medium_of_instruction', 'ranks', 'ssc_marks', 'inter_marks'];

    let hasAcademicUpdates = false;
    academicColumns.forEach(col => {
        if (updatedData[col] !== undefined) {
            academicUpdateFields.push(`${col} = ?`);
            academicUpdateValues.push(toNull(updatedData[col]));
            hasAcademicUpdates = true;
        }
    });

    if (hasAcademicUpdates) {
        const [existingAcademic] = await query('SELECT id FROM student_academic_background WHERE student_id = ?', [studentId]);
        if (existingAcademic) {
            await query(`UPDATE student_academic_background SET ${academicUpdateFields.join(', ')} WHERE student_id = ?`, [...academicUpdateValues, studentId]);
        } else {
            const insertCols = ['student_id'];
            const insertVals = [studentId];
            academicColumns.forEach(col => {
                if (updatedData[col] !== undefined) {
                    insertCols.push(col);
                    insertVals.push(toNull(updatedData[col]));
                }
            });
            if (insertCols.length > 1) {
                await query(`INSERT INTO student_academic_background (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`, insertVals);
            }
        }
    }

    // --- Update `student_images` and `student_signatures` if provided ---
    if (updatedData.pfp && typeof updatedData.pfp === 'string' && updatedData.pfp.includes(',')) {
        const pfpBuffer = Buffer.from(updatedData.pfp.split(',')[1], 'base64');
        await query('INSERT INTO student_images (student_id, pfp) VALUES (?, ?) ON DUPLICATE KEY UPDATE pfp = ?', [studentId, pfpBuffer, pfpBuffer]);
    }
    if (updatedData.signature && typeof updatedData.signature === 'string' && updatedData.signature.includes(',')) {
        const sigBuffer = Buffer.from(updatedData.signature.split(',')[1], 'base64');
        await query('INSERT INTO student_signatures (student_id, signature) VALUES (?, ?) ON DUPLICATE KEY UPDATE signature = ?', [studentId, sigBuffer, sigBuffer]);
    }

    // If personal/academic updates were applied but students table was not modified above,
    // set the updated_at and updated_by_clerk_id audit fields on students table.
    if ((hasPersonalUpdates || hasAcademicUpdates) && studentUpdateFields.length === 0) {
      await query('UPDATE students SET updated_at = NOW(), updated_by_clerk_id = ? WHERE id = ?', [clerkId, studentId]);
    }


    return apiResponse({ success: true, message: 'Student details updated successfully' });
  } catch (error) {
    console.error('Error updating student details:', error);
    return apiError('Failed to update student details', 500, error.message);
  }
}
