import { and, like, or } from 'drizzle-orm';
import { students as studentsTable } from '@/db/schema';
import { branchCodes, validateRollNo } from '@/lib/rollNumber';

function getAdmissionSymbol(examType) {
  const t = String(examType || '').trim().toUpperCase();
  if (t === 'EAMCET') return 'T';
  if (t === 'ECET') return 'L';
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
    const expectedAdmissionType = exam === 'ECET' ? 'Lateral' : 'Regular';
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

  // Get two-digit year if joiningYear is provided, otherwise use wildcard
  const yy = joiningYear ? twoDigitYear(joiningYear) : '__';

  // Search historical roll numbers for that branch and year
  // Regular: YY567TBB__
  // Lateral: YY567BB__L
  const regularPattern = `${yy}567T${branchCode}%`;
  const lateralPattern = `${yy}567${branchCode}%L`;

  // Select pattern based on admissionSymbol if provided
  let pattern = null;
  if (admissionSymbol === 'T') pattern = regularPattern;
  else if (admissionSymbol === 'L') pattern = lateralPattern;

  const rows = await tx
    .select({ roll_no: studentsTable.roll_no })
    .from(studentsTable)
    .where(
      and(
        pattern 
          ? like(studentsTable.roll_no, pattern)
          : or(like(studentsTable.roll_no, regularPattern), like(studentsTable.roll_no, lateralPattern))
      )
    );

  let maxSerial = 0;
  for (const row of rows) {
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
    throw new Error(`Serial overflow: branch ${branch} for year ${joiningYear || 'any'} has reached 99 seats`);
  }

  return nextSerial;
}

async function generateInstitutionalRollNumber(tx, { branch, examType, joiningYear }) {
  const branchCode = getBranchCodeFromName(branch);
  if (!branchCode) throw new Error(`Unknown branch: ${branch}`);

  const admissionSymbol = getAdmissionSymbol(examType);
  const nextSerial = await getNextSerialNumber(tx, { branch, joiningYear });

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
