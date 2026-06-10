
/**
 * Utility to resolve asset URLs.
 * Points to Cloudinary by default to remove dependency on local 'public' folder.
 * Uses CLOUDINARY_CLOUD_NAME from environment configuration with a fallback for client-side access.
 */

/**
 * List of assets verified to be in the local 'public' folder.
 * These will be served via the app's Global CDN (Next.js public folder)
 * for maximum performance (<100ms load).
 */
const STATIC_ASSETS = [
  '/assets/ku-logo.png',
  '/assets/ku-college-logo.png',
  '/assets/Naac_A+.png',
  '/assets/kakatiya-kala-thoranam.png',
  '/assets/rudramadevi_statue.jpg',
  '/assets/college-campus.jpg',
  '/assets/default-avatar.svg',
  '/assets/Picture1.png',
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
  '/manifest.json'
];

/**
 * Maps a local path or relative asset path to its full URL based on the storage type.
 * @param {string} path - The relative path (e.g., 'kucet/students/pfp/abc.jpg') or a local path.
 * @param {string} transformations - Cloudinary transformations (default: 'f_auto,q_auto').
 * @returns {string} - The full URL.
 */
export function getAssetUrl(path, transformations = 'f_auto,q_auto') {
  if (!path) return '';
  
  // 1. Handle data URIs, absolute URLs, and local API routes
  if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('/api/')) {
    return path;
  }

  // 2. Normalize path and check for static assets
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const normalizedPath = `/${cleanPath}`;

  if (STATIC_ASSETS.includes(normalizedPath) && transformations === 'f_auto,q_auto') {
    return normalizedPath;
  }

  // 3. Strategy: Local VPS storage (Served by Nginx alias)
  if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'local') {
    // If the path is a static asset (starts with 'assets/'), it should not go to /uploads/
    if (cleanPath.startsWith('assets/')) {
        return `/${cleanPath}`;
    }
    return `/uploads/${cleanPath}`;
  }

  // 4. Strategy: Cloudinary (client-safe)
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'djs0ry74r';
  const extension = cleanPath.split('.').pop()?.toLowerCase();
  let resourceType = 'image';
  if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
    resourceType = 'video';
  } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
    resourceType = 'raw';
  }

  const finalPath = cleanPath.includes('kucet/') ? cleanPath : `kucet/public/${cleanPath}`;
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${transformations}/${finalPath}`;
}

export default getAssetUrl;
