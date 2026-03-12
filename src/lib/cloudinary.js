import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads an image to Cloudinary
 * @param {string|Buffer|File} file - Base64 string, Buffer, or browser File object
 * @param {string} folder - Cloudinary folder name
 * @param {string} publicId - Optional public ID
 * @returns {Promise<string>} - The secure URL of the uploaded image
 */
export async function uploadToCloudinary(file, folder, publicId = null) {
  if (!file) {
    console.log('[CLOUDINARY] No file provided to uploadToCloudinary');
    return null;
  }

  let fileToUpload = file;
  
  console.log(`[CLOUDINARY] Starting upload to folder: kucet/${folder}. Type of file: ${typeof file}`);

  // Handle browser File objects (from formData)
  if (file instanceof File || (typeof file === 'object' && typeof file.arrayBuffer === 'function')) {
    console.log(`[CLOUDINARY] Processing as File object. Name: ${file.name}, Size: ${file.size} bytes`);
    
    // SECURITY: Enforce 1MB limit
    const MAX_SIZE = 1 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed is 1MB.`);
    }

    if (file.size === 0) {
      console.log('[CLOUDINARY] File size is 0, skipping upload.');
      return null;
    }

    // SECURITY: Ensure it's an image
    if (file.type && !file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed.');
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fileToUpload = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }
  // Handle Buffers
  else if (Buffer.isBuffer(file)) {
    console.log(`[CLOUDINARY] Processing as Buffer. Length: ${file.length} bytes`);
    const base64 = file.toString('base64');
    fileToUpload = `data:image/jpeg;base64,${base64}`;
  } else if (typeof file === 'string') {
    console.log(`[CLOUDINARY] Processing as string. Starts with: ${file.substring(0, 20)}...`);
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
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw new Error('Failed to upload image to cloud storage.');
  }
}

/**
 * Deletes an image from Cloudinary given its URL
 * @param {string} url - The full Cloudinary secure URL
 */
export async function deleteFromCloudinary(url) {
  if (!url || !url.includes('cloudinary.com')) return;

  try {
    // URL format: https://res.cloudinary.com/[cloud_name]/image/upload/v[version]/[folder]/[public_id].[ext]
    // We need the part after 'upload/v[version]/' or 'upload/'
    const parts = url.split('/upload/');
    if (parts.length < 2) return;

    // Remove the version if present (starts with 'v' followed by digits)
    let path = parts[1].replace(/^v\d+\//, '');
    
    // Remove the file extension
    const publicId = path.substring(0, path.lastIndexOf('.'));

    console.log('[CLOUDINARY] Deleting asset:', publicId);
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
    // Don't throw, just log. Failure to delete old pic shouldn't block the update.
  }
}

export default cloudinary;
