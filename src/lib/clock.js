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
    // Use toLocaleString to get the exact string representation of time in India
    // Then create a new Date object from it. This Date will have its local hours/minutes
    // matching IST regardless of the system's actual timezone.
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    return new Date(istString);
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
