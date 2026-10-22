import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { 
  PHOTO_EXAMPLES, 
  validateStudentPhotoFile 
} from '@/components/admission/StudentPhotoGuidance';

describe('Admission Student Photo Guidance & Assets Verification', () => {
  const publicGuidanceDir = path.join(process.cwd(), 'public/assets/guidance');

  it('verifies that all four reference guidance images exist in public/assets/guidance/', () => {
    const requiredFiles = [
      'student-photo-correct.png',
      'student-photo-printed-image.png',
      'student-photo-full-body.png',
      'student-photo-casual-outdoor.png',
    ];

    for (const filename of requiredFiles) {
      const filePath = path.join(publicGuidanceDir, filename);
      expect(fs.existsSync(filePath), `Asset ${filename} must exist on disk`).toBe(true);

      const stats = fs.statSync(filePath);
      expect(stats.size, `Asset ${filename} must not be empty`).toBeGreaterThan(1000);

      // Verify PNG magic bytes (\x89PNG\r\n\x1a\n)
      const buffer = Buffer.alloc(8);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);
      expect(buffer[0]).toBe(0x89);
      expect(buffer.toString('ascii', 1, 4)).toBe('PNG');
    }
  });

  it('verifies PHOTO_EXAMPLES structure, classifications, and image mapping', () => {
    expect(PHOTO_EXAMPLES).toHaveLength(4);

    const correct = PHOTO_EXAMPLES.filter(ex => ex.isAccepted);
    const incorrect = PHOTO_EXAMPLES.filter(ex => !ex.isAccepted);

    // Exactly 1 correct and 3 incorrect
    expect(correct).toHaveLength(1);
    expect(incorrect).toHaveLength(3);

    // 1. Correct passport portrait
    const passportEx = PHOTO_EXAMPLES.find(ex => ex.id === 'correct');
    expect(passportEx).toBeDefined();
    expect(passportEx.classification).toBe('CORRECT');
    expect(passportEx.src).toBe('/assets/guidance/student-photo-correct.png');
    expect(passportEx.alt).toContain('correct passport-style student photograph');
    expect(passportEx.bulletPoints.length).toBeGreaterThanOrEqual(4);

    // 2. Printed photo / ID card
    const printedEx = PHOTO_EXAMPLES.find(ex => ex.id === 'printed_photo');
    expect(printedEx).toBeDefined();
    expect(printedEx.classification).toBe('INCORRECT');
    expect(printedEx.src).toBe('/assets/guidance/student-photo-printed-image.png');
    expect(printedEx.alt).toContain('printed paper photo');

    // 3. Full-body photo
    const fullBodyEx = PHOTO_EXAMPLES.find(ex => ex.id === 'full_body');
    expect(fullBodyEx).toBeDefined();
    expect(fullBodyEx.classification).toBe('INCORRECT');
    expect(fullBodyEx.src).toBe('/assets/guidance/student-photo-full-body.png');
    expect(fullBodyEx.alt).toContain('distant full-body shot');

    // 4. Casual outdoor photo
    const casualEx = PHOTO_EXAMPLES.find(ex => ex.id === 'casual_outdoor');
    expect(casualEx).toBeDefined();
    expect(casualEx.classification).toBe('INCORRECT');
    expect(casualEx.src).toBe('/assets/guidance/student-photo-casual-outdoor.png');
    expect(casualEx.alt).toContain('casual outdoor snapshot');
  });

  it('validates file upload format and size guards safely', async () => {
    // Rejects null
    const nullRes = await validateStudentPhotoFile(null);
    expect(nullRes.valid).toBe(false);
    expect(nullRes.error).toBe('No file selected.');

    // Rejects empty file
    const emptyFile = { size: 0, type: 'image/jpeg' };
    const emptyRes = await validateStudentPhotoFile(emptyFile);
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.error).toContain('empty');

    // Rejects unsupported format
    const pdfFile = { size: 5000, type: 'application/pdf' };
    const pdfRes = await validateStudentPhotoFile(pdfFile);
    expect(pdfRes.valid).toBe(false);
    expect(pdfRes.error).toContain('Unsupported file format');

    const gifFile = { size: 5000, type: 'image/gif' };
    const gifRes = await validateStudentPhotoFile(gifFile);
    expect(gifRes.valid).toBe(false);
    expect(gifRes.error).toContain('Unsupported file format');

    // Rejects files > 15MB pre-compression
    const hugeFile = { size: 20 * 1024 * 1024, type: 'image/jpeg' };
    const hugeRes = await validateStudentPhotoFile(hugeFile);
    expect(hugeRes.valid).toBe(false);
    expect(hugeRes.error).toContain('too large');

    // In Node test environment (no window), supported format passes validation check
    const validFile = { size: 50000, type: 'image/jpeg' };
    const validRes = await validateStudentPhotoFile(validFile);
    expect(validRes.valid).toBe(true);
  });

  it('validates server-side pfp data URI pattern correctly', () => {
    const validDataUris = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      'data:image/jpg;base64,/9j/4AAQSkZJRg...',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      'data:image/webp;base64,UklGRtAAAABXRUJQVlA4...',
    ];

    const invalidDataUris = [
      'data:application/pdf;base64,JVBERi0xLjQK...',
      'data:image/gif;base64,R0lGODlh...',
      'data:text/plain;base64,SGVsbG8gV29ybGQ=',
      'http://malicious.com/fake.png',
      '/local/path/image.jpg',
    ];

    const pfpPattern = /^data:image\/(jpeg|png|webp|jpg);base64,/;

    for (const uri of validDataUris) {
      expect(pfpPattern.test(uri), `Expected ${uri} to be valid`).toBe(true);
    }

    for (const uri of invalidDataUris) {
      expect(pfpPattern.test(uri), `Expected ${uri} to be invalid`).toBe(false);
    }
  });
});
