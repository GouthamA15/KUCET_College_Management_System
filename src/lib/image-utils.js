import sharp from 'sharp';
import logger from './logger';

/**
 * Optimizes an image for institutional web use.
 * Target: High visual parity while staying under 1MB (ideally 600-800KB for full-res mobile shots).
 * 
 * @param {Buffer} buffer - Raw image buffer
 * @param {Object} options - Custom options (width, quality)
 * @returns {Promise<{buffer: Buffer, info: Object}>}
 */
export async function optimizeImage(buffer, { width = 1200, quality = 80, format = 'webp' } = {}) {
  try {
    const pipeline = sharp(buffer)
      .resize({
        width,
        withoutEnlargement: true,
        fit: 'inside'
      });

    if (format === 'webp') {
      pipeline.webp({ quality, effort: 4 });
    } else {
      pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
    }

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    
    logger.info({ 
        originalSize: (buffer.length / 1024).toFixed(2) + 'KB',
        optimizedSize: (data.length / 1024).toFixed(2) + 'KB',
        format: info.format,
        width: info.width,
        height: info.height
    }, '[IMAGE_OPTIMIZATION_SUCCESS]');

    return { buffer: data, info };
  } catch (error) {
    logger.error(error, '[IMAGE_OPTIMIZATION_ERROR]');
    // Fallback to original buffer if optimization fails
    return { buffer, info: {} };
  }
}
