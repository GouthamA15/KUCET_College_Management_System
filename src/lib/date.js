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
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

export function toMySQLDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  // Check if it's already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return dateString.split('T')[0];
  }
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    return dateString; // Let the DB handle invalid format
  }
  const [day, month, year] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return dateString;
  }
  return `${year}-${month}-${day}`;
}

export function parseDate(str) {
  if (!str) return null;
  
  // Helper to parse date parts with a given separator and order
  const tryParse = (dateString, separator, order) => {
    const parts = dateString.split(separator);
    if (parts.length !== 3) return null;

    let day, month, year;
    if (order === 'DMY') { // DD-MM-YYYY or DD/MM/YYYY
      [day, month, year] = parts;
    } else if (order === 'MDY') { // MM-DD-YYYY or MM/DD/YYYY
      [month, day, year] = parts;
    } else if (order === 'YMD') { // YYYY-MM-DD
      [year, month, day] = parts;
    } else {
      return null;
    }

    // Convert to numbers and validate
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31) {
      return null;
    }

    const date = new Date(y, m - 1, d);
    // Check for valid date (e.g., avoid 31st of Feb)
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
      return date;
    }
    return null;
  };

  // Try DD-MM-YYYY or DD/MM/YYYY
  let date = tryParse(str, '-', 'DMY') || tryParse(str, '/', 'DMY');
  if (date) return date;

  // Try MM-DD-YYYY or MM/DD/YYYY
  date = tryParse(str, '-', 'MDY') || tryParse(str, '/', 'MDY');
  if (date) return date;

  // Try YYYY-MM-DD (fallback, but could also be parsed by YYYY-MM-DD logic)
  date = tryParse(str, '-', 'YMD');
  if (date) return date;

  return null;
}
