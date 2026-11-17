import { describe, it, expect } from 'vitest';
import { InternshipDocumentService } from '@/services/internships/InternshipDocumentService';
import path from 'path';

describe('Internship Document Service - ZIP Export Sanitization', () => {
  it('sanitizes standard alphanumeric path segments', () => {
    expect(InternshipDocumentService.sanitizePathSegment('CSE')).toBe('CSE');
    expect(InternshipDocumentService.sanitizePathSegment('2024-2025')).toBe('2024-2025');
    expect(InternshipDocumentService.sanitizePathSegment('21KU1A0501')).toBe('21KU1A0501');
  });

  it('prevents directory traversal attacks by removing slashes and double dots', () => {
    expect(InternshipDocumentService.sanitizePathSegment('../../etc/passwd')).toBe('etcpasswd');
    expect(InternshipDocumentService.sanitizePathSegment('..\\..\\windows\\system32')).toBe('windowssystem32');
    expect(InternshipDocumentService.sanitizePathSegment('../../../sensitive.key')).toBe('sensitive.key');
  });

  it('replaces dangerous and illegal filesystem characters with underscores', () => {
    expect(InternshipDocumentService.sanitizePathSegment('Company: Name? *')).toBe('Company__Name___');
    expect(InternshipDocumentService.sanitizePathSegment('Folder <Test> | "Quote"')).toBe('Folder__Test_____Quote_');
  });

  it('falls back to default safe string for empty or null inputs', () => {
    expect(InternshipDocumentService.sanitizePathSegment(null, 'GENERAL')).toBe('GENERAL');
    expect(InternshipDocumentService.sanitizePathSegment('', 'FALLBACK')).toBe('FALLBACK');
    expect(InternshipDocumentService.sanitizePathSegment(undefined, 'UNKNOWN')).toBe('UNKNOWN');
  });

  it('constructs canonical ZIP relative path following the required institutional structure', () => {
    const safeBranch = InternshipDocumentService.sanitizePathSegment('CSE');
    const safeYear = InternshipDocumentService.sanitizePathSegment('2024-2025');
    const safeRoll = InternshipDocumentService.sanitizePathSegment('21KU1A0501');
    const safeName = InternshipDocumentService.sanitizePathSegment('Kotha Srikanth');
    const fileName = 'COMPLETION_CERTIFICATE_v1.pdf';

    const rootFolder = `Internship_Documents_${safeYear.replace(/-/g, '_')}`;
    const studentFolder = `${safeRoll}_${safeName}`;
    const zipPath = path.posix.join(rootFolder, safeBranch, studentFolder, fileName);

    expect(zipPath).toBe('Internship_Documents_2024_2025/CSE/21KU1A0501_Kotha_Srikanth/COMPLETION_CERTIFICATE_v1.pdf');
    expect(zipPath.startsWith('Internship_Documents_2024_2025/')).toBe(true);
    expect(zipPath).not.toContain('..');
  });
});
