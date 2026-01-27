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
    const parts = str.split('-');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day.length === 2 && month.length === 2 && year.length === 4) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
              return date;
            }
        }
    }
    // Try parsing YYYY-MM-DD as a fallback
    const yParts = str.split('-');
    if (yParts.length === 3) {
        const [year, month, day] = yParts;
        if (year.length === 4 && month.length === 2 && day.length === 2) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
              return date;
            }
        }
    }
    return null;
}
