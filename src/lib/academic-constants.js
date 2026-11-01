/**
 * Institutional Academic Calendar Constants and Utilities
 * Safe for both Client Components and Server-side code (no database or node-specific dependencies).
 */

export const INSTITUTIONAL_BRANCHES = ['CSE', 'IT', 'CSD', 'ECE', 'EEE', 'CIVIL', 'MECH'];

/**
 * Dynamically derives the academic year string (e.g., '2026-27') from a Date or current time.
 * In Indian engineering institutions, the academic cycle begins in June/July.
 * - June to December (months 6-12): Current year to Next year (e.g. Oct 2026 -> '2026-27')
 * - January to May (months 1-5): Previous year to Current year (e.g. Feb 2027 -> '2026-27')
 *
 * @param {Date|number|string} [date=new Date()]
 * @returns {string} Academic year formatted as YYYY-YY
 */
export function deriveDefaultAcademicYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return '2026-27'; // Institutional baseline fallback
  }
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 to 12

  if (month >= 6) {
    const nextYY = String((year + 1) % 100).padStart(2, '0');
    return `${year}-${nextYY}`;
  } else {
    const curYY = String(year % 100).padStart(2, '0');
    return `${year - 1}-${curYY}`;
  }
}

/**
 * Returns a canonical, chronologically-ordered array of academic years.
 * Includes 1 future cycle and past cycles back to baseline.
 *
 * @param {string} [baseYear=null]
 * @param {number} [pastCount=4]
 * @returns {string[]}
 */
export function getCanonicalAcademicYears(baseYear = null, pastCount = 4) {
  const active = baseYear && /^\d{4}-\d{2}$/.test(baseYear) 
    ? baseYear 
    : deriveDefaultAcademicYear();
  const startYear = parseInt(active.split('-')[0], 10);
  
  const years = [];
  // Future year (upcoming intake / preparation)
  const nextStart = startYear + 1;
  years.push(`${nextStart}-${String((nextStart + 1) % 100).padStart(2, '0')}`);

  // Current year
  years.push(active);

  // Past years
  for (let i = 1; i <= pastCount; i++) {
    const pastStart = startYear - i;
    years.push(`${pastStart}-${String((pastStart + 1) % 100).padStart(2, '0')}`);
  }

  return [...new Set(years)];
}

export const CANONICAL_ACADEMIC_YEARS = getCanonicalAcademicYears();
export const CURRENT_ACADEMIC_YEAR = deriveDefaultAcademicYear();
