/**
 * Deterministic derivation utilities for KUCET Admission Bridge.
 * 
 * Rules authoritatively confirmed by KUCET admission convener:
 * 1. Regular Students: College Admission No = last 4 characters of KUCET roll number (e.g. 26567T0332 -> 0332).
 * 2. Lateral-Entry Students: College Admission No = last 5 characters of KUCET roll number including trailing 'L' (e.g. 265670361L -> 0361L).
 * 3. University Photo Filename: ${admissionNo}.jpg
 * 4. University Signature Filename: ${admissionNo}(1).jpg
 * 5. Admission Date: Formatted as DD-MMM-YY from student's individual admission date.
 */

import { validateRollNo } from '../rollNumber.js';
import { ADMISSION_BRIDGE_CONFIG } from './config.js';

/**
 * Validates a KUCET Roll Number and deterministically derives the College Admission Number.
 * 
 * @param {string} rollNo - Raw KUCET roll number (e.g. '26567T0332' or '265670361L')
 * @returns {{
 *   isValid: boolean,
 *   admissionNo: string | null,
 *   admissionType: 'Regular' | 'Lateral' | null,
 *   branch: string | null,
 *   entryYear: string | null,
 *   error?: string
 * }}
 */
export function deriveCollegeAdmissionNo(rollNo) {
  if (!rollNo || typeof rollNo !== 'string') {
    return {
      isValid: false,
      admissionNo: null,
      admissionType: null,
      branch: null,
      entryYear: null,
      error: 'Roll number is required',
    };
  }

  const clean = rollNo.trim().toUpperCase();
  const validation = validateRollNo(clean);

  if (!validation.isValid) {
    return {
      isValid: false,
      admissionNo: null,
      admissionType: null,
      branch: null,
      entryYear: null,
      error: `Invalid KUCET roll number format: ${clean}`,
    };
  }

  const { admissionType, branch, entryYear } = validation;

  if (admissionType === 'Regular') {
    // Regular students: Last 4 characters (Branch Code + Serial Number)
    // Example: 26567T0332 -> '0332', 26567T0001 -> '0001'
    const lastFour = clean.slice(-4);
    if (!/^[0-9A-Z]{4}$/.test(lastFour)) {
      return {
        isValid: false,
        admissionNo: null,
        admissionType,
        branch,
        entryYear,
        error: `Could not extract 4-character admission number from regular roll: ${clean}`,
      };
    }

    return {
      isValid: true,
      admissionNo: lastFour, // Strict string preserving leading zeroes
      admissionType: 'Regular',
      branch,
      entryYear,
    };
  }

  if (admissionType === 'Lateral') {
    // Lateral-entry students: Last 5 characters including trailing 'L'
    // Example: 265670361L -> '0361L', 265671867L -> '1867L'
    const lastFive = clean.slice(-5);
    if (!/^[0-9A-Z]{4}L$/.test(lastFive)) {
      return {
        isValid: false,
        admissionNo: null,
        admissionType,
        branch,
        entryYear,
        error: `Could not extract 5-character admission number ending with L from lateral roll: ${clean}`,
      };
    }

    return {
      isValid: true,
      admissionNo: lastFive, // Strict string preserving leading zeroes and 'L' suffix
      admissionType: 'Lateral',
      branch,
      entryYear,
    };
  }

  return {
    isValid: false,
    admissionNo: null,
    admissionType: null,
    branch,
    entryYear,
    error: `Unsupported admission type for roll number: ${clean}`,
  };
}

/**
 * Validates a College Admission Number format.
 * - Regular: exactly 4 alphanumeric characters (e.g., '0332', '1802', '0001').
 * - Lateral: exactly 4 alphanumeric characters followed by 'L' (e.g., '0361L', '1867L').
 * 
 * @param {string} admissionNo
 * @returns {boolean}
 */
export function isValidCollegeAdmissionNo(admissionNo) {
  if (!admissionNo || typeof admissionNo !== 'string') return false;
  const clean = admissionNo.trim().toUpperCase();
  const regularPattern = /^[A-Z0-9]{4}$/;
  const lateralPattern = /^[A-Z0-9]{4}L$/;
  return regularPattern.test(clean) || lateralPattern.test(clean);
}

/**
 * Generates the authoritative KU Online portal filenames for student photo and signature.
 * 
 * Mandatory university convention:
 * - Photo: ${admissionNo}.jpg (e.g. '1802.jpg' or '1867L.jpg')
 * - Signature: ${admissionNo}(1).jpg (e.g. '1802(1).jpg' or '1867L(1).jpg')
 * 
 * @param {string} admissionNo - Validated College Admission Number
 * @returns {{ photoFilename: string, signatureFilename: string }}
 * @throws {Error} if admissionNo fails format validation
 */
export function getPortalImageFilenames(admissionNo) {
  if (!isValidCollegeAdmissionNo(admissionNo)) {
    throw new Error(
      `Invalid College Admission Number for portal filenames: "${admissionNo}". ` +
      `Expected 4 characters (e.g., "1802") or 5 characters ending in L (e.g., "1867L").`
    );
  }

  const clean = admissionNo.trim().toUpperCase();
  return {
    photoFilename: `${clean}.jpg`,
    signatureFilename: `${clean}(1).jpg`,
  };
}

/**
 * Formats a student's individual admission date to the DD-MMM-YY format expected by KU Online.
 * Example: '2026-07-25' or Date object -> '25-Jul-26'
 * 
 * @param {string | Date} dateInput 
 * @returns {string | null}
 */
export function formatAdmissionDate(dateInput) {
  if (!dateInput) return null;

  let d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    // Handle 'YYYY-MM-DD'
    const parts = dateInput.trim().split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      d = new Date(Date.UTC(year, month, day));
    } else {
      d = new Date(dateInput);
    }
  } else {
    return null;
  }

  if (isNaN(d.getTime())) return null;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getUTCDate ? d.getUTCDate() : d.getDate()).padStart(2, '0');
  const month = months[d.getUTCMonth ? d.getUTCMonth() : d.getMonth()];
  const fullYear = d.getUTCFullYear ? d.getUTCFullYear() : d.getFullYear();
  const yearShort = String(fullYear).slice(-2);

  return `${day}-${month}-${yearShort}`;
}

/**
 * Resolves a KUCET CMS branch name or code to the authoritative KU Online portal dropdown option.
 * 
 * @param {string} branchOrCode - e.g. 'CSD', 'MECH', 'CSE', '03', '30'
 * @returns {{ portalOption: string, status: 'VERIFIED' | 'UNKNOWN' }}
 */
export function mapBranchToPortal(branchOrCode) {
  if (!branchOrCode) return { portalOption: null, status: 'UNKNOWN' };

  const clean = String(branchOrCode).trim().toUpperCase();

  // 1. Direct code lookup
  if (ADMISSION_BRIDGE_CONFIG.BRANCH_MAPPING[clean]) {
    return {
      portalOption: ADMISSION_BRIDGE_CONFIG.BRANCH_MAPPING[clean].portalOption,
      status: ADMISSION_BRIDGE_CONFIG.BRANCH_MAPPING[clean].status,
    };
  }

  // 2. Name lookup
  if (ADMISSION_BRIDGE_CONFIG.BRANCH_NAME_TO_PORTAL[clean]) {
    return {
      portalOption: ADMISSION_BRIDGE_CONFIG.BRANCH_NAME_TO_PORTAL[clean],
      status: 'VERIFIED',
    };
  }

  return { portalOption: null, status: 'UNKNOWN' };
}

/**
 * Determines the KU Online "Previous Studying" dropdown option based on qualifying education.
 * - 'TG EAPCET' or Regular roll number -> 'Inter'
 * - 'TG ECET' or Lateral roll number -> 'Diploma'
 * - Others -> 'Other' (or flagged for human review)
 * 
 * @param {string} qualifyingExam - Entrance or qualifying exam from CMS
 * @param {string} admissionType - 'Regular' or 'Lateral'
 * @returns {{ previousStudy: string, confidence: 'VERIFIED' | 'DERIVED' | 'NEEDS_CONFIRMATION' }}
 */
export function mapPreviousStudy(qualifyingExam, admissionType) {
  const qClean = String(qualifyingExam || '').trim().toUpperCase();

  if (qClean === 'TG EAPCET' || (admissionType === 'Regular' && (!qualifyingExam || qClean === 'INTERMEDIATE' || qClean === 'INTER'))) {
    return { previousStudy: ADMISSION_BRIDGE_CONFIG.PREVIOUS_STUDY_OPTIONS.INTER, confidence: 'DERIVED' };
  }

  if (qClean === 'TG ECET' || (admissionType === 'Lateral' && (!qualifyingExam || qClean === 'DIPLOMA'))) {
    return { previousStudy: ADMISSION_BRIDGE_CONFIG.PREVIOUS_STUDY_OPTIONS.DIPLOMA, confidence: 'DERIVED' };
  }

  if (qClean === 'OTHER' || qClean === 'PGECET') {
    return { previousStudy: ADMISSION_BRIDGE_CONFIG.PREVIOUS_STUDY_OPTIONS.OTHER, confidence: 'NEEDS_CONFIRMATION' };
  }

  // Fallback to admission type if exam string is generic
  if (admissionType === 'Regular') {
    return { previousStudy: ADMISSION_BRIDGE_CONFIG.PREVIOUS_STUDY_OPTIONS.INTER, confidence: 'DERIVED' };
  }
  if (admissionType === 'Lateral') {
    return { previousStudy: ADMISSION_BRIDGE_CONFIG.PREVIOUS_STUDY_OPTIONS.DIPLOMA, confidence: 'DERIVED' };
  }

  return { previousStudy: ADMISSION_BRIDGE_CONFIG.PREVIOUS_STUDY_OPTIONS.OTHER, confidence: 'NEEDS_CONFIRMATION' };
}

/**
 * =============================================================================
 * PHASE 2: PRIMARY DETAILS DERIVATIONS & VALUE MAPPERS
 * =============================================================================
 */

/**
 * Maps CMS annual income range to the authoritative single numeric value required by KU Online.
 * 
 * Target Portal: https://kuonline.co.in/BTechsql/Btechreg.aspx
 * Authoritative 5 KUCET CMS Dropdown Options & Mappings:
 * 1. Less than 1,00,000   -> 50000  (Special institutional exception: 50000, not 0)
 * 2. 1,00,001 - 2,50,000  -> 100001 (Lower boundary)
 * 3. 2,50,001 - 5,00,000  -> 250001 (Lower boundary; Note: 200001 is prohibited)
 * 4. 5,00,001 - 8,00,000  -> 500001 (Lower boundary)
 * 5. Above 8,00,000       -> 800001 (Lower boundary)
 * 
 * Constraints:
 * - Does not guess or calculate averages.
 * - Does not infer from fee or scholarship data.
 * - Returns numeric value ONLY for explicitly recognized ranges.
 * - Flags missing and unknown inputs for manual review.
 * 
 * @param {string | number} incomeRange 
 * @returns {{
 *   portalValue: string | null,
 *   status: 'VERIFIED' | 'MISSING' | 'UNKNOWN',
 *   warning?: string
 * }}
 */
export function mapIncomeRangeToPortal(incomeRange) {
  if (incomeRange === null || incomeRange === undefined || String(incomeRange).trim() === '') {
    return {
      portalValue: null,
      status: 'MISSING',
      warning: 'Income range is missing in CMS record. Please verify and fill manually.',
    };
  }

  const raw = String(incomeRange).trim();

  // Normalize: remove currency symbols (₹, $, \u20B9, INR, Rs, Rupees), commas, normalize dashes & whitespace
  const clean = raw
    .replace(/[₹$\u20B9]/g, '')
    .replace(/INR|RS\.?|RUPEES/gi, '')
    .replace(/,/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // 1. "Less than 1,00,000" -> 50000 (Institutional exception: 50000, not zero)
  const isOption1 =
    clean === '50000' ||
    /^(less\s*than|below|up\s*to|upto)\s*(100000|1\s*(lakh|lac|lakhs|lacs))$/i.test(clean) ||
    /^(0|zero)\s*(-|\s+to\s+)\s*(100000|1\s*(lakh|lac|lakhs|lacs))$/i.test(clean);

  if (isOption1) {
    return { portalValue: '50000', status: 'VERIFIED' };
  }

  // 2. "1,00,001 - 2,50,000" -> 100001 (Lower boundary)
  const isOption2 =
    clean === '100001' ||
    /^(100001|100000)\s*(-|\s+to\s+)\s*250000$/i.test(clean) ||
    /^(1|1.0)\s*(-|\s+to\s+)\s*2.5\s*(lakh|lac|lakhs|lacs)$/i.test(clean);

  if (isOption2) {
    return { portalValue: '100001', status: 'VERIFIED' };
  }

  // 3. "2,50,001 - 5,00,000" -> 250001 (Lower boundary; NOT 200001)
  const isOption3 =
    clean === '250001' ||
    /^(250001|250000)\s*(-|\s+to\s+)\s*500000$/i.test(clean) ||
    /^2.5\s*(-|\s+to\s+)\s*(5|5.0)\s*(lakh|lac|lakhs|lacs)$/i.test(clean);

  if (isOption3) {
    return { portalValue: '250001', status: 'VERIFIED' };
  }

  // 4. "5,00,001 - 8,00,000" -> 500001 (Lower boundary)
  const isOption4 =
    clean === '500001' ||
    /^(500001|500000)\s*(-|\s+to\s+)\s*800000$/i.test(clean) ||
    /^(5|5.0)\s*(-|\s+to\s+)\s*(8|8.0)\s*(lakh|lac|lakhs|lacs)$/i.test(clean);

  if (isOption4) {
    return { portalValue: '500001', status: 'VERIFIED' };
  }

  // 5. "Above 8,00,000" -> 800001 (Lower boundary)
  const isOption5 =
    clean === '800001' ||
    /^(above|greater\s*than|>)\s*(800000|800001|8\s*(lakh|lac|lakhs|lacs))$/i.test(clean) ||
    /^(800000|800001|8\s*(lakh|lac|lakhs|lacs))\s*(\+|and\s*above)$/i.test(clean);

  if (isOption5) {
    return { portalValue: '800001', status: 'VERIFIED' };
  }

  // Explicit non-guessing policy: unrecognized or ambiguous inputs are never guessed
  return {
    portalValue: null,
    status: 'UNKNOWN',
    warning: `Unrecognized income selection: "${raw}". Please select manually.`,
  };
}

/**
 * Parses a Date of Birth input into components needed by KU Online 3-dropdown selector.
 * Preserves the actual calendar date without UTC day-shifts.
 * 
 * @param {string | Date} dateInput 
 * @returns {{
 *   isValid: boolean,
 *   day: string | null,
 *   dayPadded: string | null,
 *   month: string | null,
 *   monthPadded: string | null,
 *   monthName: string | null,
 *   monthShort: string | null,
 *   year: string | null,
 *   formatted: string | null,
 *   error?: string
 * }}
 */
export function parseDateOfBirth(dateInput) {
  if (!dateInput) {
    return {
      isValid: false,
      day: null,
      dayPadded: null,
      month: null,
      monthPadded: null,
      monthName: null,
      monthShort: null,
      year: null,
      formatted: null,
      error: 'Date of birth is missing',
    };
  }

  let year, monthIdx, day;

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      return { isValid: false, day: null, dayPadded: null, month: null, monthPadded: null, monthName: null, monthShort: null, year: null, formatted: null, error: 'Invalid Date object' };
    }
    // Use UTC methods to prevent timezone shifting
    year = dateInput.getUTCFullYear();
    monthIdx = dateInput.getUTCMonth();
    day = dateInput.getUTCDate();
  } else if (typeof dateInput === 'string') {
    const clean = dateInput.trim().split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      monthIdx = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) {
        return { isValid: false, day: null, dayPadded: null, month: null, monthPadded: null, monthName: null, monthShort: null, year: null, formatted: null, error: `Invalid date string: ${dateInput}` };
      }
      year = d.getUTCFullYear();
      monthIdx = d.getUTCMonth();
      day = d.getUTCDate();
    }
  } else {
    return { isValid: false, day: null, dayPadded: null, month: null, monthPadded: null, monthName: null, monthShort: null, year: null, formatted: null, error: 'Unsupported date type' };
  }

  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return { isValid: false, day: null, dayPadded: null, month: null, monthPadded: null, monthName: null, monthShort: null, year: null, formatted: null, error: 'Date components out of valid range' };
  }

  const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthNum = monthIdx + 1;
  const dayStr = String(day);
  const dayPad = dayStr.padStart(2, '0');
  const monthStr = String(monthNum);
  const monthPad = monthStr.padStart(2, '0');
  const yearStr = String(year);

  return {
    isValid: true,
    day: dayStr,
    dayPadded: dayPad,
    month: monthStr,
    monthPadded: monthPad,
    monthName: monthsFull[monthIdx],
    monthShort: monthsShort[monthIdx],
    year: yearStr,
    formatted: `${dayPad}-${monthPad}-${yearStr}`,
  };
}

/**
 * Maps CMS blood group string to KU Online blood group dropdown option.
 * Observed Portal Options: ['Select', 'O+', 'O-', 'AB+', 'A+', 'A-', 'B+', 'B-', 'AB-', 'Not-Available']
 * 
 * Strict mapping:
 * - A+, A-, B+, B-, AB+, AB-, O+, O- map to standard portal options.
 * - Empty, null, undefined, whitespace, or explicitly unavailable map to 'Not-Available'.
 * - Unknown non-empty values return null with an UNMAPPED warning (never silently fallback).
 * 
 * @param {string} bloodGroup 
 * @returns {{ portalOption: string | null, status: 'VERIFIED' | 'NOT_AVAILABLE' | 'UNMAPPED', warning?: string }}
 */
export function mapBloodGroupToPortal(bloodGroup) {
  if (bloodGroup === undefined || bloodGroup === null || String(bloodGroup).trim() === '') {
    return { portalOption: 'Not-Available', status: 'NOT_AVAILABLE' };
  }

  const clean = String(bloodGroup).toUpperCase().replace(/\s+/g, '').trim();

  const standardGroups = ['O+', 'O-', 'AB+', 'A+', 'A-', 'B+', 'B-', 'AB-'];
  if (standardGroups.includes(clean)) {
    return { portalOption: clean, status: 'VERIFIED' };
  }

  if (
    clean.includes('NOTAVAILABLE') || 
    clean.includes('NOT-AVAILABLE') || 
    clean.includes('N/A') || 
    clean === 'NA' ||
    clean === 'NONE' ||
    clean === 'UNKNOWN'
  ) {
    return { portalOption: 'Not-Available', status: 'NOT_AVAILABLE' };
  }

  // Unknown non-empty value must NOT silently convert to Not-Available
  return { 
    portalOption: null, 
    status: 'UNMAPPED', 
    warning: `Unknown blood group "${bloodGroup}". Requires manual verification in university portal.` 
  };
}

/**
 * Maps CMS gender string to KU Online gender option.
 * Portal Options: 'Male' | 'Female'
 * 
 * @param {string} gender 
 * @returns {{ portalOption: 'Male' | 'Female' | null, status: 'VERIFIED' | 'MISSING' }}
 */
export function mapGenderToPortal(gender) {
  if (!gender || String(gender).trim() === '') {
    return { portalOption: null, status: 'MISSING' };
  }

  const clean = String(gender).trim().toUpperCase();
  if (clean === 'MALE' || clean === 'M' || clean === 'BOY') {
    return { portalOption: 'Male', status: 'VERIFIED' };
  }
  if (clean === 'FEMALE' || clean === 'F' || clean === 'GIRL') {
    return { portalOption: 'Female', status: 'VERIFIED' };
  }

  return { portalOption: null, status: 'MISSING' };
}

/**
 * Maps CMS area status to KU Online location option.
 * Portal Options: 'Local' | 'Nonlocal'
 * 
 * @param {string} areaStatus 
 * @returns {{ portalOption: 'Local' | 'Nonlocal' | null, status: 'VERIFIED' | 'MISSING' }}
 */
export function mapLocationToPortal(areaStatus) {
  if (!areaStatus || String(areaStatus).trim() === '') {
    return { portalOption: null, status: 'MISSING' };
  }

  const clean = String(areaStatus).trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (clean === 'local') {
    return { portalOption: 'Local', status: 'VERIFIED' };
  }
  if (clean === 'nonlocal') {
    return { portalOption: 'Nonlocal', status: 'VERIFIED' };
  }

  return { portalOption: null, status: 'MISSING' };
}

/**
 * Maps CMS nationality to KU Online nationality option.
 * Portal Options: 'Indian' | 'Others'
 * 
 * @param {string} nationality 
 * @returns {{ portalOption: 'Indian' | 'Others', status: 'VERIFIED' }}
 */
export function mapNationalityToPortal(nationality) {
  if (!nationality || String(nationality).trim() === '') {
    return { portalOption: 'Indian', status: 'VERIFIED' };
  }

  const clean = String(nationality).trim().toLowerCase();
  if (clean === 'indian' || clean === 'india' || clean === 'ind') {
    return { portalOption: 'Indian', status: 'VERIFIED' };
  }

  return { portalOption: 'Others', status: 'VERIFIED' };
}

/**
 * Maps CMS category to KU Online social status option.
 * Portal Options: ['Select', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'OC', 'ST', 'SC', 'BC-E', 'Not-Available', 'OTHERS']
 * 
 * @param {string} category 
 * @returns {{ portalOption: string | null, status: 'VERIFIED' | 'DERIVED' | 'MISSING' }}
 */
export function mapSocialStatusToPortal(category) {
  if (!category || String(category).trim() === '') {
    return { portalOption: null, status: 'MISSING' };
  }

  const clean = String(category).trim().toUpperCase();

  const exact = ['BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'OC', 'ST', 'SC', 'OTHERS'];
  if (exact.includes(clean)) {
    return { portalOption: clean, status: 'VERIFIED' };
  }

  // Handle SC sub-categories (SC-A, SC-B, SC-C, SC-D -> SC)
  if (/^SC[-_]?[A-D]$/i.test(clean)) {
    return { portalOption: 'SC', status: 'DERIVED' };
  }

  // EWS typically mapped to OC in Telangana state portals
  if (clean === 'EWS') {
    return { portalOption: 'OC', status: 'DERIVED' };
  }

  const stripped = clean.replace(/[\s\-_]+/g, '');
  if (stripped === 'NOTAVAILABLE' || stripped.includes('NOTAVAILABLE') || clean.includes('N/A') || clean === 'NA') {
    return { portalOption: 'Not-Available', status: 'VERIFIED' };
  }

  return { portalOption: 'OTHERS', status: 'DERIVED' };
}

/**
 * Formats a student's personal details into a clean current address string.
 * Combines house no, apartment, street, city, state, pincode, country.
 * 
 * @param {Object} pd - Student personal details record
 * @returns {string | null}
 */
export function formatStudentCurrentAddress(pd) {
  if (!pd) return null;

  const currParts = [
    pd.curr_house_no,
    pd.curr_apartment,
    pd.curr_street,
    pd.curr_city,
    pd.curr_state,
    pd.curr_pincode,
    pd.curr_country && pd.curr_country !== 'India' ? pd.curr_country : null,
  ]
  .map(p => (p ? String(p).trim() : ''))
  .filter(Boolean);

  if (currParts.length > 0) {
    return currParts.join(', ');
  }

  // Fallback to permanent address if current address parts are empty
  const permParts = [
    pd.perm_house_no,
    pd.perm_apartment,
    pd.perm_street,
    pd.perm_city,
    pd.perm_state,
    pd.perm_pincode,
    pd.perm_country && pd.perm_country !== 'India' ? pd.perm_country : null,
  ]
  .map(p => (p ? String(p).trim() : ''))
  .filter(Boolean);

  if (permParts.length > 0) {
    return permParts.join(', ');
  }

  return pd.address ? String(pd.address).trim() : null;
}

/**
 * Formats a student's personal details into a clean permanent address string.
 * Combines house no, apartment, street, city, state, pincode, country.
 * 
 * @param {Object} pd - Student personal details record
 * @returns {string | null}
 */
export function formatStudentPermanentAddress(pd) {
  if (!pd) return null;

  const permParts = [
    pd.perm_house_no,
    pd.perm_apartment,
    pd.perm_street,
    pd.perm_city,
    pd.perm_state,
    pd.perm_pincode,
    pd.perm_country && pd.perm_country !== 'India' ? pd.perm_country : null,
  ]
  .map(p => (p ? String(p).trim() : ''))
  .filter(Boolean);

  if (permParts.length > 0) {
    return permParts.join(', ');
  }

  return null;
}


