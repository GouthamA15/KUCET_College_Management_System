'use client';
import { computeAcademicYear, isYearAllowed } from '@/app/lib/academicYear';
import { formatDate } from '@/lib/date';
import { getYearlyTotalFee } from '@/lib/financial-utils';

/**
 * Hook to process both scholarship sanctions and student fee payments into year-wise rows.
 * @param {string} roll_no 
 * @param {Array} scholarshipArray 
 * @param {Array} feePaymentsArray 
 * @param {string} course 
 */
export default function useFinancialRows(roll_no, scholarshipArray = [], feePaymentsArray = [], course = '') {
  if (!roll_no) return { rows: [], maxYears: 4 };

  const maxYears = (() => {
    let n = 4;
    for (let y = 4; y >= 3; y--) { if (isYearAllowed(roll_no, y)) { n = y; break; } }
    return n;
  })();

  const yearlyTotalFee = getYearlyTotalFee(course);

  // Group scholarship by year
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
          amount_sanctioned: Number(s.sanctioned_amount ?? s.amount_sanctioned ?? 0),
          amount_disbursed: Number(s.amount_disbursed ?? 0),
          date: s.sanction_date ?? s.sanctionDate ?? s.date ?? null,
        };
        break;
      }
    }
  });

  // Group fee payments by year
  const paymentsByYear = {};
  (feePaymentsArray || []).forEach((p) => {
    for (let y = 1; y <= maxYears; y++) {
      const acadLabel = computeAcademicYear(roll_no, y);
      if (!acadLabel) continue;
      // student_fee_payments table uses academic_year string
      if (p.academic_year && String(p.academic_year) === String(acadLabel)) {
        if (!paymentsByYear[y]) paymentsByYear[y] = 0;
        paymentsByYear[y] += Number(p.amount || 0);
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
    const scholar = scholarshipByYear[y];
    const studentPaid = paymentsByYear[y] || 0;
    const govtPaid = scholar?.amount_sanctioned || 0;
    const pending = Math.max(0, yearlyTotalFee - (govtPaid + studentPaid));

    return {
      labelYear: acad ?? `Year ${y}`,
      proceedings_no: scholar?.proceedings_no ?? '',
      amount_sanctioned: govtPaid > 0 ? govtPaid : '',
      student_paid: studentPaid > 0 ? studentPaid : '',
      pending_fee: pending,
      date: scholar?.date ? formatDateSlash(scholar.date) : '',
    };
  });

  return { rows, maxYears, yearlyTotalFee };
}
