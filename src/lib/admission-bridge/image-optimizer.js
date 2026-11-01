/**
 * Universal Image Optimization Module for KUCET Admission Bridge.
 * 
 * Enforces KU Online constraints & Conservative Safety Margins:
 * - Output format: Strictly genuine JPEG (image/jpeg)
 * - Maximum byte size: Conservative hard limit of 190 KiB (194,560 bytes)
 *   (providing a safety margin against assumed 200 KB university portal ceiling)
 * - Optimal target band: 100 KB - 150 KB
 * - Preserves aspect ratio without distortion
 * - Composites transparent backgrounds (signatures) onto solid white (#FFFFFF)
 * - Detailed verification report for each image processed
 */

import { 
  ADMISSION_BRIDGE_CONFIG, 
  MAX_PORTAL_IMAGE_BYTES, 
  TARGET_IMAGE_MIN_BYTES, 
  TARGET_IMAGE_MAX_BYTES 
} from './config.js';

export { MAX_PORTAL_IMAGE_BYTES, TARGET_IMAGE_MIN_BYTES, TARGET_IMAGE_MAX_BYTES };

/**
 * Validates whether an image file size in bytes satisfies the conservative portal ceiling.
 * 
 * Condition: sizeBytes <= MAX_PORTAL_IMAGE_BYTES (190 KiB = 194,560 bytes)
 * 
 * @param {number} sizeBytes 
 * @param {number} [maxBytes=MAX_PORTAL_IMAGE_BYTES]
 * @returns {{
 *   isValid: boolean,
 *   sizeBytes: number,
 *   maxBytes: number,
 *   formattedSize: string,
 *   formattedMax: string,
 *   error: string | null
 * }}
 */
export function validatePortalImageSize(sizeBytes, maxBytes = MAX_PORTAL_IMAGE_BYTES) {
  if (typeof sizeBytes !== 'number' || isNaN(sizeBytes) || sizeBytes < 0) {
    return {
      isValid: false,
      sizeBytes: 0,
      maxBytes,
      formattedSize: '0 KB',
      formattedMax: `${Math.round(maxBytes / 1024)} KB`,
      error: 'Invalid file size',
    };
  }

  const isValid = sizeBytes <= maxBytes;
  const formattedSize = `${Math.round(sizeBytes / 1024)} KB`;
  const formattedMax = `${Math.round(maxBytes / 1024)} KB`;

  return {
    isValid,
    sizeBytes,
    maxBytes,
    formattedSize,
    formattedMax,
    error: isValid 
      ? null 
      : `This image (${formattedSize}) could not be reduced below the safe upload limit (${formattedMax} / 190 KiB). Please contact the administrator or use the approved manual process.`,
  };
}

/**
 * Checks if a buffer or blob has standard JPEG magic bytes (FF D8 FF).
 * @param {Buffer | Uint8Array} bytes 
 * @returns {boolean}
 */
export function isJpegBytes(bytes) {
  if (!bytes || bytes.length < 3) return false;
  return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
}

/**
 * Checks if a buffer or blob has standard PNG magic bytes (89 50 4E 47).
 * @param {Buffer | Uint8Array} bytes 
 * @returns {boolean}
 */
export function isPngBytes(bytes) {
  if (!bytes || bytes.length < 4) return false;
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
}

/**
 * Checks if a buffer or blob has standard WebP magic bytes (RIFF...WEBP).
 * @param {Buffer | Uint8Array} bytes 
 * @returns {boolean}
 */
export function isWebpBytes(bytes) {
  if (!bytes || bytes.length < 12) return false;
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return isRiff && isWebp;
}

/**
 * Identifies the MIME type of raw binary image data.
 * @param {Buffer | Uint8Array} bytes 
 * @returns {'image/jpeg' | 'image/png' | 'image/webp' | 'unknown'}
 */
export function detectImageFormat(bytes) {
  if (isJpegBytes(bytes)) return 'image/jpeg';
  if (isPngBytes(bytes)) return 'image/png';
  if (isWebpBytes(bytes)) return 'image/webp';
  return 'unknown';
}

/**
 * Decodes a base64 data URI into a Buffer.
 * @param {string} dataUri 
 * @returns {{ buffer: Buffer, mimeType: string }}
 */
export function parseDataUri(dataUri) {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
    throw new Error('Invalid data URI format');
  }
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Malformed data URI');
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

/**
 * Node.js-compatible image optimization pipeline using Jimp.
 * Used by backend API routes, image proxy, and automated verification test suites.
 * 
 * @param {Buffer} inputBuffer - Source image buffer (JPEG, PNG, BMP)
 * @param {Object} options
 * @param {'photo' | 'signature'} [options.category='photo']
 * @param {string} [options.filename='optimized.jpg']
 * @param {number} [options.maxBytes=194560] - Conservative hard ceiling (190 KiB = 194,560 bytes)
 * @param {number} [options.targetMinBytes=102400] - 100 KB
 * @param {number} [options.targetMaxBytes=153600] - 150 KB
 * @param {Function} [options.webpDecoder] - Custom decoder hook for WebP buffers in Node
 * @param {boolean} [options.throwOnFailure=true] - Whether to throw on compression failure
 * @returns {Promise<{
 *   buffer: Buffer,
 *   originalSize: number,
 *   optimizedSize: number,
 *   originalFormat: string,
 *   mimeType: 'image/jpeg',
 *   filename: string,
 *   dimensions: { width: number, height: number },
 *   quality: number,
 *   passedConstraint: boolean
 * }>}
 */
export async function optimizeImageBufferNode(inputBuffer, options = {}) {
  const {
    category = 'photo',
    filename = 'optimized.jpg',
    maxBytes = MAX_PORTAL_IMAGE_BYTES,
    targetMinBytes = TARGET_IMAGE_MIN_BYTES,
    targetMaxBytes = TARGET_IMAGE_MAX_BYTES,
  } = options;

  if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new Error('Invalid or empty image buffer provided for optimization');
  }

  const originalSize = inputBuffer.length;
  const originalFormat = detectImageFormat(inputBuffer);

  // Lazy-load Jimp for Node.js environments
  const { Jimp } = await import('jimp');

  let image;
  try {
    image = await Jimp.read(inputBuffer);
  } catch (err) {
    if (originalFormat === 'image/webp' && typeof options.webpDecoder === 'function') {
      image = await options.webpDecoder(inputBuffer);
    } else {
      throw new Error(`Failed to decode image buffer: ${err.message}`);
    }
  }

  let width = image.bitmap.width;
  let height = image.bitmap.height;

  // Max initial dimension bounds (preserves aspect ratio)
  const maxDim = category === 'photo' 
    ? ADMISSION_BRIDGE_CONFIG.MEDIA.MAX_INITIAL_PHOTO_DIM 
    : ADMISSION_BRIDGE_CONFIG.MEDIA.MAX_INITIAL_SIGNATURE_DIM;

  // If already a compliant genuine JPEG with dimensions and size within limit, preserve original
  if (originalFormat === 'image/jpeg' && originalSize <= maxBytes && width <= maxDim && height <= maxDim && category === 'photo') {
    return {
      buffer: inputBuffer,
      originalSize,
      optimizedSize: originalSize,
      originalFormat: 'image/jpeg',
      mimeType: 'image/jpeg',
      filename,
      dimensions: { width, height },
      quality: 100,
      passedConstraint: true,
      preservedOriginal: true,
    };
  }

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    image.resize({ w: width, h: height });
  }

  // Composite over white background to fix transparent PNGs/signatures in JPEG
  const canvasWithWhiteBg = new Jimp({ width, height, color: 0xFFFFFFFF });
  canvasWithWhiteBg.composite(image, 0, 0);

  // Iterative quality candidates
  const qualityCandidates = category === 'photo'
    ? [85, 75, 65, 55, 45, 35]
    : [90, 80, 70, 60, 50, 40]; // Signatures require higher contrast

  let bestBuffer = null;
  let bestQuality = 80;

  for (const q of qualityCandidates) {
    const candidateBuf = await canvasWithWhiteBg.getBuffer('image/jpeg', { quality: q });
    if (candidateBuf.length <= maxBytes) {
      bestBuffer = candidateBuf;
      bestQuality = q;
      // Stop early if in optimal target band
      if (candidateBuf.length <= targetMaxBytes && candidateBuf.length >= targetMinBytes) {
        break;
      }
      // If highest quality is naturally smaller than target min, keep it
      if (candidateBuf.length < targetMinBytes && q === qualityCandidates[0]) {
        break;
      }
    }
  }

  // If still above maxBytes after lowest quality, step down dimensions by 0.8x
  let attempts = 0;
  while ((!bestBuffer || bestBuffer.length > maxBytes) && attempts < 5) {
    attempts++;
    width = Math.round(width * 0.8);
    height = Math.round(height * 0.8);

    const minDim = category === 'photo' 
      ? ADMISSION_BRIDGE_CONFIG.MEDIA.MIN_PHOTO_DIM 
      : ADMISSION_BRIDGE_CONFIG.MEDIA.MIN_SIGNATURE_DIM;
    if (width < minDim || height < minDim) break;

    const resizedCanvas = new Jimp({ width, height, color: 0xFFFFFFFF });
    const scaledImg = image.clone().resize({ w: width, h: height });
    resizedCanvas.composite(scaledImg, 0, 0);

    for (const q of [65, 50, 35]) {
      const candidateBuf = await resizedCanvas.getBuffer('image/jpeg', { quality: q });
      if (candidateBuf.length <= maxBytes) {
        bestBuffer = candidateBuf;
        bestQuality = q;
        break;
      }
    }
    if (bestBuffer && bestBuffer.length <= maxBytes) break;
  }

  if (!bestBuffer || bestBuffer.length > maxBytes) {
    const errorMsg = `Image compression failed: unable to reduce ${category} below conservative safe upload limit of ${maxBytes} bytes (190 KiB). (Result: ${((bestBuffer?.length || originalSize) / 1024).toFixed(1)} KB).`;
    if (options.throwOnFailure === false) {
      return {
        success: false,
        error: errorMsg,
        originalSize,
        optimizedSize: bestBuffer?.length || originalSize,
        passedConstraint: false,
      };
    }
    throw new Error(errorMsg);
  }

  // Verify resulting bytes are genuine JPEG
  if (!isJpegBytes(bestBuffer)) {
    throw new Error('Internal error: optimizer produced non-JPEG output');
  }

  return {
    buffer: bestBuffer,
    originalSize,
    optimizedSize: bestBuffer.length,
    originalFormat,
    mimeType: 'image/jpeg',
    filename,
    dimensions: { width, height },
    quality: bestQuality,
    passedConstraint: bestBuffer.length <= maxBytes,
  };
}

/**
 * Browser-native image optimization pipeline using HTML5 Canvas & Blob APIs.
 * Runs in the Chrome Extension Side Panel / Popup without external dependencies.
 * 
 * @param {Blob | File} sourceBlob - Source image blob (WebP, PNG, JPEG)
 * @param {Object} options
 * @param {'photo' | 'signature'} [options.category='photo']
 * @param {string} [options.filename='optimized.jpg']
 * @param {number} [options.maxBytes=194560]
 * @param {number} [options.targetMinBytes=102400]
 * @param {number} [options.targetMaxBytes=153600]
 * @returns {Promise<{
 *   file: File,
 *   originalSize: number,
 *   optimizedSize: number,
 *   originalFormat: string,
 *   mimeType: 'image/jpeg',
 *   filename: string,
 *   dimensions: { width: number, height: number },
 *   quality: number,
 *   passedConstraint: boolean
 * }>}
 */
export async function optimizeImageInBrowser(sourceBlob, options = {}) {
  const {
    category = 'photo',
    filename = 'optimized.jpg',
    maxBytes = MAX_PORTAL_IMAGE_BYTES,
    targetMinBytes = TARGET_IMAGE_MIN_BYTES,
    targetMaxBytes = TARGET_IMAGE_MAX_BYTES,
  } = options;

  if (!sourceBlob || typeof sourceBlob.slice !== 'function') {
    throw new Error('Invalid source Blob or File provided');
  }

  const originalSize = sourceBlob.size;
  const originalFormat = sourceBlob.type || 'unknown';

  // Decode to ImageBitmap or HTMLImageElement
  let imgBitmap;
  try {
    if (typeof createImageBitmap === 'function') {
      imgBitmap = await createImageBitmap(sourceBlob);
    } else {
      imgBitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image in browser'));
        img.src = URL.createObjectURL(sourceBlob);
      });
    }
  } catch (err) {
    throw new Error(`Image decoding failed: ${err.message}`);
  }

  let curWidth = imgBitmap.width;
  let curHeight = imgBitmap.height;

  // Max initial dimension bounds (preserves aspect ratio)
  const maxDim = category === 'photo' 
    ? ADMISSION_BRIDGE_CONFIG.MEDIA.MAX_INITIAL_PHOTO_DIM 
    : ADMISSION_BRIDGE_CONFIG.MEDIA.MAX_INITIAL_SIGNATURE_DIM;

  if (curWidth > maxDim || curHeight > maxDim) {
    const ratio = Math.min(maxDim / curWidth, maxDim / curHeight);
    curWidth = Math.round(curWidth * ratio);
    curHeight = Math.round(curHeight * ratio);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  const renderToJpegBlob = (w, h, q) => new Promise((resolve, reject) => {
    canvas.width = w;
    canvas.height = h;
    // Composite over white background to fix transparent signatures
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imgBitmap, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Canvas toBlob conversion failed'));
      else resolve(blob);
    }, 'image/jpeg', q);
  });

  const qualityCandidates = category === 'photo'
    ? [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]
    : [0.90, 0.80, 0.70, 0.60, 0.50, 0.40];

  let bestBlob = null;
  let bestQuality = 0.80;

  for (const q of qualityCandidates) {
    const candidateBlob = await renderToJpegBlob(curWidth, curHeight, q);
    if (candidateBlob.size <= maxBytes) {
      bestBlob = candidateBlob;
      bestQuality = q;
      if (candidateBlob.size <= targetMaxBytes && candidateBlob.size >= targetMinBytes) {
        break;
      }
      if (candidateBlob.size < targetMinBytes && q === qualityCandidates[0]) {
        break;
      }
    }
  }

  // Dimension step-down if quality tuning alone was insufficient
  let attempts = 0;
  while ((!bestBlob || bestBlob.size > maxBytes) && attempts < 5) {
    attempts++;
    curWidth = Math.round(curWidth * 0.8);
    curHeight = Math.round(curHeight * 0.8);

    const minDim = category === 'photo' 
      ? ADMISSION_BRIDGE_CONFIG.MEDIA.MIN_PHOTO_DIM 
      : ADMISSION_BRIDGE_CONFIG.MEDIA.MIN_SIGNATURE_DIM;
    if (curWidth < minDim || curHeight < minDim) break;

    for (const q of [0.65, 0.50, 0.35]) {
      const candidateBlob = await renderToJpegBlob(curWidth, curHeight, q);
      if (candidateBlob.size <= maxBytes) {
        bestBlob = candidateBlob;
        bestQuality = q;
        break;
      }
    }
    if (bestBlob && bestBlob.size <= maxBytes) break;
  }

  // Release bitmap resources
  if (imgBitmap.close) imgBitmap.close();

  if (!bestBlob || bestBlob.size > maxBytes) {
    throw new Error(
      `Image compression failed: unable to reduce ${category} below conservative safe upload limit of ${maxBytes} bytes (190 KiB). (Result: ${((bestBlob?.size || originalSize) / 1024).toFixed(1)} KB).`
    );
  }

  const finalFile = new File([bestBlob], filename, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  return {
    file: finalFile,
    originalSize,
    optimizedSize: finalFile.size,
    originalFormat,
    mimeType: 'image/jpeg',
    filename,
    dimensions: { width: curWidth, height: curHeight },
    quality: bestQuality,
    passedConstraint: finalFile.size <= maxBytes,
  };
}
