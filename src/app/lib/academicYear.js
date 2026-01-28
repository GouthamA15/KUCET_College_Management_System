import {
  getAdmissionTypeFromRoll,
  getEntryYearFromRoll,
  getAcademicYear as computeTotalAcademicSpan,
} from '@/lib/rollNumber';

function isYearAllowed(roll_no, year) {
  const admission_type = getAdmissionTypeFromRoll(roll_no);
  const isLateral = (admission_type || '').toString().toLowerCase().includes('lateral');
  if (isLateral) return year >= 1 && year <= 3;
  // default to Regular
  return year >= 1 && year <= 4;
}

function lastTwoDigits(y) {
  return String(y).slice(-2);
}

function computeAcademicYear(roll_no, year) {
  const admYearRaw = getEntryYearFromRoll(roll_no);
  const admYear = admYearRaw ? parseInt(admYearRaw, 10) : null;
  if (!admYear) return null;
  const yr = Number(year);
  if (!Number.isInteger(yr) || yr < 1) return null;
  if (!isYearAllowed(roll_no, yr)) return null;
  const start = admYear + (yr - 1);
  const end = start + 1;
  return `${start}-${lastTwoDigits(end)}`;
}

export { isYearAllowed, computeAcademicYear, computeTotalAcademicSpan };

export default { isYearAllowed, computeAcademicYear, computeTotalAcademicSpan };