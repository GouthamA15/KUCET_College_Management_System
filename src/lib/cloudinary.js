import { v2 as cloudinary } from 'cloudinary';
import logger from './logger';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Transforms a raw Cloudinary URL to include optimization parameters (f_auto, q_auto)
 * @param {string} url - The original Cloudinary URL
 * @param {string} transformations - Additional transformations (e.g., 'w_500,h_500,c_fill')
 * @returns {string} - The optimized URL
 */
export function getOptimizedUrl(url, transformations = '') {
  if (!url || !url.includes('cloudinary.com')) return url;

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
 * @returns {Promise<string>} - The secure URL of the uploaded image
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
    // Return optimized URL by default
    return getOptimizedUrl(result.secure_url);
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
 * Deletes an image from Cloudinary given its URL
 * @param {string} url - The full Cloudinary secure URL
 */
export async function deleteFromCloudinary(url) {
  if (!url || !url.includes('cloudinary.com')) return;

  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return;

    // Remove any transformations and version string to get the path
    const pathParts = parts[1].split('/');
    // The public_id starts after the version (v123456789) if it exists, or directly if not.
    // However, cloudinary.uploader.destroy expects the public_id including folder but excluding extension.
    
    // Easier way: Extract part between /upload/ and extension, remove version
    let path = parts[1].replace(/^v\d+\//, ''); // Remove version if first
    // If there were transformations (like f_auto,q_auto), they will be in the path too.
    // Our getOptimizedUrl puts them right after /upload/
    path = path.replace(/^[^/]+\//, (match) => {
        return match.includes(',') ? '' : match; // Remove transformation segment if it has commas
    });
    
    const publicId = path.substring(0, path.lastIndexOf('.'));

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
  }
}

export default cloudinary;
