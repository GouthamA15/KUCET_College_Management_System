
export const SFC_COURSES = new Set(['CSD', 'IT', 'CIVIL']);

/**
 * Resolves total fee based on branch/course
 * @param {string} course - Branch name (e.g., 'CSE', 'CSD')
 * @returns {number} - Total annual fee
 */
export function getYearlyTotalFee(course) {
  if (!course) return 35000;
  return SFC_COURSES.has(String(course).toUpperCase()) ? 70000 : 35000;
}

/**
 * Calculates financial summary for a student's academic year
 * @param {Object} data - Contains scholarship sanctions and fee payments
 * @param {string} course - Student's branch
 * @param {string} feeReimbursement - 'YES' or 'NO'
 * @returns {Object} - Fee summary
 */
export function calculateFinancialSummary(data, course, feeReimbursement) {
  const total_fee = getYearlyTotalFee(course);
  
  const scholarship_proceedings = (data.scholarship || []).map(r => ({
    amount: Number(r.sanctioned_amount || r.amount_sanctioned) || 0,
  }));
  const govt_paid = scholarship_proceedings.reduce((sum, p) => sum + p.amount, 0);

  const student_payments = (data.fees || []).map(r => ({
    amount: Number(r.amount) || 0,
  }));
  const student_paid = student_payments.reduce((sum, p) => sum + p.amount, 0);

  const total_paid = govt_paid + student_paid;
  const pending_fee = Math.max(0, total_fee - total_paid);
  const status = pending_fee === 0 ? 'COMPLETED' : 'PENDING';

  return {
  total_fee,
  govt_paid,
  student_paid,
  total_paid,
  pending_fee,
  status
  };
  }

  export const formatIndianNumber = (digits) => {
  if (!digits) return '';
  const s = String(digits).replace(/\D/g, '');
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  };
