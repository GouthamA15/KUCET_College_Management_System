import { getNowSync } from './clock.js';

const branchCodes = {
  '09': 'CSE',
  '30': 'CSD',
  '15': 'ECE',
  '12': 'EEE',
  '00': 'CIVIL',
  '18': 'IT',
  '03': 'MECH',
};

const EXAM_TOTAL_MARKS = {
  'TG EAPCET': 160,
  'TG ECET': 200,
  'PGECET': 120, // Assuming a default or common value for PGECET, can be updated if specified
};

function validateRollNo(rollNo) {
  if (typeof rollNo !== 'string' || rollNo.trim() === '') {
    return { isValid: false };
  }
  
  const cleanRollNo = rollNo.trim().toUpperCase();
  // Support alphanumeric serial numbers (e.g., A1, B2) common in large batches
  const regularPattern = /^(\d{2})567T(\d{2})([A-Z0-9]{2})$/;
  const lateralPattern = /^(\d{2})567T?(\d{2})([A-Z0-9]{2})L$/;

  const regularMatch = cleanRollNo.match(regularPattern);
  const lateralMatch = cleanRollNo.match(lateralPattern);

  if (regularMatch) {
    const [, year, branchCode, _serial] = regularMatch;
    const branch = branchCodes[branchCode];
    if (branch) {
      return {
        isValid: true,
        entryYear: `20${year}`,
        branch,
        admissionType: 'Regular',
      };
    }
  }

  if (lateralMatch) {
    const [, year, branchCode, _serial] = lateralMatch;
    const branch = branchCodes[branchCode];
    if (branch) {
      return {
        isValid: true,
        entryYear: `20${year}`,
        branch,
        admissionType: 'Lateral',
      };
    }
  }

  return { isValid: false };
}

function getEntryYearFromRoll(rollNo) {
  const { isValid, entryYear } = validateRollNo(rollNo);
  return isValid ? entryYear : null;
}

function getBranchFromRoll(rollNo) {
  const { isValid, branch } = validateRollNo(rollNo);
  return isValid ? branch : null;
}

function getAdmissionTypeFromRoll(rollNo) {
  const { isValid, admissionType } = validateRollNo(rollNo);
  return isValid ? admissionType : null;
}

function getAcademicYear(rollNo) {
  return getBatchFromRoll(rollNo);
}

/**
 * Determines the intake year for a new admission application.
 * From March onwards, applications are typically for the intake starting in the same calendar year.
 */
function getIntakeYear(now = getNowSync()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return currentMonth >= 3 ? currentYear : currentYear - 1;
}


function getAcademicYearForStudyYear(rollNo, yearOfStudy) {
  const entryYear = getEntryYearFromRoll(rollNo);
  if (!entryYear) {
    return null;
  }

  const startYear = parseInt(entryYear, 10) + (yearOfStudy - 1);
  const endYear = startYear + 1;

  return `${startYear}-${String(endYear).slice(-2)}`;
}

// Calculating Batch years
function getBatchFromRoll(rollNo) {
  const isLateral = rollNo.toUpperCase().endsWith('L');
  const admissionYearShort = parseInt(rollNo.substring(0, 2));
  const admissionYear = 2000 + admissionYearShort;
  
  // Batch start is 1 year earlier for laterals to match their classmates
  const batchStart = isLateral ? admissionYear - 1 : admissionYear;
  return `${batchStart}-${batchStart + 4}`;
}

function getEntranceExamQualified(rollNo) {
  if (rollNo && typeof rollNo === 'string') {
    if (rollNo.includes('T')) {
      return 'TG EAPCET';
    }
    if (rollNo.includes('L')) {
      return 'TG ECET';
    }
  }
  return null;
}


function canonicalizeRollNo(rollNo) {
  if (typeof rollNo !== 'string') return '';
  return rollNo.trim().toUpperCase().replace(/^(\d{2}567)T?/i, '$1T');
}

/**
 * Extracts and canonicalizes the student Roll Number from raw QR scanner output.
 * Fully backward-compatible with structured JSON, legacy JSON, labeled text, and raw regex.
 */
function extractRollNumberFromQR(decodedText) {
  if (!decodedText || typeof decodedText !== 'string') return null;

  let extractedRoll = null;

  // 0. Structured JSON Parse (preferred for versioned ID Card QR payloads)
  const trimmed = decodedText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidate = parsed.hallTicketNumber || parsed.roll || parsed.rollNo;
      if (candidate && typeof candidate === 'string') {
        extractedRoll = candidate.trim();
      }
    } catch (_) {
      // Fall through to regex
    }
  }

  // 1. Direct Regex Search: Look for the specific KUCET roll number pattern anywhere in the text
  // Note: Removed word boundaries (\b) and restricted serial to exactly 2 chars to extract safely from squashed text (e.g. 255671862LNAME)
  if (!extractedRoll) {
    const rollPatternMatch = decodedText.match(/(\d{2}567T?(?:09|30|15|12|00|18|03)[A-Za-z0-9]{2}L?)/i);
    
    if (rollPatternMatch) {
      extractedRoll = rollPatternMatch[1].trim();
    } else {
      // Fallback: If it's formatted weirdly but has a clear label, extract exactly 10 characters (KUCET roll length)
      const labelMatch = decodedText.match(/(?:HALL-TICKET-NO|HT-No|HT NO|ROLL NO)\s*[:-]?\s*([A-Za-z0-9]{10})/i);
      if (labelMatch) {
        extractedRoll = labelMatch[1].trim();
      } else if (decodedText.length < 10) {
        extractedRoll = decodedText.trim();
      } else {
        // Log internally and ignore to prevent polluting the scanner with giant strings
        return null;
      }
    }
  }

  const rollNo = extractedRoll.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return rollNo || null;
}

export {
  validateRollNo,
  canonicalizeRollNo,
  extractRollNumberFromQR,
  getEntryYearFromRoll,
  getBranchFromRoll,
  getAdmissionTypeFromRoll,
  getAcademicYear,
  getAcademicYearForStudyYear,
  getIntakeYear,
  getEntranceExamQualified,
  getBatchFromRoll,
  branchCodes,
  EXAM_TOTAL_MARKS,
};
