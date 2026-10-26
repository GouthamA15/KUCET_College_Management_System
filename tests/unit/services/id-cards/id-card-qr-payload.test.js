import { describe, it, expect } from 'vitest';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { extractRollNumberFromQR } from '@/lib/rollNumber';

describe('ID Card QR Payload & Attendance Compatibility Suite', () => {
  const baseStudent = {
    id: 42,
    rollNo: '26567T0901',
    admissionNo: '26567T0901',
    studentName: 'KAVYA REDDY',
    fatherName: 'RAMA REDDY',
    branch: 'CSE',
    batch: '2026-2030',
    courseDisplay: 'B.Tech (CSE)',
    studentPhone: '9876543210',
    studentAddress: 'H.No 1-2-3, Temple Road, Hanamkonda, Warangal, Telangana, 506001',
    bloodGroup: 'O+',
    admissionDate: '2026-08-01',
    studentStatus: 'ACTIVE',
  };

  it('1. generates a structured, versioned QR payload for a valid student record', () => {
    const payload = IDCardDataService.generateStudentQRPayload(baseStudent);

    expect(payload).toBeDefined();
    expect(payload.schemaVersion).toBe(1);
    expect(payload.type).toBe('KUCET_STUDENT_ID');
    expect(payload.studentId).toBe('42');
    expect(payload.hallTicketNumber).toBe('26567T0901');
    expect(payload.roll).toBe('26567T0901');
    expect(payload.fullName).toBe('KAVYA REDDY');
    expect(payload.fatherName).toBe('RAMA REDDY');
    expect(payload.branch).toBe('CSE');
    expect(payload.course).toBe('B.Tech (CSE)');
    expect(payload.academicYear).toBe('2026-2030');
    expect(payload.admissionYear).toBe('2026');
    expect(payload.collegeName).toBe('KU COLLEGE OF ENGINEERING & TECHNOLOGY');
    expect(payload.collegeAddress).toContain('Kakatiya University Campus');
    expect(payload.studentAddress).toBe(baseStudent.studentAddress);
    expect(payload.phone).toBe('9876543210');
    expect(payload.bloodGroup).toBe('O+');
  });

  it('2. generates a high-contrast data:image/png URL', async () => {
    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(baseStudent);

    expect(qrUrl).toBeDefined();
    expect(qrUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('3. QR payload matches the visible ID card student identity fields', () => {
    const payload = IDCardDataService.generateStudentQRPayload(baseStudent);

    expect(payload.hallTicketNumber).toBe(baseStudent.rollNo);
    expect(payload.fullName).toBe(baseStudent.studentName);
    expect(payload.fatherName).toBe(baseStudent.fatherName);
    expect(payload.branch).toBe(baseStudent.branch);
    expect(payload.academicYear).toBe(baseStudent.batch);
  });

  it('4. preserves spaces, special characters, and Unicode names without corruption', async () => {
    const complexStudent = {
      ...baseStudent,
      rollNo: '26567T1599',
      studentName: "MOHAMMED AFZAL D'SOUZA",
      fatherName: 'DR. S. K. D\'SOUZA & CO.',
      studentAddress: 'Plot #42/B, Flat G-1, St. Mary\'s Enclave, Road No. 7, Hyderabad - 500034',
    };

    const payload = IDCardDataService.generateStudentQRPayload(complexStudent);
    const jsonString = JSON.stringify(payload);
    const decoded = JSON.parse(jsonString);

    expect(decoded.fullName).toBe("MOHAMMED AFZAL D'SOUZA");
    expect(decoded.fatherName).toBe("DR. S. K. D'SOUZA & CO.");
    expect(decoded.studentAddress).toBe("Plot #42/B, Flat G-1, St. Mary's Enclave, Road No. 7, Hyderabad - 500034");

    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(complexStudent);
    expect(qrUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('5. handles long names and multi-line addresses gracefully', async () => {
    const longStudent = {
      ...baseStudent,
      studentName: 'CHINTHAPATLA SRI VENKATA SATYA SAI SURYA TEJA',
      fatherName: 'CHINTHAPATLA VEERA VENKATA SATYANARAYANA MURTHY',
      studentAddress: 'D.NO: 4-12-89/1A, FLAT NO: 402, SRI BALAJI TOWERS, NEAR RTC BUS STAND ROAD, MANDAPETA, KONASEEMA DISTRICT, ANDHRA PRADESH - 533308',
    };

    const payload = IDCardDataService.generateStudentQRPayload(longStudent);
    expect(payload.fullName.length).toBeGreaterThan(40);
    expect(payload.studentAddress.length).toBeGreaterThan(80);

    const qrUrl = await IDCardDataService.generateStudentQRDataUrl(longStudent);
    expect(qrUrl).toBeDefined();
    expect(qrUrl.length).toBeGreaterThan(500);
  });

  it('6. handles missing optional fields consistently without placeholder artifacts', () => {
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
    expect(payload.fullName).toBe('N/A');
    expect(payload.fatherName).toBe('N/A');
    expect(payload.academicYear).toBe('N/A');
    expect(payload.admissionYear).toBe('N/A');
    expect(payload.studentAddress).toBe('N/A');
    expect(payload.phone).toBe('N/A');
    expect(payload.bloodGroup).toBe('N/A');
    expect(payload.course).toBe('B.Tech (CIVIL)');
  });

  it('7. strictly excludes credentials, secrets, tokens, and database passwords', () => {
    const studentWithSecrets = {
      ...baseStudent,
      password_hash: 'secret_hash_123',
      session_token: 'secret_token_abc',
      otp: '123456',
      db_password: 'super_secret_db',
    };

    const payload = IDCardDataService.generateStudentQRPayload(studentWithSecrets);
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain('secret_hash');
    expect(serialized).not.toContain('secret_token');
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('super_secret_db');
    expect(payload.password_hash).toBeUndefined();
    expect(payload.session_token).toBeUndefined();
    expect(payload.otp).toBeUndefined();
  });

  it('8. attendance scanner extracts correct roll number from the structured JSON payload', () => {
    const payload = IDCardDataService.generateStudentQRPayload(baseStudent);
    const jsonString = JSON.stringify(payload);

    const extracted = extractRollNumberFromQR(jsonString);
    expect(extracted).toBe('26567T0901');
  });

  it('9. attendance scanner retains backward compatibility for legacy JSON and plain text formats', () => {
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

  it('10. attendance scanner safely rejects invalid or malformed data', () => {
    expect(extractRollNumberFromQR(null)).toBeNull();
    expect(extractRollNumberFromQR('')).toBeNull();
    expect(extractRollNumberFromQR('HELLO WORLD THIS IS NOT A ROLL NUMBER')).toBeNull();
    expect(extractRollNumberFromQR('{"random":"data"}')).toBeNull();
  });
});
