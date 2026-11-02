import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { 
  IDCardDataService, 
  buildRollNumberQRPayload, 
  buildPublicIdQRPayload 
} from '@/services/identity/IDCardDataService';
import { extractRollNumberFromQR } from '@/lib/rollNumber';
import { getPublicBaseUrl } from '@/lib/public-url';
import QrCodeReader from 'qrcode-reader';
import sharp from 'sharp';

/**
 * Optical QR decode helper using zbarimg or qrcode-reader
 */
async function decodeQRDataUrl(dataUrl) {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  try {
    const tempFile = path.join(os.tmpdir(), `test-qr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    fs.writeFileSync(tempFile, buffer);
    const zbarOut = execSync(`zbarimg -q "${tempFile}"`, { encoding: 'utf8' });
    try { fs.unlinkSync(tempFile); } catch {}
    return zbarOut.replace(/^QR-Code:/, '').replace(/\r\n/g, '\n').trimEnd();
  } catch {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    return new Promise((resolve, reject) => {
      const qr = new QrCodeReader();
      qr.callback = (err, value) => {
        if (err) return reject(err);
        resolve(value ? value.result : null);
      };
      qr.decode({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
    });
  }
}

describe('Three Distinct Student ID Card Generation Modules Suite', () => {
  const testStudent = {
    id: 101, // Internal DB primary key - must NEVER appear in QR payloads
    slNo: 77,
    rollNo: '24567T0942',
    admissionNo: '24567T0942',
    studentName: 'GOUTHAM ARRA',
    fatherName: 'VENKATESHWARLU',
    branch: 'CSE',
    batch: '2024-2028',
    courseDisplay: 'B.TECH (CSE)',
    studentPhone: '9876543210',
    studentAddress: 'H.No. 1-2-3, Subedari, Hanamkonda, Warangal - 506001',
    bloodGroup: 'O+',
    admissionDate: '2024-08-01',
    studentStatus: 'ACTIVE',
  };

  // ─── MODULE 1: ORIGINAL ID CARD GENERATOR (REGRESSION PRESERVATION) ────────
  describe('Module 1: Original Standard ID Card Generator (Preserved)', () => {
    it('1.1. preserves the exact 14-line human-readable labeled text format', () => {
      const payload = IDCardDataService.generateStudentQRPayload(testStudent);
      const lines = payload.split('\n');

      expect(lines).toHaveLength(14);
      expect(lines[0]).toBe('SL-NO : 77');
      expect(lines[1]).toBe('HALL-TICKET-NO : 24567T0942');
      expect(lines[2]).toBe('NAME : GOUTHAM ARRA');
      expect(lines[3]).toBe('FATHER-S-NAME : VENKATESHWARLU');
      expect(lines[4]).toBe('COURSE : B.TECH (CSE)');
      expect(lines[5]).toBe('ADDRESS : H.No. 1-2-3, Subedari, Hanamkonda, Warangal - 506001');
      expect(lines[6]).toBe('MOBILE-NO : 9876543210');
      expect(lines[7]).toBe('VALID-UPTO- : 2024-2028');
      expect(lines[8]).toBe('BRANCH : CSE');
      expect(lines[9]).toBe('ACADEMIC-YEAR : 2024-2028');
      expect(lines[10]).toBe('ADMISSION-YEAR : 2024');
      expect(lines[11]).toBe('COLLEGE-NAME : KU COLLEGE OF ENGINEERING & TECHNOLOGY');
      expect(lines[12]).toBe('COLLEGE-ADDRESS : Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009');
      expect(lines[13]).toBe('BLOOD-GROUP : O+');
    });

    it('1.2. optically decodes generated Standard QR image into the complete 14 lines', async () => {
      const qrUrl = await IDCardDataService.generateStudentQRDataUrl(testStudent);
      expect(qrUrl).toMatch(/^data:image\/png;base64,/);

      const decoded = await decodeQRDataUrl(qrUrl);
      expect(decoded).toBeDefined();
      expect(decoded.split('\n')).toHaveLength(14);
      expect(decoded).toContain('HALL-TICKET-NO : 24567T0942');
    });

    it('1.3. original QR payload continues to resolve through the attendance scanner', () => {
      const payload = IDCardDataService.generateStudentQRPayload(testStudent);
      const extracted = extractRollNumberFromQR(payload);
      expect(extracted).toBe('24567T0942');
    });
  });

  // ─── MODULE A: ROLL NUMBER QR ID CARD GENERATOR ────────────────────────────
  describe('Module A: Roll Number QR ID Card Generator', () => {
    it('2.1. generates a QR payload containing ONLY the student hall-ticket / roll number', () => {
      const payload = buildRollNumberQRPayload(testStudent);

      // Must be exactly the 10-character roll number
      expect(payload).toBe('24567T0942');

      // Strict negative assertions: NO URL, NO JSON, NO Name, NO DB ID
      expect(payload).not.toContain('http');
      expect(payload).not.toContain('://');
      expect(payload).not.toContain('{');
      expect(payload).not.toContain('}');
      expect(payload).not.toContain('GOUTHAM');
      expect(payload).not.toContain('101'); // Database ID
      expect(payload).not.toContain('SL-NO');
      expect(payload).not.toContain('HALL-TICKET-NO');
    });

    it('2.2. optically decodes generated Module A QR image and verifies strictly the plain roll number', async () => {
      const qrUrl = await IDCardDataService.generateRollNumberQRDataUrl(testStudent);
      expect(qrUrl).toMatch(/^data:image\/png;base64,/);

      const decoded = await decodeQRDataUrl(qrUrl);
      expect(decoded).toBe('24567T0942');
    });

    it('2.3. attendance scanner extracts the roll number from Module A plain roll-number QR', () => {
      const payload = buildRollNumberQRPayload(testStudent);
      const extracted = extractRollNumberFromQR(payload);
      expect(extracted).toBe('24567T0942');
    });

    it('2.4. handles lateral entry roll numbers correctly (e.g. ending in L)', async () => {
      const lateralStudent = {
        ...testStudent,
        rollNo: '255671870L',
        admissionNo: '255671870L',
      };
      const payload = buildRollNumberQRPayload(lateralStudent);
      expect(payload).toBe('255671870L');

      const qrUrl = await IDCardDataService.generateRollNumberQRDataUrl(lateralStudent);
      const decoded = await decodeQRDataUrl(qrUrl);
      expect(decoded).toBe('255671870L');

      const extracted = extractRollNumberFromQR(decoded);
      expect(extracted).toBe('255671870L');
    });
  });

  // ─── MODULE B: PUBLIC STUDENT IDENTIFICATION QR ID CARD GENERATOR ──────────
  describe('Module B: Public Student Identification QR ID Card Generator', () => {
    it('3.1. generates a QR payload containing the public KUCET student identification URL', () => {
      const payload = buildPublicIdQRPayload(testStudent);
      const baseUrl = getPublicBaseUrl();

      expect(payload).toBe(`${baseUrl}/public/student/24567T0942`);
      expect(payload).toMatch(/^https?:\/\/[^/]+\/public\/student\/24567T0942$/);
    });

    it('3.2. respects explicit baseUrl parameter without hardcoding domains', () => {
      const customUrl = buildPublicIdQRPayload(testStudent, 'https://kucet.ac.in');
      expect(customUrl).toBe('https://kucet.ac.in/public/student/24567T0942');

      const localUrl = buildPublicIdQRPayload(testStudent, 'http://localhost:3000');
      expect(localUrl).toBe('http://localhost:3000/public/student/24567T0942');
    });

    it('3.3. optically decodes generated Module B QR image and verifies the public URL', async () => {
      const qrUrl = await IDCardDataService.generatePublicIdQRDataUrl(testStudent, 'https://kucet.ac.in');
      expect(qrUrl).toMatch(/^data:image\/png;base64,/);

      const decoded = await decodeQRDataUrl(qrUrl);
      expect(decoded).toBe('https://kucet.ac.in/public/student/24567T0942');
    });

    it('3.4. attendance scanner resolves roll number from Module B public KUCET URL', () => {
      const publicUrl = 'https://kucet.in/public/student/24567T0942';
      const extracted = extractRollNumberFromQR(publicUrl);
      expect(extracted).toBe('24567T0942');
    });
  });

  // ─── DISPATCHER & INTEGRATION ──────────────────────────────────────────────
  describe('IDCardDataService.generateQRDataUrlForMode Dispatcher', () => {
    it('4.1. correctly generates standard QR when mode is "standard"', async () => {
      const qrUrl = await IDCardDataService.generateQRDataUrlForMode(testStudent, 'standard');
      const decoded = await decodeQRDataUrl(qrUrl);
      expect(decoded).toContain('HALL-TICKET-NO : 24567T0942');
      expect(decoded.split('\n').length).toBe(14);
    });

    it('4.2. correctly generates plain roll number QR when mode is "roll_number"', async () => {
      const qrUrl = await IDCardDataService.generateQRDataUrlForMode(testStudent, 'roll_number');
      const decoded = await decodeQRDataUrl(qrUrl);
      expect(decoded).toBe('24567T0942');
    });

    it('4.3. correctly generates public URL QR when mode is "public_url"', async () => {
      const qrUrl = await IDCardDataService.generateQRDataUrlForMode(testStudent, 'public_url', 'https://kucet.in');
      const decoded = await decodeQRDataUrl(qrUrl);
      expect(decoded).toBe('https://kucet.in/public/student/24567T0942');
    });
  });
});
