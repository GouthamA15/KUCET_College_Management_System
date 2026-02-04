import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as XLSX from 'xlsx-js-style';
import { toMySQLDate } from '@/lib/date';
import { getBranchFromRoll } from '@/lib/rollNumber';

// Helper to validate each row of student data
const validateStudentData = (student, index) => {
  const errors = [];
  if (!student.roll_no) errors.push(`Row ${index + 2}: Roll Number is missing.`);
  if (!student.name) errors.push(`Row ${index + 2}: Name is missing.`);
  if (!student.email) errors.push(`Row ${index + 2}: Email is missing.`);
  if (!student.mobile) errors.push(`Row ${index + 2}: Mobile is missing.`);
  if (!student.date_of_birth) errors.push(`Row ${index + 2}: Date of Birth is missing.`);
  
  if (student.email && !/\S+@\S+\.\S+/.test(student.email)) {
    errors.push(`Row ${index + 2}: Email format is invalid for ${student.email}.`);
  }

  return errors;
};


export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);

    if (json.length === 0) {
      return NextResponse.json({ error: 'The uploaded Excel file is empty.' }, { status: 400 });
    }

    const allErrors = [];
    const validStudents = [];

    // Pre-validation before starting the transaction
    for (let i = 0; i < json.length; i++) {
      const student = json[i];
      const errors = validateStudentData(student, i);
      if (errors.length > 0) {
        allErrors.push(...errors);
      } else {
        validStudents.push(student);
      }
    }

    if (allErrors.length > 0) {
      return NextResponse.json({ error: 'Validation failed. Please check the following errors in your Excel file:', details: allErrors }, { status: 400 });
    }

    const db = getDb();
    await db.beginTransaction();

    try {
      for (const student of validStudents) {
        // 1. Insert into students table
        const [studentResult] = await db.execute(
          `INSERT INTO students (roll_no, name, email, mobile, date_of_birth, is_email_verified)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            student.roll_no,
            student.name,
            student.email,
            student.mobile,
            toMySQLDate(student.date_of_birth),
            0 // Default to not verified
          ]
        );
        const studentId = studentResult.insertId;

        // 2. Insert into student_personal_details table
        await db.execute(
          `INSERT INTO student_personal_details (student_id, father_name, mother_name, address, category)
           VALUES (?, ?, ?, ?, ?)`,
          [
            studentId,
            student.father_name || null,
            student.mother_name || null,
            student.address || null,
            student.category || null
          ]
        );
        
        // 3. Insert into student_academic_background table
        const branch = getBranchFromRoll(student.roll_no);
        await db.execute(
          `INSERT INTO student_academic_background (student_id, branch) VALUES (?, ?)`,
          [studentId, branch]
        );
      }

      await db.commit();
      return NextResponse.json({ message: `${validStudents.length} students imported successfully.` }, { status: 200 });

    } catch (error) {
      await db.rollback();
      console.error('BULK IMPORT TRANSACTION ERROR:', error);
      let errorMessage = 'An error occurred during the database transaction. All changes have been rolled back.';
      if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = `A student with a duplicate Roll Number or Email already exists. All changes have been rolled back. Details: ${error.message}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

  } catch (error) {
    console.error('BULK IMPORT API ERROR:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while processing the file.' }, { status: 500 });
  }
}
