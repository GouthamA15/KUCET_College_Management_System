import { resolveInstitutionalFilename } from '@/lib/institution-assets';

/**
 * ============================================================
 * CANONICAL ASSET URL BUILDER & CLIENT-SIDE IMAGE CACHE
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
 * In-Memory Client-Side Image Cache Map
 * Stores resolved (cacheKey -> browserUrl) mappings to eliminate
 * redundant URL processing and prevent duplicate network fetches.
 */
const CLIENT_ASSET_CACHE = new Map();

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
 * Invalidates a specific asset or purges the entire client asset cache.
 *
 * @param {string} [pathOrKey] - The relative path or cache key to invalidate.
 *                               If omitted, clears the entire client asset cache.
 */
export function invalidateAssetCache(pathOrKey) {
  if (!pathOrKey) {
    CLIENT_ASSET_CACHE.clear();
    return;
  }

  const clean = typeof pathOrKey === 'string' ? pathOrKey.trim() : '';
  if (!clean) return;

  // Direct key deletion
  CLIENT_ASSET_CACHE.delete(clean);
  CLIENT_ASSET_CACHE.delete(`/${clean}`);

  // Prefix matching deletion for asset path patterns
  for (const key of CLIENT_ASSET_CACHE.keys()) {
    if (key.includes(clean)) {
      CLIENT_ASSET_CACHE.delete(key);
    }
  }
}

/**
 * Retrieves the current memory snapshot of cached asset URLs.
 * Useful for debugging and testing.
 *
 * @returns {Record<string, string>} Object containing cached key -> URL pairs.
 */
export function getAssetCacheSnapshot() {
  return Object.fromEntries(CLIENT_ASSET_CACHE.entries());
}

/**
 * Resolves a DB storage key or static asset path into a browser-safe URL,
 * using an in-memory client cache to prevent redundant URL recalculations.
 *
 * @param {string} path - A canonical storage key (e.g. 'kucet/students/pfp/abc.webp')
 *                        or a static asset path (e.g. '/assets/default-avatar.svg').
 * @param {string} [transformations='f_auto,q_auto'] - Cloudinary delivery transformations.
 * @param {object} [options={}] - Additional options (e.g. { bypassCache: boolean, cacheKey: string }).
 * @returns {string} The browser-ready URL, or '' if path is empty/invalid.
 */
export function getAssetUrl(path, transformations = 'f_auto,q_auto', options = {}) {
  // Guard: reject null, undefined, non-strings
  if (!path || typeof path !== 'string') return '';

  // Guard: reject serialization corruption
  if (path.includes('[object') || path.includes('undefined')) return '';

  // 1. Normalize and clean the path
  let cleanPath = path;
  if (cleanPath.startsWith('data:')) {
    return cleanPath;
  }

  // Handle full external URLs or Cloudinary CDN URLs
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    try {
      const url = new URL(cleanPath);
      // If it's a Cloudinary URL, try to extract the relative storage key
      const kucetIndex = url.pathname.indexOf('kucet/');
      if (kucetIndex !== -1) {
        cleanPath = url.pathname.substring(kucetIndex);
      } else {
        // If it's already an external non-Cloudinary URL, return it directly
        return cleanPath;
      }
    } catch {
      // Ignore URL parsing errors and treat as relative path
    }
  }

  // If already prefixed with /api/assets/view/, extract the underlying storage key
  if (cleanPath.includes('/api/assets/view/')) {
    cleanPath = cleanPath.split('/api/assets/view/')[1] || cleanPath;
  }

  // 2. Check Static Public Assets First
  if (STATIC_ASSETS.has(cleanPath)) {
    return cleanPath;
  }
  if (cleanPath.startsWith('/') && !cleanPath.includes('kucet/') && !cleanPath.startsWith('/assets/')) {
    // If it's an absolute static path in the repo public folder
    return cleanPath;
  }

  // 3. Prevent Memory Leaks: Bound the cache size (especially on server)
  if (CLIENT_ASSET_CACHE.size > 5000) {
    CLIENT_ASSET_CACHE.clear();
  }

  // Generate lookup cache key
  const storageType = (
    options.forceStorageType ||
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_TYPE ||
    process.env.STORAGE_PROVIDER ||
    process.env.STORAGE_TYPE ||
    'local'
  ).toLowerCase();

  const cacheKey = options.cacheKey || `${storageType}:${cleanPath}:${transformations}`;

  // Return cached URL if available and not explicitly bypassed
  if (!options.bypassCache && CLIENT_ASSET_CACHE.has(cacheKey)) {
    return CLIENT_ASSET_CACHE.get(cacheKey);
  }

  // Normalize: strip leading/trailing slashes for consistent matching
  const finalCleanPath = cleanPath.replace(/^\/+|\/+$/g, '');
  const normalizedPath = `/${finalCleanPath}`;

  let resolvedUrl = '';

  // Serve static public-folder assets directly
  if (STATIC_ASSETS.has(normalizedPath) || finalCleanPath.startsWith('assets/')) {
    resolvedUrl = normalizedPath;
  } else {
    // Resolve institutional assets (e.g. 'principal/signature' logical key)
    const instFilename = resolveInstitutionalFilename(finalCleanPath);
    if (instFilename) {
      if (storageType === 'local') {
        resolvedUrl = `/assets/${instFilename}`;
      } else {
        const cloudName =
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
          process.env.CLOUDINARY_CLOUD_NAME ||
          'djs0ry74r';
        resolvedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${instFilename}`;
      }
    } else if (storageType === 'cloudinary') {
      // Environment-Aware Storage Layer (Cloudinary Mode)
      const cloudName =
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
        process.env.CLOUDINARY_CLOUD_NAME ||
        'djs0ry74r';

      const extension = finalCleanPath.split('.').pop()?.toLowerCase() || '';
      let resourceType = 'image';
      if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
        resourceType = 'video';
      } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
        resourceType = 'raw';
      }

      // Cloudinary paths always live under 'kucet/' namespace
      const cloudinaryPath = (finalCleanPath.startsWith('kucet/') || finalCleanPath.startsWith('archive/'))
        ? finalCleanPath
        : `kucet/${finalCleanPath}`;

      resolvedUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${transformations}/${cloudinaryPath}`;
    } else {
      // Secure Private Storage (Local Mode): All non-static asset keys are served through /api/assets/view/
      resolvedUrl = `/api/assets/view/${finalCleanPath}`;
    }
  }

  // Cache resolved URL in client memory
  if (resolvedUrl) {
    CLIENT_ASSET_CACHE.set(cacheKey, resolvedUrl);
    // Also index under simple path for easy invalidation by path
    CLIENT_ASSET_CACHE.set(cleanPath, resolvedUrl);
  }

  return resolvedUrl;
}

export default getAssetUrl;
