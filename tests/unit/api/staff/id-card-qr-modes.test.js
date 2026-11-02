import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getPreview } from '@/app/api/staff/id-cards/[rollno]/route';
import { POST as generateBulk } from '@/app/api/staff/admission/id-cards/bulk/generate/route';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { BulkIdCardService } from '@/services/admission/id-card/BulkIdCardService';
import { verifyJwt } from '@/lib/auth';
import { cookies, headers } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

vi.mock('@/services/identity/IDCardDataService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    IDCardDataService: {
      ...actual.IDCardDataService,
      getStudentRecordByRollNo: vi.fn(),
      isStudentFirstYear: vi.fn(),
    },
  };
});

vi.mock('@/services/admission/id-card/BulkIdCardService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    BulkIdCardService: {
      ...actual.BulkIdCardService,
      generateBulkZip: vi.fn(),
    },
  };
});

describe('Staff ID Card QR Modes & Authorization Suite', () => {
  const mockAdmissionUser = {
    id: 1,
    staffId: 1,
    role: 'admission',
    is_first_year_coordinator: false,
  };

  const mockCoordinatorUser = {
    id: 2,
    staffId: 2,
    role: 'faculty',
    is_first_year_coordinator: true,
  };

  const mockUnauthorizedUser = {
    id: 3,
    staffId: 3,
    role: 'faculty',
    is_first_year_coordinator: false,
  };

  const mockFirstYearStudent = {
    rollNo: '24567T0942',
    admissionNo: '24567T0942',
    studentName: 'STUDENT ONE',
    branch: 'CSE',
    batch: '2024-2028',
    qrUrl: 'data:image/png;base64,mockQr',
  };

  const setupAuth = (user) => {
    if (!user) {
      cookies.mockResolvedValue({
        get: vi.fn(() => undefined),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      return;
    }

    cookies.mockResolvedValue({
      get: vi.fn((name) => {
        if (name === 'staff_auth' || name === 'admin_auth') return { value: 'valid-token' };
        return undefined;
      }),
    });
    headers.mockResolvedValue({
      get: vi.fn((name) => {
        if (name === 'x-staff-auth' || name === 'x-admin-auth') return 'valid-token';
        return null;
      }),
    });
    verifyJwt.mockResolvedValue(user);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. GET /api/staff/id-cards/[rollno] passes qrMode="roll_number" to IDCardDataService', async () => {
    setupAuth(mockAdmissionUser);
    IDCardDataService.getStudentRecordByRollNo.mockResolvedValue({
      ...mockFirstYearStudent,
      qrMode: 'roll_number',
    });

    const req = new Request('http://localhost:3000/api/staff/id-cards/24567T0942?qrMode=roll_number');
    const res = await getPreview(req, { params: Promise.resolve({ rollno: '24567T0942' }) });

    expect(res.status).toBe(200);
    expect(IDCardDataService.getStudentRecordByRollNo).toHaveBeenCalledWith(
      '24567T0942',
      { qrMode: 'roll_number' }
    );

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.student.qrMode).toBe('roll_number');
  });

  it('2. GET /api/staff/id-cards/[rollno] passes qrMode="public_url" to IDCardDataService', async () => {
    setupAuth(mockCoordinatorUser);
    IDCardDataService.isStudentFirstYear.mockResolvedValue(true);
    IDCardDataService.getStudentRecordByRollNo.mockResolvedValue({
      ...mockFirstYearStudent,
      qrMode: 'public_url',
    });

    const req = new Request('http://localhost:3000/api/staff/id-cards/24567T0942?qrMode=public_url');
    const res = await getPreview(req, { params: Promise.resolve({ rollno: '24567T0942' }) });

    expect(res.status).toBe(200);
    expect(IDCardDataService.getStudentRecordByRollNo).toHaveBeenCalledWith(
      '24567T0942',
      { qrMode: 'public_url' }
    );
  });

  it('3. rejects unauthorized staff without ID card permissions with 403', async () => {
    setupAuth(mockUnauthorizedUser);

    const req = new Request('http://localhost:3000/api/staff/id-cards/24567T0942');
    const res = await getPreview(req, { params: Promise.resolve({ rollno: '24567T0942' }) });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden/i);
  });

  it('4. POST /api/staff/admission/id-cards/bulk/generate accepts qrMode="roll_number"', async () => {
    setupAuth(mockAdmissionUser);
    BulkIdCardService.generateBulkZip.mockResolvedValue({
      success: true,
      jobId: 'job-123',
      downloadUrl: '/api/staff/admission/id-cards/bulk/download/job-123',
      generatedCount: 60,
    });

    const req = new Request('http://localhost:3000/api/staff/admission/id-cards/bulk/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch: 'CSE',
        academicLevel: 'FIRST_YEAR',
        qrMode: 'roll_number',
      }),
    });

    const res = await generateBulk(req, {});
    expect(res.status).toBe(201);
    expect(BulkIdCardService.generateBulkZip).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'CSE',
        academicLevel: 'FIRST_YEAR',
        qrMode: 'roll_number',
      })
    );
  });

  it('5. POST /api/staff/admission/id-cards/bulk/generate accepts qrMode="public_url"', async () => {
    setupAuth(mockCoordinatorUser);
    BulkIdCardService.generateBulkZip.mockResolvedValue({
      success: true,
      jobId: 'job-456',
      downloadUrl: '/api/staff/admission/id-cards/bulk/download/job-456',
      generatedCount: 45,
    });

    const req = new Request('http://localhost:3000/api/staff/admission/id-cards/bulk/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch: 'ALL',
        academicLevel: 'FIRST_YEAR',
        qrMode: 'public_url',
      }),
    });

    const res = await generateBulk(req, {});
    expect(res.status).toBe(201);
    expect(BulkIdCardService.generateBulkZip).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'ALL',
        academicLevel: 'FIRST_YEAR',
        qrMode: 'public_url',
      })
    );
  });
});
