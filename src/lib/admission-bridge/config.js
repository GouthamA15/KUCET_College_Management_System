/**
 * Centralized configuration for KUCET Admission Bridge integration with KU Online.
 * 
 * Target portal: https://kuonline.co.in/BTechsql/Btechreg.aspx
 */

// Centralized Conservative Image Upload Limit Constants
// University portal states 'photo & signature should be in 250K Below' or assumes ~200 KB limit.
// To guarantee portal acceptance without boundary failures, we enforce a conservative
// hard ceiling of 190 KiB = 194,560 bytes for both photographs and signatures.
export const MAX_PORTAL_IMAGE_BYTES = 194560; // 190 KiB (194,560 bytes)
export const TARGET_IMAGE_MIN_BYTES = 100 * 1024; // 100 KiB (102,400 bytes)
export const TARGET_IMAGE_MAX_BYTES = 150 * 1024; // 150 KiB (153,600 bytes)

export const ADMISSION_BRIDGE_CONFIG = Object.freeze({
  // University Portal Base & Registration URLs
  PORTAL_ORIGIN: 'https://kuonline.co.in',
  REGISTRATION_URL: 'https://kuonline.co.in/BTechsql/Btechreg.aspx',

  // Institutional Identification
  COLLEGE_CODE: '567',
  COLLEGE_BRIEF_CODE: 'UC,KU,WGL',
  COLLEGE_NAME: 'KU COLLEGE OF ENGG. & TECH, KU CAMPUS',
  DEFAULT_COURSE: 'B.TECH',
  DEFAULT_YEAR: '1',

  // Institutionally Confirmed Academic Scheme for 2026-2027 and future intakes
  // (Configurable to allow smooth transition when new schemes are introduced)
  DEFAULT_SCHEME: '2013',

  // Media Constraints mandated by KU Online & Conservative Safety Margins
  MEDIA: Object.freeze({
    // Conservative portal hard limit: 190 KiB = 194,560 bytes
    MAX_PORTAL_IMAGE_BYTES: 194560,
    MAX_FILE_BYTES: 194560, // Alias for backward compatibility
    TARGET_IMAGE_MIN_BYTES: 100 * 1024, // 100 KiB (102,400 bytes)
    TARGET_IMAGE_MAX_BYTES: 150 * 1024, // 150 KiB (153,600 bytes)
    TARGET_MIN_BYTES: 100 * 1024, // Alias
    TARGET_MAX_BYTES: 150 * 1024, // Alias
    ACCEPTED_MIME_TYPE: 'image/jpeg',
    OUTPUT_EXTENSION: '.jpg',
    MAX_INITIAL_PHOTO_DIM: 1000,
    MAX_INITIAL_SIGNATURE_DIM: 800,
    MIN_PHOTO_DIM: 240,
    MIN_SIGNATURE_DIM: 160,
  }),

  // Authoritative KUCET branch code to KU Online dropdown label mapping
  // Fully verified with KUCET admission convener & college administration
  BRANCH_MAPPING: Object.freeze({
    '09': { cmsCode: '09', cmsName: 'CSE', portalOption: 'CSE', status: 'VERIFIED' },
    '30': { cmsCode: '30', cmsName: 'CSD', portalOption: 'DATA SCIENCE', status: 'VERIFIED' },
    '15': { cmsCode: '15', cmsName: 'ECE', portalOption: 'ECE', status: 'VERIFIED' },
    '12': { cmsCode: '12', cmsName: 'EEE', portalOption: 'EEE', status: 'VERIFIED' },
    '00': { cmsCode: '00', cmsName: 'CIVIL', portalOption: 'CIVIL', status: 'VERIFIED' },
    '18': { cmsCode: '18', cmsName: 'IT', portalOption: 'IT', status: 'VERIFIED' },
    '03': { cmsCode: '03', cmsName: 'MECH', portalOption: 'MECHANICAL', status: 'VERIFIED' },
  }),

  // Mapping from CMS branch name to KU Online portal dropdown label
  BRANCH_NAME_TO_PORTAL: Object.freeze({
    CSE: 'CSE',
    CSD: 'DATA SCIENCE', // Confirmed: Computer Science & Data Science -> DATA SCIENCE
    ECE: 'ECE',
    EEE: 'EEE',
    CIVIL: 'CIVIL',
    IT: 'IT',
    MECH: 'MECHANICAL',
  }),

  // KU Online previous studying options
  PREVIOUS_STUDY_OPTIONS: Object.freeze({
    INTER: 'Inter',
    DIPLOMA: 'Diploma',
    OTHER: 'Other',
  }),

  // Phase 2: Primary Details Dropdown & Control Options
  PRIMARY_DETAILS: Object.freeze({
    BLOOD_GROUPS: Object.freeze([
      'Select', 'O+', 'O-', 'AB+', 'A+', 'A-', 'B+', 'B-', 'AB-', 'Not-Available'
    ]),
    NATIONALITIES: Object.freeze([
      'Select', 'Indian', 'Others'
    ]),
    SOCIAL_STATUSES: Object.freeze([
      'Select', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'OC', 'ST', 'SC', 'BC-E', 'Not-Available', 'OTHERS'
    ]),
    GENDERS: Object.freeze({
      MALE: 'Male',
      FEMALE: 'Female',
    }),
    LOCATIONS: Object.freeze({
      LOCAL: 'Local',
      NONLOCAL: 'Nonlocal',
    }),
    // Authoritative 5 CMS Annual Income options mapped to KU Online numeric portal values
    INCOME_OPTIONS: Object.freeze([
      'Less than 1,00,000',
      '1,00,001 - 2,50,000',
      '2,50,001 - 5,00,000',
      '5,00,001 - 8,00,000',
      'Above 8,00,000',
    ]),
    EXACT_INCOME_RULES: Object.freeze([
      { cmsOption: 'Less than 1,00,000', portalValue: '50000', minFloor: 0, maxCeiling: 100000, label: 'Less than 1,00,000' },
      { cmsOption: '1,00,001 - 2,50,000', portalValue: '100001', minFloor: 100001, maxCeiling: 250000, label: '1,00,001 - 2,50,000' },
      { cmsOption: '2,50,001 - 5,00,000', portalValue: '250001', minFloor: 250001, maxCeiling: 500000, label: '2,50,001 - 5,00,000' },
      { cmsOption: '5,00,001 - 8,00,000', portalValue: '500001', minFloor: 500001, maxCeiling: 800000, label: '5,00,001 - 8,00,000' },
      { cmsOption: 'Above 8,00,000', portalValue: '800001', minFloor: 800001, maxCeiling: null, label: 'Above 8,00,000' },
    ]),
  }),
});
