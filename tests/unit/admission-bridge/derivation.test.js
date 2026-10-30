import { describe, it, expect } from 'vitest';
import { 
  deriveCollegeAdmissionNo, 
  getPortalImageFilenames, 
  isValidCollegeAdmissionNo,
  formatAdmissionDate, 
  mapBranchToPortal, 
  mapPreviousStudy,
  mapIncomeRangeToPortal,
  parseDateOfBirth,
  mapBloodGroupToPortal,
  mapGenderToPortal,
  mapLocationToPortal,
  mapNationalityToPortal,
  mapSocialStatusToPortal,
  formatStudentCurrentAddress
} from '@/lib/admission-bridge/derivation';
import { ADMISSION_BRIDGE_CONFIG } from '@/lib/admission-bridge/config';

describe('KUCET Admission Bridge — Derivation & Mapping Suite', () => {
  describe('1. Regular Admission Number Derivation', () => {
    it('should derive last 4 characters for regular student and preserve leading zeroes', () => {
      // Civil with serial 01
      const resCivil = deriveCollegeAdmissionNo('26567T0001');
      expect(resCivil.isValid).toBe(true);
      expect(resCivil.admissionNo).toBe('0001'); // String, preserving leading zeros
      expect(resCivil.admissionType).toBe('Regular');
      expect(resCivil.branch).toBe('CIVIL');
      expect(resCivil.entryYear).toBe('2026');

      // Mechanical with serial 32
      const resMech = deriveCollegeAdmissionNo('26567T0332');
      expect(resMech.isValid).toBe(true);
      expect(resMech.admissionNo).toBe('0332');
      expect(resMech.admissionType).toBe('Regular');
      expect(resMech.branch).toBe('MECH');

      // CSE with serial 15
      const resCse = deriveCollegeAdmissionNo('26567T0915');
      expect(resCse.isValid).toBe(true);
      expect(resCse.admissionNo).toBe('0915');
      expect(resCse.branch).toBe('CSE');

      // CSD (Data Science)
      const resCsd = deriveCollegeAdmissionNo('26567T3005');
      expect(resCsd.isValid).toBe(true);
      expect(resCsd.admissionNo).toBe('3005');
      expect(resCsd.branch).toBe('CSD');
    });

    it('should never return a numeric integer type for admission number', () => {
      const res = deriveCollegeAdmissionNo('26567T0005');
      expect(typeof res.admissionNo).toBe('string');
      expect(res.admissionNo).not.toBe(5);
      expect(res.admissionNo).toBe('0005');
    });
  });

  describe('2. Lateral-Entry Admission Number Derivation', () => {
    it('should derive last 5 characters and strictly preserve trailing L suffix and leading zeroes', () => {
      // Mechanical lateral student
      const resLatMech = deriveCollegeAdmissionNo('265670361L');
      expect(resLatMech.isValid).toBe(true);
      expect(resLatMech.admissionNo).toBe('0361L'); // Preserves 'L' and leading '0'
      expect(resLatMech.admissionType).toBe('Lateral');
      expect(resLatMech.branch).toBe('MECH');
      expect(resLatMech.entryYear).toBe('2026');

      // IT lateral student
      const resLatIt = deriveCollegeAdmissionNo('265671867L');
      expect(resLatIt.isValid).toBe(true);
      expect(resLatIt.admissionNo).toBe('1867L');
      expect(resLatIt.admissionType).toBe('Lateral');
      expect(resLatIt.branch).toBe('IT');

      // Civil lateral student with leading zero
      const resLatCiv = deriveCollegeAdmissionNo('265670062L');
      expect(resLatCiv.isValid).toBe(true);
      expect(resLatCiv.admissionNo).toBe('0062L');
      expect(resLatCiv.branch).toBe('CIVIL');
    });

    it('should handle lateral roll numbers formatted with optional T', () => {
      const res = deriveCollegeAdmissionNo('26567T0961L');
      expect(res.isValid).toBe(true);
      expect(res.admissionNo).toBe('0961L');
      expect(res.admissionType).toBe('Lateral');
    });
  });

  describe('3. Invalid and Ambiguous Roll Numbers', () => {
    it('should reject invalid, malformed, or empty roll numbers', () => {
      expect(deriveCollegeAdmissionNo('')).toEqual(expect.objectContaining({ isValid: false }));
      expect(deriveCollegeAdmissionNo(null)).toEqual(expect.objectContaining({ isValid: false }));
      expect(deriveCollegeAdmissionNo('INVALID123')).toEqual(expect.objectContaining({ isValid: false }));
      expect(deriveCollegeAdmissionNo('2656799999')).toEqual(expect.objectContaining({ isValid: false }));
    });
  });

  describe('4. Portal Filename Generation Convention', () => {
    it('should generate exact KU Online filenames for regular students', () => {
      const { photoFilename, signatureFilename } = getPortalImageFilenames('1802');
      expect(photoFilename).toBe('1802.jpg');
      expect(signatureFilename).toBe('1802(1).jpg');
    });

    it('should generate exact KU Online filenames for lateral students with L suffix', () => {
      const { photoFilename, signatureFilename } = getPortalImageFilenames('1867L');
      expect(photoFilename).toBe('1867L.jpg');
      expect(signatureFilename).toBe('1867L(1).jpg');

      const civilLat = getPortalImageFilenames('0062L');
      expect(civilLat.photoFilename).toBe('0062L.jpg');
      expect(civilLat.signatureFilename).toBe('0062L(1).jpg');
    });

    it('should validate admission number and throw error on invalid input', () => {
      expect(() => getPortalImageFilenames('')).toThrow(/Invalid College Admission Number/);
      expect(() => getPortalImageFilenames('26567T0332')).toThrow(/Invalid College Admission Number/); // Full roll number rejected
      expect(() => getPortalImageFilenames('12')).toThrow(/Invalid College Admission Number/);
    });

    it('should correctly validate admission numbers with isValidCollegeAdmissionNo', () => {
      expect(isValidCollegeAdmissionNo('0332')).toBe(true);
      expect(isValidCollegeAdmissionNo('1802')).toBe(true);
      expect(isValidCollegeAdmissionNo('0361L')).toBe(true);
      expect(isValidCollegeAdmissionNo('1867L')).toBe(true);
      expect(isValidCollegeAdmissionNo('0001')).toBe(true);
      expect(isValidCollegeAdmissionNo('26567T0332')).toBe(false);
      expect(isValidCollegeAdmissionNo('XYZ')).toBe(false);
    });
  });

  describe('5. Admission Date Formatting', () => {
    it('should format individual student admission dates as DD-MMM-YY', () => {
      expect(formatAdmissionDate('2026-07-25')).toBe('25-Jul-26');
      expect(formatAdmissionDate('2026-08-05')).toBe('05-Aug-26');
      expect(formatAdmissionDate('2026-11-12')).toBe('12-Nov-26');
      expect(formatAdmissionDate(new Date('2026-07-25T00:00:00Z'))).toBe('25-Jul-26');
      expect(formatAdmissionDate(null)).toBeNull();
      expect(formatAdmissionDate('')).toBeNull();
      expect(formatAdmissionDate('invalid-date')).toBeNull();
    });
  });

  describe('6. Branch & Scheme Mapping', () => {
    it('should map CSD (30) to DATA SCIENCE as VERIFIED', () => {
      const byCode = mapBranchToPortal('30');
      expect(byCode.portalOption).toBe('DATA SCIENCE');
      expect(byCode.status).toBe('VERIFIED');

      const byName = mapBranchToPortal('CSD');
      expect(byName.portalOption).toBe('DATA SCIENCE');
      expect(byName.status).toBe('VERIFIED');
    });

    it('should map MECH (03) to MECHANICAL', () => {
      const res = mapBranchToPortal('MECH');
      expect(res.portalOption).toBe('MECHANICAL');
      expect(res.status).toBe('VERIFIED');
    });

    it('should map all other active engineering branches', () => {
      expect(mapBranchToPortal('CSE').portalOption).toBe('CSE');
      expect(mapBranchToPortal('ECE').portalOption).toBe('ECE');
      expect(mapBranchToPortal('EEE').portalOption).toBe('EEE');
      expect(mapBranchToPortal('CIVIL').portalOption).toBe('CIVIL');
      expect(mapBranchToPortal('IT').portalOption).toBe('IT');
    });

    it('should provide confirmed default scheme 2013', () => {
      expect(ADMISSION_BRIDGE_CONFIG.DEFAULT_SCHEME).toBe('2013');
    });
  });

  describe('7. Previous Study Mapping', () => {
    it('should map TG EAPCET to Inter with DERIVED confidence', () => {
      const res = mapPreviousStudy('TG EAPCET', 'Regular');
      expect(res.previousStudy).toBe('Inter');
      expect(res.confidence).toBe('DERIVED');
    });

    it('should map TG ECET to Diploma with DERIVED confidence', () => {
      const res = mapPreviousStudy('TG ECET', 'Lateral');
      expect(res.previousStudy).toBe('Diploma');
      expect(res.confidence).toBe('DERIVED');
    });

    it('should flag ambiguous previous study records as NEEDS_CONFIRMATION', () => {
      const res = mapPreviousStudy('Other', 'Regular');
      expect(res.previousStudy).toBe('Other');
      expect(res.confidence).toBe('NEEDS_CONFIRMATION');
    });
  });

  describe('8. Phase 2 Income Range Mapping to KU Online Value', () => {
    it('should map Option 1: "Less than 1,00,000" to 50000 (Institutional Exception: 50000, not 0)', () => {
      // Confirmed exact CMS string
      const r1 = mapIncomeRangeToPortal('Less than 1,00,000');
      expect(r1.portalValue).toBe('50000');
      expect(r1.status).toBe('VERIFIED');

      // Harmless whitespace, currency, and boundary variations
      expect(mapIncomeRangeToPortal('less than 1,00,000').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal('less than 100000').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal('0 - 1,00,000').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal('0 to 1,00,000').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal('₹0–₹1,00,000').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal('Below 1 Lakh').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal('Up to 1,00,000').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal('50000').portalValue).toBe('50000');
      expect(mapIncomeRangeToPortal(50000).portalValue).toBe('50000');
    });

    it('should map Option 2: "1,00,001 - 2,50,000" to lower boundary 100001', () => {
      // Confirmed exact CMS string
      const r2 = mapIncomeRangeToPortal('1,00,001 - 2,50,000');
      expect(r2.portalValue).toBe('100001');
      expect(r2.status).toBe('VERIFIED');

      // Harmless whitespace, comma, and currency variations
      expect(mapIncomeRangeToPortal('100001 - 250000').portalValue).toBe('100001');
      expect(mapIncomeRangeToPortal('100001-250000').portalValue).toBe('100001');
      expect(mapIncomeRangeToPortal('1,00,001 to 2,50,000').portalValue).toBe('100001');
      expect(mapIncomeRangeToPortal('₹1,00,001 - ₹2,50,000').portalValue).toBe('100001');
      expect(mapIncomeRangeToPortal('100001').portalValue).toBe('100001');
      expect(mapIncomeRangeToPortal(100001).portalValue).toBe('100001');
    });

    it('should map Option 3: "2,50,001 - 5,00,000" to lower boundary 250001 (Prohibits earlier 200001)', () => {
      // Confirmed exact CMS string
      const r3 = mapIncomeRangeToPortal('2,50,001 - 5,00,000');
      expect(r3.portalValue).toBe('250001');
      expect(r3.status).toBe('VERIFIED');

      // Harmless variations
      expect(mapIncomeRangeToPortal('250001 - 500000').portalValue).toBe('250001');
      expect(mapIncomeRangeToPortal('250001-500000').portalValue).toBe('250001');
      expect(mapIncomeRangeToPortal('2,50,001 to 5,00,000').portalValue).toBe('250001');
      expect(mapIncomeRangeToPortal('₹2,50,001 – ₹5,00,000').portalValue).toBe('250001');
      expect(mapIncomeRangeToPortal('250001').portalValue).toBe('250001');
      expect(mapIncomeRangeToPortal(250001).portalValue).toBe('250001');
    });

    it('should map Option 4: "5,00,001 - 8,00,000" to lower boundary 500001', () => {
      // Confirmed exact CMS string
      const r4 = mapIncomeRangeToPortal('5,00,001 - 8,00,000');
      expect(r4.portalValue).toBe('500001');
      expect(r4.status).toBe('VERIFIED');

      // Harmless variations
      expect(mapIncomeRangeToPortal('500001 - 800000').portalValue).toBe('500001');
      expect(mapIncomeRangeToPortal('500001-800000').portalValue).toBe('500001');
      expect(mapIncomeRangeToPortal('5,00,001 to 8,00,000').portalValue).toBe('500001');
      expect(mapIncomeRangeToPortal('₹5,00,001 - ₹8,00,000').portalValue).toBe('500001');
      expect(mapIncomeRangeToPortal('500001').portalValue).toBe('500001');
      expect(mapIncomeRangeToPortal(500001).portalValue).toBe('500001');
    });

    it('should map Option 5: "Above 8,00,000" to lower boundary 800001', () => {
      // Confirmed exact CMS string
      const r5 = mapIncomeRangeToPortal('Above 8,00,000');
      expect(r5.portalValue).toBe('800001');
      expect(r5.status).toBe('VERIFIED');

      // Harmless variations
      expect(mapIncomeRangeToPortal('above 800000').portalValue).toBe('800001');
      expect(mapIncomeRangeToPortal('> 800000').portalValue).toBe('800001');
      expect(mapIncomeRangeToPortal('> 8,00,000').portalValue).toBe('800001');
      expect(mapIncomeRangeToPortal('Above 8 Lakh').portalValue).toBe('800001');
      expect(mapIncomeRangeToPortal('800001').portalValue).toBe('800001');
      expect(mapIncomeRangeToPortal(800001).portalValue).toBe('800001');
    });

    it('should strictly reject earlier incorrect 200001, averages, and unconfirmed ranges without guessing', () => {
      // Earlier incorrect 200001 value must NOT be accepted
      const rOld = mapIncomeRangeToPortal('200001');
      expect(rOld.portalValue).toBeNull();
      expect(rOld.status).toBe('UNKNOWN');
      expect(rOld.warning).toContain('Unrecognized income selection');

      const rOldRange = mapIncomeRangeToPortal('2,00,001 - 5,00,000');
      expect(rOldRange.portalValue).toBeNull();
      expect(rOldRange.status).toBe('UNKNOWN');

      // Other non-CMS ranges must not guess or average
      const rArbitrary = mapIncomeRangeToPortal('3,00,001 - 4,00,000');
      expect(rArbitrary.portalValue).toBeNull();
      expect(rArbitrary.status).toBe('UNKNOWN');

      const rSingle = mapIncomeRangeToPortal('350000');
      expect(rSingle.portalValue).toBeNull();
      expect(rSingle.status).toBe('UNKNOWN');
    });

    it('should handle missing, empty, and null income inputs gracefully', () => {
      const missing = mapIncomeRangeToPortal(null);
      expect(missing.portalValue).toBeNull();
      expect(missing.status).toBe('MISSING');
      expect(missing.warning).toContain('missing in CMS record');

      const undefinedRes = mapIncomeRangeToPortal(undefined);
      expect(undefinedRes.portalValue).toBeNull();
      expect(undefinedRes.status).toBe('MISSING');

      const empty = mapIncomeRangeToPortal('');
      expect(empty.portalValue).toBeNull();
      expect(empty.status).toBe('MISSING');

      const whitespace = mapIncomeRangeToPortal('   ');
      expect(whitespace.portalValue).toBeNull();
      expect(whitespace.status).toBe('MISSING');

      const unknown = mapIncomeRangeToPortal('NOT_A_VALID_INCOME_XYZ');
      expect(unknown.portalValue).toBeNull();
      expect(unknown.status).toBe('UNKNOWN');
      expect(unknown.warning).toBeDefined();
    });
  });

  describe('9. Phase 2 Date of Birth Parsing & Components', () => {
    it('should parse YYYY-MM-DD string into components without UTC day-shifts', () => {
      const parsed = parseDateOfBirth('2008-07-25');
      expect(parsed.isValid).toBe(true);
      expect(parsed.day).toBe('25');
      expect(parsed.dayPadded).toBe('25');
      expect(parsed.month).toBe('7');
      expect(parsed.monthPadded).toBe('07');
      expect(parsed.monthName).toBe('July');
      expect(parsed.monthShort).toBe('Jul');
      expect(parsed.year).toBe('2008');
      expect(parsed.formatted).toBe('25-07-2008');
    });

    it('should handle Date object correctly in UTC', () => {
      const dateObj = new Date(Date.UTC(2007, 0, 5)); // 2007-01-05
      const parsed = parseDateOfBirth(dateObj);
      expect(parsed.isValid).toBe(true);
      expect(parsed.day).toBe('5');
      expect(parsed.dayPadded).toBe('05');
      expect(parsed.month).toBe('1');
      expect(parsed.monthPadded).toBe('01');
      expect(parsed.monthName).toBe('January');
      expect(parsed.year).toBe('2007');
    });

    it('should safely reject missing or invalid date inputs', () => {
      expect(parseDateOfBirth(null).isValid).toBe(false);
      expect(parseDateOfBirth('').isValid).toBe(false);
      expect(parseDateOfBirth('invalid-date').isValid).toBe(false);
    });
  });

  describe('10. Phase 2 Demographic, Blood Group, & Address Mappings', () => {
    it('should map Blood Group to KU Online options', () => {
      expect(mapBloodGroupToPortal('O+').portalOption).toBe('O+');
      expect(mapBloodGroupToPortal('o+').portalOption).toBe('O+');
      expect(mapBloodGroupToPortal('AB-').portalOption).toBe('AB-');
      expect(mapBloodGroupToPortal('Not available').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal(null).portalOption).toBeNull();
    });

    it('should map Gender to Male / Female', () => {
      expect(mapGenderToPortal('MALE').portalOption).toBe('Male');
      expect(mapGenderToPortal('FEMALE').portalOption).toBe('Female');
      expect(mapGenderToPortal('M').portalOption).toBe('Male');
      expect(mapGenderToPortal('F').portalOption).toBe('Female');
      expect(mapGenderToPortal(null).portalOption).toBeNull();
    });

    it('should map Location to Local / Nonlocal', () => {
      expect(mapLocationToPortal('Local').portalOption).toBe('Local');
      expect(mapLocationToPortal('Non-Local').portalOption).toBe('Nonlocal');
      expect(mapLocationToPortal('Nonlocal').portalOption).toBe('Nonlocal');
      expect(mapLocationToPortal(null).portalOption).toBeNull();
    });

    it('should map Nationality to Indian / Others', () => {
      expect(mapNationalityToPortal('Indian').portalOption).toBe('Indian');
      expect(mapNationalityToPortal('India').portalOption).toBe('Indian');
      expect(mapNationalityToPortal(null).portalOption).toBe('Indian'); // default
      expect(mapNationalityToPortal('American').portalOption).toBe('Others');
    });

    it('should map Social Status / Category', () => {
      expect(mapSocialStatusToPortal('OC').portalOption).toBe('OC');
      expect(mapSocialStatusToPortal('BC-A').portalOption).toBe('BC-A');
      expect(mapSocialStatusToPortal('SC').portalOption).toBe('SC');
      expect(mapSocialStatusToPortal('SC-A').portalOption).toBe('SC');
      expect(mapSocialStatusToPortal('ST').portalOption).toBe('ST');
      expect(mapSocialStatusToPortal('EWS').portalOption).toBe('OC'); // EWS mapped to OC
      expect(mapSocialStatusToPortal(null).portalOption).toBeNull();
    });

    it('should format current address into single clean comma-separated string', () => {
      const pd = {
        curr_house_no: 'H.No 2-4-105',
        curr_street: 'Subedari',
        curr_apartment: 'Sai Nilayam',
        curr_city: 'Hanamkonda',
        curr_state: 'Telangana',
        curr_pincode: '506001',
        curr_country: 'India',
      };
      const formatted = formatStudentCurrentAddress(pd);
      expect(formatted).toBe('H.No 2-4-105, Sai Nilayam, Subedari, Hanamkonda, Telangana, 506001');
    });

    it('should fallback to permanent address if current address parts are empty', () => {
      const pd = {
        curr_house_no: null,
        perm_house_no: '1-100',
        perm_street: 'Main Road',
        perm_city: 'Warangal',
        perm_state: 'Telangana',
        perm_pincode: '506002',
      };
      const formatted = formatStudentCurrentAddress(pd);
      expect(formatted).toBe('1-100, Main Road, Warangal, Telangana, 506002');
    });
  });
});
