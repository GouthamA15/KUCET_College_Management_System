import { getEffectiveAcademicYear, getCurrentStudyingYear } from './rollNumber';
import { getNow, getNowSync } from './clock';

/**
 * CORE LOGIC (Shared between Sync and Async)
 */

function calculateYearAndSemesterCore(rollNo, collegeInfo, now, offsetYears = 0) {
  const yearOfStudy = getCurrentStudyingYear(rollNo, collegeInfo, now, offsetYears);
  if (!yearOfStudy) return { yearOfStudy: null, semester: null, semesterLabel: 'N/A' };

  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentTime = currentMonth * 100 + currentDay;

  const firstSemStartMonth = parseInt(collegeInfo?.first_sem_start_month) || 8;
  const firstSemStartDay = parseInt(collegeInfo?.first_sem_start_day) || 25;
  const firstSemTime = firstSemStartMonth * 100 + firstSemStartDay;

  const secondSemStartMonth = parseInt(collegeInfo?.second_sem_start_month) || 2;
  const secondSemStartDay = parseInt(collegeInfo?.second_sem_start_day) || 8;
  const secondSemTime = secondSemStartMonth * 100 + secondSemStartDay;

  let isOddPeriod = false;
  if (firstSemTime < secondSemTime) {
    isOddPeriod = currentTime >= firstSemTime && currentTime < secondSemTime;
  } else {
    isOddPeriod = currentTime >= firstSemTime || currentTime < secondSemTime;
  }

  const semester = isOddPeriod ? (yearOfStudy * 2) - 1 : (yearOfStudy * 2);
  return {
    yearOfStudy,
    semester,
    semesterLabel: `Year ${yearOfStudy} / Sem ${semester}`
  };
}

function isSemesterActiveCore(semester, assignmentAcademicYear, collegeInfo, now) {
  const startYear = getEffectiveAcademicYear(collegeInfo, now);
  const currentAY = `${startYear}-${(startYear + 1).toString().slice(-2)}`;

  if (assignmentAcademicYear !== currentAY) return false;

  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentTime = currentMonth * 100 + currentDay;

  const firstSemStartMonth = parseInt(collegeInfo?.first_sem_start_month) || 8;
  const firstSemStartDay = parseInt(collegeInfo?.first_sem_start_day) || 25;
  const firstSemTime = firstSemStartMonth * 100 + firstSemStartDay;

  const secondSemStartMonth = parseInt(collegeInfo?.second_sem_start_month) || 2;
  const secondSemStartDay = parseInt(collegeInfo?.second_sem_start_day) || 8;
  const secondSemTime = secondSemStartMonth * 100 + secondSemStartDay;

  let isOddPeriod = false;
  if (firstSemTime < secondSemTime) {
    isOddPeriod = currentTime >= firstSemTime && currentTime < secondSemTime;
  } else {
    isOddPeriod = currentTime >= firstSemTime || currentTime < secondSemTime;
  }

  const isOddSemester = parseInt(semester) % 2 !== 0;
  return isOddSemester === isOddPeriod;
}

/**
 * SYNC FUNCTIONS (Mainly for Frontend / Client Components)
 * Use getNowSync() to respect mock time travel via document.cookie
 */

export function getCollegeAcademicYearSync(collegeInfo = null) {
  const startYear = getEffectiveAcademicYear(collegeInfo, getNowSync());
  return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
}

export function calculateYearAndSemesterSync(rollNo, collegeInfo = null, offsetYears = 0) {
  return calculateYearAndSemesterCore(rollNo, collegeInfo, getNowSync(), offsetYears);
}

/**
 * ASYNC FUNCTIONS (Mainly for API Routes / Server Components)
 * Use await getNow() to respect mock time travel via next/headers
 */

export async function getCollegeAcademicYear(collegeInfo = null) {
  const startYear = getEffectiveAcademicYear(collegeInfo, await getNow());
  return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
}

export async function calculateYearAndSemesterAsync(rollNo, collegeInfo = null, offsetYears = 0) {
  return calculateYearAndSemesterCore(rollNo, collegeInfo, await getNow(), offsetYears);
}

export function isSemesterActiveSync(semester, assignmentAcademicYear, collegeInfo = null) {
  return isSemesterActiveCore(semester, assignmentAcademicYear, collegeInfo, getNowSync());
}

export async function isSemesterActive(semester, assignmentAcademicYear, collegeInfo = null) {
  return isSemesterActiveCore(semester, assignmentAcademicYear, collegeInfo, await getNow());
}

// Default export for convenience (Sync version for UI)
export const calculateYearAndSemester = calculateYearAndSemesterSync;
