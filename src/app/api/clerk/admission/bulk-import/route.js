import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as XLSX from 'xlsx-js-style';
import { toMySQLDate, parseDate } from '@/lib/date';
import { getBranchFromRoll } from '@/lib/rollNumber';

// Header normalization: lowercase, trim, spaces & hyphens to _, remove non-word chars
const normalizeHeader = (h) => {
  const s = String(h || '').toLowerCase().trim();
  return s
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

// Canonical display names for required fields (for clear error messages)
const REQUIRED_DISPLAY = {
  roll_no: 'ROLL NUMBER',
  name: 'CANDIDATE NAME',
  gender: 'GENDER',
  date_of_birth: 'DOB',
  father_name: 'FATHER NAME',
  category: 'CATEGORY',
  address: 'ADDRESS',
};

// Alias mapping dictionary: normalized header -> canonical field
const ALIASES = {
  // Students table
  students: {
    roll_no: ['roll_no', 'rollnumber', 'roll_number', 'registration_no', 'reg_no', 'regnumber'],
    name: ['name', 'candidate_name', 'student_name', 'fullname'],
    gender: ['gender', 'sex'],
    date_of_birth: ['dob', 'date_of_birth', 'birth_date', 'dateofbirth'],
    mobile: ['mobile', 'phone', 'phone_number', 'mobile_number', 'contact_number'],
    email: ['email', 'mail_id', 'email_id'],
  },
  // Student personal details table
  student_personal_details: {
    father_name: ['father_name', 'fathers_name', 'parent_name'],
    category: ['category', 'caste_category'],
    address: ['address', 'residential_address'],
    mother_name: ['mother_name', 'mothers_name'],
    nationality: ['nationality'],
    religion: ['religion'],
    sub_caste: ['sub_caste', 'subcaste'],
    area_status: ['area_status', 'areastatus'],
    aadhaar_no: ['aadhaar_no', 'aadhaar', 'aadhar', 'aadhar_no'],
    guardian_mobile: ['guardian_mobile', 'guardian_phone'],
  },
  // Academic background (optional)
  student_academic_background: {
    qualifying_exam: ['qualifying_exam', 'qualifyingexam'],
    previous_college_details: ['previous_college_details', 'previouscollege', 'previous_college'],
    medium_of_instruction: ['medium_of_instruction', 'medium'],
    year_of_study: ['year_of_study', 'year'],
    total_marks: ['total_marks', 'totalmarks'],
    marks_secured: ['marks_secured', 'secured_marks', 'marksobtained'],
  },
};

// Build header mapping: column index -> { field, table }
function buildHeaderMapping(originalHeaders) {
  const normalized = originalHeaders.map(normalizeHeader);
  const mapping = {}; // colIdx -> { field, table }

  normalized.forEach((hdr, idx) => {
    if (!hdr) return;
    let found = false;
    for (const table of Object.keys(ALIASES)) {
      for (const canonical of Object.keys(ALIASES[table])) {
        const aliases = ALIASES[table][canonical];
        if (aliases.includes(hdr)) {
          mapping[idx] = { field: canonical, table };
          found = true;
          break;
        }
      }
      if (found) break;
    }
  });

  // Verify required fields presence
  const requiredCanon = ['roll_no', 'name', 'gender', 'date_of_birth', 'father_name', 'category', 'address'];
  const present = new Set(
    Object.values(mapping).map((m) => m.field)
  );

  const missing = requiredCanon.filter((f) => !present.has(f));
  return { mapping, normalizedHeaders: normalized, missingRequired: missing };
}

// Gender normalization: returns canonical or null if invalid/missing
function normalizeGender(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (['male', 'm', 'boy'].includes(v)) return 'Male';
  if (['female', 'f', 'girl'].includes(v)) return 'Female';
  if (['other', 'o', 'others'].includes(v)) return 'Other';
  return null; // invalid
}

// Date normalization to YYYY-MM-DD
function normalizeDateToMySQL(value) {
  if (!value && value !== 0) return null;
  // JS Date instance
  if (value instanceof Date && !isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  // Excel serial number
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const yyyy = parsed.y;
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    // Fallback conversion
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(dt.getTime())) {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }
  // String formats
  const s = String(value);
  const parsedStrDate = parseDate(s);
  if (parsedStrDate) {
    const yyyy = parsedStrDate.getFullYear();
    const mm = String(parsedStrDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedStrDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  // Try toMySQLDate if already in a string format
  const mysql = toMySQLDate(s);
  if (mysql && /^\d{4}-\d{2}-\d{2}$/.test(mysql)) return mysql;
  return null;
}


export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const isPreview = searchParams.get('preview') === 'true';

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'The uploaded Excel file is empty or missing headers.' }, { status: 400 });
    }

    const headers = rows[0];
    const { mapping, missingRequired } = buildHeaderMapping(headers);

    if (missingRequired.length > 0) {
      const errors = missingRequired.map((f) => `Required column "${REQUIRED_DISPLAY[f]}" not found`);
      return NextResponse.json({ error: 'Missing required columns.', errors }, { status: 400 });
    }

    const totalRows = rows.length - 1;
    const errors = [];
    const prepared = []; // array of { student, personal, academic, rowNumber }

    // Detect duplicates within file as we go
    const seenRolls = new Map(); // roll_no -> firstRow

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rowNumber = r + 1; // Excel row number (1-based)

      const student = {};
      const personal = {};
      const academic = {};

      // Build objects from mapping
      for (let c = 0; c < headers.length; c++) {
        const map = mapping[c];
        if (!map) continue;
        const val = row[c];
        if (map.table === 'students') {
          student[map.field] = val;
        } else if (map.table === 'student_personal_details') {
          personal[map.field] = val;
        } else if (map.table === 'student_academic_background') {
          academic[map.field] = val;
        }
      }

      // Required per-row validations
      const roll = String(student.roll_no || '').trim();
      const name = String(student.name || '').trim();
      const genderCanonical = normalizeGender(student.gender);
      const dobCanonical = normalizeDateToMySQL(student.date_of_birth);
      const fatherName = String(personal.father_name || '').trim();
      const category = String(personal.category || '').trim();
      const address = String(personal.address || '').trim();

      if (!roll) {
        errors.push({ row: rowNumber, roll_no: null, reason: 'Roll number is missing' });
        continue;
      }
      if (seenRolls.has(roll)) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Duplicate roll number in file' });
        continue;
      }
      seenRolls.set(roll, rowNumber);

      if (!name) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Name is missing' });
        continue;
      }
      if (!genderCanonical) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Invalid or missing gender' });
        continue;
      }
      if (!dobCanonical) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Invalid or missing DOB' });
        continue;
      }
      if (!fatherName) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Father name is missing' });
        continue;
      }
      if (!category) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Category is missing' });
        continue;
      }
      if (!address) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Address is missing' });
        continue;
      }

      // Set canonical normalized values
      student.roll_no = roll;
      student.name = name;
      student.gender = genderCanonical;
      student.date_of_birth = dobCanonical;
      // Optional fields
      if (student.email) {
        const em = String(student.email).trim();
        if (em && !/\S+@\S+\.\S+/.test(em)) {
          errors.push({ row: rowNumber, reason: `Invalid email '${em}'` });
          continue;
        }
        student.email = em || null;
      }
      if (student.mobile) {
        const mob = String(student.mobile).trim();
        student.mobile = mob || null;
      }

      // Personal mandatory
      personal.father_name = fatherName;
      personal.category = category;
      personal.address = address;

      prepared.push({ student, personal, academic, rowNumber });
    }

    // DB-level duplicates check
    const pool = getDb();
    const rollList = prepared.map((p) => p.student.roll_no);
    if (rollList.length > 0) {
      try {
        const [existingRows] = await pool.execute(
          `SELECT roll_no FROM students WHERE roll_no IN (${rollList.map(() => '?').join(',')})`,
          rollList
        );
        const existingSet = new Set(existingRows.map((r) => r.roll_no));
        // Filter out rows with duplicates in DB and log errors
        const filtered = [];
        for (const rec of prepared) {
          if (existingSet.has(rec.student.roll_no)) {
            errors.push({ row: rec.rowNumber, roll_no: rec.student.roll_no, reason: 'Roll number already exists' });
          } else {
            filtered.push(rec);
          }
        }
        prepared.splice(0, prepared.length, ...filtered);
      } catch (dupErr) {
        console.error('Duplicate check error:', dupErr);
        return NextResponse.json({ error: 'Failed to verify duplicates in database.' }, { status: 500 });
      }
    }

    let connection;
    let insertedCount = 0;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      for (const rec of prepared) {
        const { student, personal, academic } = rec;

        // Insert into students
        const [studentResult] = await connection.execute(
          `INSERT INTO students (roll_no, name, email, mobile, date_of_birth, is_email_verified, gender)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            student.roll_no,
            student.name,
            student.email || null,
            student.mobile || null,
            student.date_of_birth, // already normalized YYYY-MM-DD
            0,
            student.gender,
          ]
        );
        const studentId = studentResult.insertId;

        // Personal details (mandatory + optional where present)
        await connection.execute(
          `INSERT INTO student_personal_details (student_id, father_name, mother_name, address, category, nationality, religion, sub_caste, area_status, aadhaar_no, guardian_mobile)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            studentId,
            personal.father_name,
            personal.mother_name || null,
            personal.address,
            personal.category,
            personal.nationality || null,
            personal.religion || null,
            personal.sub_caste || null,
            personal.area_status || null,
            personal.aadhaar_no || null,
            personal.guardian_mobile || null,
          ]
        );

        // Academic background only if any field present
        const hasAcademic = Object.values(academic).some((v) => String(v).trim() !== '');
        if (hasAcademic) {
          await connection.execute(
            `INSERT INTO student_academic_background (student_id, qualifying_exam, previous_college_details, medium_of_instruction, year_of_study, total_marks, marks_secured)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              studentId,
              academic.qualifying_exam || null,
              academic.previous_college_details || null,
              academic.medium_of_instruction || null,
              academic.year_of_study || null,
              academic.total_marks || null,
              academic.marks_secured || null,
            ]
          );
        }

        insertedCount++;
      }

      await connection.commit();

      const skippedCount = totalRows - insertedCount;
      const response = {
        totalRows,
        inserted: insertedCount,
        skipped: skippedCount,
        errors,
      };

      // Attach CSV for errors if any
      if (errors.length > 0) {
        const csvHeader = 'Row,Reason';
        const csvBody = errors.map((e) => `${e.row},${String(e.reason).replace(/,/g, ';')}`).join('\n');
        response.errorReportCsv = `${csvHeader}\n${csvBody}`;
      }

      return NextResponse.json(response, { status: 200 });

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error('BULK IMPORT TRANSACTION ERROR:', error);
      return NextResponse.json({ error: 'An unexpected database error occurred. All changes have been rolled back.' }, { status: 500 });
    } finally {
      if (connection) connection.release();
    }

    const successfulImports = results.filter(r => r.status === 'success').length;
    const failedImports = results.length - successfulImports;

    return NextResponse.json({ 
        message: `Import process finished. ${successfulImports} successful, ${failedImports} failed.`,
        results,
        info: importMessages
    }, { status: hasErrors ? 207 : 200 }); // 207 Multi-Status

  } catch (error) {
    console.error('BULK IMPORT API ERROR:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while processing the file.' }, { status: 500 });
  }
}

