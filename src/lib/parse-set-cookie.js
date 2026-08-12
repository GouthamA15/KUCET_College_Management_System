/**
 * Parses a single raw Set-Cookie header string into a structured object
 * that can be passed to NextResponse.cookies.set().
 *
 * This is Edge-runtime safe (no Node.js APIs used).
 * Used by proxy.js to re-apply cookies from the /api/auth/refresh response
 * using the correct NextResponse.cookies.set() API so that Next.js 16
 * properly serializes them via x-middleware-set-cookie.
 */
export function parseSetCookieString(str) {
  if (!str) return null;

  const parts = str.split(';').map(p => p.trim());
  const [nameValue, ...attrs] = parts;
  const eqIdx = nameValue.indexOf('=');
  if (eqIdx === -1) return null;

  const name = decodeURIComponent(nameValue.slice(0, eqIdx).trim());
  // The value may itself be URL-encoded; decode carefully
  let value;
  try {
    value = decodeURIComponent(nameValue.slice(eqIdx + 1).trim());
  } catch {
    value = nameValue.slice(eqIdx + 1).trim();
  }

  const options = { path: '/' };

  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower === 'httponly') {
      options.httpOnly = true;
    } else if (lower === 'secure') {
      options.secure = true;
    } else if (lower.startsWith('samesite=')) {
      options.sameSite = attr.split('=')[1].trim().toLowerCase();
    } else if (lower.startsWith('path=')) {
      options.path = attr.split('=')[1].trim();
    } else if (lower.startsWith('domain=')) {
      options.domain = attr.split('=')[1].trim();
    } else if (lower.startsWith('max-age=')) {
      const maxAge = parseInt(attr.split('=')[1].trim(), 10);
      if (!isNaN(maxAge)) options.maxAge = maxAge;
    } else if (lower.startsWith('expires=')) {
      const expires = new Date(attr.split('=').slice(1).join('=').trim());
      if (!isNaN(expires.getTime())) options.expires = expires;
    }
  }

  return { name, value, options };
}
