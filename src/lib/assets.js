
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
  
  // 1. Handle data URIs and already-correct absolute URLs from other domains
  if (path.startsWith('data:') || (path.startsWith('http') && !path.includes('cloudinary.com'))) {
    return path;
  }

  // 2. Normalize path and check for static assets
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const normalizedPath = `/${cleanPath}`;

  if (STATIC_ASSETS.includes(normalizedPath) && transformations === 'f_auto,q_auto') {
    return normalizedPath;
  }

  // 3. Strategy: External Provider
  try {
    const { getStorageProvider } = require('./providers/storage/factory');
    const storage = getStorageProvider();
    return storage.getUrl(path, { transformations });
  } catch (err) {
    // Fallback if provider not available (shouldn't happen in production)
    return normalizedPath;
  }
}

export default getAssetUrl;
