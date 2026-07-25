import { _db } from '@/db';
import { 
  students as _studentsTable, 
  _studentPersonalDetails, 
  _studentAcademicBackground,
  _studentImportLogs
} from '@/db/schema';
import { _eq, _inArray } from 'drizzle-orm';
import * as XLSX from 'xlsx-js-style';
import { toMySQLDate, parseDate } from '@/lib/date';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { _StudentService } from '@/services/StudentService';

// Header normalization: lowercase, trim, spaces & hyphens to _, remove non-word chars
const normalizeHeader = (h) => {
  const s = String(h || '').toLowerCase().trim();
  return s
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

const VALID_CATEGORIES = new Set(['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'SC-A', 'SC-B', 'SC-C', 'SC-D', 'ST', 'EWS']);

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
    permanent_address: ['permanent_address', 'permanentaddress', 'address', 'residential_address', 'aadhar_card_address'],
    contact_address: ['contact_address', 'contactaddress', 'current_address', 'currentaddress', 'present_address', 'presentaddress'],
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
    guardian_mobile: ['guardian_mobile', 'parent_mobile', 'emergency_contact']
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
  const mapping = { /* empty */ };
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
  const requiredCanon = ['roll_no', 'name', 'gender', 'date_of_birth', 'father_name', 'category', 'permanent_address'];
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

export const POST = wrapHandler({
  auth: 'clerk',
  handler: async (req, { user, _ip }) => {
    if (user.role !== 'admission') return apiError('Forbidden', 403);

    const clerkId = user.clerkId || user.id;
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
        const rowObject = { /* empty */ };
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
      const student = { /* empty */ };
      const personal = { /* empty */ };
      const academic = { /* empty */ };

      Object.keys(record).forEach(key => {
        if (key.startsWith('_')) return;
        if (ALIASES.students[key]) {
            let val = record[key];
            if (key === 'mobile' && val) {
              const cleanMobile = String(val).replace(/\D/g, '');
              if (cleanMobile.length === 10) {
                student['mobile'] = encrypt(cleanMobile);
                student['mobile_hash'] = hashForIndex(cleanMobile);
              }
            } else {
              student[key] = val;
            }
        }
        else if (ALIASES.student_personal_details[key]) {
            let val = record[key];
            if (key === 'aadhaar_no' && val) {
              const cleanAadhaar = String(val).replace(/\D/g, '');
              if (cleanAadhaar.length === 12) {
                personal['aadhaar_no'] = encrypt(cleanAadhaar);
                personal['aadhaar_hash'] = hashForIndex(cleanAadhaar);
              }
            } else if (key === 'guardian_mobile' && val) {
              const cleanGMobile = String(val).replace(/\D/g, '');
              if (cleanGMobile.length === 10) {
                personal['guardian_mobile'] = encrypt(cleanGMobile);
              }
            } else {
              personal[key] = val;
            }
        }
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
      let category = String(personal.category || '').trim().replace(/\s*-\s*/g, '-').toUpperCase();
      if (category === 'OC-EWS' || category === 'O-EWS') category = 'EWS';
      const permanent_address = String(personal.permanent_address || personal.address || '').trim();
      const contact_address = String(personal.contact_address || '').trim() || permanent_address;

      if (!name || !gender || !dob || !fatherName || !category || !permanent_address || !VALID_CATEGORIES.has(category)) {
        errors.push({ row: rowNumber, roll_no: roll, reason: 'Validation failed (missing or invalid fields)' });
        continue;
      }

      prepared.push({
        student: { ...student, roll_no: roll, name, gender, date_of_birth: dob },
        personal: { ...personal, father_name: fatherName, category, permanent_address, contact_address },
        academic,
        rowNumber
      });
    }

    if (prepared.length === 0) return { totalRows, inserted: 0, updated: 0, skipped: totalRows, errors };

    // Offload to background queue (Upstash QStash)
    const { Queue } = await import('@/lib/queue');
    const CHUNK_SIZE = 50; // Process 50 records per webhook invocation to prevent Vercel timeouts
    
    let queuedChunks = 0;
    const chunkPromises = [];
    for (let i = 0; i < prepared.length; i += CHUNK_SIZE) {
      const chunk = prepared.slice(i, i + CHUNK_SIZE);
      chunkPromises.push(Queue.enqueueBulkImportChunk(chunk, clerkId, importFileName));
    }
    
    try {
      const results = await Promise.all(chunkPromises);
      if (results.some(r => !r || r.success === false)) {
        throw new Error("One or more chunks failed to queue (QStash not configured or error)");
      }
      queuedChunks = chunkPromises.length;
    } catch (enqueueError) {
      return apiError('Failed to queue bulk import tasks: ' + enqueueError.message, 500);
    }

    return {
      message: `Bulk import queued. ${prepared.length} records are being processed in the background across ${queuedChunks} chunks.`,
      totalRows,
      queuedChunks,
      inserted: 0, // Client should check logs later for actual inserted count
      updated: 0,
      skipped: 0,
      errors // Return inline validation errors immediately
    };
  }
});
