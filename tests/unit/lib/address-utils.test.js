import { describe, it, expect } from 'vitest';
import { 
  cleanAddressPart, 
  sanitizeAddressString, 
  formatAddress, 
  parseAddress, 
  getPermanentAddressFromDetails, 
  getContactAddressFromDetails, 
  getEffectiveStudentAddress 
} from '@/lib/address-utils';

describe('Address Utilities — Cleaning, Merging & Deduplication Suite', () => {
  describe('cleanAddressPart', () => {
    it('returns empty string for null, undefined, and empty string', () => {
      expect(cleanAddressPart(null)).toBe('');
      expect(cleanAddressPart(undefined)).toBe('');
      expect(cleanAddressPart('')).toBe('');
      expect(cleanAddressPart('   ')).toBe('');
    });

    it('strips case-insensitive placeholder values', () => {
      expect(cleanAddressPart('N/A')).toBe('');
      expect(cleanAddressPart('n/a')).toBe('');
      expect(cleanAddressPart('NA')).toBe('');
      expect(cleanAddressPart('na')).toBe('');
      expect(cleanAddressPart('NULL')).toBe('');
      expect(cleanAddressPart('null')).toBe('');
      expect(cleanAddressPart('undefined')).toBe('');
      expect(cleanAddressPart('None')).toBe('');
      expect(cleanAddressPart('-')).toBe('');
      expect(cleanAddressPart('--')).toBe('');
      expect(cleanAddressPart('—')).toBe('');
      expect(cleanAddressPart('.')).toBe('');
      expect(cleanAddressPart('Not Applicable')).toBe('');
      expect(cleanAddressPart('N.A.')).toBe('');
    });

    it('preserves valid address strings', () => {
      expect(cleanAddressPart('HouseNo13')).toBe('HouseNo13');
      expect(cleanAddressPart('4-41/1')).toBe('4-41/1');
      expect(cleanAddressPart('Shivunipally')).toBe('Shivunipally');
      expect(cleanAddressPart('Warangal')).toBe('Warangal');
    });
  });

  describe('sanitizeAddressString', () => {
    it('returns empty string for null, undefined, or empty string', () => {
      expect(sanitizeAddressString(null)).toBe('');
      expect(sanitizeAddressString(undefined)).toBe('');
      expect(sanitizeAddressString('')).toBe('');
    });

    it('removes N/A, null, and placeholder segments from address strings', () => {
      const input = 'HouseNo13, N/A, City name, NULL, 506001';
      expect(sanitizeAddressString(input)).toBe('HouseNo13, City name, 506001');
    });

    it('deduplicates adjacent duplicate segments case-insensitively', () => {
      const input = '# 4-41/1, SHIVUNIPALLY, SHIVUNIPALLY, GHANPUR, TELANGANA, 506143, India';
      expect(sanitizeAddressString(input)).toBe('# 4-41/1, SHIVUNIPALLY, GHANPUR, TELANGANA, 506143, India');
    });

    it('cleans addresses with leading/trailing commas or multiple commas', () => {
      const input = ', , N/A, H.No 12-3, , Shivunipally, , Telangana, ';
      expect(sanitizeAddressString(input)).toBe('H.No 12-3, Shivunipally, Telangana');
    });

    it('returns empty string if only "India" is present without local details', () => {
      expect(sanitizeAddressString('India')).toBe('');
      expect(sanitizeAddressString('N/A, India, null')).toBe('');
    });
  });

  describe('formatAddress', () => {
    it('formats clean structured object without empty or placeholder parts', () => {
      const addr = {
        house_no: '4-41/1',
        apartment: 'N/A',
        street: 'Shivunipally',
        city: 'Ghanpur',
        state: 'Telangana',
        pincode: '506143',
        country: 'India',
      };
      expect(formatAddress(addr)).toBe('4-41/1, Shivunipally, Ghanpur, Telangana, 506143, India');
    });

    it('deduplicates identical street and apartment names', () => {
      const addr = {
        house_no: '4-41/1',
        apartment: 'SHIVUNIPALLY',
        street: 'SHIVUNIPALLY',
        city: 'GHANPUR',
        state: 'TELANGANA',
        pincode: '506143',
        country: 'India',
      };
      expect(formatAddress(addr)).toBe('4-41/1, SHIVUNIPALLY, GHANPUR, TELANGANA, 506143, India');
    });

    it('handles student filling only house number and city', () => {
      const addr = {
        house_no: 'HouseNo13',
        apartment: 'N/A',
        street: '',
        city: 'Warangal',
        state: 'Telangana',
        pincode: '',
        country: 'India',
      };
      expect(formatAddress(addr)).toBe('HouseNo13, Warangal, Telangana, India');
    });
  });

  describe('getEffectiveStudentAddress', () => {
    it('merges permanent and current address components when student fills partial details across both', () => {
      const studentDetails = {
        // Permanent address has N/A for house no, but valid street & city
        perm_house_no: 'N/A',
        perm_apartment: 'NULL',
        perm_street: 'Main Road',
        perm_city: 'Warangal',
        perm_state: 'Telangana',
        perm_pincode: '506001',
        perm_country: 'India',

        // Current address has the house number
        curr_house_no: 'HouseNo13',
        curr_apartment: '',
        curr_street: '',
        curr_city: '',
        curr_state: '',
        curr_pincode: '',
        curr_country: 'India',
      };

      const result = getEffectiveStudentAddress(studentDetails);
      expect(result).toBe('HouseNo13, Main Road, Warangal, Telangana, 506001, India');
      expect(result).not.toContain('N/A');
      expect(result).not.toContain('NULL');
    });

    it('handles student who only filled current address', () => {
      const studentDetails = {
        perm_house_no: null,
        perm_apartment: null,
        perm_street: null,
        perm_city: null,
        perm_state: null,
        perm_pincode: null,
        perm_country: 'India',

        curr_house_no: '1-2-3/A',
        curr_apartment: 'Sneha Apts',
        curr_street: 'Subhash Road',
        curr_city: 'Hanamkonda',
        curr_state: 'Telangana',
        curr_pincode: '506002',
        curr_country: 'India',
      };

      const result = getEffectiveStudentAddress(studentDetails);
      expect(result).toBe('1-2-3/A, Sneha Apts, Subhash Road, Hanamkonda, Telangana, 506002, India');
    });

    it('handles duplicate tokens across apartment and street seamlessly', () => {
      const studentDetails = {
        perm_house_no: '# 4-41/1',
        perm_apartment: 'SHIVUNIPALLY',
        perm_street: 'SHIVUNIPALLY',
        perm_city: 'GHANPUR',
        perm_state: 'TELANGANA',
        perm_pincode: '506143',
        perm_country: 'India',
      };

      const result = getEffectiveStudentAddress(studentDetails);
      expect(result).toBe('# 4-41/1, SHIVUNIPALLY, GHANPUR, TELANGANA, 506143, India');
      // Verify SHIVUNIPALLY only appears once
      const matches = result.match(/SHIVUNIPALLY/g);
      expect(matches?.length).toBe(1);
    });

    it('falls back to unstructured address if structured fields are missing', () => {
      const studentDetails = {
        address: 'H.No 12, N/A, Kareemabad, NULL, Warangal, 506002',
      };

      const result = getEffectiveStudentAddress(studentDetails);
      expect(result).toBe('H.No 12, Kareemabad, Warangal, 506002');
    });

    it('returns empty string if all fields are empty or placeholder', () => {
      expect(getEffectiveStudentAddress(null)).toBe('');
      expect(getEffectiveStudentAddress({})).toBe('');
      expect(getEffectiveStudentAddress({ perm_house_no: 'N/A', curr_city: 'NULL' })).toBe('');
    });
  });

  describe('getPermanentAddressFromDetails & getContactAddressFromDetails', () => {
    it('returns sanitized permanent address and cleans placeholder values', () => {
      const details = {
        perm_house_no: '1-2-3',
        perm_apartment: 'N/A',
        perm_street: 'Gandhi Road',
        perm_city: 'Warangal',
        perm_state: 'Telangana',
        perm_pincode: '506001',
        perm_country: 'India',
      };
      expect(getPermanentAddressFromDetails(details)).toBe('1-2-3, Gandhi Road, Warangal, Telangana, 506001, India');
    });

    it('returns sanitized contact address and cleans placeholder values', () => {
      const details = {
        curr_house_no: '4-5-6',
        curr_apartment: 'NULL',
        curr_street: 'Station Road',
        curr_city: 'Kazipet',
        curr_state: 'Telangana',
        curr_pincode: '506003',
        curr_country: 'India',
      };
      expect(getContactAddressFromDetails(details)).toBe('4-5-6, Station Road, Kazipet, Telangana, 506003, India');
    });

    it('parseAddress extracts components and strips placeholder fields', () => {
      const parsed = parseAddress('12-3, N/A, Kareemabad, Warangal, Telangana, 506002, India');
      expect(parsed.house_no).toBe('12-3');
      expect(parsed.city).toBe('Warangal');
      expect(parsed.state).toBe('Telangana');
      expect(parsed.pincode).toBe('506002');
      expect(parsed.country).toBe('India');
    });
  });
});
