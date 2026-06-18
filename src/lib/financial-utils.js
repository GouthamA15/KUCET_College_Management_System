
export const SFC_COURSES = new Set(['CSD', 'IT', 'CIVIL']);

/**
 * Resolves total fee based on branch/course
 * @param {string} course - Branch name (e.g., 'CSE', 'CSD')
 * @param {Object} [feeConfig] - Optional dynamic config from SystemConfigService
 * @returns {number} - Total annual fee
 */
export function getYearlyTotalFee(course, feeConfig = null) {
  if (!course) return feeConfig?.REGULAR || 35000;
  
  const sfcCoursesList = feeConfig?.SFC_COURSES || Array.from(SFC_COURSES);
  const isSfc = sfcCoursesList.map(c => c.toUpperCase()).includes(String(course).toUpperCase());
  
  return isSfc ? (feeConfig?.SFC || 70000) : (feeConfig?.REGULAR || 35000);
}

/**
 * Calculates the expected scholarship amount from the government based on TG ePASS rules (including GO Rt No. 63).
 * @param {Object} student - Student details (requires fee_reimbursement, category, religion, ranks, seat_allotted_category)
 * @param {number} totalFee - The yearly total fee for the student's branch (e.g., 70000)
 * @param {Object} [feeConfig] - Optional dynamic config from SystemConfigService
 * @returns {number} - The expected government scholarship amount (e.g., 35000 or 70000)
 */
export function getExpectedScholarship(student, totalFee, feeConfig = null) {
  // 1. Mandatory Eligibility Check
  const frStatus = String(student?.fee_reimbursement || 'NO').toUpperCase();
  
  if (frStatus === 'GOV') return totalFee;
  if (frStatus !== 'YES') return 0;
  
  // 2. Quota Check (Convener vs Management)
  // Only Convener Quota (Category-A) is eligible. 
  // Management (MQ/Category-B) or Spot admissions are NOT eligible for reimbursement.
  const seatCategory = String(student?.seat_allotted_category || '').toUpperCase();
  const isManagementOrSpot = seatCategory.includes('MQ') || seatCategory.includes('SPOT') || seatCategory.includes('MANAGEMENT') || seatCategory.includes('CAT-B');
  
  if (isManagementOrSpot) return 0;

  // 3. Base Rule: If the branch fee is already at or below the base cap (35k), it's fully covered.
  const baseCap = feeConfig?.REGULAR || 35000;
  if (totalFee <= baseCap) return totalFee;

  const category = String(student?.category || student?.caste || '').toUpperCase();
  const religion = String(student?.religion || '').toUpperCase();
  
  // 4. Rule for SC/ST/Minority (GO Rt No. 63)
  // These categories get FULL fee reimbursement (RTF) regardless of their TG EAPCET/TG ECET rank.
  if (['SC', 'ST'].includes(category)) return totalFee;
  
  const minorityReligions = ['MUSLIM', 'CHRISTIAN', 'SIKH', 'BUDDHIST', 'JAIN', 'PARSI'];
  if (minorityReligions.includes(religion) || category === 'MINORITY') {
    return totalFee;
  }
  
  // 5. Government Junior College Exception
  // BC/EBC/OC-EWS students who studied in Govt Junior Colleges usually get full reimbursement.
  const prevCollege = String(student?.previous_college_details || '').toUpperCase();
  const isGovtCollege = prevCollege.includes('GOVT') || prevCollege.includes('GOVERNMENT');
  if (isGovtCollege) return totalFee;

  // 6. Standard BC/EBC/OC-EWS Rank Condition
  // Rank <= 10,000 = Full Fee Reimbursement
  // Rank > 10,000 = Partial reimbursement capped at ₹35,000
  const rank = Number(student?.ranks || student?.exam_rank || 999999);
  if (rank > 0 && rank <= 10000) return totalFee;
  
  return baseCap;
}

/**
 * Calculates financial summary for a student's academic year
 * @param {Object} data - Contains scholarship sanctions and fee payments
 * @param {string} course - Student's branch
 * @param {Object} student - Student personal details (for expected scholarship calculation)
 * @returns {Object} - Fee summary
 */
export function calculateFinancialSummary(data, course, student = {}) {
  const total_fee = getYearlyTotalFee(course);
  
  // Check expected scholarship
  const expected_govt = getExpectedScholarship(student, total_fee);
  const expected_student_liability = Math.max(0, total_fee - expected_govt);
  
  const scholarship_proceedings = (data.scholarship || [])
    .filter(r => (r.status || 'SANCTIONED').toUpperCase() !== 'REJECTED')
    .map(r => ({
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
    expected_govt,
    expected_student_liability,
    status
  };
}

export const formatIndianNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  
  // Convert string to float to handle decimals safely
  const num = parseFloat(value);
  if (isNaN(num)) return String(value);

  // Use the native Intl API for robust Indian numbering system (Lakhs/Crores)
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
};
