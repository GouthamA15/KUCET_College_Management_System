import { describe, it, expect } from 'vitest';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF, { BulkIDCardPDF, IDCardPage, IDCardOfficialPage } from '@/pdf/templates/IDCardPDF';
import { 
  ID_CARD_FORMAT_IDS, 
  ALL_ID_CARD_FORMATS,
  CLASSIC_ID_CARD_FORMATS,
  OFFICIAL_ID_CARD_FORMATS,
  resolveIDCardFormat, 
  sanitizeBloodGroup 
} from '@/lib/id-card-formats';

async function streamToBuffer(streamOrBuf) {
  if (Buffer.isBuffer(streamOrBuf)) return streamOrBuf;
  const chunks = [];
  for await (const chunk of streamOrBuf) chunks.push(chunk);
  return Buffer.concat(chunks);
}

describe('Student ID Card — 6 Selectable Formats & Architecture Suite', () => {
  const sampleStudent = {
    studentName: 'ADEPU SUCHARITHA',
    fatherName: 'ADEPU RAMAKRISHNA',
    admissionNo: '26567T0901',
    course: 'CSE',
    batch: '2026-2030',
    address: '16-1-559/2/A/1, WARANGAL, KAREEMABAD, TELANGANA, 506002',
    mobile: '9059084844',
    bloodGroup: 'O+',
    pfpUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    signatureUrl: null,
    qrUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    templateBgUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };

  describe('1. Format Resolution Engine', () => {
    it('resolves all 6 formats by canonical ID', () => {
      expect(resolveIDCardFormat('classic_roll_number').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_1);
      expect(resolveIDCardFormat('classic_standard').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_2);
      expect(resolveIDCardFormat('classic_public_url').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_3);
      expect(resolveIDCardFormat('official_roll_number').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_4);
      expect(resolveIDCardFormat('official_standard').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_5);
      expect(resolveIDCardFormat('official_public_url').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_6);
    });

    it('resolves numeric codes and format labels 1-6', () => {
      expect(resolveIDCardFormat(1).id).toBe(ID_CARD_FORMAT_IDS.FORMAT_1);
      expect(resolveIDCardFormat('format_2').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_2);
      expect(resolveIDCardFormat('3').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_3);
      expect(resolveIDCardFormat('format_4').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_4);
      expect(resolveIDCardFormat(5).id).toBe(ID_CARD_FORMAT_IDS.FORMAT_5);
      expect(resolveIDCardFormat('format6').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_6);
    });

    it('maintains 100% backward compatibility for legacy qrMode strings', () => {
      expect(resolveIDCardFormat('roll_number').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_1);
      expect(resolveIDCardFormat('standard').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_2);
      expect(resolveIDCardFormat('public_url').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_3);
    });

    it('resolves template and qrMode combination', () => {
      expect(resolveIDCardFormat('roll_number', 'official').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_4);
      expect(resolveIDCardFormat('standard', 'official').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_5);
      expect(resolveIDCardFormat('public_url', 'official').id).toBe(ID_CARD_FORMAT_IDS.FORMAT_6);
    });

    it('has exactly 3 classic formats and 3 official formats', () => {
      expect(ALL_ID_CARD_FORMATS.length).toBe(6);
      expect(CLASSIC_ID_CARD_FORMATS.length).toBe(3);
      expect(OFFICIAL_ID_CARD_FORMATS.length).toBe(3);
    });
  });

  describe('2. Strict Blood Group Sanitization Invariant', () => {
    it('accepts valid medical blood groups and normalizes them', () => {
      const valid = ['A+', 'a+', 'A-', 'B+', 'B-', 'b-', 'AB+', 'ab+', 'AB-', 'O+', 'o+', 'O-'];
      valid.forEach((bg) => {
        const clean = sanitizeBloodGroup(bg);
        expect(clean).toBe(bg.trim().toUpperCase());
      });
    });

    it('strictly returns empty string for missing, null, undefined, placeholders or invalid values', () => {
      expect(sanitizeBloodGroup(null)).toBe('');
      expect(sanitizeBloodGroup(undefined)).toBe('');
      expect(sanitizeBloodGroup('')).toBe('');
      expect(sanitizeBloodGroup('   ')).toBe('');
      expect(sanitizeBloodGroup('-Select-')).toBe('');
      expect(sanitizeBloodGroup('N/A')).toBe('');
      expect(sanitizeBloodGroup('None')).toBe('');
      expect(sanitizeBloodGroup('Not Available')).toBe('');
      expect(sanitizeBloodGroup('UNKNOWN')).toBe('');
      expect(sanitizeBloodGroup('XYZ+')).toBe('');
      expect(sanitizeBloodGroup(123)).toBe('');
    });
  });

  describe('3. Template Dispatch & Component Structure', () => {
    it('dispatches to Classic Template for Formats 1, 2, and 3', () => {
      [1, 2, 3].forEach((code) => {
        const fmt = resolveIDCardFormat(code);
        const page = IDCardPage({ ...sampleStudent, cardFormat: fmt.id, template: fmt.template });
        expect(page).toBeDefined();
        // Classic container has 1.2pt border and borderRadius 12
        const container = page.props.children;
        expect(container.props.style.borderRadius).toBe(12);
        expect(container.props.style.border).toBe('1.2pt solid #0b3578');
      });
    });

    it('dispatches to Official Template for Formats 4, 5, and 6', () => {
      [4, 5, 6].forEach((code) => {
        const fmt = resolveIDCardFormat(code);
        const page = IDCardPage({ ...sampleStudent, cardFormat: fmt.id, template: fmt.template });
        expect(page).toBeDefined();
        // Official container matches dimensions 242x385 with hidden overflow
        const container = page.props.children;
        expect(container.props.style.width).toBe(242);
        expect(container.props.style.height).toBe(385);
        expect(container.props.style.overflow).toBe('hidden');
      });
    });
  });

  describe('4. Official Template Overlay Positioning & Field Values', () => {
    it('renders valid blood group in official card overlay beside blood-drop marker', () => {
      const page = IDCardOfficialPage({ ...sampleStudent, bloodGroup: 'B+' });
      const container = page.props.children;
      // Item 9 is the Blood Group box (duplicate signature overlay was removed)
      const bloodGroupBox = container.props.children[9];
      expect(bloodGroupBox).not.toBeNull();
      expect(bloodGroupBox.props.children.props.children).toBe('B+');
    });

    it('leaves blood group area blank (null) when blood group is missing or placeholder', () => {
      ['-Select-', 'N/A', '', null, undefined, 'Not Available'].forEach((missingVal) => {
        const page = IDCardOfficialPage({ ...sampleStudent, bloodGroup: missingVal });
        const container = page.props.children;
        const bloodGroupBox = container.props.children[9];
        expect(bloodGroupBox).toBeNull();
      });
    });

    it('displays student full name in uppercase red font in dedicated section below academic year', () => {
      const page = IDCardOfficialPage(sampleStudent);
      const container = page.props.children;
      // Item 5 is the Student Name box
      const nameBox = container.props.children[5];
      expect(nameBox.props.children.props.children).toBe(sampleStudent.studentName);
      expect(nameBox.props.children.props.style.color).toBe('#d32f2f');
      expect(nameBox.props.style.top).toBe(172);
      expect(nameBox.props.style.left).toBe(12);
    });

    it('prefixes student address with # and wraps correctly', () => {
      const withHash = IDCardOfficialPage({ ...sampleStudent, address: '# 1-2-3, Warangal' });
      const addrBox1 = withHash.props.children.props.children[8];
      expect(addrBox1.props.children.props.children).toBe('# 1-2-3, Warangal');

      const withoutHash = IDCardOfficialPage({ ...sampleStudent, address: '16-1-559, Warangal' });
      const addrBox2 = withoutHash.props.children.props.children[8];
      expect(addrBox2.props.children.props.children).toBe('# 16-1-559, Warangal');
    });

    it('does not dynamically insert duplicate signature in official template', () => {
      const page = IDCardOfficialPage({ ...sampleStudent, signatureUrl: 'https://example.com/sig.png' });
      const container = page.props.children;
      // Verify children does not contain a signature box
      const childCount = container.props.children.length;
      expect(childCount).toBe(11); // bg, photo, course, htNo, batch, name, father, qr, address, bloodGroup, cell
    });

    it('positions QR code in designated white QR area with increased size', () => {
      const page = IDCardOfficialPage(sampleStudent);
      const container = page.props.children;
      const qrBox = container.props.children[7];
      expect(qrBox.props.style.left).toBe(45);
      expect(qrBox.props.style.width).toBe(86);
      expect(qrBox.props.style.height).toBe(86);
    });

    it('displays father name when available and omits when missing', () => {
      const withFather = IDCardOfficialPage({ ...sampleStudent, fatherName: 'RAMAKRISHNA' });
      expect(withFather.props.children.props.children[6]).not.toBeNull();
      expect(withFather.props.children.props.children[6].props.children.props.children).toBe('RAMAKRISHNA');

      const withoutFather = IDCardOfficialPage({ ...sampleStudent, fatherName: null });
      expect(withoutFather.props.children.props.children[6]).toBeNull();
    });

    it('displays course formatted as B.Tech (BRANCH)', () => {
      const page = IDCardOfficialPage({ ...sampleStudent, course: 'CSE' });
      const courseBox = page.props.children.props.children[2];
      expect(courseBox.props.children.props.children).toBe('B.Tech (CSE)');
    });
  });

  describe('5. PDF Buffer Generation for All 6 Formats', () => {
    it('generates a valid, readable PDF buffer for Format 1 (Classic — Roll Number QR)', async () => {
      const doc = React.createElement(IDCardPDF, { ...sampleStudent, cardFormat: 'classic_roll_number' });
      const stream = await pdf(doc).toBuffer();
      const buf = await streamToBuffer(stream);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generates a valid, readable PDF buffer for Format 2 (Classic — 14-Field QR)', async () => {
      const doc = React.createElement(IDCardPDF, { ...sampleStudent, cardFormat: 'classic_standard' });
      const stream = await pdf(doc).toBuffer();
      const buf = await streamToBuffer(stream);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generates a valid, readable PDF buffer for Format 3 (Classic — Public URL QR)', async () => {
      const doc = React.createElement(IDCardPDF, { ...sampleStudent, cardFormat: 'classic_public_url' });
      const stream = await pdf(doc).toBuffer();
      const buf = await streamToBuffer(stream);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generates a valid, readable PDF buffer for Format 4 (Official — Roll Number QR)', async () => {
      const doc = React.createElement(IDCardPDF, { ...sampleStudent, cardFormat: 'official_roll_number' });
      const stream = await pdf(doc).toBuffer();
      const buf = await streamToBuffer(stream);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generates a valid, readable PDF buffer for Format 5 (Official — 14-Field QR)', async () => {
      const doc = React.createElement(IDCardPDF, { ...sampleStudent, cardFormat: 'official_standard' });
      const stream = await pdf(doc).toBuffer();
      const buf = await streamToBuffer(stream);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generates a valid, readable PDF buffer for Format 6 (Official — Public URL QR)', async () => {
      const doc = React.createElement(IDCardPDF, { ...sampleStudent, cardFormat: 'official_public_url' });
      const stream = await pdf(doc).toBuffer();
      const buf = await streamToBuffer(stream);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(1000);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  describe('6. Bulk Multi-Page PDF Generation', () => {
    it('generates multi-page PDF batch with mixed or official format', async () => {
      const students = [
        { ...sampleStudent, admissionNo: '26567T0901', cardFormat: 'official_roll_number' },
        { ...sampleStudent, admissionNo: '26567T0902', cardFormat: 'official_standard', bloodGroup: null },
        { ...sampleStudent, admissionNo: '26567T0903', cardFormat: 'classic_standard' },
      ];

      const bulkDoc = React.createElement(BulkIDCardPDF, { students });
      const stream = await pdf(bulkDoc).toBuffer();
      const buf = await streamToBuffer(stream);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2500);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });
});
