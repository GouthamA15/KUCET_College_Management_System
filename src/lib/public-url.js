import { validateRollNo, canonicalizeRollNo } from './rollNumber';

/**
 * Returns the configured public application base URL with trailing slash stripped.
 * Prioritizes NEXT_PUBLIC_BASE_URL, with local fallback for development.
 */
export function getPublicBaseUrl() {
  let envUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  if (typeof envUrl !== 'string') {
    envUrl = 'http://localhost:3000';
  }
  let trimmed = envUrl.trim().replace(/\/+$/, '');
  if (trimmed.includes('localhost') && trimmed.startsWith('https://')) {
    trimmed = trimmed.replace('https://', 'http://');
  }
  return trimmed;
}

/**
 * Constructs the canonical public student identification URL for a student's roll number.
 * Example: https://kucet.ac.in/public/student/23567T0942
 */
export function getPublicStudentUrl(rollNo, explicitBaseUrl = null) {
  if (!rollNo || typeof rollNo !== 'string') return '';
  const cleanRoll = canonicalizeRollNo(rollNo.trim());
  const base = explicitBaseUrl ? explicitBaseUrl.trim().replace(/\/+$/, '') : getPublicBaseUrl();
  return `${base}/public/student/${encodeURIComponent(cleanRoll)}`;
}

/**
 * Validates whether an incoming URL belongs to an approved institutional origin.
 */
export function isTrustedPublicOrigin(urlObj, explicitBaseUrl = null) {
  if (!urlObj || typeof urlObj.hostname !== 'string') return false;

  const hostname = urlObj.hostname.toLowerCase();

  // 1. Check against configured base URL origin
  try {
    const configuredBase = explicitBaseUrl ? new URL(explicitBaseUrl) : new URL(getPublicBaseUrl());
    if (urlObj.origin.toLowerCase() === configuredBase.origin.toLowerCase()) {
      return true;
    }
    if (hostname === configuredBase.hostname.toLowerCase()) {
      return true;
    }
  } catch {
    // Malformed configured base URL
  }

  // 2. Approved Institutional Domains
  const trustedDomains = [
    'kucet.ac.in',
    'kucet.in',
    'login.kucet.in',
    'kucet-new.onrender.com',
  ];

  if (trustedDomains.includes(hostname)) {
    return true;
  }

  for (const domain of trustedDomains) {
    if (hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }

  // 3. Localhost & development fallbacks
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return true;
  }

  // 4. Tailscale development network (*.ts.net)
  if (hostname.endsWith('.ts.net')) {
    return true;
  }

  return false;
}

/**
 * Parses and verifies an incoming QR string as an approved KUCET public student identification URL.
 * Strictly enforces:
 * - Valid URL structure
 * - Approved institutional origin / domain
 * - Exact pathname pattern: /public/student/<rollNo>
 * - Valid KUCET roll number format
 * 
 * Returns the canonical roll number if valid, or null if untrusted/invalid.
 */
export function parseRollFromPublicStudentUrl(urlString, explicitBaseUrl = null) {
  if (!urlString || typeof urlString !== 'string') return null;

  const trimmed = urlString.trim();
  // Quick pre-check: must start with http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null; // Malformed URL
  }

  // 1. Origin verification: reject unknown domains
  if (!isTrustedPublicOrigin(parsedUrl, explicitBaseUrl)) {
    return null;
  }

  // 2. Reject query parameters or hash fragments - approved QR payloads must strictly be canonical path
  if (parsedUrl.search || parsedUrl.hash) {
    return null;
  }

  // 3. Path verification: must be /public/student/<rollNo>
  // Normalized pathname without trailing slash
  const normPath = parsedUrl.pathname.replace(/\/+$/, '');
  const match = normPath.match(/^\/public\/student\/([^/?#]+)$/i);
  if (!match) {
    return null;
  }

  // 4. Extract and validate roll number
  const candidate = decodeURIComponent(match[1]).trim();
  const validation = validateRollNo(candidate);
  if (!validation.isValid) {
    return null;
  }

  return candidate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
