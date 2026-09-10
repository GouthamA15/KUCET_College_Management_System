import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiUtils from '@/lib/api-utils';
import { db } from '@/db';
import * as academicUtils from '@/lib/academic-utils';
import { GET as getStudentStats } from '@/app/api/admin/student-stats/route';

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('Admin Student Stats API Route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 401 if user is not authenticated as admin', async () => {
    vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue(null);

    const res = await getStudentStats(new Request('http://localhost/api/admin/student-stats'));
    expect(res.status).toBe(401);
  });

  it('should compute and return active student statistics by branch and year', async () => {
    vi.spyOn(apiUtils, 'getAuthUser').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
    vi.spyOn(academicUtils, 'getCurrentCalendarSession').mockResolvedValue({
      academicYear: '2026-2027',
      semester: 1,
    });

    const mockStudents = [
      { roll_no: '24567T0901' }, // CSE
      { roll_no: '24567T0902' }, // CSE
      { roll_no: '24567T1501' }, // ECE
    ];

    const whereMock = vi.fn().mockResolvedValue(mockStudents);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.spyOn(db, 'select').mockReturnValue({ from: fromMock });

    const res = await getStudentStats(new Request('http://localhost/api/admin/student-stats'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.CSE).toBeDefined();
    expect(body.data.CSE.total).toBe(2);
    expect(body.data.ECE.total).toBe(1);
  });
});
