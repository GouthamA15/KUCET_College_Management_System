import { db } from '@/db';
import { semesters } from '@/db/schema';
import { sql, desc, asc } from 'drizzle-orm';
import { Clock } from './clock.js';
import { getEntryYearFromRoll, getAdmissionTypeFromRoll } from './rollNumber';

// Helper to get YYYY-MM-DD
function formatDate(dateObj) {
  return dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
}

/**
 * Core logic to calculate a student's year and semester given the current calendar session.
 */
export function calculateStudentYearAndSemester(rollNo, currentAcademicYear, currentSemester, offsetYears = 0) {
  const entryYear = getEntryYearFromRoll(rollNo);
  const admissionType = getAdmissionTypeFromRoll(rollNo);

  if (!entryYear) {
    return { yearOfStudy: null, semester: null, semesterLabel: 'N/A', status: 'Invalid Roll' };
  }

  const admissionYearInt = parseInt(entryYear, 10);
  const currentStartYearInt = parseInt(currentAcademicYear.split('-')[0], 10);

  let difference = currentStartYearInt - admissionYearInt;

  if (admissionType && admissionType.toLowerCase() === 'lateral') {
    difference += 1;
  }

  let studentYear = difference + 1 - (offsetYears || 0);
  if (studentYear < 1) studentYear = 1;

  const studentSemester = (studentYear - 1) * 2 + currentSemester;

  return {
    yearOfStudy: studentYear,
    semester: studentSemester,
    semesterLabel: `Year ${studentYear} / Sem ${studentSemester}`,
    academicYear: currentAcademicYear,
    calendarSemester: currentSemester,
    status: 'OK'
  };
}

/**
 * Returns the current academic session based strictly on the semesters table.
 * Returns { yearOfStudy, semester, semesterLabel, academicYear, calendarSemester, status }
 */
export async function calculateYearAndSemesterAsync(rollNo, offsetYears = 0) {
  const session = await getCurrentCalendarSession();

  if (!session) {
    return {
      yearOfStudy: null,
      semester: null,
      semesterLabel: 'N/A',
      academicYear: null,
      calendarSemester: null,
      status: 'Semester Not Configured'
    };
  }

  const result = calculateStudentYearAndSemester(rollNo, session.academicYear, session.semester, offsetYears);

  // Override status with the session status (ACTIVE, PREVIOUS, or UPCOMING)
  // unless there's an error like Invalid Roll
  if (result.status === 'OK') {
    result.status = session.status;
  }

  return {
    ...result,
    isCurrent: session.isCurrent
  };
}


/**
 * Gets the college's current academic year from the semesters table.
 */
export async function getCollegeAcademicYear() {
  const session = await getCurrentCalendarSession();
  return session ? session.academicYear : null;
}

let cachedSession = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export function clearCalendarSessionCache() {
  cachedSession = null;
  cacheTimestamp = 0;
}

/**
 * Gets the current academic session details directly from the semesters table.
 * Returns { academicYear, semester, status, isCurrent }
 */
export async function getCurrentCalendarSession(context = null) {
  const isTimeTraveling = Clock.isTimeTraveling(context);
  const nowTime = Date.now();
  if (!isTimeTraveling && cachedSession && (nowTime - cacheTimestamp < CACHE_TTL)) {
    return cachedSession;
  }

  const now = Clock.now(context);
  const dateStr = formatDate(now);

  // Priority 1: Active Semester
  const activeSemRows = await db.select()
    .from(semesters)
    .where(
      sql`${dateStr} BETWEEN ${semesters.start_date} AND ${semesters.end_date}`
    )
    .limit(1);

  if (activeSemRows.length > 0) {
    const session = {
      academicYear: activeSemRows[0].academic_year,
      semester: activeSemRows[0].semester,
      status: 'ACTIVE',
      isCurrent: true
    };
    if (!isTimeTraveling) {
      cachedSession = session;
      cacheTimestamp = nowTime;
    }
    return session;
  }

  // Priority 2: Latest completed semester
  const prevSemRows = await db.select()
    .from(semesters)
    .where(
      sql`${semesters.end_date} < ${dateStr}`
    )
    .orderBy(desc(semesters.end_date))
    .limit(1);

  if (prevSemRows.length > 0) {
    const session = {
      academicYear: prevSemRows[0].academic_year,
      semester: prevSemRows[0].semester,
      status: 'PREVIOUS',
      isCurrent: false
    };
    if (!isTimeTraveling) {
      cachedSession = session;
      cacheTimestamp = nowTime;
    }
    return session;
  }

  // Priority 3: Nearest upcoming semester (if before the first semester ever starts)
  const upcomingSemRows = await db.select()
    .from(semesters)
    .where(
      sql`${semesters.start_date} > ${dateStr}`
    )
    .orderBy(asc(semesters.start_date))
    .limit(1);

  if (upcomingSemRows.length > 0) {
    const session = {
      academicYear: upcomingSemRows[0].academic_year,
      semester: upcomingSemRows[0].semester,
      status: 'UPCOMING',
      isCurrent: false
    };
    if (!isTimeTraveling) {
      cachedSession = session;
      cacheTimestamp = nowTime;
    }
    return session;
  }

  // Priority 4: Not configured
  if (!isTimeTraveling) {
    cachedSession = null;
    cacheTimestamp = nowTime;
  }
  return null;
}

/**
 * Determine if a semester is active right now.
 */
export async function isSemesterActive(semester, assignmentAcademicYear) {
  const session = await getCurrentCalendarSession();

  if (!session || !session.isCurrent) return false;

  return session.academicYear === assignmentAcademicYear &&
         (session.semester % 2 === semester % 2);
}

export const CANONICAL_SUBJECT_TYPES = ['theory', 'lab'];

/**
 * Validates whether a subject type string belongs to canonical enum ['theory', 'lab'].
 */
export function isValidSubjectType(type) {
  if (!type || typeof type !== 'string') return false;
  return CANONICAL_SUBJECT_TYPES.includes(type.trim().toLowerCase());
}

/**
 * Authoritatively resolves subject classification from canonical syllabus metadata.
 * Does NOT silently invent 'theory' if metadata is absent or invalid.
 *
 * @param {Object} params
 * @param {string} params.subject_code - Code of the subject (e.g., 'BSC101L')
 * @param {string} params.subject_name - Display name of the subject (e.g., 'Physics-Practical')
 * @param {string} [params.canonical_subject_type] - The type stored in syllabus_subjects
 * @returns {{ subject_type: 'theory' | 'lab' | null, is_lab: boolean, status: 'RESOLVED' | 'UNRESOLVED' | 'CONTRADICTORY', source: string }}
 */
export function resolveCanonicalSubjectType({ subject_code, subject_name, canonical_subject_type } = {}) {
  const normType = canonical_subject_type ? String(canonical_subject_type).trim().toLowerCase() : null;
  const valid = isValidSubjectType(normType);

  if (valid) {
    const isLab = normType === 'lab';
    const sName = (subject_name || '').toLowerCase();
    const sCode = (subject_code || '').toUpperCase();

    // Check for potential catalogue contradiction (e.g., stored as 'theory' but named 'Practical' or ending with 'L')
    const looksLikeLab = sName.includes('lab') || sName.includes('practical') || sName.includes('laboratory') || sCode.endsWith('L');
    const isContradictory = (!isLab && looksLikeLab) || (isLab && !looksLikeLab && sName.includes('theory'));

    return {
      subject_type: normType,
      is_lab: isLab,
      status: isContradictory ? 'CONTRADICTORY' : 'RESOLVED',
      source: 'syllabus_subjects'
    };
  }

  // If canonical syllabus subject type is not provided or invalid
  return {
    subject_type: null,
    is_lab: false,
    status: 'UNRESOLVED',
    source: 'missing'
  };
}

/**
 * Normalizes an assessment evaluation view parameter based on subject classification.
 *
 * @param {string} view
 * @param {boolean} isLab
 * @returns {'overview' | 'mid1' | 'mid2' | 'assignment' | 'execution' | 'writing' | 'record'}
 */
export function normalizeEvaluationView(view, isLab = false) {
  if (!view || typeof view !== 'string') return 'overview';
  const v = view.trim().toLowerCase();

  if (v === 'overview' || v === 'overall' || v === 'all') {
    return 'overview';
  }

  if (isLab) {
    if (v === 'mid1' || v === 'execution') return 'execution';
    if (v === 'mid2' || v === 'writing') return 'writing';
    if (v === 'assignment' || v === 'record') return 'record';
    return 'overview';
  }

  // Theory
  if (v === 'mid1' || v === 'execution') return 'mid1';
  if (v === 'mid2' || v === 'writing') return 'mid2';
  if (v === 'assignment' || v === 'record') return 'assignment';
  return 'overview';
}

/**
 * Returns a filesystem-safe, standardized PDF filename for evaluation exports.
 * Format: KUCET_{BRANCH}_{CODE}_{VIEW}_{YEAR}.pdf
 *
 * @param {Object} params
 * @param {string} params.branch
 * @param {string} params.subjectCode
 * @param {string} params.view
 * @param {string} params.academicYear
 * @param {boolean} [params.isLab=false]
 * @returns {string}
 */
export function getEvaluationPdfFilename({ branch, subjectCode, view, academicYear, isLab = false } = {}) {
  const safeBranch = String(branch || 'BRANCH').trim().toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCode = String(subjectCode || 'SUB').trim().toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeYear = String(academicYear || 'YEAR').trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  const normalized = normalizeEvaluationView(view, isLab);

  let viewTag = 'Overall';
  if (normalized === 'overview') {
    viewTag = 'Overall';
  } else if (normalized === 'mid1') {
    viewTag = 'MID1';
  } else if (normalized === 'mid2') {
    viewTag = 'MID2';
  } else if (normalized === 'assignment') {
    viewTag = 'Assignment';
  } else if (normalized === 'execution') {
    viewTag = 'Execution';
  } else if (normalized === 'writing') {
    viewTag = 'Writing';
  } else if (normalized === 'record') {
    viewTag = 'Record';
  }

  return `KUCET_${safeBranch}_${safeCode}_${viewTag}_${safeYear}.pdf`;
}

/**
 * Returns a formal display title for the evaluation report.
 */
export function getEvaluationReportTitle({ _subjectName, _subjectCode, view, isLab = false } = {}) {
  const normalized = normalizeEvaluationView(view, isLab);

  if (normalized === 'overview') {
    return isLab
      ? 'CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL OVERVIEW'
      : 'CONTINUOUS INTERNAL EVALUATION (CIE) • THEORY OVERVIEW';
  }

  if (isLab) {
    if (normalized === 'execution') return 'CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL EXECUTION REPORT';
    if (normalized === 'writing') return 'CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL WRITING REPORT';
    if (normalized === 'record') return 'CONTINUOUS INTERNAL EVALUATION (CIE) • PRACTICAL RECORD REPORT';
  } else {
    if (normalized === 'mid1') return 'CONTINUOUS INTERNAL EVALUATION (CIE) • MID-1 ASSESSMENT REPORT';
    if (normalized === 'mid2') return 'CONTINUOUS INTERNAL EVALUATION (CIE) • MID-2 ASSESSMENT REPORT';
    if (normalized === 'assignment') return 'CONTINUOUS INTERNAL EVALUATION (CIE) • ASSIGNMENT ASSESSMENT REPORT';
  }

  return 'CONTINUOUS INTERNAL EVALUATION (CIE) • ASSESSMENT REPORT';
}

/**
 * Re-export pure, browser-safe assessment evaluation utilities.
 * See src/lib/evaluation-utils.js for canonical implementations.
 */
export {
  THEORY_ASSESSMENT_PATTERNS,
  getTheoryPattern,
  validateTheoryMarks,
  checkPatternSwitchCompatibility
} from './evaluation-utils.js';
