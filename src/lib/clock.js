/**
 * Authoritative source for "Current Time" in the application.
 * In development, it checks for a 'dev_mock_date' cookie to allow time travel.
 */
export async function getNow() {
  // Safe mode: Disable mock logic unless explicitly in testing environment
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';
  
  if (!isTesting) {
    return new Date();
  }

  let mockDateValue = null;

  if (typeof window === 'undefined') {
    // Server-side: use dynamic import to avoid breaking client-side builds
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      mockDateValue = cookieStore.get('dev_mock_date')?.value;
    } catch (e) {
      // cookies() might not be available in all server contexts (e.g. some edge cases)
    }
  } else {
    // Client-side
    const match = document.cookie.match(/dev_mock_date=([^;]+)/);
    if (match) mockDateValue = decodeURIComponent(match[1]);
  }

  if (mockDateValue) {
    const d = new Date(mockDateValue);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

/**
 * Synchronous version for client-side usage.
 * DO NOT use this on the server if you expect mock time to work via cookies.
 */
export function getNowSync() {
  const isTesting = process.env.NEXT_PUBLIC_WORKING_ENV === 'testing';
  if (!isTesting) {
    return new Date();
  }

  if (typeof window !== 'undefined') {
    const match = document.cookie.match(/dev_mock_date=([^;]+)/);
    if (match) {
      const d = new Date(decodeURIComponent(match[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}
