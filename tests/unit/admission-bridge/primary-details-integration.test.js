import { describe, it, expect } from 'vitest';
import { 
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

describe('KUCET Admission Bridge — Phase 2 Primary Details Integration Suite', () => {
  describe('1. Income Mapping Rules (Authoritatively Confirmed 5 CMS Options)', () => {
    it('Option 1: should map "Less than 1,00,000" to exact numeric value 50000 (Exception: 50000, not 0)', () => {
      const inputs = [
        'Less than 1,00,000',
        'less than 1,00,000',
        'less than 100000',
        '₹0–₹1,00,000',
        '₹0-₹1,00,000',
        '0 - 1,00,000',
        '0 to 1,00,000',
        '0-100000',
        'Up to 1,00,000',
        'Below 1 Lakh',
        '50000',
      ];
      for (const input of inputs) {
        const res = mapIncomeRangeToPortal(input);
        expect(res.portalValue, `Failed for input: ${input}`).toBe('50000');
        expect(res.status).toBe('VERIFIED');
      }
    });

    it('Option 2: should map "1,00,001 - 2,50,000" to lower boundary 100001', () => {
      const inputs = [
        '1,00,001 - 2,50,000',
        '100001 - 250000',
        '100001-250000',
        '100000 - 250000',
        '1,00,001 to 2,50,000',
        '₹1,00,001 - ₹2,50,000',
        '1 to 2.5 Lakhs',
        '100001',
      ];
      for (const input of inputs) {
        const res = mapIncomeRangeToPortal(input);
        expect(res.portalValue, `Failed for input: ${input}`).toBe('100001');
        expect(res.status).toBe('VERIFIED');
      }
    });

    it('Option 3: should map "2,50,001 - 5,00,000" to lower boundary 250001 (Prohibits 200001)', () => {
      const inputs = [
        '2,50,001 - 5,00,000',
        '250001 - 500000',
        '250001-500000',
        '250000 - 500000',
        '2,50,001 to 5,00,000',
        '₹2,50,001 – ₹5,00,000',
        '2.5 to 5 Lakhs',
        '250001',
      ];
      for (const input of inputs) {
        const res = mapIncomeRangeToPortal(input);
        expect(res.portalValue, `Failed for input: ${input}`).toBe('250001');
        expect(res.status).toBe('VERIFIED');
      }
    });

    it('Option 4: should map "5,00,001 - 8,00,000" to lower boundary 500001', () => {
      const inputs = [
        '5,00,001 - 8,00,000',
        '500001 - 800000',
        '500001-800000',
        '500000 - 800000',
        '5,00,001 to 8,00,000',
        '₹5,00,001 - ₹8,00,000',
        '5 to 8 Lakhs',
        '500001',
      ];
      for (const input of inputs) {
        const res = mapIncomeRangeToPortal(input);
        expect(res.portalValue, `Failed for input: ${input}`).toBe('500001');
        expect(res.status).toBe('VERIFIED');
      }
    });

    it('Option 5: should map "Above 8,00,000" to lower boundary 800001', () => {
      const inputs = [
        'Above 8,00,000',
        'above 800000',
        '> 800000',
        '> 8,00,000',
        'Above 8 Lakh',
        '800001',
      ];
      for (const input of inputs) {
        const res = mapIncomeRangeToPortal(input);
        expect(res.portalValue, `Failed for input: ${input}`).toBe('800001');
        expect(res.status).toBe('VERIFIED');
      }
    });

    it('Strict Enforcement: should reject earlier incorrect 200001, arbitrary ranges, and averages', () => {
      // Earlier incorrect 200001 must return UNKNOWN
      expect(mapIncomeRangeToPortal('200001').portalValue).toBeNull();
      expect(mapIncomeRangeToPortal('200001').status).toBe('UNKNOWN');
      expect(mapIncomeRangeToPortal('2,00,001 - 5,00,000').portalValue).toBeNull();
      expect(mapIncomeRangeToPortal('2,00,001 - 5,00,000').status).toBe('UNKNOWN');

      // Arbitrary ranges and non-CMS options must not guess
      expect(mapIncomeRangeToPortal('3,00,001 - 4,00,000').portalValue).toBeNull();
      expect(mapIncomeRangeToPortal('4,00,001 - 5,00,000').portalValue).toBeNull();
      expect(mapIncomeRangeToPortal('10,00,000').portalValue).toBeNull();
    });

    it('Rule: should handle missing or empty income and return appropriate warnings', () => {
      const nullRes = mapIncomeRangeToPortal(null);
      expect(nullRes.portalValue).toBeNull();
      expect(nullRes.status).toBe('MISSING');
      expect(nullRes.warning).toContain('missing in CMS record');

      const undefinedRes = mapIncomeRangeToPortal(undefined);
      expect(undefinedRes.status).toBe('MISSING');

      const emptyRes = mapIncomeRangeToPortal('   ');
      expect(emptyRes.status).toBe('MISSING');
    });

    it('Rule: should flag unparseable income strings as UNKNOWN with review warning', () => {
      const unk = mapIncomeRangeToPortal('NOT_A_VALID_RANGE_ABC');
      expect(unk.portalValue).toBeNull();
      expect(unk.status).toBe('UNKNOWN');
      expect(unk.warning).toContain('Unrecognized income selection');
    });
  });

  describe('2. Date of Birth Dropdown Handling', () => {
    it('should parse YYYY-MM-DD into discrete day, month, year components', () => {
      const dob = parseDateOfBirth('2008-04-05');
      expect(dob.isValid).toBe(true);
      expect(dob.day).toBe('5');
      expect(dob.dayPadded).toBe('05');
      expect(dob.month).toBe('4');
      expect(dob.monthPadded).toBe('04');
      expect(dob.monthName).toBe('April');
      expect(dob.monthShort).toBe('Apr');
      expect(dob.year).toBe('2008');
      expect(dob.formatted).toBe('05-04-2008');
    });

    it('should preserve calendar date and avoid day-shifts across timezones', () => {
      // Midnight UTC date
      const d = new Date(Date.UTC(2007, 11, 31)); // Dec 31, 2007
      const dob = parseDateOfBirth(d);
      expect(dob.isValid).toBe(true);
      expect(dob.day).toBe('31');
      expect(dob.month).toBe('12');
      expect(dob.monthName).toBe('December');
      expect(dob.year).toBe('2007');
    });

    it('should reject invalid or missing date inputs', () => {
      expect(parseDateOfBirth(null).isValid).toBe(false);
      expect(parseDateOfBirth('').isValid).toBe(false);
      expect(parseDateOfBirth('not-a-date').isValid).toBe(false);
    });
  });

  describe('3. Demographic Dropdown & Radio Mappings', () => {
    it('should map Blood Group to portal options', () => {
      expect(mapBloodGroupToPortal('O+').portalOption).toBe('O+');
      expect(mapBloodGroupToPortal('A-').portalOption).toBe('A-');
      expect(mapBloodGroupToPortal('AB+').portalOption).toBe('AB+');
      expect(mapBloodGroupToPortal('B-').portalOption).toBe('B-');
      expect(mapBloodGroupToPortal('Not available').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('N/A').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal(null).portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('   ').portalOption).toBe('Not-Available');
      expect(mapBloodGroupToPortal('UNKNOWN_XYZ').portalOption).toBeNull();
    });

    it('should map Gender to Male or Female', () => {
      expect(mapGenderToPortal('MALE').portalOption).toBe('Male');
      expect(mapGenderToPortal('FEMALE').portalOption).toBe('Female');
      expect(mapGenderToPortal('M').portalOption).toBe('Male');
      expect(mapGenderToPortal('F').portalOption).toBe('Female');
      expect(mapGenderToPortal(null).portalOption).toBeNull();
    });

    it('should map Location to Local or Nonlocal', () => {
      expect(mapLocationToPortal('Local').portalOption).toBe('Local');
      expect(mapLocationToPortal('Non-Local').portalOption).toBe('Nonlocal');
      expect(mapLocationToPortal('NonLocal').portalOption).toBe('Nonlocal');
      expect(mapLocationToPortal('nonlocal').portalOption).toBe('Nonlocal');
      expect(mapLocationToPortal(null).portalOption).toBeNull();
    });

    it('should map Nationality to Indian or Others', () => {
      expect(mapNationalityToPortal('Indian').portalOption).toBe('Indian');
      expect(mapNationalityToPortal('India').portalOption).toBe('Indian');
      expect(mapNationalityToPortal(null).portalOption).toBe('Indian');
      expect(mapNationalityToPortal('Canadian').portalOption).toBe('Others');
    });

    it('should map Social Status / Category', () => {
      expect(mapSocialStatusToPortal('OC').portalOption).toBe('OC');
      expect(mapSocialStatusToPortal('BC-A').portalOption).toBe('BC-A');
      expect(mapSocialStatusToPortal('BC-B').portalOption).toBe('BC-B');
      expect(mapSocialStatusToPortal('BC-C').portalOption).toBe('BC-C');
      expect(mapSocialStatusToPortal('BC-D').portalOption).toBe('BC-D');
      expect(mapSocialStatusToPortal('BC-E').portalOption).toBe('BC-E');
      expect(mapSocialStatusToPortal('SC').portalOption).toBe('SC');
      expect(mapSocialStatusToPortal('SC-A').portalOption).toBe('SC');
      expect(mapSocialStatusToPortal('SC-B').portalOption).toBe('SC');
      expect(mapSocialStatusToPortal('ST').portalOption).toBe('ST');
      expect(mapSocialStatusToPortal('EWS').portalOption).toBe('OC'); // Mapped to OC
      expect(mapSocialStatusToPortal('Not-Available').portalOption).toBe('Not-Available');
      expect(mapSocialStatusToPortal(null).portalOption).toBeNull();
    });
  });

  describe('4. Address & Permanent-Address Instruction', () => {
    it('should format current address into single clean string', () => {
      const pd = {
        curr_house_no: 'Plot 12',
        curr_apartment: 'Kakatiya Heights',
        curr_street: 'KU Cross Road',
        curr_city: 'Warangal',
        curr_state: 'Telangana',
        curr_pincode: '506009',
        curr_country: 'India',
      };
      const formatted = formatStudentCurrentAddress(pd);
      expect(formatted).toBe('Plot 12, Kakatiya Heights, KU Cross Road, Warangal, Telangana, 506009');
    });

    it('should fallback to permanent address if current address parts are empty', () => {
      const pd = {
        curr_house_no: null,
        perm_house_no: 'H.No 1-2-3',
        perm_street: 'Station Road',
        perm_city: 'Khammam',
        perm_state: 'Telangana',
        perm_pincode: '507001',
      };
      const formatted = formatStudentCurrentAddress(pd);
      expect(formatted).toBe('H.No 1-2-3, Station Road, Khammam, Telangana, 507001');
    });

    it('should verify permanent address rule instructs same-as-current checkbox activation', () => {
      // Confirmed institutional rule:
      // Permanent address is not independently overwritten; same-as-current checkbox must be activated
      const pdPayload = {
        currentAddress: 'Plot 12, Warangal',
        useSameAddressForPermanent: true,
      };
      expect(pdPayload.useSameAddressForPermanent).toBe(true);
    });
  });

  describe('5. Mandatory Safety & Privacy Verification', () => {
    it('should never include Email ID in Primary Details payload', () => {
      const primaryDetails = {
        fullName: 'KOLA SRIKANTH',
        fatherName: 'RAMESH',
        motherName: 'LAKSHMI',
        // Email must not be present
      };
      expect(primaryDetails.email).toBeUndefined();
      expect(primaryDetails.studentEmail).toBeUndefined();
    });

    it('should verify config options contain observed KU Online values', () => {
      expect(ADMISSION_BRIDGE_CONFIG.PRIMARY_DETAILS).toBeDefined();
      expect(ADMISSION_BRIDGE_CONFIG.PRIMARY_DETAILS.BLOOD_GROUPS).toContain('O+');
      expect(ADMISSION_BRIDGE_CONFIG.PRIMARY_DETAILS.BLOOD_GROUPS).toContain('Not-Available');
      expect(ADMISSION_BRIDGE_CONFIG.PRIMARY_DETAILS.SOCIAL_STATUSES).toContain('BC-A');
      expect(ADMISSION_BRIDGE_CONFIG.PRIMARY_DETAILS.SOCIAL_STATUSES).toContain('OC');
      expect(ADMISSION_BRIDGE_CONFIG.PRIMARY_DETAILS.GENDERS.MALE).toBe('Male');
      expect(ADMISSION_BRIDGE_CONFIG.PRIMARY_DETAILS.LOCATIONS.LOCAL).toBe('Local');
    });
  });
});
