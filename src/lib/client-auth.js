/**
 * Centralized Client-Side Authentication Utilities & In-Flight Request Deduplicator
 * 
 * Ensures concurrent client components (HomeLoginLanding, RealtimeListener, etc.)
 * sharing an expired session coalesce onto a single active refresh promise rather
 * than triggering multiple racing POST /api/auth/refresh requests.
 */

let inflightRefreshPromise = null;

export function getClientSessionType() {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie || '';
  if (cookies.includes('admin_logged_in=')) return 'admin';
  if (cookies.includes('staff_logged_in=')) return 'staff';
  if (cookies.includes('student_logged_in=')) return 'student';
  return null;
}

/**
 * Deduplicated client session refresher.
 * 
 * @param {string} sessionType - 'admin' | 'staff' | 'student'
 * @returns {Promise<Response>}
 */
export async function refreshClientSession(sessionType) {
  if (!sessionType) return null;

  if (inflightRefreshPromise) {
    return inflightRefreshPromise;
  }

  const promise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: sessionType }),
        credentials: 'include',
      });
      return res;
    } finally {
      inflightRefreshPromise = null;
    }
  })();

  inflightRefreshPromise = promise;
  return promise;
}
