import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import IDCardPDF from '@/pdf/templates/IDCardPDF';

describe('PDF Optical QR Code Extraction and Decoding', () => {
  let tmpDir;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-qr-test-'));
  });

  const mockStudent = {
    id: 101,
    rollNo: '24567T0942',
    roll_no: '24567T0942',
    studentName: 'GOUTHAM ANKAPOOR',
    name: 'GOUTHAM ANKAPOOR',
    fatherName: 'SRINIVAS',
    father_name: 'SRINIVAS',
    course: 'B.TECH',
    branch: 'COMPUTER SCIENCE & ENGINEERING',
    valid_upto: '2028-06-30',
    validUpto: '2028-06-30',
    mobile: '9876543210',
    studentPhone: '9876543210',
    address: 'H NO 1-2-3, WARANGAL, TELANGANA - 506001',
    emergency_contact: '9876543210',
    dob: '2004-05-15',
    blood_group: 'O+',
    bloodGroup: 'O+',
    identification_marks_1: 'MOLE ON RIGHT CHEEK',
    identification_marks_2: 'MOLE ON LEFT SHOULDER',
    photo_url: null,
  };

  async function generateAndExtractQRFromPDF(qrMode) {
    const qrUrl = await IDCardDataService.generateQRDataUrlForMode(mockStudent, qrMode, 'https://kucet.ac.in');

    const pdfElement = React.createElement(IDCardPDF, {
      studentName: mockStudent.studentName,
      fatherName: mockStudent.fatherName,
      admissionNo: mockStudent.rollNo,
      course: mockStudent.branch,
      batch: '2024-2028',
      address: mockStudent.address,
      mobile: mockStudent.mobile,
      pfpUrl: null,
      logoUrl: null,
      signatureUrl: null,
      qrUrl: qrUrl,
    });

    const stream = await pdf(pdfElement).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);

    const pdfPath = path.join(tmpDir, `card-${qrMode}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Page 1 contains the ID card with photo, details, and QR code
    const prefix = path.join(tmpDir, `page-${qrMode}`);
    execSync(`pdftoppm -png -r 300 -f 1 -l 1 "${pdfPath}" "${prefix}"`);
    const pageImage = `${prefix}-1.png`;

    expect(fs.existsSync(pageImage)).toBe(true);

    // Optically scan the rendered PDF page with zbarimg
    const zbarOutput = execSync(`zbarimg --raw "${pageImage}"`, { encoding: 'utf-8' });
    return zbarOutput.trim();
  }

  it('renders standard ID card PDF and extracts full 14-line QR payload optically', async () => {
    const decoded = await generateAndExtractQRFromPDF('standard');
    expect(decoded).toContain('HALL-TICKET-NO : 24567T0942');
    expect(decoded).toContain('NAME : GOUTHAM ANKAPOOR');
    expect(decoded).toContain('COURSE : B.TECH');
    expect(decoded).toContain('BRANCH : COMPUTER SCIENCE & ENGINEERING');
  });

  it('renders Module A PDF and extracts exactly the 10-char roll number optically', async () => {
    const decoded = await generateAndExtractQRFromPDF('roll_number');
    expect(decoded).toBe('24567T0942');
    expect(decoded.length).toBe(10);
  });

  it('renders Module B PDF and extracts the complete public verification URL optically', async () => {
    const decoded = await generateAndExtractQRFromPDF('public_url');
    expect(decoded).toBe('https://kucet.ac.in/public/student/24567T0942');
  });
});
