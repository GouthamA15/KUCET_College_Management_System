import { query } from '@/lib/db';
import { toMySQLDate } from '@/lib/date';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const studentData = await req.json();

    // TODO: Add validation for the student data

    // Log incoming payload for debugging
    console.log('Admission payload received:', JSON.stringify(studentData));

    const {
      admission_no,
      admission_type,
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
      course,
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
      year_of_study,
      total_marks,
      marks_secured,
    } = studentData;

    // Use provided roll_no (manual entry). If none provided, accept null and let DB constraints handle it.
    const providedRoll = roll_no || studentData.rollno || null;

    // Determine allowed admission_type values from DB enum (if present)
    let admissionTypeToSave = null;
    try {
      const col = await query(
        `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'admission_type'`
      );
      let allowedAdmissionTypes = ['Regular', 'Lateral']; // fallback
      let isNullable = 'YES';
      let columnDefault = null;
      if (Array.isArray(col) && col.length > 0 && col[0].COLUMN_TYPE) {
        const columnType = col[0].COLUMN_TYPE; // e.g. "enum('regular','Lateral Entry')"
        const matches = Array.from(columnType.matchAll(/'([^']+)'/g)).map(m => m[1]);
        if (matches.length) allowedAdmissionTypes = matches;
        if (typeof col[0].IS_NULLABLE !== 'undefined') isNullable = col[0].IS_NULLABLE;
        if (typeof col[0].COLUMN_DEFAULT !== 'undefined') columnDefault = col[0].COLUMN_DEFAULT;
      }

      if (typeof admission_type !== 'undefined' && admission_type !== null && admission_type !== '') {
        // Try to map incoming value to one of the allowedAdmissionTypes (case/spacing insensitive)
        const normalize = v => (v + '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        const incomingNorm = normalize(admission_type);
        const found = allowedAdmissionTypes.find(opt => normalize(opt) === incomingNorm);
        if (found) {
          admissionTypeToSave = found;
        } else {
          console.warn(`Admission type '${admission_type}' not matched to DB enum options: ${allowedAdmissionTypes.join(', ')}; will attempt sensible default if column forbids NULL.`);
          admissionTypeToSave = null;
        }
        // If DB column forbids NULL, prefer 'Regular' explicitly; otherwise fall back to column default or first allowed option
        if (admissionTypeToSave === null && isNullable === 'NO') {
          if (allowedAdmissionTypes.includes('Regular')) admissionTypeToSave = 'Regular';
          else admissionTypeToSave = columnDefault || (allowedAdmissionTypes.length ? allowedAdmissionTypes[0] : null);
          console.warn(`admission_type is NOT NULL in DB — using default '${admissionTypeToSave}'`);
        }
      }
    } catch (err) {
      console.error('Failed to read admission_type column definition, falling back to fallback list;', err);
      if (typeof admission_type !== 'undefined' && admission_type !== null && admission_type !== '') {
        // map common variants to fallback
        const lower = (admission_type + '').toLowerCase();
        if (lower.includes('lateral')) admissionTypeToSave = 'Lateral';
        else if (lower.includes('regular')) admissionTypeToSave = 'Regular';
        else admissionTypeToSave = null;
      }
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
      `INSERT INTO students (admission_no, roll_no, name, date_of_birth, gender, mobile, email, course, admission_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [admission_no || null, providedRoll, name || null, toMySQLDate(date_of_birth) || null, gender || null, mobile || null, email || null, course || null, admissionTypeToSave]
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
          student_id, qualifying_exam, previous_college_details, medium_of_instruction, year_of_study, total_marks, marks_secured
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId,
          qualifying_exam || null,
          previous_college_details || null,
          medium_of_instruction || null,
          year_of_study ? Number(year_of_study) : null,
          total_marks ? Number(total_marks) : null,
          marks_secured ? Number(marks_secured) : null
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
