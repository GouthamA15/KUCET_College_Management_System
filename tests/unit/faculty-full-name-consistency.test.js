import { describe, it, expect } from 'vitest';
import { formatFacultyName } from '@/lib/staff-config';
import fs from 'fs';
import path from 'path';

describe('P2 Faculty Full Name Consistency Suite', () => {
  it('preserves a faculty member with a two-part name completely', () => {
    const raw = 'Goutham Masna';
    const formatted = formatFacultyName(raw);
    expect(formatted).toBe('Goutham Masna');
  });

  it('preserves a faculty member with three or more name components completely without truncation', () => {
    const raw = 'Dr. Panchakatla Harsha Sai';
    const formatted = formatFacultyName(raw);
    expect(formatted).toBe('Dr. Panchakatla Harsha Sai');
    expect(formatted).not.toBe('Dr.');
    expect(formatted).not.toBe('Panchakatla');
  });

  it('preserves names containing initials and spaces exactly as stored', () => {
    const raw = 'P. Sannith Reddy';
    const formatted = formatFacultyName(raw);
    expect(formatted).toBe('P. Sannith Reddy');

    const multiInitial = 'K. V. R. Prasad';
    expect(formatFacultyName(multiInitial)).toBe('K. V. R. Prasad');
  });

  it('handles accidental leading or trailing edge whitespace safely while preserving internal spaces', () => {
    const padded = '   Dr. Anneun Kumar   ';
    expect(formatFacultyName(padded)).toBe('Dr. Anneun Kumar');
  });

  it('preserves names containing non-English characters and special institutional formatting', () => {
    const nonEnglish = 'డా. గౌతమ్ మస్నా';
    expect(formatFacultyName(nonEnglish)).toBe('డా. గౌతమ్ మస్నా');
  });

  it('uses clearly documented fallback without fabricating name components when missing or invalid', () => {
    expect(formatFacultyName(null)).toBe('Faculty');
    expect(formatFacultyName(undefined)).toBe('Faculty');
    expect(formatFacultyName('')).toBe('Faculty');
    expect(formatFacultyName('   ')).toBe('Faculty');
    expect(formatFacultyName(null, 'Staff')).toBe('Staff');
  });

  it('search can match a faculty member using any component of their complete name (not just first token)', () => {
    const facultyList = [
      { id: 180010, name: 'Dr. Panchakatla Harsha Sai', employee_id: 'KU-180010' },
      { id: 180011, name: 'P. Sannith Reddy', employee_id: 'KU-180011' },
      { id: 180012, name: 'Goutham Masna', employee_id: 'KU-180012' },
    ];

    const searchFaculty = (query) => {
      const q = query.trim().toLowerCase();
      return facultyList.filter(f => f.name.toLowerCase().includes(q) || f.employee_id.toLowerCase().includes(q));
    };

    // Match by last token
    expect(searchFaculty('Sai')).toHaveLength(1);
    expect(searchFaculty('Sai')[0].id).toBe(180010);

    // Match by middle token
    expect(searchFaculty('Sannith')).toHaveLength(1);
    expect(searchFaculty('Sannith')[0].id).toBe(180011);

    // Match by later component
    expect(searchFaculty('Masna')).toHaveLength(1);
    expect(searchFaculty('Masna')[0].id).toBe(180012);
  });

  it('static analysis audit: ensures no `.split(\' \')[0]` exists in faculty dashboard files', () => {
    const filesToAudit = [
      'src/app/staff/faculty/dashboard/FacultyDashboardClient.js',
      'src/app/staff/admission/dashboard/AdmissionDashboardClient.js',
      'src/app/staff/scholarship/dashboard/ScholarshipDashboardClient.js',
    ];

    for (const relPath of filesToAudit) {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).not.toMatch(/staff\?\.name\?\.split\(['"] ['"]\)\[0\]/);
        expect(content).not.toMatch(/firstName\s*=\s*staff/);
      }
    }
  });

  it('static analysis audit: ensures CSP in next.config.mjs permits Cloudflare Web Analytics', () => {
    const configPath = path.resolve(process.cwd(), 'next.config.mjs');
    const content = fs.readFileSync(configPath, 'utf8');
    expect(content).toContain('https://static.cloudflareinsights.com');
    expect(content).toContain('https://cloudflareinsights.com');
  });
});
