// Utility to construct official syllabus PDF URLs
// Returns a string URL when inputs are valid, otherwise returns null.
export function getSyllabusUrl({ course, year, semester } = {}) {
  const base = process.env.NEXT_PUBLIC_SYLLABUS_BASE_URL;
  if (!base) return null;

  // Validate numeric year and semester
  const y = Number(year);
  const s = Number(semester);
  if (!Number.isInteger(y) || y < 1) return null;
  if (!Number.isInteger(s) || s < 1) return null;

  // First year special case: common syllabus (no branch in filename)
  if (y === 1) {
    return `${base}/btech_year1_sem${s}.pdf`;
  }

  // For other years, course is required and must be normalized
  if (!course) return null;
  const normalized = String(course).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalized) return null;

  return `${base}/btech_year${y}_${normalized}_sem${s}.pdf`;
}

export default getSyllabusUrl;
