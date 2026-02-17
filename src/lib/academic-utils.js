import { getEffectiveAcademicYear } from './rollNumber';

export function getCollegeAcademicYear(collegeInfo = null) {
  const startYear = getEffectiveAcademicYear(collegeInfo);
  return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
}

export function isSemesterActive(semester, assignmentAcademicYear, collegeInfo = null) {
  const currentAY = getCollegeAcademicYear(collegeInfo);
  if (assignmentAcademicYear !== currentAY) return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentTime = currentMonth * 100 + currentDay;

  const firstSemStartMonth = parseInt(collegeInfo?.first_sem_start_month) || 6;
  const firstSemStartDay = parseInt(collegeInfo?.first_sem_start_day) || 1;
  const firstSemTime = firstSemStartMonth * 100 + firstSemStartDay;

  const secondSemStartMonth = parseInt(collegeInfo?.second_sem_start_month) || 1;
  const secondSemStartDay = parseInt(collegeInfo?.second_sem_start_day) || 15;
  const secondSemTime = secondSemStartMonth * 100 + secondSemStartDay;

  // Logic: 
  // If firstSemTime < secondSemTime (e.g. 6/1 < 1/15 is false, usually 1/15 < 6/1)
  // Standard: Second Sem starts early in the year (Jan/Feb), First Sem starts middle (June/Aug)
  
  let isOddPeriod = false;
  if (firstSemTime < secondSemTime) {
      // First sem starts earlier in the calendar year than second sem
      isOddPeriod = currentTime >= firstSemTime && currentTime < secondSemTime;
  } else {
      // Second sem starts earlier in the calendar year (standard)
      // Odd period is from firstSemTime until the end of year OR from start of year until secondSemTime? No.
      // Usually: 
      // Second Sem: Feb - Aug
      // First Sem: Aug - Feb
      isOddPeriod = currentTime >= firstSemTime || currentTime < secondSemTime;
  }

  const isOddSemester = parseInt(semester) % 2 !== 0;
  return isOddSemester === isOddPeriod;
}
