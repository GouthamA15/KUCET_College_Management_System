import { resolveInstitutionalFilename } from '@/lib/institution-assets';

/**
 * ============================================================
 * CANONICAL ASSET URL BUILDER
 * ============================================================
 * Single function responsible for converting a DB storage key
 * into a browser-ready URL. Zero legacy path hacks.
 *
 * Database storage keys must follow the canonical format:
 *   kucet/<category>/<subfolder>/<random-uuid>.<ext>
 *
 * Examples:
 *   kucet/students/pfp/b3f96f9f4d51487fb2d69fce.webp
 *   kucet/requests/pfp/71a9e1c8ab7d4b6d8d4e7e4a.webp
 *   kucet/clerks/pfp/5cb17d61a06c47d1b932af38.jpg
 *
 * NEVER store full URLs in the database.
 * NEVER store legacy paths (requests/, students/ without kucet/).
 * ============================================================
 */

/**
 * Static assets served from the Next.js /public folder.
 * These are never routed through storage providers.
 */
export const STATIC_ASSETS = new Set([
  '/assets/ku-logo.png',
  '/assets/ku-college-logo.png',
  '/assets/Naac_A+.png',
  '/assets/kakatiya-kala-thoranam.png',
  '/assets/rudramadevi_statue.jpg',
  '/assets/college-campus.jpg',
  '/assets/default-avatar.svg',
  '/assets/Picture1.png',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
  '/assets/DevPics/Dev1.mp4',
  '/assets/DevPics/Dev1.png',
  '/assets/DevPics/Dev2.jpg',
  '/assets/DevPics/Dev2.mp3',
  '/assets/DevPics/Dev3.jpg',
  '/assets/DevPics/Dev3.mp3',
  '/assets/DevPics/Group.jpg',
  '/assets/Payment QR/ku_payment_100.png',
  '/assets/Payment QR/ku_payment_150.png',
  '/assets/Payment QR/ku_payment_200.png',
  '/assets/Payment QR/kucet-logo.png',
  '/manifest.json',
  '/favicon.ico',
]);

/**
 * Resolves a DB storage key or static asset path into a browser-safe URL.
 *
 * @param {string} path - A canonical storage key (e.g. 'kucet/students/pfp/abc.webp')
 *                        or a static asset path (e.g. '/assets/default-avatar.svg').
 * @param {string} [transformations='f_auto,q_auto'] - Cloudinary delivery transformations.
 * @returns {string} The browser-ready URL, or '' if path is empty/invalid.
 */
export function getAssetUrl(path, transformations = 'f_auto,q_auto') {
  // Guard: reject null, undefined, non-strings
  if (!path || typeof path !== 'string') return '';

  // Guard: reject serialization corruption
  if (path.includes('[object') || path.includes('undefined')) return '';

  // Pass-through: data URIs, absolute URLs, Next.js API routes
  if (
    path.startsWith('data:') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('/api/')
  ) {
    return path;
  }

  // Normalize: strip leading slash for consistent matching
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const normalizedPath = `/${cleanPath}`;

  // Serve static public-folder assets directly
  if (STATIC_ASSETS.has(normalizedPath)) {
    return normalizedPath;
  }

  // Resolve institutional assets (e.g. 'principal/signature' logical key)
  const instFilename = resolveInstitutionalFilename(cleanPath);
  if (instFilename) {
    const storageType = (
      process.env.NEXT_PUBLIC_STORAGE_TYPE ||
      process.env.STORAGE_TYPE ||
      'local'
    ).toLowerCase();
    if (storageType === 'local') {
      return `/assets/${instFilename}`;
    }
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      'djs0ry74r';
    return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${instFilename}`;
  }

  // Secure Private Storage: All non-static asset keys are served through /api/assets/view/
  // where session, role, and ownership authorization are enforced.
  return `/api/assets/view/${cleanPath}`;
}

export default getAssetUrl;
