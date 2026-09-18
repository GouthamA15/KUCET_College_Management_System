import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatInstitutionalDate,
  formatDateTime,
  formatInstitutionalDateTime,
  toMySQLDate,
  parseDate
} from '@/lib/date';

describe('formatDate (DD-MM-YYYY Standard)', () => {
  it('formats SQL DATE strings (YYYY-MM-DD) strictly to DD-MM-YYYY', () => {
    expect(formatDate('2026-09-18')).toBe('18-09-2026');
    expect(formatDate('2026-01-01')).toBe('01-01-2026');
    expect(formatDate('2026-03-09')).toBe('09-03-2026');
    expect(formatDate('2026-12-31')).toBe('31-12-2026');
  });

  it('preserves calendar date for ISO midnight strings without timezone shift', () => {
    expect(formatDate('2026-09-18T00:00:00.000Z')).toBe('18-09-2026');
    expect(formatDate('2026-01-01T00:00:00Z')).toBe('01-01-2026');
  });

  it('keeps already formatted DD-MM-YYYY unchanged', () => {
    expect(formatDate('18-09-2026')).toBe('18-09-2026');
    expect(formatDate('01-01-2026')).toBe('01-01-2026');
    expect(formatDate('09-03-2026')).toBe('09-03-2026');
  });

  it('converts slash dates DD/MM/YYYY and YYYY/MM/DD to DD-MM-YYYY', () => {
    expect(formatDate('18/09/2026')).toBe('18-09-2026');
    expect(formatDate('2026/09/18')).toBe('18-09-2026');
  });

  it('formats Date objects to DD-MM-YYYY using Asia/Kolkata timezone', () => {
    const d = new Date(Date.UTC(2026, 8, 18, 10, 0, 0)); // 2026-09-18 10:00 UTC = 15:30 IST
    expect(formatDate(d)).toBe('18-09-2026');
  });

  it('formats numeric timestamps', () => {
    const timestamp = new Date(Date.UTC(2026, 8, 18, 10, 0, 0)).getTime();
    expect(formatDate(timestamp)).toBe('18-09-2026');
  });

  it('safely handles null, undefined, empty, and invalid values with fallback', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('invalid-date')).toBe('');
    expect(formatDate(null, '-')).toBe('-');
    expect(formatDate(undefined, '—')).toBe('—');
    expect(formatDate('', 'N/A')).toBe('N/A');
    expect(formatDate('not-a-date', '—')).toBe('—');
  });

  it('formatInstitutionalDate behaves identically to formatDate', () => {
    expect(formatInstitutionalDate('2026-09-18')).toBe('18-09-2026');
    expect(formatInstitutionalDate(null)).toBe('');
  });
});

describe('formatDateTime & formatInstitutionalDateTime', () => {
  it('formats date portion strictly as DD-MM-YYYY and preserves time', () => {
    const isoString = '2026-09-18T14:30:00.000Z'; // 20:00 IST
    const result = formatDateTime(isoString);
    expect(result).toContain('18-09-2026');
    expect(result).toMatch(/^18-09-2026 • \d{1,2}:\d{2} (AM|PM)$/);
  });

  it('supports formatInstitutionalDateTime alias', () => {
    const isoString = '2026-09-18T14:30:00.000Z';
    const result = formatInstitutionalDateTime(isoString);
    expect(result).toContain('18-09-2026');
  });

  it('returns fallback for null/empty values', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime('', { fallback: 'N/A' })).toBe('N/A');
  });
});

describe('toMySQLDate & parseDate', () => {
  it('converts DD-MM-YYYY to YYYY-MM-DD for DB queries', () => {
    expect(toMySQLDate('18-09-2026')).toBe('2026-09-18');
  });

  it('preserves YYYY-MM-DD input', () => {
    expect(toMySQLDate('2026-09-18')).toBe('2026-09-18');
  });

  it('parses DD-MM-YYYY into a valid Date object', () => {
    const d = parseDate('18-09-2026');
    expect(d).toBeInstanceOf(Date);
    expect(d.getDate()).toBe(18);
    expect(d.getMonth()).toBe(8);
    expect(d.getFullYear()).toBe(2026);
  });
});
