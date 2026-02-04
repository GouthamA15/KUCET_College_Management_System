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
  if (!student.mobile) errors.push(`Row ${index + 2}: Mobile is missing.`);
  if (!student.date_of_birth) errors.push(`Row ${index + 2}: Date of Birth is missing.`);
  
  // Only validate email format if it is provided
  if (student.email && String(student.email).trim() !== '' && !/\S+@\S+\.\S+/.test(student.email)) {
    errors.push(`Row ${index + 2}: Email format is invalid for '${student.email}'.`);
  }
  // Optional: basic gender validation if provided
  const normalizedGender = String(student.gender || '').trim().toLowerCase();
  if (student.gender && normalizedGender !== '' && !['male', 'female', 'other'].includes(normalizedGender)) {
    errors.push(`Row ${index + 2}: Invalid Gender '${student.gender}'. Must be 'Male', 'Female', or 'Other'.`);
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
    const importMessages = []; // To collect informational messages for the clerk

    // Pre-processing and validation before starting the transaction
    for (let i = 0; i < json.length; i++) {
      const student = { ...json[i] }; // Create a copy to avoid modifying original json during validation
      let currentEmail = String(student.email || '').trim();
      let currentGender = String(student.gender || '').trim();
      
      // Auto-populate email if not provided
      if (currentEmail === '') {
        if (student.roll_no && String(student.roll_no).trim() !== '') {
          currentEmail = `${String(student.roll_no).trim().toLowerCase()}@college.com`;
          importMessages.push(`Row ${i + 2}: Email auto-generated as '${currentEmail}' for Roll No '${student.roll_no}'.`);
        } else {
          allErrors.push(`Row ${i + 2}: Cannot auto-generate email, Roll Number is missing or empty.`);
          continue; // Skip further processing for this row if roll_no is missing
        }
      }
      student.email = currentEmail; // Update student object with generated/processed email

      // Process gender: set to null if empty, otherwise normalize
      if (currentGender === '') {
        currentGender = null;
        importMessages.push(`Row ${i + 2}: Gender not provided for Roll No '${student.roll_no}', setting to NULL.`);
      } else {
        // Normalize gender to standard casing (e.g., 'Male', 'Female', 'Other')
        const lowerGender = currentGender.toLowerCase();
        if (['male', 'm'].includes(lowerGender)) currentGender = 'Male';
        else if (['female', 'f'].includes(lowerGender)) currentGender = 'Female';
        else if (['other', 'o'].includes(lowerGender)) currentGender = 'Other';
        // If still not recognized, it will be caught by validation (if specific values are required) or inserted as is
        // For now, validation above handles invalid values.
      }
      student.gender = currentGender; // Update student object with processed gender

      const errors = validateStudentData(student, i); // Validate the processed student object
      if (errors.length > 0) {
        allErrors.push(...errors);
      } else {
        validStudents.push(student);
      }
    }

    if (allErrors.length > 0) {
      return NextResponse.json({ error: 'Validation failed. Please check the following errors in your Excel file:', details: allErrors }, { status: 400 });
    }

    const pool = getDb(); // Get the pool

    let connection; // Declare connection outside try-finally for scope

    try {
      connection = await pool.getConnection(); // Get a connection from the pool
      await connection.beginTransaction(); // Start transaction on the connection

      for (const student of validStudents) {
        // 1. Insert into students table (now including gender)
        const [studentResult] = await connection.execute( // Use connection.execute
          `INSERT INTO students (roll_no, name, email, mobile, date_of_birth, is_email_verified, gender)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            student.roll_no,
            student.name,
            student.email,
            student.mobile,
            toMySQLDate(student.date_of_birth),
            0, // Default to not verified
            student.gender
          ]
        );
        const studentId = studentResult.insertId;

        // 2. Insert into student_personal_details table
        await connection.execute( // Use connection.execute
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
        // Branch is derived from roll number and not stored in this table as per schema.
        // Insert only student_id for now. Additional academic details can be added if available in Excel.
        await connection.execute( // Use connection.execute
          `INSERT INTO student_academic_background (student_id) VALUES (?)`,
          [studentId]
        );
      }

      await connection.commit(); // Commit transaction on the connection
      return NextResponse.json({ message: `${validStudents.length} students imported successfully.`, info: importMessages }, { status: 200 });

    } catch (error) {
      if (connection) {
        await connection.rollback(); // Rollback transaction on the connection
      }
      console.error('BULK IMPORT TRANSACTION ERROR:', error);
      let errorMessage = 'An error occurred during the database transaction. All changes have been rolled back.';
      if (error.code === 'ER_DUP_ENTRY') {
        const duplicateValue = error.message.match(/for key '(.*?)'/)?.[1];
        if (duplicateValue) {
          if (error.message.includes('email')) {
            // Attempt to find which student's email caused the duplicate
            const duplicatedStudent = validStudents.find(s => error.message.includes(s.email));
            errorMessage = `A student with email '${duplicatedStudent ? duplicatedStudent.email : "an existing email"}' already exists. All changes have been rolled back.`;
          } else if (error.message.includes('roll_no')) {
            // Attempt to find which student's roll_no caused the duplicate
            const duplicatedStudent = validStudents.find(s => error.message.includes(s.roll_no));
            errorMessage = `A student with roll number '${duplicatedStudent ? duplicatedStudent.roll_no : "an existing roll number"}' already exists. All changes have been rolled back.`;
          } else {
            errorMessage = `A duplicate entry error occurred during import for key ${duplicateValue}. All changes have been rolled back. Details: ${error.message}`;
          }
        } else {
            errorMessage = `A duplicate entry error occurred during import. All changes have been rolled back. Details: ${error.message}`;
        }
      } else {
        errorMessage = `An unexpected database error occurred. All changes have been rolled back. Details: ${error.message}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
      if (connection) {
        connection.release(); // Release the connection back to the pool
      }
    }

  } catch (error) {
    console.error('BULK IMPORT API ERROR:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while processing the file.' }, { status: 500 });
  }
}
