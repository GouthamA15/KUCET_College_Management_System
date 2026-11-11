import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import React from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF, { IDCardOfficialPage } from '@/pdf/templates/IDCardPDF';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { ID_CARD_FORMATS } from '@/lib/id-card-formats';
import sharp from 'sharp';

describe('Student ID Card Layout Correction, Alignment & Production Rendering Regression Suite', () => {
  let tempDir;
  let templateBgUrl = null;
  let samplePhotoUrl = null;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `kucet-idcard-regression-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Load official template PNG if available in /tmp
    const templatePath = '/tmp/kucet-official-id-card-template-2026.png';
    if (fs.existsSync(templatePath)) {
      const tBuf = fs.readFileSync(templatePath);
      templateBgUrl = `data:image/png;base64,${tBuf.toString('base64')}`;
    }

    // Create a 64x56 test student photo
    const pBuf = await sharp({
      create: {
        width: 64,
        height: 56,
        channels: 4,
        background: { r: 11, g: 53, b: 120, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    samplePhotoUrl = `data:image/png;base64,${pBuf.toString('base64')}`;
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  async function streamToBuffer(stream) {
    if (Buffer.isBuffer(stream)) return stream;
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  // 9 Distinct Student Profiles as specified in Section 12
  const testProfiles = [
    {
      label: '1. Short name student',
      studentName: 'RAM',
      fatherName: 'RAO',
      rollNo: '26567T0901',
      branch: 'CSE',
      batch: '2026-2030',
      address: 'Warangal',
      mobile: '9876543210',
      bloodGroup: 'O+',
    },
    {
      label: '2. Long name student',
      studentName: 'MOHAMMED ABDUL REHMAN SIDDIQUI AL-HASHMI',
      fatherName: 'MOHAMMED ABDUL KAREEM',
      rollNo: '26567T0902',
      branch: 'ECE',
      batch: '2026-2030',
      address: 'H No 12-4-567/A, Near Public Gardens, Hanamkonda',
      mobile: '9876543211',
      bloodGroup: 'B+',
    },
    {
      label: '3. Long father name student',
      studentName: 'KALYAN REDDY',
      fatherName: 'CHINTHA KUNTA VENKATA RAMA NARASIMHA REDDY',
      rollNo: '26567T0903',
      branch: 'CIVIL',
      batch: '2026-2030',
      address: 'Flat 402, Kakatiya Residency, Vidyaranyapuri',
      mobile: '9876543212',
      bloodGroup: 'A+',
    },
    {
      label: '4. Short address student',
      studentName: 'PRIYA SHARMA',
      fatherName: 'RAJESH SHARMA',
      rollNo: '26567T0904',
      branch: 'IT',
      batch: '2026-2030',
      address: 'KU Campus',
      mobile: '9876543213',
      bloodGroup: 'AB+',
    },
    {
      label: '5. Long address student (multi-line)',
      studentName: 'VENKATESHWARLU G',
      fatherName: 'NARSIMHA G',
      rollNo: '26567T0905',
      branch: 'MECH',
      batch: '2026-2030',
      address: 'D.No. 4-78/B/12, Subedari Main Road, Near Old Bus Stand, Warangal Urban District, Telangana State, PIN - 506001',
      mobile: '9876543214',
      bloodGroup: 'O-',
    },
    {
      label: '6. Valid blood group student',
      studentName: 'SNEHA PATEL',
      fatherName: 'BHARAT PATEL',
      rollNo: '26567T0906',
      branch: 'CSD',
      batch: '2026-2030',
      address: 'Kareemabad, Warangal',
      mobile: '9876543215',
      bloodGroup: 'A-',
    },
    {
      label: '7. Missing / Null blood group student',
      studentName: 'ROHIT KUMAR',
      fatherName: 'SURESH KUMAR',
      rollNo: '26567T0907',
      branch: 'EEE',
      batch: '2026-2030',
      address: 'Kazipet, Warangal',
      mobile: '9876543216',
      bloodGroup: null, // Must remain completely blank beside blood-drop icon
    },
    {
      label: '8. Longer mobile number student (with country code or landline)',
      studentName: 'ANANYA DESHMUKH',
      fatherName: 'VIJAY DESHMUKH',
      rollNo: '26567T0908',
      branch: 'CSE',
      batch: '2026-2030',
      address: '# 2-10-890, Nakkalagutta, Hanamkonda',
      mobile: '+91 9876543217',
      bloodGroup: 'B-',
    },
    {
      label: '9. Fully populated optional fields student',
      studentName: 'GOUTHAM ANKAPOOR',
      fatherName: 'SRINIVAS ANKAPOOR',
      rollNo: '24567T0942',
      branch: 'CSE',
      batch: '2024-2028',
      address: '# 16-1-559/2/A/1, SRR Thota, Warangal, 506002',
      mobile: '9059084844',
      bloodGroup: 'O+',
    },
  ];

  describe('A. Layout Invariants & Geometry Verification', () => {
    it('places student name strictly BELOW Academic Year in dedicated zone (top: 172, height: 30)', () => {
      const page = IDCardOfficialPage({
        studentName: 'GOUTHAM ANKAPOOR',
        admissionNo: '24567T0942',
        course: 'CSE',
        batch: '2024-2028',
      });
      const nameBox = page.props.children.props.children[5];
      expect(nameBox.props.style.top).toBe(172);
      expect(nameBox.props.style.left).toBe(12);
      expect(nameBox.props.style.width).toBe(218);
      expect(nameBox.props.style.height).toBe(30);
      expect(nameBox.props.children.props.children).toBe('GOUTHAM ANKAPOOR');
      expect(nameBox.props.children.props.style.color).toBe('#d32f2f');
    });

    it('photo box is bounded strictly above red line at 168 pt (top: 108, height: 56)', () => {
      const page = IDCardOfficialPage({
        studentName: 'RAM',
        pfpUrl: samplePhotoUrl,
      });
      const photoBox = page.props.children.props.children[1];
      expect(photoBox.props.style.top).toBe(108);
      expect(photoBox.props.style.height).toBe(56);
      expect(photoBox.props.style.top + photoBox.props.style.height).toBeLessThanOrEqual(168);
    });

    it('enforces # prefix for address without duplication', () => {
      // 1. Without #
      const p1 = IDCardOfficialPage({ address: '12-34 Warangal' });
      const addrBox1 = p1.props.children.props.children[8];
      expect(addrBox1.props.children.props.children).toBe('# 12-34 Warangal');

      // 2. Already with #
      const p2 = IDCardOfficialPage({ address: '# 56-78 Hanamkonda' });
      const addrBox2 = p2.props.children.props.children[8];
      expect(addrBox2.props.children.props.children).toBe('# 56-78 Hanamkonda');
    });

    it('strictly omits dynamic signature overlay from official card to prevent duplication', () => {
      const page = IDCardOfficialPage({
        studentName: 'TEST',
        signatureUrl: 'https://kucet.ac.in/assets/principal-sign.png',
      });
      const children = page.props.children.props.children;
      // Exactly 11 functional children: bg, photo, course, htNo, batch, name, father, qr, address, bloodGroup, cell
      expect(children.length).toBe(11);
    });

    it('leaves blood group area blank when missing or invalid', () => {
      ['', null, undefined, '-Select-', 'N/A', 'Not Available'].forEach((val) => {
        const page = IDCardOfficialPage({ bloodGroup: val });
        const bgBox = page.props.children.props.children[9];
        expect(bgBox).toBeNull();
      });
    });

    it('enlarges QR code to 86x86 pt positioned at left: 45 pt inside designated white QR area', () => {
      const page = IDCardOfficialPage({ qrUrl: 'data:image/png;base64,dummy' });
      const qrBox = page.props.children.props.children[7];
      expect(qrBox.props.style.left).toBe(45);
      expect(qrBox.props.style.top).toBe(226);
      expect(qrBox.props.style.width).toBe(86);
      expect(qrBox.props.style.height).toBe(86);
    });
  });

  describe('B. All 9 Student Variation Scenarios Render Successfully', () => {
    testProfiles.forEach((profile, idx) => {
      it(`renders profile ${profile.label} into valid official PDF`, async () => {
        const qrUrl = await IDCardDataService.generateStudentQRDataUrl({
          ...profile,
          id: 100 + idx,
          studentStatus: 'ACTIVE',
        });

        const doc = React.createElement(IDCardPDF, {
          studentName: profile.studentName,
          fatherName: profile.fatherName,
          admissionNo: profile.rollNo,
          course: profile.branch,
          batch: profile.batch,
          address: profile.address,
          mobile: profile.mobile,
          bloodGroup: profile.bloodGroup,
          pfpUrl: samplePhotoUrl,
          qrUrl,
          template: 'official',
          cardFormat: 'official_standard',
          templateBgUrl,
        });

        const stream = await pdf(doc).toBuffer();
        const buffer = await streamToBuffer(stream);
        expect(buffer.length).toBeGreaterThan(1000);
        expect(buffer.slice(0, 5).toString()).toBe('%PDF-');

        const pdfPath = path.join(tempDir, `profile_${idx + 1}.pdf`);
        fs.writeFileSync(pdfPath, buffer);
        expect(fs.existsSync(pdfPath)).toBe(true);
      });
    });
  });

  describe('C. All 6 ID Card Formats Generate and Encode QR Correctly', () => {
    const student = testProfiles[8]; // Full student

    Object.values(ID_CARD_FORMATS).forEach((formatDef) => {
      it(`renders Format ${formatDef.code}: ${formatDef.name}`, async () => {
        const qrUrl = await IDCardDataService.generateQRDataUrlForMode(
          {
            ...student,
            id: 200 + formatDef.code,
            studentStatus: 'ACTIVE',
          },
          formatDef.qrMode,
          'https://kucet.ac.in'
        );
        expect(qrUrl).toBeDefined();

        const doc = React.createElement(IDCardPDF, {
          studentName: student.studentName,
          fatherName: student.fatherName,
          admissionNo: student.rollNo,
          course: student.branch,
          batch: student.batch,
          address: student.address,
          mobile: student.mobile,
          bloodGroup: student.bloodGroup,
          pfpUrl: samplePhotoUrl,
          qrUrl,
          template: formatDef.template,
          cardFormat: formatDef.id,
          format: formatDef.id,
          templateBgUrl,
        });

        const stream = await pdf(doc).toBuffer();
        const buffer = await streamToBuffer(stream);
        expect(buffer.length).toBeGreaterThan(1000);
        expect(buffer.slice(0, 5).toString()).toBe('%PDF-');

        const pdfPath = path.join(tempDir, `format_${formatDef.code}.pdf`);
        fs.writeFileSync(pdfPath, buffer);

        // Also save persistent samples for inspection
        const persistentDir = '/tmp/kucet-idcard-samples';
        fs.mkdirSync(persistentDir, { recursive: true });
        fs.writeFileSync(path.join(persistentDir, `format_${formatDef.code}.pdf`), buffer);

        // Optical QR Scan with pdftoppm + zbarimg if available
        let hasTools = false;
        try {
          execSync('command -v pdftoppm && command -v zbarimg', { stdio: 'ignore' });
          hasTools = true;
        } catch {}

        if (hasTools) {
          const prefix = path.join(tempDir, `scan_fmt_${formatDef.code}`);
          execSync(`pdftoppm -png -r 300 -f 1 -l 1 "${pdfPath}" "${prefix}"`);
          const renderedPng = `${prefix}-1.png`;
          expect(fs.existsSync(renderedPng)).toBe(true);

          // Copy rendered PNG to persistentDir
          fs.copyFileSync(renderedPng, path.join(persistentDir, `format_${formatDef.code}_rendered.png`));

          const zbarOut = execSync(`zbarimg -q "${renderedPng}"`, { encoding: 'utf-8' });
          expect(zbarOut).toContain('QR-Code:');

          if (formatDef.qrMode === 'roll_number') {
            expect(zbarOut).toContain(student.rollNo);
          } else if (formatDef.qrMode === 'standard') {
            expect(zbarOut).toContain(`HALL-TICKET-NO : ${student.rollNo}`);
            expect(zbarOut).toContain(`NAME : ${student.studentName}`);
          } else if (formatDef.qrMode === 'public_url') {
            expect(zbarOut).toContain(`https://kucet.ac.in/public/student/${student.rollNo}`);
          }
        }
      });
    });
  });
});
