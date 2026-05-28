
/**
 * Comprehensive TS ePASS Scholarship Rules Utility
 * Refines the logic based on GO Rt No. 63 and Institutional standards.
 */

export const MINORITY_RELIGIONS = ['MUSLIM', 'CHRISTIAN', 'SIKH', 'BUDDHIST', 'JAIN', 'PARSI'];

/**
 * Calculates the expected Tuition Fee Reimbursement (RTF).
 * @param {Object} student - Unified student object containing category, religion, rank, admission_type, inter_background.
 * @param {number} collegeTuitionFee - Total fee for the year (e.g., 70000 or 35000).
 * @returns {number} - Expected government RTF.
 */
export function calculateExpectedRTF(student, collegeTuitionFee) {
  // 1. Mandatory Quota Check
  // Only Convener Quota (Category-A) is eligible. 
  // Spot/Management (Category-B) or CAT-B admissions are NOT eligible.
  const seatCategory = String(student?.seat_allotted_category || '').toUpperCase();
  const isManagementOrSpot = 
    seatCategory.includes('MQ') || 
    seatCategory.includes('SPOT') || 
    seatCategory.includes('MANAGEMENT') || 
    seatCategory.includes('CAT-B');
  
  if (isManagementOrSpot || student?.fee_reimbursement === 'NO') {
    return 0;
  }

  // 2. Base Rules (Full fee if college fee is <= 35k)
  if (collegeTuitionFee <= 35000) return collegeTuitionFee;

  const category = String(student?.category || student?.caste || '').toUpperCase();
  const religion = String(student?.religion || '').toUpperCase();
  const rank = Number(student?.ranks || student?.exam_rank || 0);

  // 3. Rule for SC/ST/Minority (GO Rt No. 63)
  // These categories get FULL fee regardless of rank.
  if (['SC', 'ST'].includes(category)) return collegeTuitionFee;
  if (MINORITY_RELIGIONS.includes(religion) || category === 'MINORITY') {
    return collegeTuitionFee;
  }

  // 4. Government Junior College Exception
  // BC/EBC/OC-EWS students who studied in Govt Junior Colleges usually get full reimbursement.
  const prevCollege = String(student?.previous_college_details || '').toUpperCase();
  const isGovtCollege = prevCollege.includes('GOVT') || prevCollege.includes('GOVERNMENT');
  if (isGovtCollege) return collegeTuitionFee;

  // 5. Standard BC/EBC/OC-EWS Rank Condition
  // Below 10,000 Rank = Full Fee
  // Above 10,000 Rank = Max 35,000 Cap
  if (rank > 0 && rank <= 10000) {
    return collegeTuitionFee;
  }

  return 35000;
}

/**
 * Estimates the Maintenance Fee (MTF) / Mess Charges.
 * This is the amount paid directly to the student's bank account.
 * @param {string} category 
 * @param {boolean} isHosteller 
 * @returns {number} - Estimated annual MTF (approximate values).
 */
export function estimateAnnualMTF(category, isHosteller = false) {
  // Approximate values based on 10 months academic session
  // Day Scholars: ~₹5,500 - ₹9,000 per year
  // Hostellers: ~₹15,000 - ₹20,000 per year
  if (isHosteller) return 18000;
  return 7000;
}
