
/**
 * Utility to resolve asset URLs.
 * Points to Cloudinary by default to remove dependency on local 'public' folder.
 * Uses CLOUDINARY_CLOUD_NAME from environment configuration with a fallback for client-side access.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'djs0ry74r';

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
 * Maps a local path (like '/assets/logo.png') to its static local path or Cloudinary fallback.
 * @param {string} localPath - The path relative to the public folder.
 * @returns {string} - The full URL.
 */
export function getAssetUrl(localPath) {
  if (!localPath) return '';
  
  // If it's already an absolute URL or a data URI, return as is
  if (localPath.startsWith('http') || localPath.startsWith('data:')) {
    return localPath;
  }

  // Ensure path starts with a slash for matching
  const normalizedPath = localPath.startsWith('/') ? localPath : `/${localPath}`;

  // If the asset is in our static list, serve it locally from the /public folder
  if (STATIC_ASSETS.includes(normalizedPath)) {
    return normalizedPath;
  }

  // Fallback to Cloudinary for everything else (including sensitive seals/signatures)
  const cleanPath = normalizedPath.substring(1);
  const extension = cleanPath.split('.').pop().toLowerCase();
  let resourceType = 'image';
  
  if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
    resourceType = 'video';
  } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
    resourceType = 'raw';
  }

  return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/f_auto,q_auto/kucet/public/${cleanPath}`;
}

export default getAssetUrl;
