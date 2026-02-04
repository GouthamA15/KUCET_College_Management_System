import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { validateRollNo } from '@/lib/rollNumber';

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

export async function POST(req) {
  const cookieStore = await cookies();
  const clerkAuthCookie = cookieStore.get('clerk_auth');
  const token = clerkAuthCookie ? clerkAuthCookie.value : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await verifyJwt(token, process.env.JWT_SECRET);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const studentData = await req.json();

    // Log incoming payload for debugging
    console.log('Admission payload received:', JSON.stringify(studentData));

    const {
      admission_no,
      roll_no,
      name,
      father_name,
      mother_name,
      date_of_birth,
      place_of_birth,
      gender,
      nationality,
      religion,
      sub_caste,
      category,
      address,
      mobile,
      email,
      qualifying_exam,
      mother_tongue,
      father_occupation,
      student_aadhar_no,
      father_guardian_mobile_no,
      identification_marks,
      // additional personal/academic fields
      annual_income,
      aadhaar_no,
      seat_allotted_category,
      ncc_nss_details,
      area_status,
      previous_college_details,
      medium_of_instruction,
      ranks, // Added ranks
    } = studentData;

    const providedRoll = roll_no || studentData.rollno || null;

    if (!providedRoll) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    const { isValid } = validateRollNo(providedRoll);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid roll number format' }, { status: 400 });
    }

    // Check if a student with this roll number already exists
    if (providedRoll) {
      const [existingStudent] = await query('SELECT id FROM students WHERE roll_no = ?', [providedRoll]);
      if (existingStudent) {
        return NextResponse.json({ error: `Student with Roll Number ${providedRoll} already exists.` }, { status: 409 });
      }
    }

    // Insert into `students` table (core student record)
    const studentResult = await query(
      `INSERT INTO students (admission_no, roll_no, name, date_of_birth, gender, mobile, email) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [admission_no || null, providedRoll, name || null, toMySQLDate(date_of_birth) || null, gender || null, mobile || null, email || null]
    );

    const studentId = studentResult.insertId;

    try {
        // Sanitize Aadhaar: DB expects 12 digits (no spaces). Accept either `student_aadhar_no` or `aadhaar_no` from payload.
        const rawAadhaar = (student_aadhar_no || aadhaar_no || '') + '';
        const cleanAadhaar = (rawAadhaar.replace(/\D/g, '') || null);
        const aadhaarToSave = cleanAadhaar ? cleanAadhaar.slice(0, 12) : null;

        // Insert personal details into `student_personal_details`
        await query(
          `INSERT INTO student_personal_details (
            student_id, father_name, mother_name, nationality, religion, category, sub_caste, area_status, mother_tongue, place_of_birth, father_occupation, annual_income, aadhaar_no, guardian_mobile, address, seat_allotted_category, identification_marks, ncc_nss_details
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            studentId,
            father_name || null,
            mother_name || null,
            nationality || null,
            religion || null,
            category || null,
            sub_caste || null,
            area_status || null,
            mother_tongue || null,
            place_of_birth || null,
            father_occupation || null,
            annual_income ? Number(annual_income) : null,
            aadhaarToSave,
            father_guardian_mobile_no || null,
            address || null,
            seat_allotted_category || null,
            identification_marks || null,
            ncc_nss_details || null
          ]
        );

      // Insert academic background into `student_academic_background`
      await query(
        `INSERT INTO student_academic_background (
          student_id, qualifying_exam, previous_college_details, medium_of_instruction, ranks
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          studentId,
          qualifying_exam || null,
          previous_college_details || null,
          medium_of_instruction || null,
          ranks ? Number(ranks) : null
        ]
      );

      // Fetch inserted records to return for debugging/confirmation
      const savedStudentRows = await query('SELECT * FROM students WHERE id = ?', [studentId]);
      const savedPersonal = await query('SELECT * FROM student_personal_details WHERE student_id = ?', [studentId]);
      const savedAcademic = await query('SELECT * FROM student_academic_background WHERE student_id = ?', [studentId]);

      return NextResponse.json({ success: true, studentId, roll_no: providedRoll, savedStudent: savedStudentRows[0] || null, savedPersonal: savedPersonal[0] || null, savedAcademic: savedAcademic[0] || null });
    } catch (innerError) {
      // If inserting related details fails, remove the created student to avoid partial state
      console.error('Error inserting related student data, rolling back student:', innerError);
      try { await query('DELETE FROM students WHERE id = ?', [studentId]); } catch (delErr) { console.error('Rollback delete failed:', delErr); }
      return NextResponse.json({ error: 'Failed to save student details' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error adding student:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}