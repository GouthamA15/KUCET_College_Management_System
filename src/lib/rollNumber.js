import { getNowSync } from './clock';

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

/**
 * Determines the effective start year of the current academic session.
 * Uses college-specific semester start dates if provided, otherwise defaults to June 1st.
 */
function getEffectiveAcademicYear(collegeInfo = null, now = getNowSync()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  // Boundary for new academic year: defaults to June (6) 1st
  const startMonth = parseInt(collegeInfo?.first_sem_start_month) || 6;
  const startDay = parseInt(collegeInfo?.first_sem_start_day) || 1;

  const currentTotal = currentMonth * 100 + currentDay;
  const boundaryTotal = startMonth * 100 + startDay;

  return currentTotal < boundaryTotal ? currentYear - 1 : currentYear;
}

function getCourseDuration(rollNo) {
  const type = getAdmissionTypeFromRoll(rollNo);
  return (type && type.toLowerCase() === 'lateral') ? 3 : 4;
}

function getCurrentStudyingYear(rollNo, collegeInfo = null, now = getNowSync(), offsetYears = 0) {
  const entryYear = getEntryYearFromRoll(rollNo);
  const admissionType = getAdmissionTypeFromRoll(rollNo);

  if (!entryYear) {
    return null;
  }

  const entryYearInt = parseInt(entryYear, 10);
  
  // Use collegeInfo to determine the effective academic year boundary
  const effectiveYear = getEffectiveAcademicYear(collegeInfo, now);

  // Residency Year (1st year in college, 2nd year in college, etc.)
  let residencyYear = effectiveYear - entryYearInt + 1;
  residencyYear -= (offsetYears || 0);

  const maxResidency = getCourseDuration(rollNo);
  if (!Number.isInteger(residencyYear) || residencyYear < 1 || residencyYear > maxResidency) return null;

  // Program Year (1st year of B.Tech, 2nd year of B.Tech, etc.)
  let programYear = residencyYear;
  if (admissionType && admissionType.toLowerCase() === 'lateral') {
    programYear += 1;
  }

  return programYear;
}

/**
 * Determine the current semester (1-8) for a student using roll number and college info.
 * Returns integer semester (1..8) or null when it cannot be determined.
 */
function getCurrentSemester(rollNo, collegeInfo = null, now = getNowSync(), offsetYears = 0) {
  const programYear = getCurrentStudyingYear(rollNo, collegeInfo, now, offsetYears);
  if (!programYear) return null;

  // Determine whether we are in the first or second semester of the study year
  const startMonth = parseInt(collegeInfo?.first_sem_start_month) || 6;
  const startDay = parseInt(collegeInfo?.first_sem_start_day) || 1;
  const currentTotal = (now.getMonth() + 1) * 100 + now.getDate();
  const boundaryTotal = startMonth * 100 + startDay;
  const isInFirstSem = currentTotal >= boundaryTotal;

  const sem = isInFirstSem ? (2 * programYear - 1) : (2 * programYear);
  if (!Number.isInteger(sem) || sem < 1 || sem > 8) return null;
  return sem;
}

function getAcademicYearForStudyYear(rollNo, yearOfStudy) {
  const entryYear = getEntryYearFromRoll(rollNo);
  if (!entryYear) {
    return null;
  }

  const admissionType = getAdmissionTypeFromRoll(rollNo);
  const entryYearInt = parseInt(entryYear, 10);
  
  // For laterals, Year 2 is their first year (entryYear)
  const academicYearStart = (admissionType?.toLowerCase() === 'lateral') 
    ? entryYearInt + (yearOfStudy - 2)
    : entryYearInt + (yearOfStudy - 1);

  const endYear = academicYearStart + 1;
  return `${academicYearStart}-${String(endYear).slice(-2)}`;
}

// Calculating Batch years
function getBatchFromRoll(rollNo) {
  const isLateral = rollNo.toUpperCase().endsWith('L');
  const admissionYearShort = parseInt(rollNo.substring(0, 2));
  const admissionYear = 2000 + admissionYearShort;
  
  // Batch start is 1 year earlier for laterals to match their classmates (graduation cohort)
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

function getCurrentAcademicYear(rollNo, collegeInfo = null, now = getNowSync()) {
  let entryYear = getEntryYearFromRoll(rollNo);
  if (!entryYear && typeof rollNo === 'string' && rollNo.includes('567')) {
    const maybeYear = rollNo.slice(0, 2);
    if (/^\d{2}$/.test(maybeYear)) entryYear = `20${maybeYear}`;
  }

  if (!entryYear) return null;

  const admissionYear = parseInt(entryYear, 10);
  const effectiveYear = getEffectiveAcademicYear(collegeInfo, now);
  const residencyYear = effectiveYear - admissionYear + 1;

  const maxResidency = getCourseDuration(rollNo);
  if (!Number.isInteger(residencyYear) || residencyYear < 1 || residencyYear > maxResidency) return null;

  const startYear = admissionYear + (residencyYear - 1);
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

// Authoritative resolver for current academic year
function getResolvedCurrentAcademicYear(rollNo, collegeInfo = null, now = getNowSync()) {
  if (typeof rollNo !== 'string') {
    throw new Error('Invalid roll number format – cannot determine academic year');
  }

  let entryYear = getEntryYearFromRoll(rollNo);
  if (!entryYear) {
    const two = String(rollNo).slice(0, 2);
    if (/^\d{2}$/.test(two) && String(rollNo).includes('567')) entryYear = `20${two}`;
  }

  if (!entryYear) {
    throw new Error('Invalid roll number format – cannot determine academic year');
  }

  const admissionYear = parseInt(entryYear, 10);
  const effectiveYear = getEffectiveAcademicYear(collegeInfo, now);
  let residencyYear = effectiveYear - admissionYear + 1;

  const maxResidency = getCourseDuration(rollNo);
  
  // Clamp to course duration bounds
  if (!Number.isFinite(residencyYear)) residencyYear = 1;
  if (residencyYear < 1) residencyYear = 1;
  if (residencyYear > maxResidency) residencyYear = maxResidency;

  const startYear = admissionYear + (residencyYear - 1);
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
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
  getEffectiveAcademicYear,
  getIntakeYear,
  getEntranceExamQualified,
  getBatchFromRoll,
  getCurrentSemester,
  getCourseDuration,
  branchCodes,
  EXAM_TOTAL_MARKS,
};
