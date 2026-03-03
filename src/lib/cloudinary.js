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
    if (file.size === 0) {
      console.log('[CLOUDINARY] File size is 0, skipping upload.');
      return null;
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

export default cloudinary;
