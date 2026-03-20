import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentImportLogs,
  clerks
} from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import * as XLSX from 'xlsx-js-style';
import { toMySQLDate, parseDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { COLLEGE_CONFIG } from '@/lib/college-config';

// Header normalization: lowercase, trim, spaces & hyphens to _, remove non-word chars
const normalizeHeader = (h) => {
  const s = String(h || '').toLowerCase().trim();
  return s
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

// Canonical display names for required fields
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

const ALIASES = {
  students: {
    roll_no: ['roll_no', 'rollnumber', 'roll_number', 'registration_no', 'reg_no', 'regnumber', 'hall_ticket_no', 'studentid', 'ht_no', 'hall_ticket_number'],
    name: ['name', 'candidate_name', 'student_name', 'fullname', 'name_of_this_student', 'name_of_the_candidate'],
    gender: ['gender', 'sex'],
    date_of_birth: ['dob', 'date_of_birth', 'birth_date', 'dateofbirth'],
    mobile: ['mobile', 'phone', 'phone_number', 'mobile_number', 'contact_number', 'mobile_no', 'student_number', 'number'],
    email: ['email', 'mail_id', 'email_id'],
    fee_reimbursement: ['fee_reimbursement', 'fee_reimb', 'reimbursement', 'scholarship'],
  },
  student_personal_details: {
    father_name: ['father_name', 'fathers_name', 'parent_name'],
    blood_group: ['blood_group', 'bloodgroup', 'bg'],
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
  student_academic_background: {
    qualifying_exam: ['qualifying_exam', 'qualifyingexam'],
    previous_college_details: ['previous_college_details', 'previouscollege', 'previous_college'],
    medium_of_instruction: ['medium_of_instruction', 'medium', 'medium_of_education', 'language_of_education', 'education_medium'],
    ranks: ['rank', 'intermediate_rank'],
  },
};

function buildHeaderMapping(originalHeaders) {
  const normalized = originalHeaders.map(normalizeHeader);
  const mapping = {};
  normalized.forEach((hdr, idx) => {
    if (!hdr) return;
    let found = false;
    for (const table of Object.keys(ALIASES)) {
      for (const canonical of Object.keys(ALIASES[table])) {
        if (ALIASES[table][canonical].includes(hdr)) {
          mapping[idx] = { field: canonical, table };
          found = true;
          break;
        }
      }
      if (found) break;
    }
  });
  const requiredCanon = ['roll_no', 'name', 'gender', 'date_of_birth', 'father_name', 'category', 'address'];
  const present = new Set(Object.values(mapping).map((m) => m.field));
  const missing = requiredCanon.filter((f) => !present.has(f));
  return { mapping, normalizedHeaders: normalized, missingRequired: missing };
}

function normalizeGender(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (['male', 'm', 'boy'].includes(v)) return 'Male';
  if (['female', 'f', 'girl'].includes(v)) return 'Female';
  if (['other', 'o', 'others'].includes(v)) return 'Other';
  return null;
}

function normalizeDateToMySQL(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    return null;
  }
  const s = String(value);
  const parsedStrDate = parseDate(s);
  if (parsedStrDate) return parsedStrDate.toISOString().slice(0, 10);
  const mysql = toMySQLDate(s);
  if (mysql && /^\d{4}-\d{2}-\d{2}$/.test(mysql)) return mysql;
  return null;
}

export async function POST(req) {
  try {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'admission') return apiError('Forbidden', 403);

    const clerkId = user?.clerkId || user.id || null;
    const clerk = await db.query.clerks.findFirst({ where: eq(clerks.id, clerkId) });
    if (!clerk) return apiError('Unauthorized: clerk not found', 403);

    const contentType = req.headers.get('content-type') || '';
    let totalRows = 0;
    const errors = [];
    const prepared = [];
    const seenRolls = new Map();
    let importFileName = null;

    let records = [];
    let isJsonInput = false;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      records = body.students || [];
      isJsonInput = true;
    } else {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file) return apiError('No file uploaded.', 400);
      importFileName = file.name || null;
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!sheetRows || sheetRows.length < 2) return apiError('Data empty.', 400);
      
      const headers = sheetRows[0];
      const dataRows = sheetRows.slice(1);
      const { mapping, missingRequired } = buildHeaderMapping(headers);
      if (missingRequired.length > 0) return apiError('Missing required columns', 400);

      records = dataRows.map((rowArray) => {
        const rowObject = {};
        headers.forEach((header, index) => {
          const map = mapping[index];
          if (map) rowObject[map.field] = rowArray[index];
        });
        return rowObject;
      });
    }

    totalRows = records.length;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + (isJsonInput ? 1 : 2);
      const student = {};
      const personal = {};
      const academic = {};

      Object.keys(record).forEach(key => {
        if (key.startsWith('_')) return;
        if (ALIASES.students[key]) student[key] = record[key];
        else if (ALIASES.student_personal_details[key]) personal[key] = record[key];
        else if (ALIASES.student_academic_background[key]) academic[key] = record[key];
      });

      const roll = String(student.roll_no || '').trim();
      if (!roll) { errors.push({ row: rowNumber, roll_no: null, reason: 'Roll number missing' }); continue; }
      if (seenRolls.has(roll)) { errors.push({ row: rowNumber, roll_no: roll, reason: 'Duplicate in file' }); continue; }
      seenRolls.set(roll, rowNumber);

      // Simple Inline Validation
      const gender = normalizeGender(student.gender);
      const dob = normalizeDateToMySQL(student.date_of_birth);
      const name = String(student.name || '').trim();
      const fatherName = String(personal.father_name || '').trim();
      const category = String(personal.category || '').trim().replace(/\s*-\s*/g, '-');
      const address = String(personal.address || '').trim();

      if (!name || !gender || !dob || !fatherName || !category || !address || !VALID_CATEGORIES.has(category)) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Validation failed (missing or invalid fields)' });
        continue;
      }

      prepared.push({
        student: { ...student, roll_no: roll, name, gender, date_of_birth: dob },
        personal: { ...personal, father_name: fatherName, category, address },
        academic,
        rowNumber
      });
    }

    if (prepared.length === 0) return apiResponse({ totalRows, inserted: 0, updated: 0, skipped: totalRows, errors });

    const incomingRolls = prepared.map(p => p.student.roll_no);
    const existingStudents = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      personal_id: studentPersonalDetails.id,
      academic_id: studentAcademicBackground.id
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id))
    .where(inArray(studentsTable.roll_no, incomingRolls));

    const existingMap = new Map(existingStudents.map(s => [s.roll_no, s]));

    let insertedCount = 0;
    let updatedCount = 0;

    await db.transaction(async (tx) => {
      for (const rec of prepared) {
        const existing = existingMap.get(rec.student.roll_no);
        const { student, personal, academic } = rec;

        if (existing) {
          // Update
          await tx.update(studentsTable).set(student).where(eq(studentsTable.id, existing.id));
          if (existing.personal_id) {
            await tx.update(studentPersonalDetails).set(personal).where(eq(studentPersonalDetails.id, existing.personal_id));
          } else {
            await tx.insert(studentPersonalDetails).values({ student_id: existing.id, ...personal });
          }
          if (existing.academic_id) {
            await tx.update(studentAcademicBackground).set(academic).where(eq(studentAcademicBackground.id, existing.academic_id));
          } else if (Object.keys(academic).length > 0) {
            await tx.insert(studentAcademicBackground).values({ student_id: existing.id, ...academic });
          }
          updatedCount++;
        } else {
          // Insert
          const [res] = await tx.insert(studentsTable).values({ ...student, added_by_clerk_id: clerkId });
          const studentId = res.insertId;
          await tx.insert(studentPersonalDetails).values({ student_id: studentId, ...personal });
          if (Object.keys(academic).length > 0) {
            await tx.insert(studentAcademicBackground).values({ student_id: studentId, ...academic });
          }
          insertedCount++;
        }
      }

      if (insertedCount > 0) {
        await tx.insert(studentImportLogs).values({ clerk_id: clerkId, total_records: insertedCount, file_name: importFileName });
      }
    });

    return apiResponse({
      totalRows,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: totalRows - insertedCount - updatedCount,
      errors
    });

  } catch (error) {
    logger.error('BULK IMPORT ERROR:', error);
    return apiError('Import failed', 500);
  }
}
