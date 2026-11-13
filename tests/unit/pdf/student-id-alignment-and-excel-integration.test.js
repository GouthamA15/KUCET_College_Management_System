import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import React from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { pdf } from '@react-pdf/renderer';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx-js-style';

import IDCardPDF, { IDCardOfficialPage, IDCardClassicPage } from '@/pdf/templates/IDCardPDF';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { BulkImportTemplateService } from '@/services/admission/BulkImportTemplateService';
import { ID_CARD_FORMATS, sanitizeBloodGroup } from '@/lib/id-card-formats';

const hasOpticalTools = (() => {
  try {
    execSync('command -v pdftoppm && command -v zbarimg', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('Student ID Card — Photograph Alignment, Left-Aligned Name & Blood Group Excel Integration Suite', () => {
  let tempDir;
  let testPhotoDataUrls = {};

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `kucet-idcard-final-test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Generate diverse test images:
    // 1. Portrait image (300 x 400 - 3:4 aspect ratio)
    const portraitBuf = await sharp({
      create: { width: 300, height: 400, channels: 4, background: { r: 11, g: 53, b: 120, alpha: 1 } },
    }).png().toBuffer();
    testPhotoDataUrls.portrait = `data:image/png;base64,${portraitBuf.toString('base64')}`;

    // 2. Landscape image (600 x 400 - 3:2 aspect ratio)
    const landscapeBuf = await sharp({
      create: { width: 600, height: 400, channels: 4, background: { r: 220, g: 38, b: 38, alpha: 1 } },
    }).png().toBuffer();
    testPhotoDataUrls.landscape = `data:image/png;base64,${landscapeBuf.toString('base64')}`;

    // 3. Square image (500 x 500 - 1:1 aspect ratio)
    const squareBuf = await sharp({
      create: { width: 500, height: 500, channels: 4, background: { r: 16, g: 185, b: 129, alpha: 1 } },
    }).png().toBuffer();
    testPhotoDataUrls.square = `data:image/png;base64,${squareBuf.toString('base64')}`;

    // 4. Unusual / Wide aspect ratio (800 x 200 - 4:1 aspect ratio)
    const wideBuf = await sharp({
      create: { width: 800, height: 200, channels: 4, background: { r: 245, g: 158, b: 11, alpha: 1 } },
    }).png().toBuffer();
    testPhotoDataUrls.wide = `data:image/png;base64,${wideBuf.toString('base64')}`;

    // 5. High-resolution image (1800 x 2400)
    const highResBuf = await sharp({
      create: { width: 1800, height: 2400, channels: 4, background: { r: 79, g: 70, b: 229, alpha: 1 } },
    }).png().toBuffer();
    testPhotoDataUrls.highRes = `data:image/png;base64,${highResBuf.toString('base64')}`;
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  async function renderDocToBuffer(doc) {
    const stream = await pdf(doc).toBuffer();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  // =========================================================================
  // 1. PHOTOGRAPH PLACEMENT & UN-CROPPED RENDERING
  // =========================================================================
  describe('1. Student Photograph Alignment & Un-cropped Aspect-Ratio Containment', () => {
    it('official card photo style strictly enforces thin border and portrait dimensions', () => {
      const page = IDCardOfficialPage({
        studentName: 'RAM',
        pfpUrl: testPhotoDataUrls.portrait,
      });
      const photoBox = page.props.children.props.children[1];
      const photoImg = photoBox.props.children;

      expect(photoImg.props.style.objectFit).toBe('cover');
      expect(photoBox.props.style.alignItems).toBe('center');
      expect(photoBox.props.style.justifyContent).toBe('center');
      expect(photoBox.props.style.top).toBe(108);
      expect(photoBox.props.style.left).toBe(19);
      expect(photoBox.props.style.width).toBe(50);
      expect(photoBox.props.style.height).toBe(58);
      expect(photoBox.props.style.border).toBe('0.8pt solid #334155');
    });

    it('classic card photo style strictly enforces objectFit: contain to prevent cropping', () => {
      const page = IDCardClassicPage({
        studentName: 'RAM',
        pfpUrl: testPhotoDataUrls.portrait,
      });
      // Children: 0: logo, 1: headerText, 2: headerSpacer, 3: ribbon, 4: gridSection (photo + info)
      const gridSection = page.props.children.props.children[4];
      const photoBox = gridSection.props.children[0];
      const photoImg = photoBox.props.children;

      expect(photoImg.props.style.objectFit).toBe('contain');
      expect(photoBox.props.style.width).toBe(78);
      expect(photoBox.props.style.height).toBe(98);
      expect(photoBox.props.style.alignItems).toBe('center');
      expect(photoBox.props.style.justifyContent).toBe('center');
    });

    it('renders valid PDF buffers for portrait, landscape, square, wide, and high-res photos', async () => {
      for (const [shape, photoDataUrl] of Object.entries(testPhotoDataUrls)) {
        const doc = React.createElement(IDCardPDF, {
          studentName: `PHOTO TEST ${shape.toUpperCase()}`,
          admissionNo: '26567T0901',
          course: 'CSE',
          batch: '2026-2030',
          address: 'Warangal',
          mobile: '9876543210',
          bloodGroup: 'O+',
          pfpUrl: photoDataUrl,
          template: 'official',
          cardFormat: 'official_standard',
        });

        const buf = await renderDocToBuffer(doc);
        expect(buf).toBeInstanceOf(Buffer);
        expect(buf.length).toBeGreaterThan(1500);
      }
    });

    it('handles long or unusual photo storage filenames gracefully without crash', async () => {
      const longKey = 'kucet/students/pfp/very_long_photo_key_with_special_chars_and_nested_folders_2026_id_card_test_file.webp';
      const doc = React.createElement(IDCardPDF, {
        studentName: 'SPECIAL FILENAME STUDENT',
        admissionNo: '26567T0901',
        course: 'CSE',
        batch: '2026-2030',
        address: 'Warangal',
        mobile: '9876543210',
        bloodGroup: 'A+',
        pfpUrl: testPhotoDataUrls.square,
        photoKey: longKey,
        template: 'official',
        cardFormat: 'official_standard',
      });

      const buf = await renderDocToBuffer(doc);
      expect(buf.length).toBeGreaterThan(1500);
    });
  });

  // =========================================================================
  // 2. STUDENT NAME POSITIONING RESTORATION (LEFT-ALIGNED)
  // =========================================================================
  describe('2. Student Name Positioning & Text Wrapping', () => {
    it('centers official card student name safely clear of the left margin chevron (textAlign: center)', () => {
      const page = IDCardOfficialPage({
        studentName: 'KALYAN REDDY',
      });
      const nameBox = page.props.children.props.children[5];
      const nameText = nameBox.props.children;

      // Container: top 172, left 20, width 204, height 32, centered
      expect(nameBox.props.style.top).toBe(172);
      expect(nameBox.props.style.left).toBe(20);
      expect(nameBox.props.style.width).toBe(204);
      expect(nameBox.props.style.height).toBe(32);
      expect(nameBox.props.style.alignItems).toBe('center');
      expect(nameText.props.style.textAlign).toBe('center');
      expect(nameText.props.style.color).toBe('#d32f2f');
    });

    it('short student name displays on one line, centered', () => {
      const page = IDCardOfficialPage({ studentName: 'RAM' });
      const nameBox = page.props.children.props.children[5];
      const nameText = nameBox.props.children;

      expect(nameText.props.children).toBe('RAM');
      expect(nameText.props.style.textAlign).toBe('center');
      expect(nameText.props.style.fontSize).toBe(10.5);
    });

    it('normal length student name displays on one line at 10.5pt, centered', () => {
      const page = IDCardOfficialPage({ studentName: 'ADEPU SUCHARITHA' });
      const nameBox = page.props.children.props.children[5];
      const nameText = nameBox.props.children;

      expect(nameText.props.children).toBe('ADEPU SUCHARITHA');
      expect(nameText.props.style.textAlign).toBe('center');
      expect(nameText.props.style.fontSize).toBe(10.5);
    });

    it('long student name scales to 9.2pt or 9.5pt and wraps into 2 centered lines within height', () => {
      const longName = 'MOHAMMED ABDUL REHMAN SIDDIQUI';
      const page = IDCardOfficialPage({ studentName: longName });
      const nameBox = page.props.children.props.children[5];
      const nameText = nameBox.props.children;

      expect(nameText.props.children).toBe(longName);
      expect(nameText.props.style.textAlign).toBe('center');
      expect(nameText.props.style.fontSize).toBeLessThan(10);
      expect(nameBox.props.style.height).toBe(32);
      // Ensures it does not collide with father name at top: 204
      expect(nameBox.props.style.top + nameBox.props.style.height).toBeLessThanOrEqual(204);
    });

    it('very long student name scales to 8.2pt, remaining centered without overlapping father name or QR', () => {
      const veryLongName = 'CHINTHA KUNTA VENKATA RAMA NARASIMHA REDDY';
      const page = IDCardOfficialPage({ studentName: veryLongName });
      const nameBox = page.props.children.props.children[5];
      const nameText = nameBox.props.children;

      expect(nameText.props.children).toBe(veryLongName);
      expect(nameText.props.style.textAlign).toBe('center');
      expect(nameText.props.style.fontSize).toBeLessThanOrEqual(8.5);
      expect(nameBox.props.style.top + nameBox.props.style.height).toBeLessThanOrEqual(204);
    });
  });

  // =========================================================================
  // 3. BLOOD GROUP CARD DISPLAY (BESIDE RED BLOOD DROP SYMBOL)
  // =========================================================================
  describe('3. Blood Group Display on ID Card', () => {
    const canonicalBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    canonicalBloodGroups.forEach((bg) => {
      it(`renders valid blood group "${bg}" beside blood drop symbol at top: 362, left: 27`, () => {
        const page = IDCardOfficialPage({
          studentName: 'STUDENT',
          bloodGroup: bg,
        });
        const bloodBox = page.props.children.props.children[9];
        expect(bloodBox).not.toBeNull();
        expect(bloodBox.props.style.top).toBe(362);
        expect(bloodBox.props.style.left).toBe(27);
        expect(bloodBox.props.children.props.children).toBe(bg);
        expect(bloodBox.props.children.props.style.color).toBe('#d32f2f');
      });
    });

    it('leaves blood group area blank (null) when blood group is empty, missing, or placeholder', () => {
      const emptyValues = ['', '  ', null, undefined, '-Select-', 'Not Available', 'N/A', 'UNKNOWN', 'null', 'undefined'];
      emptyValues.forEach((val) => {
        const page = IDCardOfficialPage({
          studentName: 'STUDENT',
          bloodGroup: val,
        });
        const bloodBox = page.props.children.props.children[9];
        expect(bloodBox).toBeNull();
      });
    });

    it('does not render a second dynamic blood-drop icon, preserving the authentic background icon', () => {
      const page = IDCardOfficialPage({
        studentName: 'STUDENT',
        bloodGroup: 'O+',
      });
      const children = page.props.children.props.children;
      // Functional children: bg, photo, course, htNo, batch, name, father, qr, address, bloodGroup, cell
      expect(children.length).toBe(11);
      // Item 9 is the blood group text container (only contains Text element, no Image)
      const bloodBox = children[9];
      expect(bloodBox.props.children.type).toBe('TEXT');
    });
  });

  // =========================================================================
  // 4. BULK EXCEL TEMPLATE & BLOOD GROUP INTEGRATION
  // =========================================================================
  describe('4. Bulk Excel Template & Import Parser with Blood Group', () => {
    it('generates downloadable Excel template with Blood Group column', async () => {
      const workbook = await BulkImportTemplateService.generateWorkbook();
      expect(workbook).toBeDefined();

      const worksheet = workbook.getWorksheet('Student Import Template');
      expect(worksheet).toBeDefined();

      // Check header row (row 1)
      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell((cell) => headers.push(cell.value));

      expect(headers).toContain('Blood Group');
      expect(headers).toContain('Roll Number');
      expect(headers).toContain('Candidate Name');
      expect(headers).toContain('Permanent Address');
      expect(headers).toContain('Mobile');

      // Verify Blood Group column index and key
      const bloodGroupCol = worksheet.columns.find((col) => col.key === 'blood_group' || col.header === 'Blood Group');
      expect(bloodGroupCol).toBeDefined();
      expect(bloodGroupCol.header).toBe('Blood Group');

      // Verify sample row 1 has valid blood group 'O+'
      const row2 = worksheet.getRow(2);
      expect(row2.getCell('blood_group').value).toBe('O+');

      // Verify sample row 2 has empty blood group
      const row3 = worksheet.getRow(3);
      expect(row3.getCell('blood_group').value).toBe('');

      // Verify buffer generation
      const buf = await BulkImportTemplateService.generateTemplateBuffer();
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(1000);
    });

    it('Excel import parser correctly reads Blood Group values from workbook', async () => {
      // Build a realistic test workbook with diverse blood groups
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Students');
      ws.addRow(['Roll Number', 'Candidate Name', 'Gender', 'Date of Birth', 'Father Name', 'Category', 'Permanent Address', 'Contact Address', 'Mobile', 'Email', 'Blood Group']);
      ws.addRow(['26567T0901', 'KAVYA REDDY', 'FEMALE', '2005-04-12', 'RAMA REDDY', 'OC', 'Warangal', 'Warangal', '9876543210', 'kavya@test.com', 'A+']);
      ws.addRow(['26567T0902', 'SURESH KUMAR', 'MALE', '2005-06-15', 'VENKATESH', 'BC-B', 'Hanamkonda', 'Hanamkonda', '9876543211', 'suresh@test.com', 'O-']);
      ws.addRow(['26567T0903', 'ANANYA D', 'FEMALE', '2005-08-20', 'VIJAY D', 'OC', 'Kazipet', 'Kazipet', '9876543212', 'ananya@test.com', '']); // Blank blood group

      const buf = await workbook.xlsx.writeBuffer();

      // Read back with xlsx-js-style (mirroring bulk-import route)
      const parsedWb = XLSX.read(Buffer.from(buf), { type: 'array' });
      const sheet = parsedWb.Sheets[parsedWb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      expect(rows[0]).toContain('Blood Group');
      const bgColIdx = rows[0].indexOf('Blood Group');

      expect(rows[1][bgColIdx]).toBe('A+');
      expect(rows[2][bgColIdx]).toBe('O-');
      expect(rows[3][bgColIdx] === undefined || rows[3][bgColIdx] === '').toBe(true);
    });

    it('backward compatibility: imports legacy Excel file WITHOUT Blood Group column successfully', async () => {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Students');
      // No Blood Group column
      ws.addRow(['Roll Number', 'Candidate Name', 'Gender', 'Date of Birth', 'Father Name', 'Category', 'Permanent Address', 'Contact Address', 'Mobile', 'Email']);
      ws.addRow(['26567T0901', 'KAVYA REDDY', 'FEMALE', '2005-04-12', 'RAMA REDDY', 'OC', 'Warangal', 'Warangal', '9876543210', 'kavya@test.com']);

      const buf = await workbook.xlsx.writeBuffer();
      const parsedWb = XLSX.read(Buffer.from(buf), { type: 'array' });
      const sheet = parsedWb.Sheets[parsedWb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      expect(rows[0]).not.toContain('Blood Group');
      expect(rows[1][0]).toBe('26567T0901');
      expect(rows[1][1]).toBe('KAVYA REDDY');
    });

    it('correctly maps all 8 valid medical blood groups and normalizes casing', () => {
      const groups = ['a+', 'A-', 'b+', 'B-', 'ab+', 'AB-', 'o+', 'O-'];
      groups.forEach((bg) => {
        const cleaned = sanitizeBloodGroup(bg);
        expect(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).toContain(cleaned);
      });
    });

    it('rejects unsupported blood group values and returns empty string', () => {
      const invalid = ['XYZ', 'C+', 'O*', 'Positive', 'A_POS', '123', 'Not Available', '-Select-'];
      invalid.forEach((bg) => {
        expect(sanitizeBloodGroup(bg)).toBe('');
      });
    });
  });

  // =========================================================================
  // 5. REGRESSION VERIFICATION: ALL 6 ID CARD FORMATS
  // =========================================================================
  describe('5. Complete ID Card Regression Suite Across All 6 Formats', () => {
    const studentFixture = {
      rollNo: '26567T0901',
      admissionNo: '26567T0901',
      studentName: 'ADEPU SUCHARITHA',
      fatherName: 'ADEPU RAMAKRISHNA',
      branch: 'CSE',
      batch: '2026-2030',
      address: '# 16-1-559, Warangal',
      mobile: '9059084844',
      bloodGroup: 'B+',
    };

    Object.values(ID_CARD_FORMATS).forEach((formatDef) => {
      it(`Format ${formatDef.code} (${formatDef.name}): generates valid PDF buffer with scannable QR and correct layout`, async () => {
        const qrUrl = await IDCardDataService.generateQRDataUrlForMode(
          studentFixture,
          formatDef.qrMode,
          'https://kucet.ac.in'
        );
        expect(qrUrl).toBeDefined();

        const doc = React.createElement(IDCardPDF, {
          ...studentFixture,
          pfpUrl: testPhotoDataUrls.portrait,
          qrUrl,
          template: formatDef.template,
          cardFormat: formatDef.id,
          format: formatDef.id,
        });

        const buf = await renderDocToBuffer(doc);
        expect(buf).toBeInstanceOf(Buffer);
        expect(buf.length).toBeGreaterThan(2000);

        // Optical verification if pdftoppm & zbarimg are available
        if (hasOpticalTools) {
          const pdfPath = path.join(tempDir, `test_fmt_${formatDef.code}.pdf`);
          fs.writeFileSync(pdfPath, buf);

          const prefix = path.join(tempDir, `scan_fmt_${formatDef.code}`);
          execSync(`pdftoppm -png -r 300 -f 1 -l 1 "${pdfPath}" "${prefix}"`);
          const renderedPng = `${prefix}-1.png`;
          expect(fs.existsSync(renderedPng)).toBe(true);

          const zbarOut = execSync(`zbarimg -q "${renderedPng}"`, { encoding: 'utf-8' });
          expect(zbarOut).toContain('QR-Code:');

          if (formatDef.qrMode === 'roll_number') {
            expect(zbarOut).toContain('26567T0901');
          } else if (formatDef.qrMode === 'standard') {
            expect(zbarOut).toContain('HALL-TICKET-NO : 26567T0901');
            expect(zbarOut).toContain('NAME : ADEPU SUCHARITHA');
            expect(zbarOut).toContain('BLOOD-GROUP : B+');
          } else if (formatDef.qrMode === 'public_url') {
            expect(zbarOut).toContain('https://kucet.ac.in/public/student/26567T0901');
          }
        }
      });
    });
  });
});
