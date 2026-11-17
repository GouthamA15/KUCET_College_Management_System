import { describe, it, expect } from 'vitest';
import { InternshipCompanyService } from '@/services/internships/InternshipCompanyService';

describe('Internship Workflow & Normalization Engine', () => {
  it('normalizes company names into canonical identifiers for deduplication', () => {
    expect(InternshipCompanyService.normalizeName('Google India Pvt. Ltd.')).toBe('googleindiapvtltd');
    expect(InternshipCompanyService.normalizeName('  Infosys   Technologies  ')).toBe('infosystechnologies');
    expect(InternshipCompanyService.normalizeName('Tata Consultancy Services (TCS)')).toBe('tataconsultancyservicestcs');
    expect(InternshipCompanyService.normalizeName('Amazon Web Services, Inc.')).toBe('amazonwebservicesinc');
    expect(InternshipCompanyService.normalizeName('Microsoft-R&D')).toBe('microsoftrd');
  });

  it('matches normalized variants of the same company regardless of punctuation, case, or spacing', () => {
    const raw1 = 'Tech Mahindra Ltd.';
    const raw2 = 'tech   mahindra ltd';
    const raw3 = 'TECH-MAHINDRA LTD!';

    expect(InternshipCompanyService.normalizeName(raw1)).toBe(InternshipCompanyService.normalizeName(raw2));
    expect(InternshipCompanyService.normalizeName(raw2)).toBe(InternshipCompanyService.normalizeName(raw3));
  });

  it('returns empty string for null or non-string inputs safely', () => {
    expect(InternshipCompanyService.normalizeName(null)).toBe('');
    expect(InternshipCompanyService.normalizeName(undefined)).toBe('');
    expect(InternshipCompanyService.normalizeName(12345)).toBe('');
  });
});
