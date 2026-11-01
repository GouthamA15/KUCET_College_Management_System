import { describe, it, expect, vi } from 'vitest';
import { GET as sessionPdfGET } from '@/app/api/staff/faculty/attendance/session/pdf/route';
import { GET as fullPdfGET } from '@/app/api/staff/faculty/attendance/export/pdf/route';
import { GET as fullCsvGET } from '@/app/api/staff/faculty/attendance/export/csv/route';
import { getAuthUser } from '@/lib/api-utils';
import { staffAccounts } from '@/db/schema';

const hasLiveDb = Boolean(process.env.DB_HOST && process.env.SKIP_ENV_VALIDATION !== 'true');

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

describe('Attendance Export Integration Suite against Live Assignment 450014', () => {
  it('verifies staffAccounts schema has name column and not full_name', () => {
    expect(staffAccounts.name).toBeDefined();
    expect(staffAccounts.full_name).toBeUndefined();
  });

  it.skipIf(!hasLiveDb)('generates real Attendance Session PDF for assignment 450014, date 2026-10-28, session 2', async () => {
    getAuthUser.mockResolvedValue({
      id: 90001,
      role: 'faculty',
      branch: 'CSE',
      full_name: 'Sune Bhai kumar Nilla'
    });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session/pdf?assignment_id=450014&date=2026-10-28&session=2');
    const res = await sessionPdfGET(req);
    if (res.status !== 200) {
      const errBody = await res.json();
      console.log('Session PDF non-200 response:', res.status, errBody);
    }

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attendance_PE4102CS_28_10_2026_S2.pdf');

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF Magic number verification
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  }, 30000);

  it.skipIf(!hasLiveDb)('generates real Full Attendance PDF for assignment 450014', async () => {
    getAuthUser.mockResolvedValue({
      id: 90001,
      role: 'faculty',
      branch: 'CSE',
      full_name: 'Sune Bhai kumar Nilla'
    });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/pdf?assignment_id=450014');
    const res = await fullPdfGET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attendance_register_PE4102CS_CSE_Sem7.pdf');

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF Magic number verification
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  }, 30000);

  it.skipIf(!hasLiveDb)('generates real Full Attendance CSV for assignment 450014', async () => {
    getAuthUser.mockResolvedValue({
      id: 90001,
      role: 'faculty',
      branch: 'CSE',
      full_name: 'Sune Bhai kumar Nilla'
    });

    const req = new Request('http://localhost:3000/api/staff/faculty/attendance/export/csv?assignment_id=450014');
    const res = await fullCsvGET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('attendance_register_PE4102CS_Sem7.csv');

    const csvText = await res.text();
    expect(csvText.length).toBeGreaterThan(100);
    expect(csvText).toContain('KU COLLEGE OF ENGINEERING & TECHNOLOGY - ATTENDANCE REGISTER');
    expect(csvText).toContain('PE4102CS');
    expect(csvText).toContain('Sune Bhai kumar Nilla');
    expect(csvText).toContain('"Roll Number","Student Name"');
    expect(csvText).toContain('TOTAL PRESENT');
    // Verify standard DD-MM-YYYY format in session column headers
    expect(csvText).toContain('28-10-2026 (S2)');
  }, 30000);
});
