// Centralized logout helpers (client-side only)
import { invalidateAssetCache } from '@/lib/assets';
import { disconnectRealtimeSocket } from '@/components/RealtimeListener';

async function safePost(url) {
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', credentials: 'include' });
  } catch {
    // Ignore network errors; client-side cleanup + redirect still proceeds.
  }
}

function clearCookie(name) {
  try {
    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; path=/;`;
  } catch {
    // ignore
  }
}

function safeSessionClear() {
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

function safeLocalRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function redirectTo(url = '/') {
  window.location.replace(url);
}

async function purgeBrowserCaches() {
  try {
    disconnectRealtimeSocket();
  } catch {
    // ignore
  }

  try {
    invalidateAssetCache();
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
  } catch {
    // ignore
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' });
    }
  } catch {
    // ignore
  }
}

const SENSITIVE_LOCAL_STORAGE_KEYS = [
  'logged_in_student',
  'admission_form_draft',
  'kucet_gps_consent',
  'profileStatusBarCount',
  'profileStatusBarSeenRequestId',
  'profileStatusBarSeenStatus'
];

async function logoutAndRedirect({
  endpoint,
  localStorageKeys = [],
  clearSessionStorage = true,
  cookies = [],
  redirect = '/',
} = {}) {
  await safePost(endpoint);

  await purgeBrowserCaches();

  // Clean sensitive/role local storage keys
  const keysToClean = new Set([...SENSITIVE_LOCAL_STORAGE_KEYS, ...localStorageKeys]);
  for (const key of keysToClean) {
    safeLocalRemoveItem(key);
  }

  // Always clear entire sessionStorage to prevent cross-account contamination
  if (clearSessionStorage !== false) {
    safeSessionClear();
  }

  const allCookies = [
    'admin_auth', 'admin_logged_in', 'admin_refresh_token', 'admin_session_id',
    'staff_auth', 'staff_logged_in', 'staff_refresh_token', 'staff_role', 'staff_session_id',
    'student_auth', 'student_logged_in', 'student_refresh_token', 'student_session_id',
    'session_id',
    ...cookies
  ];

  for (const cookieName of allCookies) {
    clearCookie(cookieName);
  }

  redirectTo(redirect);
}

/**
 * Role-based logout helper.
 *
 * Preserves existing behavior:
 * - Student: tries optional `onLogout()` first; if it succeeds, returns early.
 * - Student default: POST /api/student/logout, clear storage, redirect.
 * - Staff/faculty: POST /api/staff/logout then redirect.
 * - Admin: POST /api/admin/logout then redirect.
 * - Fallback: POST /api/auth/logout then redirect.
 */
export async function logoutByRole({ role = 'guest', onLogout, redirect = '/' } = {}) {
  if (role === 'student') {
    if (typeof onLogout === 'function') {
      try {
        await onLogout();
        return;
      } catch {
        // fall through
      }
    }

    await logoutAndRedirect({
      endpoint: '/api/student/logout',
      localStorageKeys: ['logged_in_student'],
      clearSessionStorage: true,
      redirect,
    });
    return;
  }

  if (role === 'admin') {
    await logoutAndRedirect({ endpoint: '/api/admin/logout', clearSessionStorage: true, redirect });
    return;
  }

  if (['staff', 'admission', 'scholarship', 'faculty', 'hod'].includes(role)) {
    await logoutAndRedirect({ endpoint: '/api/staff/logout', clearSessionStorage: true, redirect });
    return;
  }

  await logoutAndRedirect({ endpoint: '/api/auth/logout', clearSessionStorage: true, redirect });
}

/**
 * Scholarship dashboard logout helper.
 */
export async function logoutScholarshipDashboard({ redirect = '/' } = {}) {
  await logoutByRole({ role: 'staff', redirect });
}
