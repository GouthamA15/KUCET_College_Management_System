import { describe, it, expect } from 'vitest';
import {
  normalizeStudentDob,
  normalizeAuthoritativeDob,
  validateStudentDob,
  isValidCalendarDate,
  isLeapYear,
  getDaysInMonth,
  isDobFormat,
  timingSafeStringEqual
} from '@/lib/dob';

describe('DOB Normalization & Calendar Validation Suite (PART 2)', () => {
  describe('Calendar Date & Leap Year Validation', () => {
    it('identifies standard leap years correctly', () => {
      expect(isLeapYear(2004)).toBe(true);
      expect(isLeapYear(2008)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2005)).toBe(false);
      expect(isLeapYear(2019)).toBe(false);
      expect(isLeapYear(2023)).toBe(false);
    });

    it('identifies century leap year rules correctly (divisible by 100 vs 400)', () => {
      expect(isLeapYear(2000)).toBe(true); // divisible by 400
      expect(isLeapYear(1900)).toBe(false); // divisible by 100 but not 400
      expect(isLeapYear(2100)).toBe(false); // divisible by 100 but not 400
    });

    it('calculates correct days in month including leap February', () => {
      expect(getDaysInMonth(1, 2005)).toBe(31);
      expect(getDaysInMonth(2, 2005)).toBe(28); // non-leap
      expect(getDaysInMonth(2, 2004)).toBe(29); // leap
      expect(getDaysInMonth(2, 2000)).toBe(29); // century leap
      expect(getDaysInMonth(2, 1900)).toBe(28); // century non-leap
      expect(getDaysInMonth(4, 2005)).toBe(30);
      expect(getDaysInMonth(12, 2005)).toBe(31);
    });

    it('validates calendar dates strictly', () => {
      expect(isValidCalendarDate(22, 2, 2005)).toBe(true);
      expect(isValidCalendarDate(29, 2, 2004)).toBe(true);
      expect(isValidCalendarDate(29, 2, 2005)).toBe(false); // impossible in 2005
      expect(isValidCalendarDate(32, 2, 2005)).toBe(false); // impossible day
      expect(isValidCalendarDate(31, 4, 2005)).toBe(false); // April has 30 days
      expect(isValidCalendarDate(30, 4, 2005)).toBe(true);
      expect(isValidCalendarDate(0, 0, 0)).toBe(false);
      expect(isValidCalendarDate(15, 13, 2005)).toBe(false); // month 13
      expect(isValidCalendarDate(1, 1, 1850)).toBe(false); // out of range
      expect(isValidCalendarDate(1, 1, 2150)).toBe(false); // out of range
    });
  });

  describe('normalizeStudentDob — Three Explicit Formats & Wire Format', () => {
    it('accepts Format 1: DD-MM-YYYY (hyphenated canonical format)', () => {
      const res = normalizeStudentDob('22-02-2005');
      expect(res.isValid).toBe(true);
      expect(res.canonical).toBe('22-02-2005');
      expect(res.isoDate).toBe('2005-02-22');
      expect(res.day).toBe(22);
      expect(res.month).toBe(2);
      expect(res.year).toBe(2005);
    });

    it('accepts Format 2: DD/MM/YYYY (slash-separated format)', () => {
      const res = normalizeStudentDob('22/02/2005');
      expect(res.isValid).toBe(true);
      expect(res.canonical).toBe('22-02-2005');
      expect(res.isoDate).toBe('2005-02-22');
      expect(res.day).toBe(22);
      expect(res.month).toBe(2);
      expect(res.year).toBe(2005);
    });

    it('accepts Format 3: DDMMYYYY (8-digit compact format)', () => {
      const res = normalizeStudentDob('22022005');
      expect(res.isValid).toBe(true);
      expect(res.canonical).toBe('22-02-2005');
      expect(res.isoDate).toBe('2005-02-22');
      expect(res.day).toBe(22);
      expect(res.month).toBe(2);
      expect(res.year).toBe(2005);
    });

    it('accepts Frontend Wire Format: YYYY-MM-DD (resulting from existing LoginPanel DD-MM-YYYY transform)', () => {
      const res = normalizeStudentDob('2005-02-22');
      expect(res.isValid).toBe(true);
      expect(res.canonical).toBe('22-02-2005');
      expect(res.isoDate).toBe('2005-02-22');
      expect(res.day).toBe(22);
      expect(res.month).toBe(2);
      expect(res.year).toBe(2005);
    });

    it('normalizes single-digit day/month with leading zeros canonically', () => {
      expect(normalizeStudentDob('05-09-2007').canonical).toBe('05-09-2007');
      expect(normalizeStudentDob('05/09/2007').canonical).toBe('05-09-2007');
      expect(normalizeStudentDob('05092007').canonical).toBe('05-09-2007');
    });

    it('handles leap year 29 February correctly across all three formats', () => {
      expect(normalizeStudentDob('29-02-2004').canonical).toBe('29-02-2004');
      expect(normalizeStudentDob('29/02/2004').canonical).toBe('29-02-2004');
      expect(normalizeStudentDob('29022004').canonical).toBe('29-02-2004');
    });
  });

  describe('normalizeStudentDob — Strict Rejections (Part 2.2 Table)', () => {
    it('rejects 2-digit year with hyphens: 22-02-05', () => {
      const res = normalizeStudentDob('22-02-05');
      expect(res.isValid).toBe(false);
    });

    it('rejects 2-digit year with slashes: 22/02/05', () => {
      const res = normalizeStudentDob('22/02/05');
      expect(res.isValid).toBe(false);
    });

    it('rejects 7-digit compact format: 2202205 (must not accept 7 digits)', () => {
      const res = normalizeStudentDob('2202205');
      expect(res.isValid).toBe(false);
    });

    it('rejects impossible day: 32-02-2005', () => {
      const res = normalizeStudentDob('32-02-2005');
      expect(res.isValid).toBe(false);
    });

    it('rejects non-leap year February 29: 29-02-2005', () => {
      const res = normalizeStudentDob('29-02-2005');
      expect(res.isValid).toBe(false);
    });

    it('rejects century non-leap year February 29: 29-02-1900', () => {
      const res = normalizeStudentDob('29-02-1900');
      expect(res.isValid).toBe(false);
    });

    it('rejects 00-00-0000', () => {
      const res = normalizeStudentDob('00-00-0000');
      expect(res.isValid).toBe(false);
    });

    it('rejects empty input and whitespace', () => {
      expect(normalizeStudentDob('').isValid).toBe(false);
      expect(normalizeStudentDob('   ').isValid).toBe(false);
      expect(normalizeStudentDob(null).isValid).toBe(false);
      expect(normalizeStudentDob(undefined).isValid).toBe(false);
    });

    it('rejects unsupported separators (e.g. dots, underscores)', () => {
      expect(normalizeStudentDob('22.02.2005').isValid).toBe(false);
      expect(normalizeStudentDob('22_02_2005').isValid).toBe(false);
      expect(normalizeStudentDob('22 02 2005').isValid).toBe(false);
    });

    it('rejects extra or missing digits', () => {
      expect(normalizeStudentDob('220-02-2005').isValid).toBe(false);
      expect(normalizeStudentDob('22-02-20055').isValid).toBe(false);
      expect(normalizeStudentDob('220022005').isValid).toBe(false); // 9 digits
      expect(normalizeStudentDob('2022005').isValid).toBe(false); // 7 digits
    });
  });

  describe('normalizeAuthoritativeDob — Database Normalization & Timezone Safety', () => {
    it('normalizes SQL DATE string "2005-02-22" directly to "22-02-2005" without timezone shifts', () => {
      expect(normalizeAuthoritativeDob('2005-02-22')).toBe('22-02-2005');
    });

    it('normalizes ISO string with midnight UTC without shifting date', () => {
      expect(normalizeAuthoritativeDob('2005-02-22T00:00:00.000Z')).toBe('22-02-2005');
    });

    it('normalizes Date object using institutional Asia/Kolkata timezone standard', () => {
      const d = new Date(Date.UTC(2005, 1, 22)); // Feb 22, 2005
      const norm = normalizeAuthoritativeDob(d);
      expect(norm).toBe('22-02-2005');
    });

    it('returns null on missing or invalid database DOB', () => {
      expect(normalizeAuthoritativeDob(null)).toBeNull();
      expect(normalizeAuthoritativeDob(undefined)).toBeNull();
      expect(normalizeAuthoritativeDob('')).toBeNull();
    });
  });

  describe('validateStudentDob — End-to-End Validation', () => {
    const authoritativeDbDate = '2005-02-22'; // 22 Feb 2005

    it('matches authoritative DOB for all 3 supported input formats', () => {
      const r1 = validateStudentDob('22-02-2005', authoritativeDbDate);
      expect(r1.formatValid).toBe(true);
      expect(r1.matches).toBe(true);
      expect(r1.canonical).toBe('22-02-2005');

      const r2 = validateStudentDob('22/02/2005', authoritativeDbDate);
      expect(r2.formatValid).toBe(true);
      expect(r2.matches).toBe(true);
      expect(r2.canonical).toBe('22-02-2005');

      const r3 = validateStudentDob('22022005', authoritativeDbDate);
      expect(r3.formatValid).toBe(true);
      expect(r3.matches).toBe(true);
      expect(r3.canonical).toBe('22-02-2005');
    });

    it('matches authoritative DOB for frontend wire format 2005-02-22', () => {
      const r = validateStudentDob('2005-02-22', authoritativeDbDate);
      expect(r.formatValid).toBe(true);
      expect(r.matches).toBe(true);
      expect(r.canonical).toBe('22-02-2005');
    });

    it('reports formatValid: false for invalid formats', () => {
      expect(validateStudentDob('22-02-05', authoritativeDbDate).formatValid).toBe(false);
      expect(validateStudentDob('22/02/05', authoritativeDbDate).formatValid).toBe(false);
      expect(validateStudentDob('2202205', authoritativeDbDate).formatValid).toBe(false);
      expect(validateStudentDob('32-02-2005', authoritativeDbDate).formatValid).toBe(false);
      expect(validateStudentDob('29-02-2005', authoritativeDbDate).formatValid).toBe(false);
    });

    it('reports formatValid: true and matches: false when format is valid but date differs from DB', () => {
      const res = validateStudentDob('23-02-2005', authoritativeDbDate);
      expect(res.formatValid).toBe(true);
      expect(res.matches).toBe(false);
      expect(res.canonical).toBe('23-02-2005');
    });
  });

  describe('Constant-time Comparison (timingSafeStringEqual)', () => {
    it('returns true for matching strings', () => {
      expect(timingSafeStringEqual('22-02-2005', '22-02-2005')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(timingSafeStringEqual('22-02-2005', '23-02-2005')).toBe(false);
      expect(timingSafeStringEqual('22-02-2005', '22-02-2004')).toBe(false);
    });

    it('handles different lengths without throwing', () => {
      expect(timingSafeStringEqual('short', 'much_longer_string_value')).toBe(false);
      expect(timingSafeStringEqual('', 'non_empty')).toBe(false);
      expect(timingSafeStringEqual('', '')).toBe(true);
    });
  });

  describe('isDobFormat helper', () => {
    it('recognizes date formats for user hints', () => {
      expect(isDobFormat('22-02-2005')).toBe(true);
      expect(isDobFormat('22/02/2005')).toBe(true);
      expect(isDobFormat('22022005')).toBe(true);
      expect(isDobFormat('2005-02-22')).toBe(true);
    });

    it('returns false for general passwords', () => {
      expect(isDobFormat('MySecurePassword!123')).toBe(false);
      expect(isDobFormat('admin123')).toBe(false);
      expect(isDobFormat('')).toBe(false);
    });
  });
});
