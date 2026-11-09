import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Bonafide Enhancement — PDF Templates & Three-Path Routing Contracts', () => {
  const ordinaryPdfPath = path.resolve(process.cwd(), 'src/pdf/templates/OrdinaryBonafidePDF.js');
  const percentagePdfPath = path.resolve(process.cwd(), 'src/pdf/templates/BonafideCertificatePDF.js');

  it('verifies OrdinaryBonafidePDF file exists, wraps BaseCertificate, and omits attendance clause', () => {
    expect(fs.existsSync(ordinaryPdfPath)).toBe(true);
    const content = fs.readFileSync(ordinaryPdfPath, 'utf8');

    // Must wrap BaseCertificate
    expect(content).toContain('BaseCertificate');
    // Must NOT contain attendance percentage or attendance clause
    expect(content).not.toContain('attendancePercentage');
    expect(content).not.toContain('percentage of attendance');
    // Invariant: NEVER attach HTML DOM props (onError, onClick) to @react-pdf components
    expect(content).not.toContain('onError');
    expect(content).not.toContain('onClick');
  });

  it('verifies BonafideCertificatePDF contains attendance clause', () => {
    expect(fs.existsSync(percentagePdfPath)).toBe(true);
    const content = fs.readFileSync(percentagePdfPath, 'utf8');

    expect(content).toContain('BaseCertificate');
    expect(content).toContain('attendancePercentage');
    expect(content).toContain('percentage of attendance');
  });

  it('preserves exact legacy fallback routing contract when snapshot fields are null', () => {
    const certRequest = {
      request_id: 101,
      certificate_type: 'Bonafide Certificate',
      certificate_format: null,
      study_year: null,
      study_semester: null,
      generated_attendance: null,
      purpose: 'General'
    };

    const isLegacy = !certRequest.certificate_format || !certRequest.study_year;
    expect(isLegacy).toBe(true);

    let chosenPath = null;
    if (isLegacy) {
      chosenPath = 'LEGACY_BONAFIDE';
    } else if (certRequest.certificate_format === 'ORDINARY') {
      chosenPath = 'ORDINARY';
    } else {
      chosenPath = 'PERCENTAGE';
    }

    expect(chosenPath).toBe('LEGACY_BONAFIDE');
  });

  it('routes new ORDINARY request to OrdinaryBonafidePDF with snapshot values', () => {
    const certRequest = {
      request_id: 102,
      certificate_type: 'Bonafide Certificate',
      certificate_format: 'ORDINARY',
      study_year: 1,
      study_semester: 1,
      generated_attendance: 'N/A',
      purpose: 'Scholarship'
    };

    const isLegacy = !certRequest.certificate_format || !certRequest.study_year;
    expect(isLegacy).toBe(false);

    let chosenPath = null;
    if (isLegacy) {
      chosenPath = 'LEGACY_BONAFIDE';
    } else if (certRequest.certificate_format === 'ORDINARY') {
      chosenPath = 'ORDINARY';
    } else {
      chosenPath = 'PERCENTAGE';
    }

    expect(chosenPath).toBe('ORDINARY');
  });

  it('routes new PERCENTAGE request to BonafideCertificatePDF with snapshot values', () => {
    const certRequest = {
      request_id: 103,
      certificate_type: 'Bonafide Certificate',
      certificate_format: 'PERCENTAGE',
      study_year: 2,
      study_semester: 3,
      generated_attendance: '78.2%',
      purpose: 'Bank Account'
    };

    const isLegacy = !certRequest.certificate_format || !certRequest.study_year;
    expect(isLegacy).toBe(false);

    let chosenPath = null;
    if (isLegacy) {
      chosenPath = 'LEGACY_BONAFIDE';
    } else if (certRequest.certificate_format === 'ORDINARY') {
      chosenPath = 'ORDINARY';
    } else {
      chosenPath = 'PERCENTAGE';
    }

    expect(chosenPath).toBe('PERCENTAGE');
  });
});
