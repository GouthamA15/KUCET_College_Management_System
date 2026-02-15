'use client';
import { computeAcademicYear, isYearAllowed } from '@/app/lib/academicYear';
import { formatDate } from '@/lib/date';

export default function useScholarshipRows(roll_no, scholarshipArray = []) {
  if (!roll_no) return { rows: [], maxYears: 4 };

  const maxYears = (() => {
    let n = 4;
    for (let y = 4; y >= 3; y--) { if (isYearAllowed(roll_no, y)) { n = y; break; } }
    return n;
  })();

  const scholarshipByYear = {};
  (scholarshipArray || []).forEach((s) => {
    for (let y = 1; y <= maxYears; y++) {
      const acadLabel = computeAcademicYear(roll_no, y);
      if (!acadLabel) continue;
      const matchesYearIndex = s.year && Number(s.year) === y;
      const matchesAcademicLabel = s.academic_year && String(s.academic_year) === String(acadLabel);
      if (matchesYearIndex || matchesAcademicLabel) {
        scholarshipByYear[y] = {
          proceedings_no: s.proceeding_no ?? s.proceedings_no ?? s.proceedingNo ?? '',
          amount_sanctioned: s.sanctioned_amount ?? s.amount_sanctioned ?? s.sanctionedAmount ?? '',
          amount_disbursed: s.amount_disbursed ?? '',
          date: s.sanction_date ?? s.sanctionDate ?? s.date ?? null,
        };
        break;
      }
    }
  });

  const formatDateSlash = (val) => {
    if (!val) return '';
    try {
      const dFmt = formatDate(val);
      if (dFmt && typeof dFmt === 'string') return dFmt.replaceAll('-', '/');
      const d = new Date(val);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(val);
    }
  };

  const rows = Array.from({ length: maxYears }, (_, i) => {
    const y = i + 1;
    const acad = computeAcademicYear(roll_no, y);
    const rec = scholarshipByYear[y];
    return {
      labelYear: acad ?? `Year ${y}`,
      proceedings_no: rec?.proceedings_no ?? '',
      amount_sanctioned: rec?.amount_sanctioned ?? '',
      amount_disbursed: rec?.amount_disbursed ?? '',
      date: rec?.date ? formatDateSlash(rec.date) : '',
    };
  });

  return { rows, maxYears };
}
