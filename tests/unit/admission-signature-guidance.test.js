import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { 
  SIGNATURE_EXAMPLES, 
  validateStudentSignatureFile 
} from '@/components/admission/StudentSignatureGuidance';
import { STATIC_ASSETS } from '@/lib/assets';

describe('Admission Student Signature Guidance & Assets Verification', () => {
  const publicGuidanceDir = path.join(process.cwd(), 'public/assets/guidance');

  it('verifies that all four reference signature guidance images exist in public/assets/guidance/', () => {
    const requiredFiles = [
      'student-signature-acceptable-1.png',
      'student-signature-acceptable-2.png',
      'student-signature-incorrect-crop.png',
      'student-signature-incorrect-orientation.png',
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

  it('verifies all 4 signature assets are registered in STATIC_ASSETS set', () => {
    const requiredUrls = [
      '/assets/guidance/student-signature-acceptable-1.png',
      '/assets/guidance/student-signature-acceptable-2.png',
      '/assets/guidance/student-signature-incorrect-crop.png',
      '/assets/guidance/student-signature-incorrect-orientation.png',
    ];

    for (const url of requiredUrls) {
      expect(STATIC_ASSETS.has(url), `STATIC_ASSETS must contain ${url}`).toBe(true);
    }
  });

  it('verifies SIGNATURE_EXAMPLES structure, classifications, and image mapping', () => {
    expect(SIGNATURE_EXAMPLES).toHaveLength(4);

    const acceptable = SIGNATURE_EXAMPLES.filter(ex => ex.isAccepted);
    const unacceptable = SIGNATURE_EXAMPLES.filter(ex => !ex.isAccepted);

    // Exactly 2 acceptable and 2 unacceptable
    expect(acceptable).toHaveLength(2);
    expect(unacceptable).toHaveLength(2);

    // 1. Acceptable 1: Clear signature
    const ex1 = SIGNATURE_EXAMPLES.find(ex => ex.id === 'acceptable_clear');
    expect(ex1).toBeDefined();
    expect(ex1.classification).toBe('ACCEPTABLE');
    expect(ex1.title).toBe('ACCEPTABLE — Clear signature');
    expect(ex1.src).toBe('/assets/guidance/student-signature-acceptable-1.png');
    expect(ex1.alt).toContain('acceptable clear student signature');
    expect(ex1.bulletPoints.length).toBeGreaterThanOrEqual(4);

    // 2. Acceptable 2: Properly framed signature
    const ex2 = SIGNATURE_EXAMPLES.find(ex => ex.id === 'acceptable_framed');
    expect(ex2).toBeDefined();
    expect(ex2.classification).toBe('ACCEPTABLE');
    expect(ex2.title).toBe('ACCEPTABLE — Properly framed signature');
    expect(ex2.src).toBe('/assets/guidance/student-signature-acceptable-2.png');
    expect(ex2.alt).toContain('acceptable properly framed student signature');

    // 3. Incorrect 1: Incorrect cropping
    const ex3 = SIGNATURE_EXAMPLES.find(ex => ex.id === 'incorrect_crop');
    expect(ex3).toBeDefined();
    expect(ex3.classification).toBe('NOT ACCEPTABLE');
    expect(ex3.title).toBe('NOT ACCEPTABLE — Incorrect cropping');
    expect(ex3.src).toBe('/assets/guidance/student-signature-incorrect-crop.png');
    expect(ex3.alt).toContain('incorrectly cropped signature');
    expect(ex3.summary).toContain('Upload the complete signature with appropriate margins');

    // 4. Incorrect 2: Wrong orientation
    const ex4 = SIGNATURE_EXAMPLES.find(ex => ex.id === 'incorrect_orientation');
    expect(ex4).toBeDefined();
    expect(ex4.classification).toBe('NOT ACCEPTABLE');
    expect(ex4.title).toBe('NOT ACCEPTABLE — Wrong orientation');
    expect(ex4.src).toBe('/assets/guidance/student-signature-incorrect-orientation.png');
    expect(ex4.alt).toContain('wrong orientation signature');
    expect(ex4.summary).toContain('Ensure your signature is upright and correctly oriented');
  });

  it('validates file upload format and size guards safely for signatures', async () => {
    // Rejects null
    const nullRes = await validateStudentSignatureFile(null);
    expect(nullRes.valid).toBe(false);
    expect(nullRes.error).toBe('No signature file selected.');

    // Rejects empty file
    const emptyFile = { size: 0, type: 'image/jpeg' };
    const emptyRes = await validateStudentSignatureFile(emptyFile);
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.error).toContain('empty');

    // Rejects unsupported format
    const pdfFile = { size: 5000, type: 'application/pdf' };
    const pdfRes = await validateStudentSignatureFile(pdfFile);
    expect(pdfRes.valid).toBe(false);
    expect(pdfRes.error).toContain('Unsupported file format');

    // Rejects files > 15MB pre-compression
    const hugeFile = { size: 20 * 1024 * 1024, type: 'image/jpeg' };
    const hugeRes = await validateStudentSignatureFile(hugeFile);
    expect(hugeRes.valid).toBe(false);
    expect(hugeRes.error).toContain('too large');

    // In Node test environment, supported format passes validation check
    const validFile = { size: 50000, type: 'image/jpeg' };
    const validRes = await validateStudentSignatureFile(validFile);
    expect(validRes.valid).toBe(true);
  });

  it('verifies that admission page maintains popup-only interaction and clean main-page invariant', () => {
    const pagePath = path.join(process.cwd(), 'src/app/admission/page.js');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    // Must NOT have permanent PhotoGuidanceGrid rendered on main page
    expect(pageContent).not.toContain('<PhotoGuidanceGrid');

    // Must render on-demand PhotoGuidanceModal and SignatureGuidanceModal
    expect(pageContent).toContain('<PhotoGuidanceModal');
    expect(pageContent).toContain('<SignatureGuidanceModal');

    // Must have triggers for both modals
    expect(pageContent).toContain('setIsPhotoGuidanceModalOpen(true)');
    expect(pageContent).toContain('setIsSignatureGuidanceModalOpen(true)');

    // Must wire file pickers
    expect(pageContent).toContain('pfpInputRef.current?.click()');
    expect(pageContent).toContain('sigInputRef.current?.click()');
  });
});
