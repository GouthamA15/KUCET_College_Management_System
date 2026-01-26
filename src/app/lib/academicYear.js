// Reusable academic year utility
export function parseAdmissionYearFromRoll(roll_no) {
  if (!roll_no || typeof roll_no !== 'string') return null;
  const firstTwo = roll_no.trim().slice(0, 2);
  if (!/^[0-9]{2}$/.test(firstTwo)) return null;
  return 2000 + Number(firstTwo);
}

export function isYearAllowed(admission_type, year) {
  const adm = (admission_type || '').toString().toLowerCase();
  if (adm.includes('lateral')) return year >= 1 && year <= 3;
  // default to Regular
  return year >= 1 && year <= 4;
}

function lastTwoDigits(y) {
  return String(y).slice(-2);
}

export function computeAcademicYear(roll_no, admission_type, year) {
  const admYear = parseAdmissionYearFromRoll(roll_no);
  if (!admYear) return null;
  const yr = Number(year);
  if (!Number.isInteger(yr) || yr < 1) return null;
  if (!isYearAllowed(admission_type, yr)) return null;
  const start = admYear + (yr - 1);
  const end = start + 1;
  return `${start}-${lastTwoDigits(end)}`;
}

export function computeTotalAcademicSpan(roll_no, admission_type) {
  const admYear = parseAdmissionYearFromRoll(roll_no);
  if (!admYear) return null;
  const isLateral = (admission_type || '').toString().toLowerCase().includes('lateral');
  const length = isLateral ? 3 : 4;
  const end = admYear + length;
  return `${admYear} - ${lastTwoDigits(end)}`;
}

export default { parseAdmissionYearFromRoll, isYearAllowed, computeAcademicYear };
