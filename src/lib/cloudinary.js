import { v2 as cloudinary } from 'cloudinary';
import logger from './logger';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Relativizes a Cloudinary URL into a path that can be stored and later resolved.
 * @param {string} url - The full Cloudinary secure URL
 * @returns {string} - The relative path (e.g., 'kucet/students/pfp/abc.jpg')
 */
export function relativizeCloudinaryUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return url;

  const parts = url.split('/upload/');
  if (parts.length < 2) return url;

  // Strip version (v12345678/) and transformations (f_auto,q_auto/)
  let path = parts[1].replace(/^v\d+\//, ''); 
  
  // If the path still contains multiple segments and the first one isn't 'kucet', 
  // it might be a transformation segment (e.g., f_auto,q_auto)
  if (path.includes('/') && !path.startsWith('kucet/')) {
    const segments = path.split('/');
    if (segments[0].includes(',')) {
      path = segments.slice(1).join('/');
    }
  }

  return path;
}

/**
 * Transforms a raw Cloudinary URL to include optimization parameters (f_auto, q_auto)
 * @param {string} url - The original Cloudinary URL
 * @param {string} transformations - Additional transformations (e.g., 'w_500,h_500,c_fill')
 * @returns {string} - The optimized URL
 */
export function getOptimizedUrl(url, transformations = '') {
  if (!url) return url;

  // If it's already a relative path, we don't apply optimizations here 
  // as getAssetUrl will do it when resolving.
  if (!url.includes('cloudinary.com')) return url;

  const parts = url.split('/upload/');
  if (parts.length < 2) return url;

  const base = parts[0];
  const rest = parts[1];
  
  // Combine f_auto, q_auto with any provided transformations
  const autoParams = 'f_auto,q_auto';
  const combinedTransformations = transformations 
    ? `${autoParams},${transformations}` 
    : autoParams;

  return `${base}/upload/${combinedTransformations}/${rest}`;
}

/**
 * Uploads an image to Cloudinary using a cryptographically random UUID filename.
 * NEVER uses roll numbers, student IDs, emails, or original filenames.
 *
 * @param {string|Buffer|File} file - Base64 string, Buffer, or browser File object
 * @param {string} folder - Cloudinary folder name relative to 'kucet/' (e.g. 'students/pfp')
 * @param {string|null} publicId - Optional override (used only internally; defaults to UUID)
 * @returns {Promise<string>} - The canonical storage key: 'kucet/<folder>/<uuid>.<ext>'
 */
export async function uploadToCloudinary(file, folder, publicId = null) {
  if (!file) {
    return null;
  }

  let fileToUpload = file;

  // Handle browser File objects (from formData)
  if (file instanceof File || (typeof file === 'object' && typeof file.arrayBuffer === 'function')) {
    // SECURITY: Enforce 1MB limit
    const MAX_SIZE = 1 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed is 1MB.`);
    }

    if (file.size === 0) return null;

    // SECURITY: Ensure it's an image
    if (file.type && !file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed.');
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || 'image/jpeg';
    fileToUpload = `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
  // Handle Buffers
  else if (Buffer.isBuffer(file)) {
    const base64 = file.toString('base64');
    fileToUpload = `data:image/jpeg;base64,${base64}`;
  }

  const cleanPublicId = typeof publicId === 'string' && publicId.trim() && !publicId.includes('[object') 
    ? publicId.trim() 
    : null;

  // Generate a cryptographically random UUID as the filename.
  // This ensures NO user identifiers (roll numbers, emails, names) appear in storage paths.
  const randomFilename = cleanPublicId || (
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  );

  const options = {
    folder: `kucet/${folder}`,
    resource_type: 'auto',
    public_id: randomFilename,
    unique_filename: false,
    overwrite: false,
  };

  try {
    const result = await cloudinary.uploader.upload(fileToUpload, options);
    if (!result || !result.public_id) {
      throw new Error('Cloudinary upload returned an empty response.');
    }

    // ARCHITECTURE CONTRACT: Return ONLY the storage key, never the full URL.
    // Format: kucet/<folder>/<uuid>.<ext>
    const ext = result.format ? `.${result.format}` : '';
    const storageKey = `${result.public_id}${ext}`;

    // GUARD: Ensure the storage key is a valid string — prevent [object Object] corruption
    if (
      typeof storageKey !== 'string' ||
      storageKey.includes('[object') ||
      storageKey.includes('undefined') ||
      !storageKey.startsWith('kucet/')
    ) {
      throw new Error(`Cloudinary upload returned an invalid storage key: ${storageKey}`);
    }

    return storageKey;
  } catch (error) {
    logger.error('Cloudinary Upload Error:', {
      message: error.message,
      stack: error.stack,
      folder,
      publicId,
    });
    throw new Error(`Failed to upload image to cloud storage: ${error.message}`);
  }
}


/**
 * Deletes an image from Cloudinary given its storage key or URL.
 * Handles: storage keys, full URLs, versioned paths.
 * @param {string} pathOrUrl - The storage key or full URL
 */
export async function deleteFromCloudinary(pathOrUrl) {
  if (!pathOrUrl) return;
  if (typeof pathOrUrl !== 'string') return;
  // Skip data URIs and [object Object] garbage
  if (pathOrUrl.startsWith('data:') || pathOrUrl.includes('[object')) return;

  try {
    let keyPath;
    if (pathOrUrl.includes('cloudinary.com')) {
      // Full Cloudinary URL - extract the storage key
      keyPath = relativizeCloudinaryUrl(pathOrUrl);
    } else if (/^v\d+\//.test(pathOrUrl)) {
      // Versioned path like v1778497250/kucet/students/pfp/abc.jpg
      keyPath = pathOrUrl.replace(/^v\d+\//, '');
    } else {
      // Already a storage key
      keyPath = pathOrUrl;
    }
    
    if (!keyPath) return;
    
    // Cloudinary uploader.destroy expects public_id WITHOUT extension
    const lastDot = keyPath.lastIndexOf('.');
    const publicId = lastDot > 0 ? keyPath.substring(0, lastDot) : keyPath;

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
  }
}

export default cloudinary;
