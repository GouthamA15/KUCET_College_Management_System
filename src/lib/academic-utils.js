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

