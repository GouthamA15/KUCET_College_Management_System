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
  'EAMCET': 160,
  'ECET': 200,
  'PGECET': 120, // Assuming a default or common value for PGECET, can be updated if specified
};

function validateRollNo(rollNo) {
  if (typeof rollNo !== 'string' || rollNo.trim() === '') {
    return { isValid: false };
  }
  const regularPattern = /^(\d{2})567T(\d{2})(\d{2})$/;
  const lateralPattern = /^(\d{2})567(\d{2})(\d{2})L$/;

  const regularMatch = rollNo.match(regularPattern);
  const lateralMatch = rollNo.match(lateralPattern);

  if (regularMatch) {
    const [, year, branchCode, serial] = regularMatch;
    const branch = branchCodes[branchCode];
    if (branch && parseInt(serial) >= 1 && parseInt(serial) <= 99) {
      return {
        isValid: true,
        entryYear: `20${year}`,
        branch,
        admissionType: 'Regular',
      };
    }
  }

  if (lateralMatch) {
    const [, year, branchCode, serial] = lateralMatch;
    const branch = branchCodes[branchCode];
    if (branch && parseInt(serial) >= 1 && parseInt(serial) <= 99) {
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
  const entryYear = getEntryYearFromRoll(rollNo);
  const admissionType = getAdmissionTypeFromRoll(rollNo);

  if (!entryYear) {
    return null;
  }

  const startYear = parseInt(entryYear, 10);
  const endYear = admissionType === 'Regular' ? startYear + 4 : startYear + 3;

  return `${startYear}-${endYear}`;
}

function getCurrentStudyingYear(rollNo) {
  const entryYear = getEntryYearFromRoll(rollNo);
  const admissionType = getAdmissionTypeFromRoll(rollNo);

  if (!entryYear) {
    return null;
  }

  const entryYearInt = parseInt(entryYear, 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Effective academic base year: if before June, academic year belongs to previous calendar year
  const effectiveYear = currentMonth < 6 ? currentYear - 1 : currentYear;

  const academicYearIndex = effectiveYear - entryYearInt + 1;

  const maxYears = (admissionType && admissionType.toLowerCase() === 'lateral') ? 3 : 4;
  if (!Number.isInteger(academicYearIndex) || academicYearIndex < 1 || academicYearIndex > maxYears) return null;

  return academicYearIndex;
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

function getEntranceExamQualified(rollNo) {
  if (rollNo && typeof rollNo === 'string') {
    if (rollNo.includes('T')) {
      return 'EAMCET';
    }
    if (rollNo.includes('L')) {
      return 'ECET';
    }
  }
  return null;
}

export {
  validateRollNo,
  getEntryYearFromRoll,
  getBranchFromRoll,
  getAdmissionTypeFromRoll,
  getAcademicYear,
  getCurrentStudyingYear,
  getAcademicYearForStudyYear,
  getCurrentAcademicYear,
  getResolvedCurrentAcademicYear,
  getEntranceExamQualified,
  branchCodes,
  EXAM_TOTAL_MARKS,
};

function getCurrentAcademicYear(rollNo) {
  let entryYear = getEntryYearFromRoll(rollNo);
  let admissionType = getAdmissionTypeFromRoll(rollNo);

  // If strict parsing failed, attempt a tolerant extraction for slightly malformed/short roll numbers
  if (!entryYear && typeof rollNo === 'string' && rollNo.includes('567')) {
    const maybeYear = rollNo.slice(0, 2);
    if (/^\d{2}$/.test(maybeYear)) {
      entryYear = `20${maybeYear}`;
      admissionType = rollNo.includes('L') ? 'Lateral' : 'Regular';
    }
  }

  if (!entryYear) return null;

  const admissionYear = parseInt(entryYear, 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const effectiveYear = currentMonth < 6 ? currentYear - 1 : currentYear;
  const academicYearIndex = effectiveYear - admissionYear + 1;

  const maxYears = (admissionType && admissionType.toLowerCase() === 'lateral') ? 3 : 4;
  if (!Number.isInteger(academicYearIndex) || academicYearIndex < 1 || academicYearIndex > maxYears) return null;

  const startYear = admissionYear + (academicYearIndex - 1);
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

// Authoritative resolver for current academic year
// Throws on invalid roll number format. Frontend must not compute academic year independently.
function getResolvedCurrentAcademicYear(rollNo) {
  if (typeof rollNo !== 'string') {
    throw new Error('Invalid roll number format – cannot determine academic year');
  }

  let entryYear = getEntryYearFromRoll(rollNo);
  let admissionType = getAdmissionTypeFromRoll(rollNo);

  // Tolerant parsing fallback: handle slightly malformed values while preserving intent
  if (!entryYear) {
    const two = String(rollNo).slice(0, 2);
    if (/^\d{2}$/.test(two) && String(rollNo).includes('567')) {
      entryYear = `20${two}`;
      admissionType = String(rollNo).includes('L') ? 'Lateral' : 'Regular';
    }
  }

  if (!entryYear) {
    throw new Error('Invalid roll number format – cannot determine academic year');
  }

  const admissionYear = parseInt(entryYear, 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // June boundary: before June -> academic base is previous calendar year
  const effectiveYear = currentMonth < 6 ? currentYear - 1 : currentYear;
  let academicYearIndex = effectiveYear - admissionYear + 1;

  const maxYears = (admissionType && String(admissionType).toLowerCase() === 'lateral') ? 3 : 4;
  // Clamp to course duration bounds
  if (!Number.isFinite(academicYearIndex)) academicYearIndex = 1;
  if (academicYearIndex < 1) academicYearIndex = 1;
  if (academicYearIndex > maxYears) academicYearIndex = maxYears;

  const startYear = admissionYear + (academicYearIndex - 1);
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}
