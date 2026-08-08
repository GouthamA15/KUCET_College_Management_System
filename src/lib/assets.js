
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
  '/assets/principal-sign.png',
  '/assets/principal-signStamp.png',
  '/assets/principal-sign-stamp.png',
  '/assets/principal-sign-black.png',
  '/assets/principal-sign3.png',
  '/assets/principal-sign4.png',
  '/assets/principal_ku_qr.png',
  '/assets/ku-college-seal.png',
  '/manifest.json',
  '/favicon.ico'
];

/**
 * Maps a local path or relative asset path to its full URL based on the storage type.
 * @param {string} path - The relative path (e.g., 'kucet/students/pfp/abc.jpg') or a local path.
 * @param {string} transformations - Cloudinary transformations (default: 'f_auto,q_auto').
 * @returns {string} - The full URL.
 */
export function getAssetUrl(path, transformations = 'f_auto,q_auto') {
  if (!path) return '';
  if (typeof path !== 'string') return '';
  
  // 1. Handle data URIs, absolute URLs, and local API routes
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/api/')) {
    return path;
  }

  // 2. Handle [object Object] corruption gracefully - return empty string
  if (path.includes('[object Object]') || path.startsWith('[object')) {
    return '';
  }

  // 3. Handle versioned Cloudinary paths (legacy DB data: v1234567/kucet/...)
  let cleanedPath = path.replace(/^v\d+\//, '');

  // 4. Normalize path and check for static assets
  const cleanPath = cleanedPath.startsWith('/') ? cleanedPath.substring(1) : cleanedPath;
  const normalizedPath = `/${cleanPath}`;

  if (STATIC_ASSETS.includes(normalizedPath)) {
    return normalizedPath;
  }

  // Check signature & branding aliases (e.g., 'principal-sign.png')
  const signatureAliases = [
    'principal-sign.png', 'principal-signStamp.png', 'principal-sign-stamp.png', 
    'principal-sign-black.png', 'principal-sign3.png', 'principal-sign4.png', 
    'principal_ku_qr.png', 'ku-college-seal.png'
  ];
  const basename = cleanPath.split('/').pop() || '';
  if (signatureAliases.includes(cleanPath) || signatureAliases.includes(basename)) {
    return `/assets/${basename}`;
  }

  const storageType = (
    process.env.NEXT_PUBLIC_STORAGE_TYPE || 
    process.env.STORAGE_TYPE || 
    'local'
  ).toLowerCase();

  // 5. Strategy: Local storage proxy
  if (storageType === 'local') {
    return `/api/assets/view/${cleanPath}`;
  }

  // 6. Strategy: S3 / Cloudflare R2
  if (storageType === 's3' || storageType === 'r2') {
    const s3Domain = process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN || process.env.S3_PUBLIC_DOMAIN;
    if (s3Domain) {
      return `${s3Domain.replace(/\/$/, '')}/${cleanPath}`;
    }
  }

  // 7. Strategy: Cloudinary (client-safe default)
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'djs0ry74r';
  const extension = cleanPath.split('.').pop()?.toLowerCase() || '';
  let resourceType = 'image';
  if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
    resourceType = 'video';
  } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
    resourceType = 'raw';
  }

  const trimmedPath = cleanPath.replace(/^uploads\//, '').replace(/^public\//, '');
  const finalPath = trimmedPath.startsWith('kucet/') ? trimmedPath : `kucet/${trimmedPath}`;
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${transformations}/${finalPath}`;
}

export default getAssetUrl;

