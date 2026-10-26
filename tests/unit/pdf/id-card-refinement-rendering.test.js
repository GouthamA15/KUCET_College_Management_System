import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF, { BulkIDCardPDF, IDCardPage } from '@/pdf/templates/IDCardPDF';

describe('Student ID Card Refinement — Visual, Border, Typography & Layout Suite', () => {
  const sampleStudent = {
    studentName: 'ADEPU SUCHARITHA',
    fatherName: 'ADEPU RAMAKRISHNA',
    admissionNo: '26567T0901',
    course: 'CSE',
    batch: '2026-2030',
    address: '16-1-559/2/A/1, WARANGAL, KAREEMABAD, SRR THOTA, TELANGANA, 506002',
    mobile: '9059084844',
    pfpUrl: null,
    logoUrl: null,
    signatureUrl: null,
    qrUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };

  it('1. verifies outer rounded border with Kakatiya Navy styling and inner corner clipping', () => {
    const pageElement = IDCardPage(sampleStudent);
    expect(pageElement).toBeDefined();

    const container = pageElement.props.children;
    expect(container.props.style.border).toBe('1.2pt solid #0b3578');
    expect(container.props.style.borderRadius).toBe(12);
    expect(container.props.style.overflow).toBe('hidden');

    // Logo section has matching inner radius
    const headerLogoSection = container.props.children[0];
    expect(headerLogoSection.props.style.borderTopLeftRadius).toBe(10.5);
    expect(headerLogoSection.props.style.borderBottomRightRadius).toBe(20);
  });

  it('2. verifies header college name does not split TECHNOLOGY across lines', () => {
    const pageElement = IDCardPage(sampleStudent);
    const container = pageElement.props.children;
    const headerTextSection = container.props.children[1];
    
    // Check college name text node
    const collegeNameNode = headerTextSection.props.children[1];
    expect(collegeNameNode.props.style.fontSize).toBe(7.2);
    expect(collegeNameNode.props.style.color).toBe('#0b3578');
    expect(collegeNameNode.props.children).toBe('KU COLLEGE OF ENGINEERING\n& TECHNOLOGY');
    expect(collegeNameNode.props.children).not.toMatch(/TECH-[\r\n]NOLOGY/);
  });

  it('3. verifies QR code size is enlarged to 82x82pt with high contrast and square aspect ratio', () => {
    const pageElement = IDCardPage(sampleStudent);
    const container = pageElement.props.children;
    // Row 6: QR Code & Principal Signature
    const bottomRow = container.props.children[6];
    const qrBox = bottomRow.props.children[0];

    expect(qrBox.props.style.width).toBe(82);
    expect(qrBox.props.style.height).toBe(82);
    expect(qrBox.props.style.padding).toBe(2);
    expect(qrBox.props.style.backgroundColor).toBe('#ffffff');
  });

  it('4. verifies bottom address block font size is enlarged and positioned upward into main card content', () => {
    const pageElement = IDCardPage(sampleStudent);
    const container = pageElement.props.children;
    // Section 7: Address & Contact
    const footerSection = container.props.children[7];

    expect(footerSection.props.style.marginTop).toBe(5);
    expect(footerSection.props.style.marginTop).not.toBe('auto');
    expect(footerSection.props.style.borderTop).toBeUndefined();

    const addressText = footerSection.props.children[0];
    const cellText = footerSection.props.children[1];

    expect(addressText.props.style.fontSize).toBe(9);
    expect(addressText.props.style.fontWeight).toBe('bold');
    expect(cellText.props.style.fontSize).toBe(9.5);
    expect(cellText.props.style.fontWeight).toBe('black');
  });

  it('5. successfully generates a valid PDF stream for single and bulk ID cards', async () => {
    const doc = React.createElement(IDCardPDF, sampleStudent);
    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);

    expect(pdfBuffer.length).toBeGreaterThan(500);

    // Bulk PDF
    const bulkDoc = React.createElement(BulkIDCardPDF, {
      students: [sampleStudent, { ...sampleStudent, admissionNo: '26567T0902' }],
    });
    const bulkStream = await pdf(bulkDoc).toBuffer();
    const bulkChunks = [];
    for await (const chunk of bulkStream) bulkChunks.push(chunk);
    const bulkBuffer = Buffer.concat(bulkChunks);

    expect(bulkBuffer.length).toBeGreaterThan(pdfBuffer.length);
  });
});
