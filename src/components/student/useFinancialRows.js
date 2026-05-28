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

  // Group fee payments by year and track the latest payment date
  const paymentsByYear = {};
  (feePaymentsArray || []).forEach((p) => {
    for (let y = 1; y <= maxYears; y++) {
      const acadLabel = computeAcademicYear(roll_no, y);
      if (!acadLabel) continue;
      if (p.academic_year && String(p.academic_year) === String(acadLabel)) {
        if (!paymentsByYear[y]) paymentsByYear[y] = { amount: 0, date: null };
        paymentsByYear[y].amount += Number(p.amount || 0);
        
        // Track latest payment date for this year
        const pDate = p.transaction_date ?? p.date;
        if (pDate) {
          if (!paymentsByYear[y].date || new Date(pDate) > new Date(paymentsByYear[y].date)) {
            paymentsByYear[y].date = pDate;
          }
        }
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
    const studentPaidRec = paymentsByYear[y] || { amount: 0, date: null };
    const govtPaid = scholar?.amount_sanctioned || 0;
    const totalPaid = govtPaid + studentPaidRec.amount;
    const balance = yearlyTotalFee - totalPaid;
    const pending = balance > 0 ? balance : 0;
    const credit = balance < 0 ? Math.abs(balance) : 0;

    // Determine latest relevant date
    let displayDate = scholar?.date || studentPaidRec.date;
    if (scholar?.date && studentPaidRec.date) {
      displayDate = new Date(scholar.date) > new Date(studentPaidRec.date) ? scholar.date : studentPaidRec.date;
    }

    return {
      labelYear: acad ?? `Year ${y}`,
      proceedings_no: scholar?.proceedings_no ?? '',
      amount_sanctioned: govtPaid > 0 ? govtPaid : '',
      student_paid: studentPaidRec.amount > 0 ? studentPaidRec.amount : '',
      pending_fee: pending,
      credit_balance: credit,
      date: displayDate ? formatDateSlash(displayDate) : '',
    };
  });

  return { rows, maxYears, yearlyTotalFee };
}
