// Centralized logout helpers (client-side only)
import { invalidateAssetCache } from '@/lib/assets';

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

function safeSessionRemoveItem(key) {
  try {
    sessionStorage.removeItem(key);
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

async function logoutAndRedirect({
  endpoint,
  localStorageKeys = [],
  clearSessionStorage = false,
  sessionStorageKeys = [],
  cookies = [],
  redirect = '/',
} = {}) {
  await safePost(endpoint);

  await purgeBrowserCaches();

  for (const key of localStorageKeys) safeLocalRemoveItem(key);

  if (clearSessionStorage) {
    safeSessionClear();
  } else {
    for (const key of sessionStorageKeys) safeSessionRemoveItem(key);
  }

  for (const cookieName of cookies) clearCookie(cookieName);

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
    await logoutAndRedirect({ endpoint: '/api/admin/logout', redirect });
    return;
  }

  if (['staff', 'admission', 'scholarship', 'faculty', 'hod'].includes(role)) {
    await logoutAndRedirect({ endpoint: '/api/staff/logout', redirect });
    return;
  }

  await logoutAndRedirect({ endpoint: '/api/auth/logout', redirect });
}

/**
 * Scholarship dashboard uses cookie/session flags instead of the shared logout endpoint.
 * This helper preserves that behavior.
 */
export function logoutScholarshipDashboard({ redirect = '/' } = {}) {
  void logoutAndRedirect({
    cookies: ['staff_auth', 'staff_logged_in'],
    sessionStorageKeys: ['staff_authenticated'],
    redirect,
  });
}
