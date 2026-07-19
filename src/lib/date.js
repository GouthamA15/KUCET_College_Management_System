const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(dateString) {
  if (!dateString) return '';
  try {
    let date;
    if (typeof dateString === 'string' && dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day.length === 2 && month.length === 2 && year.length === 4) {
          date = new Date(`${year}-${month}-${day}T00:00:00`);
        }
      }
    }
    if (!date || isNaN(date.getTime())) {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Alias for formatDate to match institutional naming standards.
 */
export const formatInstitutionalDate = formatDate;

export function toMySQLDate(value) {
  if (value === undefined || value === null || value === '') return null;
  
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Robustly extract local date parts to avoid UTC shift
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

  // Fallback to generic Date parsing
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return value; // Let the DB handle invalid format if we can't parse it
}

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

    // STRICTURE: Ensure parts don't contain time (spaces or colons)
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

export function formatInstitutionalDateTime(dateInput) {
  if (!dateInput && dateInput !== 0) return '';

  let d = null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    // If it contains time indicators, skip custom parseDate (which might strip time)
    if (dateInput.includes(':') || dateInput.includes('T')) {
      d = new Date(dateInput);
    } else {
      d = parseDate(dateInput) || new Date(dateInput);
    }
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else {
    try {
      d = new Date(dateInput);
    } catch (_e) {
      return String(dateInput);
    }
  }

  if (!d || isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; 

  return `${day}-${month}-${year} • ${hours}:${minutes} ${ampm}`;
}
