import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Helper function to verify JWT using jose (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

// Helper function to handle undefined/empty values and convert them to null
const toNull = (value) => (value === undefined || value === '' ? null : value);

export async function PUT(req, context) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded || decoded.role !== 'admission') {
    return NextResponse.json({ error: 'Forbidden: Only admission clerks can update student details' }, { status: 403 });
  }

  try {
    const params = await context.params;
    const { rollno } = params;

    if (!rollno) {
      return NextResponse.json({ error: 'Missing rollno parameter' }, { status: 400 });
    }

    const updatedData = await req.json();

    // Find student ID
    const [student] = await query('SELECT id FROM students WHERE roll_no = ?', [rollno]);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    const studentId = student.id;

    // --- Update `students` table ---
    const studentUpdateFields = [];
    const studentUpdateValues = [];

    if (updatedData.name !== undefined) { studentUpdateFields.push('name = ?'); studentUpdateValues.push(toNull(updatedData.name)); }
    if (updatedData.admission_no !== undefined) { studentUpdateFields.push('admission_no = ?'); studentUpdateValues.push(toNull(updatedData.admission_no)); }
    if (updatedData.date_of_birth !== undefined) { studentUpdateFields.push('date_of_birth = ?'); studentUpdateValues.push(toMySQLDate(updatedData.date_of_birth)); }
    if (updatedData.gender !== undefined) { studentUpdateFields.push('gender = ?'); studentUpdateValues.push(toNull(updatedData.gender)); }
    if (updatedData.mobile !== undefined) { studentUpdateFields.push('mobile = ?'); studentUpdateValues.push(toNull(updatedData.mobile)); }
    if (updatedData.email !== undefined) { studentUpdateFields.push('email = ?'); studentUpdateValues.push(toNull(updatedData.email)); }
    // Note: roll_no is typically not updated directly after admission, and it's used as the identifier here.

    if (studentUpdateFields.length > 0) {
      await query(`UPDATE students SET ${studentUpdateFields.join(', ')} WHERE id = ?`, [...studentUpdateValues, studentId]);
    }

    // --- Update `student_personal_details` table ---
    const personalUpdateFields = [];
    const personalUpdateValues = [];
    const personalInsertValues = [];
    const personalColumns = ['father_name', 'mother_name', 'nationality', 'religion', 'category', 'sub_caste', 'area_status', 'mother_tongue', 'place_of_birth', 'father_occupation', 'annual_income', 'aadhaar_no', 'address', 'seat_allotted_category', 'identification_marks'];

    let hasPersonalUpdates = false;
    personalColumns.forEach(col => {
      if (updatedData[col] !== undefined) {
        if (col === 'aadhaar_no' && updatedData[col] !== null) {
          // Sanitize aadhaar_no: remove all non-digits before storing
          personalUpdateFields.push(`${col} = ?`);
          personalUpdateValues.push(toNull(String(updatedData[col]).replace(/\D/g, '')));
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
    const academicColumns = ['qualifying_exam', 'previous_college_details', 'medium_of_instruction', 'ranks'];

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
            // If no academic background exists, insert it
            const insertCols = ['student_id'];
            const insertVals = [studentId];
            academicColumns.forEach(col => {
                if (updatedData[col] !== undefined) { // Only include columns present in updatedData
                    insertCols.push(col);
                    insertVals.push(toNull(updatedData[col]));
                }
            });
            if (insertCols.length > 1) { // More than just student_id
                await query(`INSERT INTO student_academic_background (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`, insertVals);
            }
        }
    }


    return NextResponse.json({ success: true, message: 'Student details updated successfully' });
  } catch (error) {
    console.error('Error updating student details:', error);
    return NextResponse.json({ error: 'Failed to update student details', details: error.message }, { status: 500 });
  }
}
