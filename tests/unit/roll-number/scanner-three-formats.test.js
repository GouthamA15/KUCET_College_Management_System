import { describe, it, expect } from 'vitest';
import { extractRollNumberFromQR } from '@/lib/rollNumber';

describe('Attendance Scanner Multi-Format QR Compatibility & Security Suite', () => {
  // ─── 1. FORMAT A: PLAIN ROLL NUMBER ───────────────────────────────────────
  describe('Format A: Plain Roll Number', () => {
    it('1.1. extracts valid 10-character regular roll number', () => {
      expect(extractRollNumberFromQR('24567T0942')).toBe('24567T0942');
      expect(extractRollNumberFromQR('23567T0901')).toBe('23567T0901');
      expect(extractRollNumberFromQR('26567T0058')).toBe('26567T0058');
    });

    it('1.2. extracts lateral entry roll numbers ending in L', () => {
      expect(extractRollNumberFromQR('255671870L')).toBe('255671870L');
      expect(extractRollNumberFromQR('235670901L')).toBe('235670901L');
    });

    it('1.3. canonicalizes lowercase roll numbers safely', () => {
      expect(extractRollNumberFromQR('24567t0942')).toBe('24567T0942');
      expect(extractRollNumberFromQR('255671870l')).toBe('255671870L');
    });
  });

  // ─── 2. FORMAT B: PUBLIC KUCET STUDENT IDENTIFICATION URL ─────────────────
  describe('Format B: Public KUCET Student Identification URL', () => {
    it('2.1. extracts roll number from approved https://kucet.ac.in URL', () => {
      const url = 'https://kucet.ac.in/public/student/24567T0942';
      expect(extractRollNumberFromQR(url)).toBe('24567T0942');
    });

    it('2.2. extracts roll number from approved https://kucet.in URL', () => {
      const url = 'https://kucet.in/public/student/23567T0901';
      expect(extractRollNumberFromQR(url)).toBe('23567T0901');
    });

    it('2.3. extracts roll number from subdomains like login.kucet.in', () => {
      const url = 'https://login.kucet.in/public/student/255671870L';
      expect(extractRollNumberFromQR(url)).toBe('255671870L');
    });

    it('2.4. extracts roll number from local development URLs (localhost / 127.0.0.1)', () => {
      expect(extractRollNumberFromQR('http://localhost:3000/public/student/24567T0942')).toBe('24567T0942');
      expect(extractRollNumberFromQR('http://127.0.0.1:3000/public/student/24567T0942')).toBe('24567T0942');
    });

    it('2.5. extracts roll number from Tailscale dev URLs (*.ts.net)', () => {
      const url = 'https://kucet-dev-node.tailf6b4a7.ts.net/public/student/24567T0942';
      expect(extractRollNumberFromQR(url)).toBe('24567T0942');
    });

    it('2.6. handles trailing slashes cleanly on public URLs', () => {
      const url = 'https://kucet.ac.in/public/student/24567T0942/';
      expect(extractRollNumberFromQR(url)).toBe('24567T0942');
    });
  });

  // ─── 3. SECURITY GUARDS & REJECTION OF MALICIOUS / UNKNOWN URLS ────────────
  describe('Attendance Scanner Security Guards', () => {
    it('3.1. REJECTS unknown external domains embedding valid roll numbers', () => {
      // Must NOT extract roll numbers from arbitrary untrusted domains!
      expect(extractRollNumberFromQR('https://evil.com/public/student/24567T0942')).toBeNull();
      expect(extractRollNumberFromQR('https://phishing.org/verify?roll=24567T0942')).toBeNull();
      expect(extractRollNumberFromQR('https://attacker-kucet.com/public/student/24567T0942')).toBeNull();
      expect(extractRollNumberFromQR('http://not-kucet.ac.in/public/student/24567T0942')).toBeNull();
    });

    it('3.2. REJECTS unexpected paths on approved KUCET domains', () => {
      // Must strictly require the /public/student/<rollNo> route
      expect(extractRollNumberFromQR('https://kucet.ac.in/admin/dashboard/24567T0942')).toBeNull();
      expect(extractRollNumberFromQR('https://kucet.in/api/v1/students/24567T0942')).toBeNull();
      expect(extractRollNumberFromQR('https://kucet.in/public/unapproved-route/24567T0942')).toBeNull();
      expect(extractRollNumberFromQR('https://kucet.in/public/student/')).toBeNull();
    });

    it('3.3. REJECTS URLs with malformed or invalid roll numbers', () => {
      expect(extractRollNumberFromQR('https://kucet.ac.in/public/student/INVALID_ROLL_123')).toBeNull();
      expect(extractRollNumberFromQR('https://kucet.in/public/student/9999999999')).toBeNull();
      expect(extractRollNumberFromQR('https://kucet.in/public/student/')).toBeNull();
    });

    it('3.4. REJECTS malformed URL strings', () => {
      expect(extractRollNumberFromQR('http://')).toBeNull();
      expect(extractRollNumberFromQR('https:///public/student/24567T0942')).toBeNull();
    });

    it('3.5. REJECTS URLs with unapproved query parameters', () => {
      expect(extractRollNumberFromQR('https://kucet.ac.in/public/student/24567T0942?ref=scanner')).toBeNull();
      expect(extractRollNumberFromQR('https://kucet.ac.in/public/student/24567T0942?token=123')).toBeNull();
    });

    it('3.6. REJECTS URLs with fragment identifiers / hashes', () => {
      expect(extractRollNumberFromQR('https://kucet.ac.in/public/student/24567T0942#section')).toBeNull();
    });

    it('3.7. guarantees zero network fetching during URL parsing', () => {
      // The function is purely synchronous and performs zero HTTP/fetch requests
      const result = extractRollNumberFromQR('https://kucet.ac.in/public/student/24567T0942');
      expect(result).toBe('24567T0942');
    });
  });

  // ─── 4. REGRESSION: ORIGINAL 14-LINE PLAIN-TEXT & LEGACY JSON FORMATS ──────
  describe('Original & Legacy QR Formats Regression', () => {
    it('4.1. extracts roll number from original 14-line plain text ID card format', () => {
      const originalPayload = [
        'SL-NO : 451',
        'HALL-TICKET-NO : 24567T0942',
        'NAME : GOUTHAM ARRA',
        'FATHER-S-NAME : VENKATESHWARLU',
        'COURSE : B.TECH (CSE)',
        'ADDRESS : H.No. 1-2-3, Subedari, Warangal',
        'MOBILE-NO : 9876543210',
        'VALID-UPTO- : 2024-2028',
        'BRANCH : CSE',
        'ACADEMIC-YEAR : 2024-2028',
        'ADMISSION-YEAR : 2024',
        'COLLEGE-NAME : KU COLLEGE OF ENGINEERING & TECHNOLOGY',
        'COLLEGE-ADDRESS : Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009',
        'BLOOD-GROUP : O+',
      ].join('\n');

      expect(extractRollNumberFromQR(originalPayload)).toBe('24567T0942');
    });

    it('4.2. extracts roll number from legacy structured JSON format', () => {
      const legacyJson = JSON.stringify({
        schemaVersion: 1,
        type: 'KUCET_STUDENT_ID',
        hallTicketNumber: '24567T0942',
        fullName: 'GOUTHAM ARRA',
        branch: 'CSE',
      });

      expect(extractRollNumberFromQR(legacyJson)).toBe('24567T0942');
    });

    it('4.3. extracts roll number from legacy minimal JSON format', () => {
      const minimalJson = JSON.stringify({
        roll: '255671870L',
        name: 'CHAVAN PAVITHRA',
      });

      expect(extractRollNumberFromQR(minimalJson)).toBe('255671870L');
    });

    it('4.4. extracts roll number from labeled text (e.g. HT NO: ...)', () => {
      expect(extractRollNumberFromQR('HT NO: 24567T0942')).toBe('24567T0942');
      expect(extractRollNumberFromQR('ROLL NO: 24567T0942')).toBe('24567T0942');
      expect(extractRollNumberFromQR('HALL-TICKET-NO : 24567T0942')).toBe('24567T0942');
    });

    it('4.5. safely handles empty, null, or garbage inputs', () => {
      expect(extractRollNumberFromQR(null)).toBeNull();
      expect(extractRollNumberFromQR(undefined)).toBeNull();
      expect(extractRollNumberFromQR('')).toBeNull();
      expect(extractRollNumberFromQR('   ')).toBeNull();
      expect(extractRollNumberFromQR('NOT A ROLL NUMBER AT ALL')).toBeNull();
    });
  });
});
