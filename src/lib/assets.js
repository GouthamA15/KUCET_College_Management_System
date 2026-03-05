
/**
 * Utility to resolve asset URLs.
 * Points to Cloudinary by default to remove dependency on local 'public' folder.
 * Supports a local fallback if Cloudinary is unavailable.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dx3ruj7f4';
const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/kucet/public`;

/**
 * Maps a local path (like '/assets/logo.png') to its Cloudinary equivalent or local fallback.
 * @param {string} localPath - The path relative to the public folder.
 * @returns {string} - The full URL (Cloudinary or local).
 */
export function getAssetUrl(localPath) {
  if (!localPath) return '';
  
  // If it's already an absolute URL or a data URI, return as is
  if (localPath.startsWith('http') || localPath.startsWith('data:')) {
    return localPath;
  }

  // Remove leading slash for Cloudinary path construction
  const cleanPath = localPath.startsWith('/') ? localPath.substring(1) : localPath;
  
  return `${CLOUDINARY_BASE}/${cleanPath}`;
}

export default getAssetUrl;
