import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as exportHandler } from '@/app/api/staff/id-cards/export/route';
import { GET as listHandler } from '@/app/api/staff/id-cards/route';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { verifyJwt } from '@/lib/auth';
import { cookies, headers } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe('Staff ID Card API Routes (/api/staff/id-cards & /api/staff/id-cards/export)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupAuth = (user) => {
    if (!user) {
      cookies.mockResolvedValue({
        get: vi.fn(() => undefined),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue(null);
    } else {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'staff_auth' || name === 'admin_auth') return { value: 'valid-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: user.id || 101,
        staffId: user.staffId || user.id || 101,
        email: user.email || 'staff@kucet.ac.in',
        role: user.role,
        branch: user.branch,
        department_code: user.department_code,
      });
    }
  };

  describe('GET /api/staff/id-cards/export', () => {
    it('returns 401 when user is unauthenticated', async () => {
      setupAuth(null);

      const req = new Request('http://localhost/api/staff/id-cards/export?branch=CSE');
      const res = await exportHandler(req);

      expect([401, 403]).toContain(res.status);
    });

    it('returns 401 or 403 when user has unauthorized role (e.g. student)', async () => {
      setupAuth({ id: 1, role: 'student' });

      const req = new Request('http://localhost/api/staff/id-cards/export?branch=CSE');
      const res = await exportHandler(req);

      expect([401, 403]).toContain(res.status);
    });

    it('returns 400 when branch parameter is missing', async () => {
      setupAuth({ id: 2, role: 'admission', email: 'admission@kucet.ac.in' });

      const req = new Request('http://localhost/api/staff/id-cards/export');
      const res = await exportHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('branch parameter is required');
    });

    it('returns 403 when departmental staff attempts to export an unauthorized branch', async () => {
      setupAuth({
        id: 3,
        role: 'faculty',
        branch: 'CSE', // Scoped only to CSE
        email: 'faculty.cse@kucet.ac.in',
      });

      const req = new Request('http://localhost/api/staff/id-cards/export?branch=CIVIL');
      const res = await exportHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('returns 200 with Excel stream when admission staff exports a valid branch', async () => {
      setupAuth({ id: 2, role: 'admission', email: 'admission@kucet.ac.in' });

      const mockBuffer = Buffer.from('mock-excel-binary-data');
      vi.spyOn(IDCardDataService, 'exportBranchData').mockResolvedValueOnce({
        buffer: mockBuffer,
        filename: 'KUCET_CSE_ID_CARD_DATA_2026-2030.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        count: 66,
      });

      const req = new Request('http://localhost/api/staff/id-cards/export?branch=CSE&format=xlsx');
      const res = await exportHandler(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers.get('Content-Disposition')).toContain('KUCET_CSE_ID_CARD_DATA_2026-2030.xlsx');
      expect(res.headers.get('X-Total-Count')).toBe('66');
    });

    it('returns 200 with CSV stream when CSV format is requested', async () => {
      setupAuth({ id: 2, role: 'admission', email: 'admission@kucet.ac.in' });

      const mockBuffer = Buffer.from('mock-csv-data');
      vi.spyOn(IDCardDataService, 'exportBranchData').mockResolvedValueOnce({
        buffer: mockBuffer,
        filename: 'KUCET_CSE_ID_CARD_DATA_2026-2030.csv',
        contentType: 'text/csv; charset=utf-8',
        count: 66,
      });

      const req = new Request('http://localhost/api/staff/id-cards/export?branch=CSE&format=csv');
      const res = await exportHandler(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(res.headers.get('Content-Disposition')).toContain('KUCET_CSE_ID_CARD_DATA_2026-2030.csv');
    });

    it('returns 404 when branch has zero eligible finalized students', async () => {
      setupAuth({ id: 2, role: 'admission', email: 'admission@kucet.ac.in' });

      const err = new Error('No eligible finalized students found for branch MECH');
      err.statusCode = 404;
      vi.spyOn(IDCardDataService, 'exportBranchData').mockRejectedValueOnce(err);

      const req = new Request('http://localhost/api/staff/id-cards/export?branch=MECH');
      const res = await exportHandler(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('No eligible finalized students');
    });
  });

  describe('GET /api/staff/id-cards (Listing & Branch Summary)', () => {
    it('returns 200 with paginated authoritative students and branch stats for admission staff', async () => {
      setupAuth({ id: 2, role: 'admission', email: 'admission@kucet.ac.in' });

      vi.spyOn(IDCardDataService, 'getStudentRecords').mockResolvedValueOnce({
        students: [
          {
            rollNo: '26567T0901',
            studentName: 'KAVYA REDDY',
            branch: 'CSE',
            batch: '2026-2030',
            photoStatus: 'AVAILABLE',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        stats: { totalEligible: 1, photosAvailable: 1, photosMissing: 0 },
        branches: [{ branch: 'CSE', totalEligible: 1 }],
      });

      const req = new Request('http://localhost/api/staff/id-cards?branch=CSE&page=1&limit=20');
      const res = await listHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.students.length).toBe(1);
      expect(json.userPermissions.canView).toBe(true);
      expect(json.userPermissions.canGenerate).toBe(true);
    });
  });
});
