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

const VALID_CATEGORIES = new Set(['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'OC-EWS']);

// Alias mapping dictionary: normalized header -> canonical field
const ALIASES = {
  // Students table
  students: {
    roll_no: ['roll_no', 'rollnumber', 'roll_number', 'registration_no', 'reg_no', 'regnumber', 'hall_ticket_no', 'studentid', 'ht_no', 'hall_ticket_number'],
    name: ['name', 'candidate_name', 'student_name', 'fullname', 'name_of_this_student', 'name_of_the_candidate'],
    gender: ['gender', 'sex'],
    date_of_birth: ['dob', 'date_of_birth', 'birth_date', 'dateofbirth'],
    mobile: ['mobile', 'phone', 'phone_number', 'mobile_number', 'contact_number', 'mobile_no', 'student_number', 'number'],
    email: ['email', 'mail_id', 'email_id'],
  },
  // Student personal details table
  student_personal_details: {
    father_name: ['father_name', 'fathers_name', 'parent_name'],
    category: ['category', 'caste_category', 'caste', 'category_cast'],
    address: ['address', 'residential_address', 'permanent_address', 'aadhar_card_address'],
    mother_name: ['mother_name', 'mothers_name'],
    nationality: ['nationality', 'native_country'],
    religion: ['religion'],
    sub_caste: ['sub_caste', 'subcaste'],
    area_status: ['area_status', 'areastatus', 'area_statu', 'local__non_local'],
    aadhaar_no: ['aadhaar_no', 'aadhaar', 'aadhar', 'aadhar_no', 'uid', 'aadhar_card_number'],
    place_of_birth: ['place_of_birth'],
    father_occupation: ['father_occupation', 'father_work'],
    annual_income: ['annual_income', 'income'],
    identification_marks: ['identification_mark', 'identify_marks'],
  },
  // Academic background (optional)
  student_academic_background: {
    qualifying_exam: ['qualifying_exam', 'qualifyingexam'],
    previous_college_details: ['previous_college_details', 'previouscollege', 'previous_college'],
    medium_of_instruction: ['medium_of_instruction', 'medium', 'medium_of_education', 'language_of_education', 'education_medium'],
    year_of_study: ['year_of_study', 'year'],
    total_marks: ['total_marks', 'totalmarks'],
    marks_secured: ['marks_secured', 'secured_marks', 'marksobtained'],
    intermediate_rank: ['rank', 'intermediate_rank'],
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
    const contentType = req.headers.get('content-type') || '';
    let rows;
    let headers;

    const errors = [];
    const prepared = []; // array of { student, personal, academic, rowNumber, isUpdate: boolean, existingId: number }
    const seenRolls = new Map(); // roll_no -> firstRow

    if (contentType.includes('application/json')) {
      const { students } = await req.json();
      if (!students || !Array.isArray(students) || students.length === 0) {
        return NextResponse.json({ error: 'No student data received.' }, { status: 400 });
      }
      totalRows = students.length;
      // When receiving JSON, the data is already processed by the client with canonical keys.
      // We can directly process these objects.
      processRows(students, true);

    } else { // Handle multipart/form-data for file upload
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (!sheetRows || sheetRows.length < 2) {
        return NextResponse.json({ error: 'The uploaded data is empty or missing headers.' }, { status: 400 });
      }
      
      const headers = sheetRows[0];
      const dataRows = sheetRows.slice(1);
      totalRows = dataRows.length;

      const { mapping, missingRequired } = buildHeaderMapping(headers);
      if (missingRequired.length > 0) {
        const aliasHints = {};
        missingRequired.forEach(canonical => {
            for (const table of Object.keys(ALIASES)) {
                if (ALIASES[table][canonical]) {
                    aliasHints[canonical] = ALIASES[table][canonical];
                    break;
                }
            }
        });
        const missingDisplayNames = missingRequired.map(f => ({ field: f, display: REQUIRED_DISPLAY[f] || f }));
        return NextResponse.json({ type: 'HEADER_ERRORS', error: 'Missing required columns.', missingRequired, missingDisplayNames, aliasHints, detectedHeaders: headers.map(String) }, { status: 400 });
      }
      
      // Convert sheet rows (array of arrays) to object rows (array of objects with canonical keys)
      const objectRows = dataRows.map((rowArray, rowIndex) => {
        const rowObject = {};
        headers.forEach((header, index) => {
            const map = mapping[index];
            if(map) {
                rowObject[map.field] = rowArray[index];
            }
        });
        return rowObject;
      });
      processRows(objectRows, false); // isJson = false for Excel uploads
    }
    
    // Helper function to process and validate each row from either JSON or Excel
    function processRows(records, isJson = false) {
        for(let i = 0; i < records.length; i++) {
            const record = records[i];
            const rowNumber = i + (isJson ? 1 : 2); // Excel rows start at 1 (for header), data at 2. JSON is 0-indexed.

            const student = {};
            const personal = {};
            const academic = {};
            
            // Distribute fields from the record into their respective table objects
            Object.keys(record).forEach(key => {
                if (key.startsWith('_')) return; // Ignore client-side internal keys like _errors

                // Find which table this key belongs to
                let tableFound = null;
                for (const table in ALIASES) {
                    // Check if the key exists as a canonical field in any ALIASES table group
                    if (ALIASES[table] && ALIASES[table][key]) {
                        tableFound = table;
                        break;
                    }
                }
                
                if (tableFound === 'students') student[key] = record[key];
                else if (tableFound === 'student_personal_details') personal[key] = record[key];
                else if (tableFound === 'student_academic_background') academic[key] = record[key];
                // Fields not mapped to any alias group are ignored
            });

            const roll = String(student.roll_no || '').trim();
            if (!roll) { errors.push({ row: rowNumber, roll_no: null, reason: 'Roll number is missing' }); continue; }
            if (seenRolls.has(roll)) { errors.push({ row: rowNumber, roll_no: roll, reason: 'Duplicate roll number in file' }); continue; }
            seenRolls.set(roll, rowNumber); // Mark as seen in this batch

            const validationResult = validateRecord(roll, student, personal, academic);
            if(validationResult.error) {
                errors.push({ row: rowNumber, roll_no: roll, reason: validationResult.error });
                continue;
            }
            
            prepared.push({ student: validationResult.student, personal: validationResult.personal, academic, rowNumber });
        }
    }

    // Helper function for per-record validation
    function validateRecord(roll, student, personal, academic) {
        const name = String(student.name || '').trim();
        if (!name) return { error: 'Name is missing' };
        
        const genderCanonical = normalizeGender(student.gender);
        if (!genderCanonical) return { error: 'Invalid or missing gender' };
        
        const dobCanonical = normalizeDateToMySQL(student.date_of_birth);
        if (!dobCanonical) return { error: 'Invalid or missing DOB' };
        
        const fatherName = String(personal.father_name || '').trim();
        if (!fatherName) return { error: 'Father name is missing' };
        
        const category = String(personal.category || '').trim().replace(/\s*-\s*/g, '-');
        if (!category) return { error: 'Category is missing' };
        if (!VALID_CATEGORIES.has(category)) return { error: `Invalid category '${category}'` };

        const address = String(personal.address || '').trim();
        if (!address) return { error: 'Address is missing' };

        // Normalize and set canonical values for insertion
        student.roll_no = roll;
        student.name = name;
        student.gender = genderCanonical;
        student.date_of_birth = dobCanonical;
        personal.father_name = fatherName;
        personal.category = category;
        personal.address = address;
        
        if (student.mobile) {
            const mob = String(student.mobile).trim();
            if (mob && !/^(\+91)?\d{10}$/.test(mob)) return { error: `Invalid mobile: ${mob}` };
            student.mobile = mob || null;
        } else {
            student.mobile = null;
        }

        if (student.email) {
            const em = String(student.email).trim();
            if (em && !/\S+@\S+\.\S+/.test(em)) return { error: `Invalid email: ${em}` };
            student.email = em || null;
        } else {
            student.email = null;
        }

        // Other personal details (ensure null if empty for DB)
        personal.mother_name = String(personal.mother_name || '').trim() || null;
        personal.nationality = String(personal.nationality || '').trim() || null;
        personal.religion = String(personal.religion || '').trim() || null;
        personal.sub_caste = String(personal.sub_caste || '').trim() || null;
        personal.area_status = String(personal.area_status || '').trim() || null;
        personal.aadhaar_no = String(personal.aadhaar_no || '').trim() || null;
        personal.place_of_birth = String(personal.place_of_birth || '').trim() || null;
        personal.father_occupation = String(personal.father_occupation || '').trim() || null;
        personal.annual_income = String(personal.annual_income || '').trim() || null;
        personal.identification_marks = String(personal.identification_marks || '').trim() || null;

        // Academic details (ensure null if empty for DB)
        academic.qualifying_exam = String(academic.qualifying_exam || '').trim() || null;
        academic.previous_college_details = String(academic.previous_college_details || '').trim() || null;
        academic.medium_of_instruction = String(academic.medium_of_instruction || '').trim() || null;
        academic.year_of_study = academic.year_of_study === undefined ? null : academic.year_of_study; // Keep number or set null
        academic.total_marks = academic.total_marks === undefined ? null : academic.total_marks;
        academic.marks_secured = academic.marks_secured === undefined ? null : academic.marks_secured;
        academic.intermediate_rank = academic.intermediate_rank === undefined ? null : academic.intermediate_rank;

        return { student, personal, academic };
    }
    
    // Helper to compare incoming record with existing DB record
    function compareRecords(incomingRec, existingDbRec) {
      const studentUpdates = {};
      const personalUpdates = {};
      const academicUpdates = {};
      let hasChanges = false;

      // Fields for students table
      const STUDENT_FIELDS = ['name', 'email', 'mobile', 'date_of_birth', 'gender'];
      STUDENT_FIELDS.forEach(field => {
          const incomingValue = incomingRec.student[field] !== undefined ? String(incomingRec.student[field]).trim() : '';
          const existingValue = existingDbRec[field] !== null ? String(existingDbRec[field]).trim() : '';
          
          if (field === 'date_of_birth') {
              // Compare normalized dates
              const normalizedIncomingDate = normalizeDateToMySQL(incomingRec.student[field]);
              const normalizedExistingDate = normalizeDateToMySQL(existingDbRec.date_of_birth);
              if (normalizedIncomingDate !== normalizedExistingDate) {
                  studentUpdates[field] = incomingRec.student[field];
                  hasChanges = true;
              }
          } else if (field === 'gender') {
              if (normalizeGender(incomingValue) !== normalizeGender(existingValue)) {
                  studentUpdates[field] = incomingRec.student[field];
                  hasChanges = true;
              }
          } else if (field === 'email' || field === 'mobile') {
              // These can be null, compare directly after trimming
              if (incomingValue !== existingValue) {
                  studentUpdates[field] = incomingRec.student[field];
                  hasChanges = true;
              }
          }
          else if (incomingValue !== existingValue) {
              studentUpdates[field] = incomingRec.student[field];
              hasChanges = true;
          }
      });
      // Handle email/mobile explicitly if null from incoming but not existing (and vice-versa for cleanup)
      if (incomingRec.student.email === null && existingDbRec.email !== null) { studentUpdates.email = null; hasChanges = true; }
      if (incomingRec.student.mobile === null && existingDbRec.mobile !== null) { studentUpdates.mobile = null; hasChanges = true; }


      // Fields for student_personal_details table
      const PERSONAL_FIELDS = ['father_name', 'mother_name', 'address', 'category', 'nationality', 'religion', 'sub_caste', 'area_status', 'aadhaar_no', 'place_of_birth', 'father_occupation', 'annual_income', 'identification_marks'];
      PERSONAL_FIELDS.forEach(field => {
          const incomingValue = incomingRec.personal[field] !== undefined ? String(incomingRec.personal[field]).trim() : '';
          const existingValue = existingDbRec[field] !== null ? String(existingDbRec[field]).trim() : '';
          if (field === 'category') { // Normalize category for comparison
            if (incomingValue.replace(/\s*-\s*/g, '-') !== existingValue.replace(/\s*-\s*/g, '-')) {
                personalUpdates[field] = incomingRec.personal[field];
                hasChanges = true;
            }
          }
          else if (incomingValue !== existingValue) {
              personalUpdates[field] = incomingRec.personal[field];
              hasChanges = true;
          }
      });
      // Explicitly handle null for optional fields in personal details
      PERSONAL_FIELDS.forEach(field => {
        if (incomingRec.personal[field] === null && existingDbRec[field] !== null) { personalUpdates[field] = null; hasChanges = true; }
      });


      // Fields for student_academic_background table
      const ACADEMIC_FIELDS = ['qualifying_exam', 'previous_college_details', 'medium_of_instruction', 'year_of_study', 'total_marks', 'marks_secured', 'intermediate_rank'];
      ACADEMIC_FIELDS.forEach(field => {
          const incomingValue = incomingRec.academic[field] !== undefined ? String(incomingRec.academic[field]).trim() : '';
          const existingValue = existingDbRec[field] !== null ? String(existingDbRec[field]).trim() : '';
          // For numeric fields like year_of_study, total_marks, marks_secured, intermediate_rank, compare as numbers if possible
          if (['year_of_study', 'total_marks', 'marks_secured', 'intermediate_rank'].includes(field)) {
            const numIncoming = Number(incomingValue);
            const numExisting = Number(existingValue);
            if (!isNaN(numIncoming) && !isNaN(numExisting) && numIncoming !== numExisting) {
                academicUpdates[field] = incomingRec.academic[field];
                hasChanges = true;
            } else if (isNaN(numIncoming) && !isNaN(numExisting)) { // Incoming is not number, existing is
                academicUpdates[field] = incomingRec.academic[field]; // Set to whatever incoming is (likely null)
                hasChanges = true;
            } else if (!isNaN(numIncoming) && isNaN(numExisting)) { // Incoming is number, existing is not
                academicUpdates[field] = incomingRec.academic[field];
                hasChanges = true;
            }
          }
          else if (incomingValue !== existingValue) {
              academicUpdates[field] = incomingRec.academic[field];
              hasChanges = true;
          }
      });
      // Explicitly handle null for optional fields in academic details
      ACADEMIC_FIELDS.forEach(field => {
        if (incomingRec.academic[field] === null && existingDbRec[field] !== null) { academicUpdates[field] = null; hasChanges = true; }
      });


      return { hasChanges, studentUpdates, personalUpdates, academicUpdates };
    }

    // DB-level check and prepare for updates/inserts
    const pool = getDb();
    const incomingRollList = prepared.map((p) => p.student.roll_no);
    
    // Arrays to hold records for insertion and updating
    const recordsToInsert = [];
    const recordsToUpdate = [];
    // updatedCount is already declared globally

    if (incomingRollList.length > 0) {
      try {
        // Fetch existing data for all incoming roll numbers
        const [existingStudentsDb] = await pool.execute(
          `SELECT s.id, s.roll_no, s.name, s.email, s.mobile, s.date_of_birth, s.gender,
                  sp.id AS personal_id, sp.father_name, sp.mother_name, sp.address, sp.category, sp.nationality, sp.religion, sp.sub_caste, sp.area_status, sp.aadhaar_no, sp.place_of_birth, sp.father_occupation, sp.annual_income, sp.identification_marks,
                  sa.id AS academic_id, sa.qualifying_exam, sa.previous_college_details, sa.medium_of_instruction, sa.year_of_study, sa.total_marks, sa.marks_secured, sa.intermediate_rank
           FROM students s
           LEFT JOIN student_personal_details sp ON s.id = sp.student_id
           LEFT JOIN student_academic_background sa ON s.id = sa.student_id
           WHERE s.roll_no IN (${incomingRollList.map(() => '?').join(',')})`,
          incomingRollList
        );

        const existingDataMap = new Map(); // roll_no -> full existing record
        existingStudentsDb.forEach(row => existingDataMap.set(row.roll_no, row));

        for (const rec of prepared) {
          const incomingRoll = rec.student.roll_no;
          if (existingDataMap.has(incomingRoll)) {
            // This is an existing student, check for changes
            const existingRecord = existingDataMap.get(incomingRoll);
            rec.existingId = existingRecord.id; // Store student_id for updates
            rec.personalExistingId = existingRecord.personal_id; // Store personal_id
            rec.academicExistingId = existingRecord.academic_id; // Store academic_id

            // Compare incoming data with existing data
            const changes = compareRecords(rec, existingRecord);

            if (changes.hasChanges) {
              rec.changes = changes; // Attach detected changes
              recordsToUpdate.push(rec);
            } else {
              // No changes, skip this record
              errors.push({ row: rec.rowNumber, roll_no: incomingRoll, reason: 'Roll number already exists, no changes detected.' });
            }
          } else {
            // New student, mark for insertion
            recordsToInsert.push(rec);
          }
        }
        // Clear prepared, will re-populate with recordsToInsert and recordsToUpdate
        prepared.splice(0, prepared.length); 
        prepared.push(...recordsToInsert, ...recordsToUpdate); // Re-order for better processing (inserts then updates)

      } catch (dupCheckErr) {
        console.error('DB-level check error:', dupCheckErr);
        return NextResponse.json({ error: 'Failed to process existing student data.' }, { status: 500 });
      }
    }
    
    let connection;
    let insertedCount = 0; // Updated count is global
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      for (const rec of prepared) {
        const { student, personal, academic, existingId, personalExistingId, academicExistingId, changes } = rec;

        if (existingId) { // Record needs update
          // Update students table
          if (Object.keys(changes.studentUpdates).length > 0) {
            const updateFields = Object.keys(changes.studentUpdates).map(field => `${field} = ?`).join(', ');
            const updateValues = Object.values(changes.studentUpdates);
            await connection.execute(
              `UPDATE students SET ${updateFields} WHERE id = ?`,
              [...updateValues, existingId]
            );
          }

          // Update student_personal_details table or insert if it doesn't exist
          if (personalExistingId) {
            if (Object.keys(changes.personalUpdates).length > 0) {
              const updateFields = Object.keys(changes.personalUpdates).map(field => `${field} = ?`).join(', ');
              const updateValues = Object.values(changes.personalUpdates);
              await connection.execute(
                `UPDATE student_personal_details SET ${updateFields} WHERE id = ?`,
                [...updateValues, personalExistingId]
              );
            }
          } else if (Object.keys(personal).length > 0) { // No personal details record, but incoming has data, so insert
            const personalKeys = Object.keys(personal).join(', ');
            const personalPlaceholders = Object.keys(personal).map(() => '?').join(', ');
            await connection.execute(
              `INSERT INTO student_personal_details (student_id, ${personalKeys}) VALUES (?, ${personalPlaceholders})`,
              [existingId, ...Object.values(personal)]
            );
          }


          // Update student_academic_background table or insert if it doesn't exist
          if (academicExistingId) {
            if (Object.keys(changes.academicUpdates).length > 0) {
              const updateFields = Object.keys(changes.academicUpdates).map(field => `${field} = ?`).join(', ');
              const updateValues = Object.values(changes.academicUpdates);
              await connection.execute(
                `UPDATE student_academic_background SET ${updateFields} WHERE id = ?`,
                [...updateValues, academicExistingId]
              );
            }
          } else if (Object.keys(academic).length > 0) { // No academic record, but incoming has data, so insert
              const academicKeys = Object.keys(academic).join(', ');
              const academicPlaceholders = Object.keys(academic).map(() => '?').join(', ');
              await connection.execute(
                `INSERT INTO student_academic_background (student_id, ${academicKeys}) VALUES (?, ${academicPlaceholders})`,
                [existingId, ...Object.values(academic)]
              );
          }
          updatedCount++;

        } else { // New record, perform insert
          // Insert into students
          const [studentResult] = await connection.execute(
            `INSERT INTO students (roll_no, name, email, mobile, date_of_birth, is_email_verified, gender)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              student.roll_no,
              student.name,
              student.email,
              student.mobile,
              student.date_of_birth, // already normalized YYYY-MM-DD
              0,
              student.gender,
            ]
          );
          const studentId = studentResult.insertId;

          // Personal details (if any data provided)
          if (Object.keys(personal).length > 0) {
            const personalKeys = Object.keys(personal).join(', ');
            const personalPlaceholders = Object.keys(personal).map(() => '?').join(', ');
            await connection.execute(
              `INSERT INTO student_personal_details (student_id, ${personalKeys}) VALUES (?, ${personalPlaceholders})`,
              [studentId, ...Object.values(personal)]
            );
          }

          // Academic background (if any data provided)
          if (Object.keys(academic).length > 0) {
            const academicKeys = Object.keys(academic).join(', ');
            const academicPlaceholders = Object.keys(academic).map(() => '?').join(', ');
            await connection.execute(
              `INSERT INTO student_academic_background (student_id, ${academicKeys}) VALUES (?, ${academicPlaceholders})`,
              [studentId, ...Object.values(academic)]
            );
          }
          insertedCount++;
        }
      }

      await connection.commit();

      const skippedCount = totalRows - insertedCount - updatedCount; // Adjusted skipped count
      const response = {
        totalRows,
        inserted: insertedCount,
        updated: updatedCount, // Include updated count
        skipped: skippedCount,
        errors,
      };

      // Attach CSV for errors if any
      if (errors.length > 0) {
        const csvHeader = 'Row,Roll Number,Reason';
        const csvBody = errors.map((e) => `${e.row},${e.roll_no || 'N/A'},${String(e.reason).replace(/,/g, ';')}`).join('\n');
        response.errorReportCsv = `${csvHeader}\n${csvBody}`;
      }

      return NextResponse.json(response, { status: 200 });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('BULK IMPORT TRANSACTION ERROR:', error);
      return NextResponse.json({ error: 'Database transaction failed.' }, { status: 500 });
    } finally {
      if (connection) connection.release();
    }