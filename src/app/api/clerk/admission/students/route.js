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
      identification_marks,
      // additional personal/academic fields
      annual_income,
      aadhaar_no,
      seat_allotted_category,
      area_status,
      previous_college_details,
      medium_of_instruction,
      ranks, // Added ranks
      blood_group,
      fee_reimbursement,
    } = studentData;

    const providedRoll = roll_no || studentData.rollno || null;

    if (!providedRoll) {
      return apiError('Roll number is required', 400);
    }

    const { isValid } = validateRollNo(providedRoll);

    if (!isValid) {
      return apiError('Invalid roll number format', 400);
    }

    // Check if a student with this roll number already exists
    if (providedRoll) {
      const [existingStudent] = await query('SELECT id FROM students WHERE roll_no = ?', [providedRoll]);
      if (existingStudent) {
        return apiError(`Student with Roll Number ${providedRoll} already exists.`, 409);
      }
    }

    // Ensure clerk exists and use clerk id from JWT (do NOT accept clerk id from frontend)
    const clerkId = user?.clerkId || null;
    if (!clerkId) {
      return apiError('Unauthorized: clerk id missing in token', 401);
    }
    const [clerkRow] = await query('SELECT id FROM clerks WHERE id = ?', [clerkId]);
    if (!clerkRow) {
      return apiError('Unauthorized: clerk not found', 403);
    }

    // Validate blood group if provided
    const validBloodGroups = COLLEGE_CONFIG.bloodGroups;
    const bloodGroupToSave = blood_group && String(blood_group).trim() ? String(blood_group).trim() : null;
    if (bloodGroupToSave && !validBloodGroups.includes(bloodGroupToSave)) {
      return apiError('Invalid blood group value', 400);
    }

    // Validate fee_reimbursement if provided
    const validFeeReimbursement = ['YES', 'NO'];
    const feeReimbursementToSave = fee_reimbursement == null ? null : String(fee_reimbursement).trim().toUpperCase();
    if (feeReimbursementToSave && !validFeeReimbursement.includes(feeReimbursementToSave)) {
      return apiError('Invalid fee_reimbursement value', 400);
    }

    // Insert into `students` table (core student record). Set added_by_clerk_id from token.
    const studentResult = await query(
      `INSERT INTO students (admission_no, roll_no, name, date_of_birth, gender, mobile, email, added_by_clerk_id, fee_reimbursement, created_at, updated_at, updated_by_clerk_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, NULL)`,
      [admission_no || null, providedRoll, name || null, toMySQLDate(date_of_birth) || null, gender || null, mobile || null, email || null, clerkId, feeReimbursementToSave]
    );

    const studentId = studentResult.insertId;

    try {
        // Sanitize Aadhaar: DB expects 12 digits (no spaces). Accept either `student_aadhar_no` or `aadhaar_no` from payload.
        const rawAadhaar = (student_aadhar_no || aadhaar_no || '') + '';
        const cleanAadhaar = (rawAadhaar.replace(/\D/g, '') || null);
        const aadhaarToSave = cleanAadhaar ? cleanAadhaar.slice(0, 12) : null;

        // Insert personal details into `student_personal_details`. Include optional blood_group.
        await query(
          `INSERT INTO student_personal_details (
                      student_id, father_name, mother_name, nationality, religion, category, sub_caste, area_status, mother_tongue, place_of_birth, father_occupation, annual_income, aadhaar_no, address, seat_allotted_category, identification_marks, blood_group
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,          [
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
            address || null,
            seat_allotted_category || null,
            identification_marks || null,
            bloodGroupToSave
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
      
            return apiResponse({ success: true, studentId, roll_no: providedRoll, savedStudent: savedStudentRows[0] || null, savedPersonal: savedPersonal[0] || null, savedAcademic: savedAcademic[0] || null });
          } catch (innerError) {
            // If inserting related details fails, remove the created student to avoid partial state
            console.error('Error inserting related student data, rolling back student:', innerError);
            try { await query('DELETE FROM students WHERE id = ?', [studentId]); } catch (delErr) { console.error('Rollback delete failed:', delErr); }
            return apiError('Failed to save student details', 500);
          }
        } catch (error) {
          console.error('Error adding student:', error);
          return apiError('Internal Server Error', 500);
        }
      }
      