
/**
 * Utility to resolve asset URLs.
 * Points to Cloudinary by default to remove dependency on local 'public' folder.
 * Uses CLOUDINARY_CLOUD_NAME from environment configuration with a fallback for client-side access.
 */

const DEFAULT_CLOUD_NAME = 'djs0ry74r';
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD_NAME;

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
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
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
 * @returns {string} - The full URL.
 */
export function getAssetUrl(path) {
  if (!path) return '';
  
  const originalPath = path;

  // 1. Handle data URIs and already-correct absolute URLs from other domains
  if (path.startsWith('data:') || (path.startsWith('http') && !path.includes('cloudinary.com'))) {
    return path;
  }

  // 2. Relativize absolute Cloudinary URLs for backward compatibility
  if (path.startsWith('http') && path.includes('cloudinary.com')) {
    const parts = path.split('/upload/');
    if (parts.length >= 2) {
      let relativePath = parts[1].replace(/^v\d+\//, ''); 
      if (relativePath.includes('/')) {
        const segments = relativePath.split('/');
        if (segments[0].includes(',')) {
          relativePath = segments.slice(1).join('/');
        }
      }
      path = relativePath;
    }
  }

  // 3. Ensure we are working with a relative path now
  if (path.startsWith('http')) return path;

  // 4. Preserve root-relative URLs (starting with /)
  if (path.startsWith('/') && !path.startsWith('/api/assets/view/')) {
    return path;
  }

  // 5. Normalize the path
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const normalizedPath = `/${cleanPath}`;

  // 6. Handle Static Assets
  if (STATIC_ASSETS.includes(normalizedPath)) {
    return normalizedPath;
  }

  // 7. Strategy: Local VPS Storage (Secure Proxy)
  if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'local') {
    return `/api/assets/view/${cleanPath}`;
  }

  // 8. Strategy: Cloudinary
  const extension = cleanPath.split('.').pop().toLowerCase();
  let resourceType = 'image';
  if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
    resourceType = 'video';
  } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
    resourceType = 'raw';
  }

  const finalPath = cleanPath.startsWith('kucet/') ? cleanPath : `kucet/public/${cleanPath}`;
  return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/f_auto,q_auto/${finalPath}`;
}

export default getAssetUrl;
