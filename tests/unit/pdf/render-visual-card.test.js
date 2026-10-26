import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF from '@/pdf/templates/IDCardPDF';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import sharp from 'sharp';

describe('Render & Visual Verification of ID Card', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `kucet-idcard-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Safe cleanup ignore
      }
    }
  });

  it('renders realistic ID card to PDF and converts to PNG for optical scanning verification', async () => {
    // Realistic synthetic student fixture
    const testStudent = {
      id: 101,
      rollNo: '26567T0901',
      admissionNo: '26567T0901',
      studentName: 'ADEPU SUCHARITHA',
      fatherName: 'ADEPU RAMAKRISHNA',
      branch: 'CSE',
      batch: '2026-2030',
      courseDisplay: 'B.Tech (CSE)',
      studentPhone: '9059084844',
      studentAddress: '16-1-559/2/A/1, Warangal, Kareemabad, SRR Thota, Telangana, 506002',
      bloodGroup: 'O+',
      admissionDate: '2026-08-01',
      studentStatus: 'ACTIVE',
    };

    // 1. Generate QR code
    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(testStudent);
    expect(qrUrl).toBeDefined();

    // 2. Generate sample photo (90x110)
    const samplePhotoBuf = await sharp({
      create: {
        width: 90,
        height: 110,
        channels: 4,
        background: { r: 11, g: 53, b: 120, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const pfpUrl = `data:image/png;base64,${samplePhotoBuf.toString('base64')}`;

    // 3. Read real college logo
    const logoPath = path.resolve(process.cwd(), 'public/assets/ku-college-logo.png');
    let logoUrl = null;
    if (fs.existsSync(logoPath)) {
      const logoBuf = fs.readFileSync(logoPath);
      logoUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
    }

    // 4. Principal signature
    const sigPath = path.resolve(process.cwd(), 'ChatGPT Image Oct 22, 2026, 03_02_17 PM.png');
    let signatureUrl = null;
    if (fs.existsSync(sigPath)) {
      const sigBuf = fs.readFileSync(sigPath);
      signatureUrl = `data:image/png;base64,${sigBuf.toString('base64')}`;
    }

    // 5. Render PDF
    const doc = React.createElement(IDCardPDF, {
      studentName: testStudent.studentName,
      fatherName: testStudent.fatherName,
      admissionNo: testStudent.rollNo,
      course: testStudent.branch,
      batch: testStudent.batch,
      address: testStudent.studentAddress,
      mobile: testStudent.studentPhone,
      pfpUrl,
      logoUrl,
      signatureUrl,
      qrUrl,
    });

    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);

    const pdfPath = path.join(tempDir, 'id_card_preview.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(fs.statSync(pdfPath).size).toBeGreaterThan(1000);

    // 6. Convert PDF to 300 DPI PNG using pdftoppm if available
    let hasPdftoppm = false;
    try {
      execSync('command -v pdftoppm', { stdio: 'ignore' });
      hasPdftoppm = true;
    } catch {
      hasPdftoppm = false;
    }

    if (hasPdftoppm) {
      const pngPrefix = path.join(tempDir, 'id_card_preview');
      execSync(`pdftoppm -png -r 300 "${pdfPath}" "${pngPrefix}"`);

      const generatedPng = `${pngPrefix}-1.png`;
      expect(fs.existsSync(generatedPng)).toBe(true);

      // 7. Verify optical scannability with zbarimg directly on the complete rendered ID card!
      let hasZbar = false;
      try {
        execSync('command -v zbarimg', { stdio: 'ignore' });
        hasZbar = true;
      } catch {
        hasZbar = false;
      }

      if (hasZbar) {
        const zbarOut = execSync(`zbarimg -q "${generatedPng}"`).toString();
        expect(zbarOut).toContain('QR-Code:');
        expect(zbarOut).toContain('26567T0901');
        expect(zbarOut).toContain('KUCET_STUDENT_ID');
        expect(zbarOut).toContain('ADEPU SUCHARITHA');
      }
    }
  });
});
