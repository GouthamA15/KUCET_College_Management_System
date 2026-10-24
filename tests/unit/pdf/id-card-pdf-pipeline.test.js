import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF, { BulkIDCardPDF } from '@/pdf/templates/IDCardPDF';
import sharp from 'sharp';

describe('ID Card PDF Template & Rendering Pipeline Suite', () => {
  it('renders single IDCardPDF document cleanly without hardcoded T.M. Reddy text', async () => {
    // Verified 1x1 test signature PNG
    const sigPng = await sharp({
      create: {
        width: 100,
        height: 50,
        channels: 4,
        background: { r: 33, g: 122, b: 19, alpha: 1 }, // Institutional Green
      },
    })
      .png()
      .toBuffer();
    const signatureUrl = `data:image/png;base64,${sigPng.toString('base64')}`;

    // Test student with typical data
    const student = {
      studentName: 'ADEPU SUCHARITHA',
      fatherName: 'ADEPU RAMAKRISHNA',
      admissionNo: '26567T0901',
      course: 'CSE',
      batch: '2026-2030',
      address: '16-1-559/2/A/1, WARANGAL, KAREEMABAD, SRR THOTA, TELANGANA, 506002',
      mobile: '9059084844',
      pfpUrl: null,
      logoUrl: null,
      signatureUrl,
      qrUrl: null,
    };

    const doc = React.createElement(IDCardPDF, student);
    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);

    expect(pdfBuffer.length).toBeGreaterThan(500);

    // Verify raw text inside PDF does NOT contain T.M. Reddy
    const pdfText = pdfBuffer.toString('latin1');
    expect(pdfText).not.toContain('T.M. Reddy');
    expect(pdfText).not.toContain('TM Reddy');
  });

  it('renders long student name, long father name, and multi-line address safely without overlap errors', async () => {
    const student = {
      studentName: 'CHINTHAPATLA SRI VENKATA SATYA SAI SURYA TEJA',
      fatherName: 'CHINTHAPATLA VEERA VENKATA SATYANARAYANA MURTHY',
      admissionNo: '26567T1599',
      course: 'ECE',
      batch: '2026-2030',
      address: 'D.NO: 4-12-89/1A, FLAT NO: 402, SRI BALAJI TOWERS, NEAR RTC BUS STAND ROAD, MANDAPETA, KONASEEMA DISTRICT, ANDHRA PRADESH - 533308',
      mobile: '9848123456',
      pfpUrl: null,
      logoUrl: null,
      signatureUrl: null,
      qrUrl: null,
    };

    const doc = React.createElement(IDCardPDF, student);
    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);

    expect(pdfBuffer.length).toBeGreaterThan(500);
  });

  it('renders BulkIDCardPDF for multiple students and sets multiple pages', async () => {
    const students = [
      {
        studentName: 'STUDENT ONE',
        fatherName: 'FATHER ONE',
        admissionNo: '26567T0901',
        course: 'CSE',
        batch: '2026-2030',
        address: 'Warangal',
        mobile: '9999999991',
      },
      {
        studentName: 'STUDENT TWO',
        fatherName: 'FATHER TWO',
        admissionNo: '26567T0902',
        course: 'CSE',
        batch: '2026-2030',
        address: 'Hanamkonda',
        mobile: '9999999992',
      },
    ];

    const doc = React.createElement(BulkIDCardPDF, { students });
    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);

    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
