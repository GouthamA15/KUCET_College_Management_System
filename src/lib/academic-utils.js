import { getEntryYearFromRoll, getAdmissionTypeFromRoll } from './rollNumber';

/**
 * Calculates the current year of study and semester based on student's roll number
 * and the college's semester start dates.
 * 
 * @param {string} rollNo - The student's roll number.
 * @param {object} collegeInfo - College info containing semester start dates.
 * @param {Date} [now] - Optional current date for testing.
 * @returns {object} { yearOfStudy, semester, semesterLabel }
 */
export function calculateYearAndSemester(rollNo, collegeInfo, now = new Date()) {
  const entryYearStr = getEntryYearFromRoll(rollNo);
  const admissionType = getAdmissionTypeFromRoll(rollNo) || 'Regular';
  
  if (!entryYearStr) {
    return { yearOfStudy: 1, semester: 1, semesterLabel: 'I' };
  }

  const admissionYear = parseInt(entryYearStr, 10);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const fMonth = parseInt(collegeInfo?.first_sem_start_month) || 7; // Default July
  const fDay = parseInt(collegeInfo?.first_sem_start_day) || 1;
  const sMonth = parseInt(collegeInfo?.second_sem_start_month) || 1; // Default January
  const sDay = parseInt(collegeInfo?.second_sem_start_day) || 1;

  // We need to determine which academic year we are currently in.
  // An academic year starts on (fMonth, fDay).
  
  const currentTotal = currentMonth * 100 + currentDay;
  const firstSemTotal = fMonth * 100 + fDay;
  const secondSemTotal = sMonth * 100 + sDay;

  let effectiveAcademicStartYear;
  let isSecondSem = false;

  // Case 1: Second semester starts in the next calendar year (e.g., f=July, s=Jan)
  if (sMonth < fMonth) {
    if (currentTotal >= firstSemTotal) {
      // We are in the first semester of the academic year that started this calendar year
      effectiveAcademicStartYear = currentYear;
      isSecondSem = false;
    } else if (currentTotal >= secondSemTotal) {
      // We are in the second semester of the academic year that started last calendar year
      effectiveAcademicStartYear = currentYear - 1;
      isSecondSem = true;
    } else {
      // We are in the first semester of the academic year that started last calendar year
      // This happens if currentTotal < secondSemTotal (e.g., Jan 1st when Second Sem starts Jan 15th)
      effectiveAcademicStartYear = currentYear - 1;
      isSecondSem = false;
    }
  } 
  // Case 2: Both semesters start in the same calendar year (e.g., f=Jan, s=July - unlikely but possible)
  else {
    if (currentTotal >= secondSemTotal) {
      effectiveAcademicStartYear = currentYear;
      isSecondSem = true;
    } else if (currentTotal >= firstSemTotal) {
      effectiveAcademicStartYear = currentYear;
      isSecondSem = false;
    } else {
      effectiveAcademicStartYear = currentYear - 1;
      isSecondSem = true; // Assuming the second sem of previous year continues until first sem of next year
    }
  }

  let yearOfStudy = effectiveAcademicStartYear - admissionYear + 1;
  if (String(admissionType).toLowerCase() === 'lateral') {
    yearOfStudy += 1;
  }

  const maxYears = (String(admissionType).toLowerCase() === 'lateral') ? 3 : 4;
  yearOfStudy = Math.max(1, Math.min(maxYears, yearOfStudy));

  const semester = isSecondSem ? (yearOfStudy * 2) : (yearOfStudy * 2 - 1);
  
  const semesterWords = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  const semesterLabel = semesterWords[semester - 1] || String(semester);

  return {
    yearOfStudy,
    semester,
    semesterLabel
  };
}
