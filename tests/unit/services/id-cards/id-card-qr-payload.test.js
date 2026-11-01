import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { IDCardDataService, buildStudentIDCardQRPayload } from '@/services/identity/IDCardDataService';
import { extractRollNumberFromQR } from '@/lib/rollNumber';
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

describe('ID Card QR Payload & Attendance Compatibility Suite', () => {
  const baseStudent = {
    id: 42, // Internal DB primary key - must NEVER be used as SL-NO
    slNo: 451,
    rollNo: '255671870L',
    admissionNo: '255671870L',
    studentName: 'CHAVAN PAVITHRA',
    fatherName: 'RAVI',
    branch: 'IT',
    batch: '2025-2028',
    courseDisplay: 'B.TECH (IT)',
    studentPhone: '9959155235',
    studentAddress: '# Pallaruguda Mdl:Sangem Warangal',
    bloodGroup: 'B+',
    admissionDate: '2025-08-01',
    studentStatus: 'ACTIVE',
  };

  it('1. generates a readable plain-text QR payload matching the exact requested 14-field sequence', () => {
    const payload = IDCardDataService.generateStudentQRPayload(baseStudent);

    expect(typeof payload).toBe('string');

    // Expected exact 14 lines
    const lines = payload.split('\n');
    expect(lines).toHaveLength(14);

    // First 8 mandatory fields in exact order
    expect(lines[0]).toBe('SL-NO : 451');
    expect(lines[1]).toBe('HALL-TICKET-NO : 255671870L');
    expect(lines[2]).toBe('NAME : CHAVAN PAVITHRA');
    expect(lines[3]).toBe('FATHER-S-NAME : RAVI');
    expect(lines[4]).toBe('COURSE : B.TECH (IT)');
    expect(lines[5]).toBe('ADDRESS : # Pallaruguda Mdl:Sangem Warangal');
    expect(lines[6]).toBe('MOBILE-NO : 9959155235');
    expect(lines[7]).toBe('VALID-UPTO- : 2025-2028');

    // Appended preserved fields
    expect(lines[8]).toBe('BRANCH : IT');
    expect(lines[9]).toBe('ACADEMIC-YEAR : 2025-2028');
    expect(lines[10]).toBe('ADMISSION-YEAR : 2025');
    expect(lines[11]).toBe('COLLEGE-NAME : KU COLLEGE OF ENGINEERING & TECHNOLOGY');
    expect(lines[12]).toBe('COLLEGE-ADDRESS : Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009');
    expect(lines[13]).toBe('BLOOD-GROUP : B+');
  });

  it('2. matches the illustrative Section 4 example output exactly for SURARAPU SUSMITHA', () => {
    const susmitha = {
      slNo: 451,
      rollNo: '26567T0058',
      studentName: 'SURARAPU SUSMITHA',
      fatherName: 'SURARAPU KUMAR',
      branch: 'CIVIL',
      courseDisplay: 'B.TECH (CIVIL)',
      studentAddress: '16-4-106, GOPALAPURAM, 8 DIVISION, KHAMMAM, TELANGANA, 507002, India',
      studentPhone: '9966336258',
      batch: '2026-2030',
      bloodGroup: 'B+',
    };

    const payload = IDCardDataService.generateStudentQRPayload(susmitha);

    const expected = [
      'SL-NO : 451',
      'HALL-TICKET-NO : 26567T0058',
      'NAME : SURARAPU SUSMITHA',
      'FATHER-S-NAME : SURARAPU KUMAR',
      'COURSE : B.TECH (CIVIL)',
      'ADDRESS : 16-4-106, GOPALAPURAM, 8 DIVISION, KHAMMAM, TELANGANA, 507002, India',
      'MOBILE-NO : 9966336258',
      'VALID-UPTO- : 2026-2030',
      'BRANCH : CIVIL',
      'ACADEMIC-YEAR : 2026-2030',
      'ADMISSION-YEAR : 2026',
      'COLLEGE-NAME : KU COLLEGE OF ENGINEERING & TECHNOLOGY',
      'COLLEGE-ADDRESS : Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009',
      'BLOOD-GROUP : B+',
    ].join('\n');

    expect(payload).toBe(expected);
  });

  it('3. generates a high-contrast data:image/png URL', async () => {
    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(baseStudent);

    expect(qrUrl).toBeDefined();
    expect(qrUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('4. optically decodes generated QR code image and verifies exact human-readable text output', async () => {
    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(baseStudent);
    const decodedText = await decodeQRDataUrl(qrUrl);

    expect(decodedText).toBeDefined();
    expect(decodedText).toBe([
      'SL-NO : 451',
      'HALL-TICKET-NO : 255671870L',
      'NAME : CHAVAN PAVITHRA',
      'FATHER-S-NAME : RAVI',
      'COURSE : B.TECH (IT)',
      'ADDRESS : # Pallaruguda Mdl:Sangem Warangal',
      'MOBILE-NO : 9959155235',
      'VALID-UPTO- : 2025-2028',
      'BRANCH : IT',
      'ACADEMIC-YEAR : 2025-2028',
      'ADMISSION-YEAR : 2025',
      'COLLEGE-NAME : KU COLLEGE OF ENGINEERING & TECHNOLOGY',
      'COLLEGE-ADDRESS : Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009',
      'BLOOD-GROUP : B+',
    ].join('\n'));
  });

  it('5. strictly confirms absence of JSON markers, schemaVersion, type, studentId, and raw database metadata', () => {
    const payload = IDCardDataService.generateStudentQRPayload(baseStudent);

    // No JSON object or syntax
    expect(payload.trim().startsWith('{')).toBe(false);
    expect(payload.trim().endsWith('}')).toBe(false);

    // Required exclusions
    expect(payload).not.toContain('schemaVersion');
    expect(payload).not.toContain('KUCET_STUDENT_ID');
    expect(payload).not.toContain('studentId');
    expect(payload).not.toContain('"type"');
    expect(payload).not.toContain('"fullName"');
    expect(payload).not.toContain('"hallTicketNumber"');
  });

  it('6. official serial number uses student slNo / sNo and NEVER substitutes internal database id', () => {
    // Case A: Official serial number present
    const studentWithSerial = {
      ...baseStudent,
      id: 999999, // Internal DB ID
      slNo: 789,
    };
    const payloadA = IDCardDataService.generateStudentQRPayload(studentWithSerial);
    expect(payloadA).toContain('SL-NO : 789');
    expect(payloadA).not.toContain('999999');

    // Case B: sNo alias present
    const studentWithSNo = {
      ...baseStudent,
      id: 888888,
      slNo: null,
      sNo: 54,
    };
    const payloadB = IDCardDataService.generateStudentQRPayload(studentWithSNo);
    expect(payloadB).toContain('SL-NO : 54');
    expect(payloadB).not.toContain('888888');

    // Case C: No serial number assigned
    const studentWithoutSerial = {
      ...baseStudent,
      id: 212227, // Internal DB ID
      slNo: null,
      sNo: null,
    };
    const payloadC = IDCardDataService.generateStudentQRPayload(studentWithoutSerial);
    expect(payloadC).toContain('SL-NO : \n');
    expect(payloadC).not.toContain('212227');
  });

  it('7. preserves distinct roll number as ROLL-NO only if distinct from hallTicketNumber', () => {
    const studentWithDistinctRoll = {
      ...baseStudent,
      rollNo: '255671870L',
      roll: 'DISTINCT-ROLL-99',
    };
    const payload = IDCardDataService.generateStudentQRPayload(studentWithDistinctRoll);
    expect(payload).toContain('ROLL-NO : DISTINCT-ROLL-99');

    // Identical roll should not produce redundant duplicate line
    const studentWithSameRoll = {
      ...baseStudent,
      rollNo: '255671870L',
      roll: '255671870L',
    };
    const payloadSame = IDCardDataService.generateStudentQRPayload(studentWithSameRoll);
    expect(payloadSame).not.toContain('ROLL-NO :');
  });

  it('8. preserves spaces, special characters, and Unicode names without corruption', async () => {
    const complexStudent = {
      ...baseStudent,
      slNo: 12,
      rollNo: '26567T1599',
      studentName: "MOHAMMED AFZAL D'SOUZA",
      fatherName: 'DR. S. K. D\'SOUZA & CO.',
      courseDisplay: 'B.TECH (ECE)',
      studentAddress: 'Plot #42/B, Flat G-1, St. Mary\'s Enclave, Road No. 7, Hyderabad - 500034',
    };

    const payload = IDCardDataService.generateStudentQRPayload(complexStudent);

    expect(payload).toContain("NAME : MOHAMMED AFZAL D'SOUZA");
    expect(payload).toContain("FATHER-S-NAME : DR. S. K. D'SOUZA & CO.");
    expect(payload).toContain("ADDRESS : Plot #42/B, Flat G-1, St. Mary's Enclave, Road No. 7, Hyderabad - 500034");

    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(complexStudent);
    expect(qrUrl).toMatch(/^data:image\/png;base64,/);

    const decoded = await decodeQRDataUrl(qrUrl);
    expect(decoded).toContain("NAME : MOHAMMED AFZAL D'SOUZA");
    expect(decoded).toContain("FATHER-S-NAME : DR. S. K. D'SOUZA & CO.");
  });

  it('9. handles long names and multi-line addresses gracefully by formatting onto a single line', async () => {
    const longStudent = {
      ...baseStudent,
      slNo: 88,
      studentName: 'CHINTHAPATLA SRI VENKATA SATYA SAI SURYA TEJA',
      fatherName: 'CHINTHAPATLA VEERA VENKATA SATYANARAYANA MURTHY',
      studentAddress: 'D.NO: 4-12-89/1A\nFLAT NO: 402, SRI BALAJI TOWERS\nNEAR RTC BUS STAND ROAD\nMANDAPETA, ANDHRA PRADESH - 533308',
    };

    const payload = IDCardDataService.generateStudentQRPayload(longStudent);
    const lines = payload.split('\n');

    expect(lines).toHaveLength(14);
    expect(lines[5]).toBe('ADDRESS : D.NO: 4-12-89/1A, FLAT NO: 402, SRI BALAJI TOWERS, NEAR RTC BUS STAND ROAD, MANDAPETA, ANDHRA PRADESH - 533308');

    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(longStudent);
    expect(qrUrl).toBeDefined();

    const decoded = await decodeQRDataUrl(qrUrl);
    expect(decoded.split('\n')).toHaveLength(14);
  });

  it('10. handles missing optional fields gracefully without printing undefined, null, or misleading placeholder data', () => {
    const minimalStudent = {
      id: 99,
      rollNo: '26567T0001',
      studentName: null,
      fatherName: null,
      branch: 'CIVIL',
      batch: null,
      courseDisplay: null,
      studentPhone: null,
      studentAddress: null,
      bloodGroup: null,
      admissionDate: null,
    };

    const payload = IDCardDataService.generateStudentQRPayload(minimalStudent);
    const lines = payload.split('\n');

    expect(lines).toHaveLength(14);
    expect(lines[0]).toBe('SL-NO : ');
    expect(lines[1]).toBe('HALL-TICKET-NO : 26567T0001');
    expect(lines[2]).toBe('NAME : ');
    expect(lines[3]).toBe('FATHER-S-NAME : ');
    expect(lines[4]).toBe('COURSE : B.TECH (CIVIL)');
    expect(lines[5]).toBe('ADDRESS : ');
    expect(lines[6]).toBe('MOBILE-NO : ');
    expect(lines[7]).toBe('VALID-UPTO- : 2026-2030'); // Derived from 26567T0001
    expect(lines[8]).toBe('BRANCH : CIVIL');
    expect(lines[9]).toBe('ACADEMIC-YEAR : 2026-2030');
    expect(lines[10]).toBe('ADMISSION-YEAR : 2026');
    expect(lines[11]).toBe('COLLEGE-NAME : KU COLLEGE OF ENGINEERING & TECHNOLOGY');
    expect(lines[12]).toBe('COLLEGE-ADDRESS : Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009');
    expect(lines[13]).toBe('BLOOD-GROUP : ');

    // No placeholder artifacts
    expect(payload).not.toContain('undefined');
    expect(payload).not.toContain('null');
    expect(payload).not.toContain('N/A');
    expect(payload).not.toContain('NaN');
  });

  it('11. strictly excludes credentials, secrets, tokens, and database passwords', () => {
    const studentWithSecrets = {
      ...baseStudent,
      password_hash: 'secret_hash_123',
      session_token: 'secret_token_abc',
      otp: '123456',
      db_password: 'super_secret_db',
    };

    const payload = IDCardDataService.generateStudentQRPayload(studentWithSecrets);

    expect(payload).not.toContain('secret_hash');
    expect(payload).not.toContain('secret_token');
    expect(payload).not.toContain('123456');
    expect(payload).not.toContain('super_secret_db');
  });

  it('12. attendance scanner extracts correct roll number from the readable plain-text payload', () => {
    const payload = IDCardDataService.generateStudentQRPayload(baseStudent);

    const extracted = extractRollNumberFromQR(payload);
    expect(extracted).toBe('255671870L');
  });

  it('13. attendance scanner retains backward compatibility for legacy JSON and plain text formats', () => {
    // Legacy format
    const legacyJson = JSON.stringify({
      roll: '255670901',
      name: 'PREVIOUS STUDENT',
      branch: 'CSE',
      batch: '2025-2029',
    });
    expect(extractRollNumberFromQR(legacyJson)).toBe('255670901');

    // Plain text
    expect(extractRollNumberFromQR('225670901')).toBe('225670901');

    // Labeled text
    expect(extractRollNumberFromQR('HT NO: 225671501')).toBe('225671501');
    expect(extractRollNumberFromQR('ROLL NO: 26567T0901')).toBe('26567T0901');

    // Lateral entry
    expect(extractRollNumberFromQR('235670901L')).toBe('235670901L');
  });

  it('14. attendance scanner safely rejects invalid or malformed data', () => {
    expect(extractRollNumberFromQR(null)).toBeNull();
    expect(extractRollNumberFromQR('')).toBeNull();
    expect(extractRollNumberFromQR('HELLO WORLD THIS IS NOT A ROLL NUMBER')).toBeNull();
    expect(extractRollNumberFromQR('{"random":"data"}')).toBeNull();
  });

  it('15. standalone buildStudentIDCardQRPayload function is exported and behaves identically', () => {
    const standalonePayload = buildStudentIDCardQRPayload(baseStudent);
    const servicePayload = IDCardDataService.generateStudentQRPayload(baseStudent);

    expect(standalonePayload).toBe(servicePayload);
    expect(standalonePayload).toContain('HALL-TICKET-NO : 255671870L');
    expect(standalonePayload).toContain('BRANCH : IT');
    expect(standalonePayload).toContain('BLOOD-GROUP : B+');
  });
});
