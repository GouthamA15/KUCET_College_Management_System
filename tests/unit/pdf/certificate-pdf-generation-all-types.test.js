import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import BonafideCertificatePDF from '@/pdf/templates/BonafideCertificatePDF';
import OrdinaryBonafidePDF from '@/pdf/templates/OrdinaryBonafidePDF';
import CustodianCertificatePDF from '@/pdf/templates/CustodianCertificatePDF';
import StudyConductCertificatePDF from '@/pdf/templates/StudyConductCertificatePDF';
import MigrationCertificatePDF from '@/pdf/templates/MigrationCertificatePDF';
import CourseCompletionCertificatePDF from '@/pdf/templates/CourseCompletionCertificatePDF';
import IncomeTaxCertificatePDF from '@/pdf/templates/IncomeTaxCertificatePDF';
import TransferCertificatePDF from '@/pdf/templates/TransferCertificatePDF';
import NoObjectionCertificatePDF from '@/pdf/templates/NoObjectionCertificatePDF';

import { resolveAcademicClassification } from '@/lib/academicClassification';

const placeholderImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function renderToBuffer(doc) {
  const stream = await pdf(doc).toBuffer();
  if (Buffer.isBuffer(stream)) return stream;
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getPdfInfo(buffer) {
  const tmpPath = path.join(os.tmpdir(), `test-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    const output = execSync(`pdfinfo "${tmpPath}"`).toString();
    const pagesMatch = output.match(/Pages:\s+(\d+)/);
    const sizeMatch = output.match(/Page size:\s+([^\n]+)/);
    return {
      pages: pagesMatch ? parseInt(pagesMatch[1], 10) : null,
      pageSize: sizeMatch ? sizeMatch[1].trim() : null,
    };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_cleanupErr) {
      // Ignored
    }
  }
}

function getPdfText(buffer) {
  const tmpPath = path.join(os.tmpdir(), `test-pdf-text-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmpPath, buffer);
  try {
    return execSync(`pdftotext "${tmpPath}" -`).toString().replace(/\s+/g, ' ');
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_cleanupErr) {
      // Ignored
    }
  }
}

describe('Certificate Formats, PDF Quality & Regular vs Lateral Student Compatibility', () => {
  const common = {
    certId: 'KUCET-98A7B6C5',
    date: '09/11/2026',
    fatherName: 'Venkat Rao',
    academicYear: '2026-27',
    casteDisplay: 'BC-B',
    category: 'BC-B',
    subCaste: 'Perika',
    logoUrl: placeholderImg,
    signatureUrl: placeholderImg,
    qrUrl: placeholderImg,
  };

  describe('1. Regular Entry Students (4-Year Track)', () => {
    it('generates valid Ordinary Bonafide PDF for Regular Year 1 CSE student without attendance percentage', async () => {
      const data = {
        ...common,
        studentName: 'Rahul Sharma',
        admissionNo: '26567T0912',
        course: 'CSE',
        year: 'I (FIRST)',
        semester: 'I (FIRST)',
        purpose: 'Bus Pass Application',
      };

      const buffer = await renderToBuffer(React.createElement(OrdinaryBonafidePDF, data));
      expect(buffer.length).toBeGreaterThan(1000);

      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1); // Must fit cleanly on exactly 1 page

      const text = getPdfText(buffer);
      expect(text).toContain('BONAFIDE CERTIFICATE');
      expect(text).toContain('Rahul Sharma');
      expect(text).toContain('Venkat Rao');
      expect(text).toContain('26567T0912');
      expect(text).toContain('I (FIRST) Year Semester I (FIRST)');
      expect(text).toContain('branch CSE');
      expect(text).toContain('2026-27');
      expect(text).toContain('Bus Pass Application');
      expect(text).not.toContain('percentage of attendance');
    });

    it('generates valid Ordinary Bonafide PDF for Regular Year 1 ECE student', async () => {
      const data = {
        ...common,
        studentName: 'Deepak Varma',
        admissionNo: '26567T1522',
        course: 'ECE',
        year: 'I (FIRST)',
        semester: 'I (FIRST)',
        purpose: 'Metro Student Concession',
      };

      const buffer = await renderToBuffer(React.createElement(OrdinaryBonafidePDF, data));
      const text = getPdfText(buffer);
      expect(text).toContain('Deepak Varma');
      expect(text).toContain('26567T1522');
      expect(text).toContain('branch ECE');
      expect(text).toContain('Metro Student Concession');
    });

    it('generates valid Percentage Bonafide PDF for Regular Year 3 CSE student with attendance percentage', async () => {
      const data = {
        ...common,
        studentName: 'Anil Kumar',
        admissionNo: '24567T0925',
        course: 'CSE',
        year: 'III (THIRD)',
        semester: 'V (FIFTH)',
        attendancePercentage: '84.5%',
        purpose: 'Passport Application',
      };

      const buffer = await renderToBuffer(React.createElement(BonafideCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('BONAFIDE CERTIFICATE');
      expect(text).toContain('Anil Kumar');
      expect(text).toContain('24567T0925');
      expect(text).toContain('III (THIRD) Year Semester V (FIFTH)');
      expect(text).toContain('branch CSE');
      expect(text).toContain('Passport Application');
      expect(text).toContain('percentage of attendance is 84.5%');
    });
  });

  describe('2. Lateral Entry Students (3-Year Track, Enters Curricular Year 2)', () => {
    it('classifies Lateral CSE newly admitted student as Curricular Year 2 / Sem 3 with ORDINARY format', () => {
      const classification = resolveAcademicClassification({
        rollNo: '26567T0901L',
        academicYear: '2026-27',
        studySemester: 3,
      });

      expect(classification.isValid).toBe(true);
      expect(classification.admissionType).toBe('Lateral');
      expect(classification.yearsAtKucet).toBe(1); // 1st year at KUCET
      expect(classification.studyYear).toBe(2);   // Curricular Year 2
      expect(classification.studySemester).toBe(3);
      expect(classification.certificateFormat).toBe('ORDINARY');
      expect(classification.isFirstYearAtKucet).toBe(true);
    });

    it('generates valid Ordinary Bonafide PDF for Lateral CSE student in Curricular Year 2', async () => {
      const data = {
        ...common,
        studentName: 'Priya Patel',
        admissionNo: '26567T0901L',
        course: 'CSE',
        year: 'II (SECOND)',
        semester: 'III (THIRD)',
        purpose: 'State Fee Reimbursement',
      };

      const buffer = await renderToBuffer(React.createElement(OrdinaryBonafidePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('BONAFIDE CERTIFICATE');
      expect(text).toContain('Priya Patel');
      expect(text).toContain('26567T0901L');
      expect(text).toContain('II (SECOND) Year Semester III (THIRD)');
      expect(text).toContain('branch CSE');
      expect(text).toContain('State Fee Reimbursement');
      expect(text).not.toContain('percentage of attendance');
    });

    it('generates valid Ordinary Bonafide PDF for Lateral ECE student in Curricular Year 2', async () => {
      const data = {
        ...common,
        studentName: 'Sanjay Rathod',
        admissionNo: '26567T1504L',
        course: 'ECE',
        year: 'II (SECOND)',
        semester: 'III (THIRD)',
        purpose: 'Hostel Admission',
      };

      const buffer = await renderToBuffer(React.createElement(OrdinaryBonafidePDF, data));
      const text = getPdfText(buffer);
      expect(text).toContain('Sanjay Rathod');
      expect(text).toContain('26567T1504L');
      expect(text).toContain('branch ECE');
      expect(text).toContain('II (SECOND) Year Semester III (THIRD)');
    });

    it('classifies Lateral ECE in 2nd year at KUCET (Curricular Year 3) as PERCENTAGE format', () => {
      const classification = resolveAcademicClassification({
        rollNo: '25567T1502L',
        academicYear: '2026-27',
        studySemester: 5,
      });

      expect(classification.isValid).toBe(true);
      expect(classification.admissionType).toBe('Lateral');
      expect(classification.yearsAtKucet).toBe(2); // 2nd year at KUCET
      expect(classification.studyYear).toBe(3);   // Curricular Year 3
      expect(classification.studySemester).toBe(5);
      expect(classification.certificateFormat).toBe('PERCENTAGE');
      expect(classification.isFirstYearAtKucet).toBe(false);
    });

    it('generates valid Percentage Bonafide PDF for Lateral student in Curricular Year 3', async () => {
      const data = {
        ...common,
        studentName: 'Sneha Reddy',
        admissionNo: '25567T1502L',
        course: 'ECE',
        year: 'III (THIRD)',
        semester: 'V (FIFTH)',
        attendancePercentage: '79.2%',
        purpose: 'Education Loan Renewal',
      };

      const buffer = await renderToBuffer(React.createElement(BonafideCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('Sneha Reddy');
      expect(text).toContain('25567T1502L');
      expect(text).toContain('III (THIRD) Year Semester V (FIFTH)');
      expect(text).toContain('branch ECE');
      expect(text).toContain('percentage of attendance is 79.2%');
    });
  });

  describe('3. Other Institutional Certificates Lifecycle', () => {
    it('generates valid No Objection Certificate (NOC) with internship dates and purpose', async () => {
      const data = {
        ...common,
        studentName: 'Vikram Singh',
        admissionNo: '23567T0940',
        course: 'CSE',
        year: 'IV (FOURTH)',
        semester: 'VII (SEVENTH)',
        purpose: 'Industrial Internship at DRDO Research Center',
        fromDate: '01/12/2026',
        toDate: '31/01/2027',
      };

      const buffer = await renderToBuffer(React.createElement(NoObjectionCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('NO OBJECTION CERTIFICATE');
      expect(text).toContain('Vikram Singh');
      expect(text).toContain('23567T0940');
      expect(text).toContain('branch CSE');
      expect(text).toContain('Industrial Internship at DRDO Research Center');
      expect(text).toContain('from 01/12/2026 to 31/01/2027');
    });

    it('generates valid Custodian Certificate', async () => {
      const data = {
        ...common,
        studentName: 'Kavitha Devi',
        admissionNo: '24567T1205',
        course: 'EEE',
        year: 'III (THIRD)',
        semester: 'V (FIFTH)',
        hallTicket: '24567T1205',
      };

      const buffer = await renderToBuffer(React.createElement(CustodianCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('CUSTODIAN CERTIFICATE');
      expect(text).toContain('Kavitha Devi');
      expect(text).toContain('24567T1205');
    });

    it('generates valid Study Conduct Certificate', async () => {
      const data = {
        ...common,
        studentName: 'Manoj Kumar',
        admissionNo: '23567T0012',
        course: 'CIVIL',
        conduct: 'Exemplary',
      };

      const buffer = await renderToBuffer(React.createElement(StudyConductCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('STUDY & CONDUCT CERTIFICATE');
      expect(text).toContain('Manoj Kumar');
      expect(text).toContain('Exemplary');
    });

    it('generates valid Migration Certificate', async () => {
      const data = {
        ...common,
        studentName: 'Ramesh Babu',
        admissionNo: '22567T0318',
        course: 'MECH',
        reason: 'Higher Studies Abroad',
      };

      const buffer = await renderToBuffer(React.createElement(MigrationCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('MIGRATION CERTIFICATE');
      expect(text).toContain('Ramesh Babu');
    });

    it('generates valid Course Completion Certificate', async () => {
      const data = {
        ...common,
        studentName: 'Suresh Raina',
        admissionNo: '22567T0950',
        course: 'CSE',
        aggCgpa: '8.45',
        completionYear: 2026,
      };

      const buffer = await renderToBuffer(React.createElement(CourseCompletionCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('COURSE COMPLETION CERTIFICATE');
      expect(text).toContain('Suresh Raina');
      expect(text).toContain('8.45');
    });

    it('generates valid Income Tax (IT) Certificate', async () => {
      const data = {
        ...common,
        studentName: 'Deepa Rani',
        admissionNo: '25567T1808',
        course: 'IT',
        year: 'II (SECOND)',
        semester: 'III (THIRD)',
        feeAmount: '35,000/- (Rupees Thirty-five Thousand only)',
        purpose: 'Father IT Exemption 80C',
      };

      const buffer = await renderToBuffer(React.createElement(IncomeTaxCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('FEE PARTICULARS');
      expect(text).toContain('TO WHOMSOEVER IT MAY CONCERN');
      expect(text).toContain('Deepa Rani');
      expect(text).toContain('35,000/-');
      expect(text).toContain('Father IT Exemption 80C');
    });

    it('generates valid Transfer Certificate (TC)', async () => {
      const data = {
        ...common,
        studentName: 'Naresh Kumar',
        admissionNo: '22567T0930',
        course: 'CSE',
        conduct: 'Good',
        reason: 'Course Completed',
        admissionDate: '01/09/2022',
        leavingDate: '30/06/2026',
      };

      const buffer = await renderToBuffer(React.createElement(TransferCertificatePDF, data));
      const info = getPdfInfo(buffer);
      expect(info.pages).toBe(1);

      const text = getPdfText(buffer);
      expect(text).toContain('TRANSFER CERTIFICATE');
      expect(text).toContain('Naresh Kumar');
      expect(text).toContain('Good');
    });
  });
});
