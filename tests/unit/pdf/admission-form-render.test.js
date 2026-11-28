import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import AdmissionFormPDF from '@/pdf/templates/AdmissionFormPDF';
import { generateAdmissionFormDocx } from '@/lib/admission-form-docx';
import { getInstitutionalLogoBuffer, getInstitutionalLogoDataUrl } from '@/lib/institutional-logo';
import PizZip from 'pizzip';

describe('Admission Form Digitalization Suite', () => {
  it('renders blank official admission form PDF to a valid 1-page buffer', async () => {
    const element = React.createElement(AdmissionFormPDF, { data: {} });
    const buffer = await renderToBuffer(element);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify PDF header
    const pdfStr = buffer.toString('binary');
    expect(pdfStr.startsWith('%PDF-')).toBe(true);

    // Verify single-page invariant: exactly one /Type /Page
    const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g);
    expect(pageMatches).not.toBeNull();
    expect(pageMatches.length).toBe(1);
  });

  it('renders pre-filled admission form PDF with student details and identification marks', async () => {
    const mockStudent = {
      admission_no: 'ADM-2026-901',
      academic_year: '2026 - 2027',
      branch: 'Computer Science & Engineering',
      qualifying_exam: 'TS EAPCET',
      name: 'RAHUL SHARMA',
      father_name: 'VIJAY SHARMA',
      mother_name: 'SUNITHA SHARMA',
      guardian_name: 'N/A',
      date_of_birth: '15-08-2005',
      gender: 'MALE',
      nationality: 'Indian',
      religion: 'Hindu',
      category: 'BC-B',
      sub_caste: 'Goud',
      mother_tongue: 'Telugu',
      place_of_birth: 'Warangal',
      blood_group: 'O+',
      father_occupation: 'Agriculture',
      annual_income: '1,50,000',
      aadhaar_no: '9876-5432-1098',
      student_mobile: '9876543210',
      guardian_mobile: '9876543211',
      email: 'rahul.sharma@example.com',
      identification_mark_1: 'A mole on the right side of the neck',
      identification_mark_2: 'A scar on the left forehead',
      seat_allotted_category: 'BC-B-GEN',
      exam_rank: 4521,
      area_status: 'Local',
      fee_reimbursement: 'YES',
      present_address: 'H.No. 1-2-345, Naimnagar, Hanamkonda, Warangal, Telangana - 506001',
      permanent_address: 'H.No. 1-2-345, Naimnagar, Hanamkonda, Warangal, Telangana - 506001',
    };

    const element = React.createElement(AdmissionFormPDF, { data: mockStudent });
    const buffer = await renderToBuffer(element);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    const pdfStr = buffer.toString('binary');
    const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g);
    expect(pageMatches.length).toBe(1);
  });

  it('generates a valid OpenXML Word document (.docx) with all essential parts', () => {
    const mockData = {
      name: 'KAVITHA REDDY',
      admission_no: '22567T0902',
      branch: 'Electrical & Electronics Engineering',
      category: 'OC',
    };

    const docxBuf = generateAdmissionFormDocx(mockData);
    expect(Buffer.isBuffer(docxBuf)).toBe(true);
    expect(docxBuf.length).toBeGreaterThan(1000);

    // Open with PizZip to verify internal structure
    const zip = new PizZip(docxBuf);
    expect(zip.file('[Content_Types].xml')).toBeDefined();
    expect(zip.file('_rels/.rels')).toBeDefined();
    expect(zip.file('word/document.xml')).toBeDefined();
    expect(zip.file('word/styles.xml')).toBeDefined();
    expect(zip.file('word/media/image1.png')).toBeDefined();

    const docXml = zip.file('word/document.xml').asText();
    expect(docXml).toContain('KU COLLEGE OF ENGINEERING &amp; TECHNOLOGY');
    expect(docXml).toContain('Admission Form');
    expect(docXml).toContain('KAVITHA REDDY');
    expect(docXml).toContain('22567T0902');
    expect(docXml).toContain('Electrical &amp; Electronics Engineering');
    expect(docXml).toContain('Contact Details (Postal)');

    // Verify full-page flush geometry & fixed layout invariants
    expect(docXml).toContain('w:tblLayout w:type="fixed"');
    expect(docXml).toContain('w:tblW w:w="10800"');
    expect(docXml).toContain('w:pgMar w:top="360" w:right="553" w:bottom="360" w:left="553"');
    expect(docXml).toContain('w:cantSplit');

    // Verify enlarged legible typography (10pt = w:sz 20)
    expect(docXml).toContain('w:sz w:val="20"');
    const stylesXml = zip.file('word/styles.xml').asText();
    expect(stylesXml).toContain('w:sz w:val="20"');

    // Mathematical grid invariant verification across all rows in the Main Table:
    // Extract the second table (the Main Form table)
    const tables = docXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
    expect(tables.length).toBeGreaterThanOrEqual(2);
    const mainTableXml = tables[1];

    const rows = mainTableXml.match(/<w:tr>[\s\S]*?<\/w:tr>/g) || [];
    expect(rows.length).toBe(37); // exactly 26 field rows + row 27 + 4 fee rows + 1 contact header + 1 address header + 4 address lines

    rows.forEach((rowXml, idx) => {
      const cells = rowXml.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
      let totalSpan = 0;
      let totalWidth = 0;

      for (const cell of cells) {
        const spanMatch = cell.match(/<w:gridSpan w:val="(\d+)"\/>/);
        const span = spanMatch ? parseInt(spanMatch[1], 10) : 1;
        totalSpan += span;

        const widthMatch = cell.match(/<w:tcW w:w="(\d+)"/);
        if (widthMatch) {
          totalWidth += parseInt(widthMatch[1], 10);
        }
      }

      expect(totalSpan, `Row ${idx + 1} gridSpan sum`).toBe(7);
      expect(totalWidth, `Row ${idx + 1} cell width sum (dxa)`).toBe(10800);
    });
  });

  it('resolves the institutional logo buffer and data URL from allowlisted public/assets paths', () => {
    const buf = getInstitutionalLogoBuffer();
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);

    const dataUrl = getInstitutionalLogoDataUrl();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});
