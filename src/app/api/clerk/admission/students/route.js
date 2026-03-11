import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { validateRollNo } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { COLLEGE_CONFIG } from '@/lib/college-config';

export async function POST(req) {
  const user = await getAuthUser('clerk');

  if (!user || user.role !== 'admission') {
    return apiError('Forbidden: Only admission clerks can add students', 403);
  }

  try {
    const studentData = await req.json();

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
      identification_marks,
      annual_income,
      guardian_mobile,
      aadhaar_no,
      seat_allotted_category,
      area_status,
      previous_college_details,
      medium_of_instruction,
      ranks, 
      ssc_marks,
      inter_marks,
      blood_group,
      fee_reimbursement,
      pfp, 
      signature, 
    } = studentData;

    const providedRoll = roll_no || studentData.rollno || null;

    if (!providedRoll) {
      return apiError('Roll number is required', 400);
    }

    const { isValid } = validateRollNo(providedRoll);
    if (!isValid) {
      return apiError('Invalid roll number format', 400);
    }

    const db = await require('@/lib/db').getDb();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Check if a student with this roll number already exists
      const [existingStudent] = await connection.execute('SELECT id FROM students WHERE roll_no = ?', [providedRoll]);
      if (existingStudent.length > 0) {
        await connection.rollback();
        return apiError(`Student with Roll Number ${providedRoll} already exists.`, 409);
      }

      // Ensure clerk exists
      const clerkId = user?.clerkId || null;
      if (!clerkId) {
        await connection.rollback();
        return apiError('Unauthorized: clerk id missing in token', 401);
      }

      // Validate blood group
      const validBloodGroups = COLLEGE_CONFIG.bloodGroups;
      const bloodGroupToSave = blood_group && String(blood_group).trim() ? String(blood_group).trim() : null;
      if (bloodGroupToSave && !validBloodGroups.includes(bloodGroupToSave)) {
        await connection.rollback();
        return apiError('Invalid blood group value', 400);
      }

      // Validate fee_reimbursement
      const validFeeReimbursement = ['YES', 'NO', 'GOV'];
      const feeReimbursementToSave = fee_reimbursement == null ? null : String(fee_reimbursement).trim().toUpperCase();
      if (feeReimbursementToSave && !validFeeReimbursement.includes(feeReimbursementToSave)) {
        await connection.rollback();
        return apiError('Invalid fee_reimbursement value', 400);
      }

      // Insert into students table
      const [studentResult] = await connection.execute(
        `INSERT INTO students (admission_no, roll_no, name, date_of_birth, gender, mobile, email, added_by_clerk_id, fee_reimbursement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [admission_no || null, providedRoll, name || null, toMySQLDate(date_of_birth) || null, gender || null, mobile || null, email || null, clerkId, feeReimbursementToSave]
      );

      const studentId = studentResult.insertId;

      // Sanitize Aadhaar
      const rawAadhaar = (student_aadhar_no || aadhaar_no || '') + '';
      const cleanAadhaar = (rawAadhaar.replace(/\D/g, '') || null);
      const aadhaarToSave = cleanAadhaar ? cleanAadhaar.slice(0, 12) : null;

      // Insert personal details
      await connection.execute(
        `INSERT INTO student_personal_details (
          student_id, father_name, mother_name, nationality, religion, category, sub_caste, area_status, mother_tongue, place_of_birth, father_occupation, annual_income, guardian_mobile, aadhaar_no, address, seat_allotted_category, identification_marks, blood_group
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId, father_name || null, mother_name || null, nationality || null, religion || null, category || null,
          sub_caste || null, area_status || null, mother_tongue || null, place_of_birth || null, father_occupation || null,
          annual_income ? Number(annual_income) : null, guardian_mobile || null, aadhaarToSave, address || null,
          seat_allotted_category || null, identification_marks || null, bloodGroupToSave
        ]
      );

      // Insert academic background
      await connection.execute(
        `INSERT INTO student_academic_background (
          student_id, qualifying_exam, previous_college_details, medium_of_instruction, ranks, ssc_marks, inter_marks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId, qualifying_exam || null, previous_college_details || null, medium_of_instruction || null,
          ranks ? Number(ranks) : null, ssc_marks || null, inter_marks || null
        ]
      );

      // Handle Images (Buffer if base64 provided)
      if (pfp && typeof pfp === 'string' && pfp.includes(',')) {
        const pfpBuffer = Buffer.from(pfp.split(',')[1], 'base64');
        await connection.execute('INSERT INTO student_images (student_id, pfp) VALUES (?, ?)', [studentId, pfpBuffer]);
      }
      if (signature && typeof signature === 'string' && signature.includes(',')) {
        const sigBuffer = Buffer.from(signature.split(',')[1], 'base64');
        await connection.execute('INSERT INTO student_signatures (student_id, signature) VALUES (?, ?)', [studentId, sigBuffer]);
      }

      await connection.commit();
      return apiResponse({ success: true, studentId, roll_no: providedRoll, message: 'Student admitted successfully.' });

    } catch (innerError) {
      await connection.rollback();
      console.error('Inner admission error:', innerError);
      return apiError('Failed to save student details', 500);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error adding student:', error);
    return apiError('Internal Server Error', 500);
  }
      }
      