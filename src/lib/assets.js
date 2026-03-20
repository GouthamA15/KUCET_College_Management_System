
/**
 * Utility to resolve asset URLs.
 * Points to Cloudinary by default to remove dependency on local 'public' folder.
 * Uses CLOUDINARY_CLOUD_NAME from environment configuration with a fallback for client-side access.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'djs0ry74r';

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
  
  // Determine resource type based on extension
  const extension = cleanPath.split('.').pop().toLowerCase();
  let resourceType = 'image';
  
  // Cloudinary uses 'video' resource type for both video and audio files
  if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
    resourceType = 'video';
  } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
    resourceType = 'raw';
  }

  // Construct URL with optimization transformations (f_auto, q_auto)
  // Note: transformations go after /upload/
  return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/f_auto,q_auto/kucet/public/${cleanPath}`;
}

export default getAssetUrl;
