import { describe, it, expect } from 'vitest';
import { 
  optimizeImageBufferNode, 
  detectImageFormat, 
  isJpegBytes, 
  isPngBytes,
  isWebpBytes,
  parseDataUri,
  validatePortalImageSize,
  MAX_PORTAL_IMAGE_BYTES 
} from '@/lib/admission-bridge/image-optimizer';
import { Jimp } from 'jimp';

describe('KUCET Admission Bridge — Image Optimizer Suite (Conservative 190 KiB Limit)', () => {
  // Helper to create synthetic test images
  async function createSyntheticImage({ width = 400, height = 400, color = 0x0000FFFF, mime = 'image/png' }) {
    const img = new Jimp({ width, height, color });
    return await img.getBuffer(mime);
  }

  describe('1. Centralized Boundary Constants & Byte-Level Validation', () => {
    it('1. should validate JPEG below the limit (< 194,560 bytes)', () => {
      const res = validatePortalImageSize(100000);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.sizeBytes).toBe(100000);
      expect(res.maxBytes).toBe(MAX_PORTAL_IMAGE_BYTES);
    });

    it('2. should validate JPEG exactly at the configured maximum (194,560 bytes)', () => {
      const res = validatePortalImageSize(MAX_PORTAL_IMAGE_BYTES);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.sizeBytes).toBe(194560);
    });

    it('3. should reject JPEG one byte above the configured maximum (194,561 bytes)', () => {
      const res = validatePortalImageSize(MAX_PORTAL_IMAGE_BYTES + 1);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('could not be reduced below the safe upload limit');
      expect(res.error).toContain('190 KiB');
      expect(res.sizeBytes).toBe(194561);
    });
  });

  describe('2. Format Detection, MIME & Magic Bytes', () => {
    it('should correctly identify JPEG, PNG, and WebP magic bytes', async () => {
      const pngBuf = await createSyntheticImage({ mime: 'image/png' });
      expect(isPngBytes(pngBuf)).toBe(true);
      expect(isJpegBytes(pngBuf)).toBe(false);
      expect(detectImageFormat(pngBuf)).toBe('image/png');

      const jpegBuf = await createSyntheticImage({ mime: 'image/jpeg' });
      expect(isJpegBytes(jpegBuf)).toBe(true);
      expect(isPngBytes(jpegBuf)).toBe(false);
      expect(detectImageFormat(jpegBuf)).toBe('image/jpeg');

      // Synthetic WebP header buffer
      const webpHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20  // VP8
      ]);
      expect(isWebpBytes(webpHeader)).toBe(true);
      expect(detectImageFormat(webpHeader)).toBe('image/webp');
    });

    it('should parse valid base64 data URIs', () => {
      const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const dataUri = `data:image/png;base64,${rawBase64}`;
      const parsed = parseDataUri(dataUri);
      expect(parsed.mimeType).toBe('image/png');
      expect(Buffer.isBuffer(parsed.buffer)).toBe(true);
      expect(parsed.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('3. Multi-Pass JPEG Compression & Boundary Enforcement', () => {
    it('4. should compress large high-res JPEG successfully below 194,560 bytes', async () => {
      // Large high-resolution image (1600 x 1600)
      const largeImg = await createSyntheticImage({ width: 1600, height: 1600, color: 0x123456FF, mime: 'image/png' });
      
      const result = await optimizeImageBufferNode(largeImg, {
        category: 'photo',
        filename: '0332.jpg',
      });

      expect(result.optimizedSize).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
      expect(result.passedConstraint).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
      expect(isJpegBytes(result.buffer)).toBe(true);
      expect(result.dimensions.width).toBeLessThanOrEqual(1000);
      expect(result.dimensions.height).toBeLessThanOrEqual(1000);
    });

    it('5. should convert WebP buffer into genuine JPEG below the limit via decoder hook', async () => {
      // Mock WebP source image
      const mockWebpBuffer = Buffer.concat([
        Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
        Buffer.from('MOCK_WEBP_IMAGE_PAYLOAD')
      ]);

      const result = await optimizeImageBufferNode(mockWebpBuffer, {
        category: 'photo',
        filename: 'photo.jpg',
        webpDecoder: async () => {
          return new Jimp({ width: 300, height: 350, color: 0x00FF00FF });
        }
      });

      expect(result.mimeType).toBe('image/jpeg');
      expect(isJpegBytes(result.buffer)).toBe(true);
      expect(result.optimizedSize).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
      expect(result.passedConstraint).toBe(true);
    });

    it('6. should convert PNG source images into genuine JPEG with correct MIME type and magic bytes', async () => {
      const sourcePng = await createSyntheticImage({ width: 500, height: 600, color: 0xFF0000FF, mime: 'image/png' });
      
      const result = await optimizeImageBufferNode(sourcePng, {
        category: 'photo',
        filename: '1802.jpg',
      });

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.filename).toBe('1802.jpg');
      expect(isJpegBytes(result.buffer)).toBe(true);
      expect(result.originalFormat).toBe('image/png');
      expect(result.dimensions.width).toBe(500);
      expect(result.dimensions.height).toBe(600);
      expect(result.passedConstraint).toBe(true);
      expect(result.optimizedSize).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
    });

    it('7. should composite transparent signature onto solid white before JPEG conversion', async () => {
      const transparentSig = await createSyntheticImage({
        width: 600,
        height: 200,
        color: 0x00000000, // Fully transparent
        mime: 'image/png',
      });

      const result = await optimizeImageBufferNode(transparentSig, {
        category: 'signature',
        filename: '1867L(1).jpg',
      });

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.filename).toBe('1867L(1).jpg');
      expect(isJpegBytes(result.buffer)).toBe(true);
      expect(result.optimizedSize).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
      expect(result.passedConstraint).toBe(true);

      // Verify that pixel 10,10 is now white (high RGB near 255)
      const decodedOutput = await Jimp.read(result.buffer);
      const pixelColor = decodedOutput.getPixelColor(10, 10);
      const r = (pixelColor >> 24) & 0xFF;
      const g = (pixelColor >> 16) & 0xFF;
      const b = (pixelColor >> 8) & 0xFF;
      expect(r).toBeGreaterThan(240);
      expect(g).toBeGreaterThan(240);
      expect(b).toBeGreaterThan(240);
    });

    it('8. should execute iterative quality and dimension reduction across multiple passes', async () => {
      const complexImg = await createSyntheticImage({ width: 1200, height: 1200, color: 0xAABBCCFF, mime: 'image/png' });
      
      // Enforce strict low limit to force multi-pass reduction
      const result = await optimizeImageBufferNode(complexImg, {
        category: 'photo',
        maxBytes: 120 * 1024,
      });

      expect(result.optimizedSize).toBeLessThanOrEqual(120 * 1024);
      expect(result.passedConstraint).toBe(true);
      expect(isJpegBytes(result.buffer)).toBe(true);
    });

    it('9. should return structured failure and reject staging when image cannot be reduced sufficiently', async () => {
      const img = await createSyntheticImage({ width: 500, height: 500, color: 0xFFFFFFFF, mime: 'image/png' });
      
      // Impossible ceiling: 10 bytes
      await expect(optimizeImageBufferNode(img, {
        maxBytes: 10,
      })).rejects.toThrow(/unable to reduce photo below conservative safe upload limit/);

      // Test structured failure object when throwOnFailure is false
      const failedResult = await optimizeImageBufferNode(img, {
        maxBytes: 10,
        throwOnFailure: false,
      });
      expect(failedResult.success).toBe(false);
      expect(failedResult.passedConstraint).toBe(false);
      expect(failedResult.error).toContain('unable to reduce');
    });

    it('10. should handle corrupt or unsupported image buffers gracefully', async () => {
      await expect(optimizeImageBufferNode(Buffer.from([]))).rejects.toThrow(/Invalid or empty/);
      await expect(optimizeImageBufferNode(null)).rejects.toThrow(/Invalid or empty/);
      
      const corruptedBytes = Buffer.from('NOT_AN_IMAGE_RANDOM_TEXT_DATA_CORRUPT');
      await expect(optimizeImageBufferNode(corruptedBytes)).rejects.toThrow(/Failed to decode image/);
    });

    it('11. should enforce genuine JPEG MIME type and magic bytes on all outputs', async () => {
      const img = await createSyntheticImage({ width: 300, height: 300, color: 0x334455FF, mime: 'image/png' });
      const result = await optimizeImageBufferNode(img);

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer[0]).toBe(0xFF);
      expect(result.buffer[1]).toBe(0xD8);
      expect(result.buffer[2]).toBe(0xFF);
    });

    it('12. should prevent oversized files from passing the upload validation boundary', () => {
      const oversizedBytes = MAX_PORTAL_IMAGE_BYTES + 5000;
      const validation = validatePortalImageSize(oversizedBytes);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('safe upload limit');
    });

    it('13. should apply identical 194,560 byte ceiling to both photographs and signatures', async () => {
      const photoImg = await createSyntheticImage({ width: 600, height: 600, color: 0x112233FF, mime: 'image/png' });
      const sigImg = await createSyntheticImage({ width: 600, height: 200, color: 0x445566FF, mime: 'image/png' });

      const photoRes = await optimizeImageBufferNode(photoImg, { category: 'photo' });
      const sigRes = await optimizeImageBufferNode(sigImg, { category: 'signature' });

      expect(photoRes.optimizedSize).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
      expect(sigRes.optimizedSize).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
      expect(photoRes.passedConstraint).toBe(true);
      expect(sigRes.passedConstraint).toBe(true);
    });

    it('14. should leave the original source image buffer completely untouched', async () => {
      const originalBuf = await createSyntheticImage({ width: 400, height: 400, color: 0x998877FF, mime: 'image/png' });
      const originalSnapshot = Buffer.from(originalBuf);

      await optimizeImageBufferNode(originalBuf, { category: 'photo' });

      // Verify original buffer was never mutated
      expect(Buffer.compare(originalBuf, originalSnapshot)).toBe(0);
    });
  });
});
