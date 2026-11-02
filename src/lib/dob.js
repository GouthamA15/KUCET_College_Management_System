import crypto from 'crypto';
import { formatDate } from '@/lib/date';

const COMPARE_PAD_LEN = 255;

/**
 * Constant-time string equality check to prevent timing attacks.
 */
export function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.alloc(COMPARE_PAD_LEN);
  const bBuf = Buffer.alloc(COMPARE_PAD_LEN);
  Buffer.from(String(a || '')).copy(aBuf, 0, 0, Math.min(String(a || '').length, COMPARE_PAD_LEN));
  Buffer.from(String(b || '')).copy(bBuf, 0, 0, Math.min(String(b || '').length, COMPARE_PAD_LEN));
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Leap year check.
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Days in month lookup with leap year calculation for February.
 */
export function getDaysInMonth(month, year) {
  const days = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month] || 0;
}

/**
 * Strict calendar date validation.
 */
export function isValidCalendarDate(day, month, year) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return false;
  }
  if (year < 1900 || year > 2100) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    return false;
  }
  return true;
}

/**
 * Normalizes student Date-of-Birth input to canonical DD-MM-YYYY format.
 * 
 * Explicitly accepted input formats:
 *   1. DD-MM-YYYY (e.g. "22-02-2005")
 *   2. DD/MM/YYYY (e.g. "22/02/2005")
 *   3. DDMMYYYY   (e.g. "22022005" - exactly 8 digits)
 *   4. YYYY-MM-DD (wire format produced when existing LoginPanel.js split('-') runs on DD-MM-YYYY)
 * 
 * Strict rejection rules:
 *   - 2-digit years (e.g. 22-02-05, 22/02/05)
 *   - 7-digit compact (e.g. 2202205)
 *   - Impossible dates (e.g. 32-02-2005, 29-02-2005 in non-leap year, 00-00-0000)
 *   - Empty or non-string input
 */
export function normalizeStudentDob(rawInput) {
  if (rawInput === null || rawInput === undefined) {
    return { isValid: false, error: 'Date of birth is required' };
  }

  const str = String(rawInput).trim();
  if (!str) {
    return { isValid: false, error: 'Date of birth is required' };
  }

  let day, month, year;

  // Format 1: DD-MM-YYYY
  const hyphenDmy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (hyphenDmy) {
    day = parseInt(hyphenDmy[1], 10);
    month = parseInt(hyphenDmy[2], 10);
    year = parseInt(hyphenDmy[3], 10);
  } else {
    // Format 2: DD/MM/YYYY
    const slashDmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashDmy) {
      day = parseInt(slashDmy[1], 10);
      month = parseInt(slashDmy[2], 10);
      year = parseInt(slashDmy[3], 10);
    } else {
      // Format 3: DDMMYYYY (compact 8-digit)
      const compactDmy = str.match(/^(\d{2})(\d{2})(\d{4})$/);
      if (compactDmy) {
        day = parseInt(compactDmy[1], 10);
        month = parseInt(compactDmy[2], 10);
        year = parseInt(compactDmy[3], 10);
      } else {
        // Format 4: YYYY-MM-DD (wire format from frontend DD-MM-YYYY conversion)
        const wireYmd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (wireYmd) {
          year = parseInt(wireYmd[1], 10);
          month = parseInt(wireYmd[2], 10);
          day = parseInt(wireYmd[3], 10);
        } else {
          return { isValid: false, error: 'Invalid date format' };
        }
      }
    }
  }

  if (!isValidCalendarDate(day, month, year)) {
    return { isValid: false, error: 'Invalid calendar date' };
  }

  const canonical = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).padStart(4, '0')}`;
  const isoDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    isValid: true,
    canonical,
    isoDate,
    day,
    month,
    year
  };
}

/**
 * Normalizes authoritative database date of birth into canonical DD-MM-YYYY format
 * with zero timezone distortion.
 */
export function normalizeAuthoritativeDob(dbDob) {
  if (dbDob === null || dbDob === undefined || dbDob === '') {
    return null;
  }

  if (typeof dbDob === 'string') {
    const trimmed = dbDob.trim();
    // Standard SQL date 'YYYY-MM-DD' or ISO timestamp prefix
    const sqlMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (sqlMatch) {
      const year = parseInt(sqlMatch[1], 10);
      const month = parseInt(sqlMatch[2], 10);
      const day = parseInt(sqlMatch[3], 10);
      if (isValidCalendarDate(day, month, year)) {
        return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).padStart(4, '0')}`;
      }
    }

    // Direct DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);
      if (isValidCalendarDate(day, month, year)) {
        return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).padStart(4, '0')}`;
      }
    }
  }

  if (dbDob instanceof Date && !isNaN(dbDob.getTime())) {
    const formatted = formatDate(dbDob);
    const normalized = normalizeStudentDob(formatted);
    if (normalized.isValid) {
      return normalized.canonical;
    }
  }

  return null;
}

/**
 * Checks whether an entered string matches any recognized date pattern.
 * Used for contextual user feedback when a permanent password login fails.
 */
export function isDobFormat(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return normalizeStudentDob(trimmed).isValid ||
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed) ||
    /^\d{8}$/.test(trimmed);
}

/**
 * Authoritatively validates user-supplied DOB against the authoritative database DOB.
 * 
 * Returns:
 *   { formatValid: boolean, matches: boolean, canonical?: string, error?: string }
 */
export function validateStudentDob(inputDob, dbDob) {
  const inputNormalized = normalizeStudentDob(inputDob);
  if (!inputNormalized.isValid) {
    return {
      formatValid: false,
      matches: false,
      error: inputNormalized.error
    };
  }

  const dbNormalized = normalizeAuthoritativeDob(dbDob);
  if (!dbNormalized) {
    return {
      formatValid: true,
      matches: false,
      error: 'Authoritative student date of birth is unavailable'
    };
  }

  const matches = timingSafeStringEqual(inputNormalized.canonical, dbNormalized);
  return {
    formatValid: true,
    matches,
    canonical: inputNormalized.canonical
  };
}
