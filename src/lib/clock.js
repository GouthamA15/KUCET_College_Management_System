/**
 * Authoritative source for "Current Time" in the application.
 * In development, it checks for a 'dev_mock_date' cookie to allow time travel.
 * PRODUCTION HARDENING: Always returns IST (UTC+5:30) as a Date object whose 
 * wall-clock time matches India, regardless of server/system timezone.
 */
export function getNow() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';
  
  // Robustly get IST (Asia/Kolkata) as a wall-clock Date object
  const getISTNow = () => {
    const now = new Date();
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const partValues = {};
      parts.forEach(p => {
        if (p.type !== 'literal') partValues[p.type] = parseInt(p.value, 10);
      });
      return new Date(
        partValues.year,
        partValues.month - 1,
        partValues.day,
        partValues.hour,
        partValues.minute,
        partValues.second
      );
    } catch (_e) {
      // Safe fallback: math-based UTC to IST shift (UTC+5:30)
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      return new Date(utc + (3600000 * 5.5));
    }
  };

  if (isProduction || !isTesting) {
    return getISTNow();
  }

  // CLIENT-SIDE MOCK DATE
  if (typeof window !== 'undefined') {
    const match = document.cookie.match(/dev_mock_date=([^;]+)/);
    if (match) {
      const d = new Date(decodeURIComponent(match[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // SERVER-SIDE MOCK DATE (Sync fallback)
  return getISTNow();
}

/**
 * Synchronous version for client-side usage. (Identical to getNow after fix)
 */
export function getNowSync() {
  return getNow();
}
