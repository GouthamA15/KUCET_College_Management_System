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
 * Uploads an image to Cloudinary
 * @param {string|Buffer|File} file - Base64 string, Buffer, or browser File object
 * @param {string} folder - Cloudinary folder name
 * @param {string} publicId - Optional public ID
 * @returns {Promise<string>} - The relative path of the uploaded image
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

  const options = {
    folder: `kucet/${folder}`,
    resource_type: 'auto',
  };

  if (publicId) {
    options.public_id = publicId;
  }

  try {
    const result = await cloudinary.uploader.upload(fileToUpload, options);
    if (!result || !result.secure_url) {
      throw new Error('Cloudinary upload returned an empty response.');
    }
    
    // Return ONLY the relative path (including extension)
    // Cloudinary's secure_url includes the extension by default.
    return relativizeCloudinaryUrl(result.secure_url);
  } catch (error) {
    logger.error('Cloudinary Upload Error:', {
      message: error.message,
      stack: error.stack,
      folder,
      publicId
    });
    throw new Error(`Failed to upload image to cloud storage: ${error.message}`);
  }
}

/**
 * Deletes an image from Cloudinary given its URL or relative path
 * @param {string} pathOrUrl - The full URL or relative path
 */
export async function deleteFromCloudinary(pathOrUrl) {
  if (!pathOrUrl) return;

  try {
    const path = pathOrUrl.includes('cloudinary.com') 
      ? relativizeCloudinaryUrl(pathOrUrl) 
      : pathOrUrl;

    // Cloudinary uploader.destroy expects public_id (folder + name, NO extension)
    const publicId = path.substring(0, path.lastIndexOf('.'));

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
  }
}

export default cloudinary;
