/**
 * Authoritative source for "Current Time" in the application.
 * In development, it checks for a 'dev_mock_date' cookie to allow time travel.
 * PRODUCTION HARDENING: Always returns IST (UTC+5:30) regardless of server location.
 */
export async function getNow() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';
  
  // Use a helper to get the system time in IST
  const getISTNow = () => {
    const date = new Date();
    // India is UTC + 5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    return new Date(utc + istOffset);
  };

  if (isProduction || !isTesting) {
    return getISTNow();
  }

  let mockDateValue = null;

  if (typeof window === 'undefined') {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      mockDateValue = cookieStore.get('dev_mock_date')?.value;
    } catch (e) {}
  } else {
    const match = document.cookie.match(/dev_mock_date=([^;]+)/);
    if (match) mockDateValue = decodeURIComponent(match[1]);
  }

  if (mockDateValue) {
    const d = new Date(mockDateValue);
    if (!isNaN(d.getTime())) return d;
  }

  return getISTNow();
}

/**
 * Synchronous version for client-side usage.
 */
export function getNowSync() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';
  
  const getISTNow = () => {
    const date = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    return new Date(utc + istOffset);
  };

  if (isProduction || !isTesting) {
    return getISTNow();
  }

  if (typeof window !== 'undefined') {
    const match = document.cookie.match(/dev_mock_date=([^;]+)/);
    if (match) {
      const d = new Date(decodeURIComponent(match[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  return getISTNow();
}
