/**
 * Centralized Date & DateTime Formatting Utilities for KUCET CMS
 * 
 * INVIOLABLE PRESENTATION STANDARD:
 * All user-facing frontend dates MUST be formatted strictly as:
 * DD-MM-YYYY (e.g., "18-09-2026", "01-01-2026", "09-03-2026")
 * 
 * Timezone safety:
 * - Date-only values preserve the exact calendar date (zero timezone distortion).
 * - Timestamps are formatted with Asia/Kolkata (IST = UTC+5:30) wall-clock time.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats any valid date input into strictly DD-MM-YYYY.
 * 
 * @param {string | Date | number | null | undefined} dateInput 
 * @param {string} fallback Value to return if date is null, undefined, or invalid (default: '')
 * @returns {string} Formatted date as DD-MM-YYYY or fallback
 */
export function formatDate(dateInput, fallback = '') {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return fallback;
  }

  try {
    // 1. Handle String inputs
    if (typeof dateInput === 'string') {
      const str = dateInput.trim();
      if (!str) return fallback;

      // Check if already in DD-MM-YYYY format
      const ddmmyyyyMatch = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, d, m, y] = ddmmyyyyMatch;
        const dn = parseInt(d, 10);
        const mn = parseInt(m, 10);
        if (dn >= 1 && dn <= 31 && mn >= 1 && mn <= 12) {
          return str;
        }
      }

      // Check DD/MM/YYYY format
      const slashDmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (slashDmyMatch) {
        const [, d, m, y] = slashDmyMatch;
        const dn = parseInt(d, 10);
        const mn = parseInt(m, 10);
        if (dn >= 1 && dn <= 31 && mn >= 1 && mn <= 12) {
          return `${d}-${m}-${y}`;
        }
      }

      // Check pure date YYYY-MM-DD or string starting with YYYY-MM-DD (e.g., SQL DATE or T00:00:00)
      // TIMEZONE GUARD: For pure date strings without active hours, extract directly to avoid UTC shift
      const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
      if (ymdMatch) {
        const [, y, m, d, hh, mm, ss] = ymdMatch;
        const hasSpecificTime = hh !== undefined && (parseInt(hh, 10) !== 0 || parseInt(mm || '0', 10) !== 0 || parseInt(ss || '0', 10) !== 0);
        
        // If it has NO non-zero time (date-only or midnight UTC), preserve calendar date directly
        if (!hasSpecificTime) {
          const dn = parseInt(d, 10);
          const mn = parseInt(m, 10);
          if (dn >= 1 && dn <= 31 && mn >= 1 && mn <= 12) {
            return `${d}-${m}-${y}`;
          }
        }
      }

      // Check YYYY/MM/DD format
      const slashYmdMatch = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
      if (slashYmdMatch) {
        const [, y, m, d] = slashYmdMatch;
        return `${d}-${m}-${y}`;
      }

      // Fall back to Date parsing for ISO timestamps with non-zero time
      const parsedDate = new Date(str);
      if (!isNaN(parsedDate.getTime())) {
        return formatFromDateObject(parsedDate);
      }

      return fallback;
    }

    // 2. Handle Date object
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) return fallback;
      return formatFromDateObject(dateInput);
    }

    // 3. Handle Number (timestamp or Excel serial)
    if (typeof dateInput === 'number') {
      if (isNaN(dateInput) || dateInput <= 0) return fallback;
      
      // Excel epoch serial
      if (dateInput < 100000) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const ms = dateInput * 86400000;
        const date = new Date(excelEpoch.getTime() + ms);
        if (!isNaN(date.getTime())) return formatFromDateObject(date);
        return fallback;
      }

      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) return formatFromDateObject(date);
      return fallback;
    }

    return fallback;
  } catch (error) {
    console.error('Error formatting date:', error);
    return fallback;
  }
}

/**
 * Helper to extract 2-digit day, 2-digit month, and 4-digit year in Asia/Kolkata (IST).
 */
function formatFromDateObject(date) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    // en-GB outputs dd/mm/yyyy
    const parts = formatter.format(date).split('/');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
  } catch (_e) {
    // Fallback: local Date getters
  }

  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Institutional standard alias for formatDate.
 */
export const formatInstitutionalDate = formatDate;

/**
 * Formats date and time into DD-MM-YYYY • hh:mm AM/PM (or 24h format).
 * Preserves the DD-MM-YYYY date requirement while maintaining time information.
 * 
 * @param {string | Date | number} dateInput
 * @param {object} [options]
 * @param {string} [options.fallback='']
 * @param {string} [options.separator=' • ']
 * @param {boolean} [options.hour12=true]
 * @param {boolean} [options.includeSeconds=false]
 * @returns {string}
 */
export function formatDateTime(dateInput, options = {}) {
  const {
    fallback = '',
    separator = ' • ',
    hour12 = true,
    includeSeconds = false
  } = options;

  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return fallback;
  }

  let d = null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return fallback;
    if (trimmed.includes(':') || trimmed.includes('T')) {
      d = new Date(trimmed);
    } else {
      d = parseDate(trimmed) || new Date(trimmed);
    }
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  }

  if (!d || isNaN(d.getTime())) return fallback;

  const dateStr = formatFromDateObject(d);

  try {
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: hour12
    });
    const timeStr = timeFormatter.format(d);
    return `${dateStr}${separator}${timeStr}`;
  } catch (_e) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    if (hour12) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${dateStr}${separator}${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
    return `${dateStr}${separator}${String(hours).padStart(2, '0')}:${minutes}`;
  }
}

/**
 * Institutional standard alias for formatDateTime.
 */
export const formatInstitutionalDateTime = (dateInput) => formatDateTime(dateInput);

/**
 * Converts a date input to SQL DATE string (YYYY-MM-DD) for database storage.
 * NOTE: For presentation to users, ALWAYS use formatDate instead.
 */
export function toMySQLDate(value) {
  if (value === undefined || value === null || value === '') return null;
  
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value !== 'string') {
    return null;
  }

  // Check if it's already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.split('T')[0];
  }

  // Support DD-MM-YYYY
  const parts = value.split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }

  // Support DD/MM/YYYY
  const slashParts = value.split('/');
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback to generic Date parsing
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return value;
}

/**
 * Parses user input into a Date object.
 */
export function parseDate(str) {
  if (!str && str !== 0) return null;

  if (str instanceof Date && !isNaN(str.getTime())) {
    return str;
  }

  if (typeof str === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = str * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + ms);
    if (!isNaN(date.getTime())) return date;
  }
  
  const dateString = String(str).trim();
  
  const tryParse = (dateString, separator, order) => {
    const parts = dateString.split(separator);
    if (parts.length !== 3) return null;

    if (parts.some(p => p.includes(' ') || p.includes(':'))) return null;

    let dayStr, monthStr, yearStr;
    if (order === 'DMY') [dayStr, monthStr, yearStr] = parts;
    else if (order === 'MDY') [monthStr, dayStr, yearStr] = parts;
    else if (order === 'YMD') [yearStr, monthStr, dayStr] = parts;
    else return null;

    const d = parseInt(dayStr, 10);
    const monthIndex = MONTHS.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
    const m = monthIndex >= 0 ? monthIndex + 1 : parseInt(monthStr, 10);
    const y = parseInt(yearStr, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
    return null;
  };

  return tryParse(dateString, '-', 'DMY') || 
         tryParse(dateString, '/', 'DMY') || 
         tryParse(dateString, '-', 'MDY') || 
         tryParse(dateString, '/', 'MDY') || 
         tryParse(dateString, '-', 'YMD');
}
