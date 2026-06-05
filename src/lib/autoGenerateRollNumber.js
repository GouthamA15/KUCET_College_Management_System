import { and, like, or, eq } from 'drizzle-orm';
import { students as studentsTable, studentAdmissionDrafts } from '@/db/schema';
import { branchCodes, validateRollNo } from '@/lib/rollNumber';

function getAdmissionSymbol(examType) {
  const t = String(examType || '').trim().toUpperCase();
  if (t === 'TG EAPCET') return 'T';
  if (t === 'TG ECET') return 'L';
  throw new Error(`Unsupported examType: ${examType}`);
}

function getBranchCodeFromName(branchName) {
  const name = String(branchName || '').trim().toUpperCase();
  const entry = Object.entries(branchCodes).find(([, n]) => String(n).toUpperCase() === name);
  return entry ? entry[0] : null;
}

function twoDigitSerial(serial) {
  const n = Number(serial);
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw new Error('Serial must be an integer between 1 and 99');
  }
  return String(n).padStart(2, '0');
}

function twoDigitYear(joiningYear) {
  const y = Number(joiningYear);
  if (!Number.isInteger(y) || y < 2000 || y > 2099) {
    throw new Error('joiningYear must be a 4-digit year (e.g., 2025)');
  }
  return String(y).slice(-2);
}

function buildRollNumber({ joiningYear, branchCode, serial, admissionSymbol, collegeCode = '567' }) {
  const yy = twoDigitYear(joiningYear);
  const ss = twoDigitSerial(serial);
  const bc = String(branchCode);
  if (!/^\d{2}$/.test(bc)) throw new Error('branchCode must be a 2-digit string');

  const sym = String(admissionSymbol).toUpperCase();
  if (sym === 'T') {
    return `${yy}${collegeCode}T${bc}${ss}`;
  }
  if (sym === 'L') {
    return `${yy}${collegeCode}${bc}${ss}L`;
  }
  throw new Error(`Unsupported admissionSymbol: ${admissionSymbol}`);
}

function extractSerialFromRoll(rollNo) {
  if (typeof rollNo !== 'string') return null;
  const v = rollNo.trim().toUpperCase();

  const regularMatch = v.match(/^(\d{2})567T(\d{2})(\d{2})$/);
  if (regularMatch) {
    const serial = parseInt(regularMatch[3], 10);
    return Number.isFinite(serial) ? serial : null;
  }

  const lateralMatch = v.match(/^(\d{2})567(\d{2})(\d{2})L$/);
  if (lateralMatch) {
    const serial = parseInt(lateralMatch[3], 10);
    return Number.isFinite(serial) ? serial : null;
  }

  return null;
}

function validateGeneratedRollNumber(rollNo, { expectedBranch, expectedExamType } = {}) {
  const parsed = validateRollNo(String(rollNo || '').trim().toUpperCase());
  if (!parsed.isValid) return { isValid: false, error: 'Invalid roll number format' };

  if (expectedBranch && String(parsed.branch).toUpperCase() !== String(expectedBranch).toUpperCase()) {
    return { isValid: false, error: `Branch mismatch (got ${parsed.branch})` };
  }

  if (expectedExamType) {
    const exam = String(expectedExamType).toUpperCase();
    const expectedAdmissionType = (exam === 'TG ECET') ? 'Lateral' : 'Regular';
    if (String(parsed.admissionType) !== expectedAdmissionType) {
      return { isValid: false, error: `Admission type mismatch (expected ${expectedAdmissionType})` };
    }
  }

  return { isValid: true };
}

async function getNextSerialNumber(tx, { branch, joiningYear, admissionSymbol }) {
  const branchCode = getBranchCodeFromName(branch);
  if (!branchCode) {
    throw new Error(`Unknown branch: ${branch}`);
  }

  const yy = joiningYear ? twoDigitYear(joiningYear) : '__';
  let queryConditions = [];
  let draftConditions = [];

  if (admissionSymbol === 'L') {
    // LATERAL ENTRY RULE: Continue sequence from previous year's regulars
    // e.g., Batch 2025 starts in 2025 (Regulars) and joins 2nd year in 2026 (Laterals)
    const prevYY = joiningYear ? twoDigitYear(joiningYear - 1) : '__';
    
    // Condition 1: Regulars from PREVIOUS year (YY567TBB__)
    queryConditions.push(like(studentsTable.roll_no, `${prevYY}567T${branchCode}%`));
    draftConditions.push(like(studentAdmissionDrafts.roll_no, `${prevYY}567T${branchCode}%`));
    
    // Condition 2: Laterals from CURRENT year (YY567BB__L)
    queryConditions.push(like(studentsTable.roll_no, `${yy}567${branchCode}%L`));
    draftConditions.push(like(studentAdmissionDrafts.roll_no, `${yy}567${branchCode}%L`));
  } else {
    // REGULAR ENTRY RULE: Just search current year regulars
    queryConditions.push(like(studentsTable.roll_no, `${yy}567T${branchCode}%`));
    draftConditions.push(like(studentAdmissionDrafts.roll_no, `${yy}567T${branchCode}%`));
    // Also include any laterals from the SAME year just in case (unlikely but safe)
    queryConditions.push(like(studentsTable.roll_no, `${yy}567${branchCode}%L`));
    draftConditions.push(like(studentAdmissionDrafts.roll_no, `${yy}567${branchCode}%L`));
  }

  const studentRows = await tx
    .select({ roll_no: studentsTable.roll_no })
    .from(studentsTable)
    .where(or(...queryConditions));

  const draftRows = await tx
    .select({ roll_no: studentAdmissionDrafts.roll_no })
    .from(studentAdmissionDrafts)
    .where(and(
      or(...draftConditions),
      eq(studentAdmissionDrafts.status, 'PROCESSED')
    ));

  const allRows = [...studentRows, ...draftRows];

  let maxSerial = 0;
  for (const row of allRows) {
    const rn = row.roll_no;
    if (!rn) continue;

    const parsed = validateRollNo(String(rn).toUpperCase());
    if (!parsed.isValid) continue;
    if (String(parsed.branch).toUpperCase() !== String(branch).toUpperCase()) continue;

    const serial = extractSerialFromRoll(rn);
    if (!Number.isInteger(serial)) continue;

    if (serial > maxSerial) maxSerial = serial;
  }

  const nextSerial = maxSerial + 1;
  if (nextSerial > 99) {
    throw new Error(`Serial overflow: branch ${branch} has reached 99 seats for this batch sequence`);
  }

  return nextSerial;
}

async function generateInstitutionalRollNumber(tx, { branch, examType, joiningYear }) {
  const branchCode = getBranchCodeFromName(branch);
  if (!branchCode) throw new Error(`Unknown branch: ${branch}`);

  const admissionSymbol = getAdmissionSymbol(examType);
  const nextSerial = await getNextSerialNumber(tx, { branch, joiningYear, admissionSymbol });

  const rollNumber = buildRollNumber({
    joiningYear,
    branchCode,
    serial: nextSerial,
    admissionSymbol,
  });

  const check = validateGeneratedRollNumber(rollNumber, { expectedBranch: branch, expectedExamType: examType });
  if (!check.isValid) {
    throw new Error(check.error || 'Generated roll number failed validation');
  }

  return rollNumber;
}

export {
  generateInstitutionalRollNumber,
  getNextSerialNumber,
  extractSerialFromRoll,
  buildRollNumber,
  getAdmissionSymbol,
  validateGeneratedRollNumber,
  getBranchCodeFromName,
};
