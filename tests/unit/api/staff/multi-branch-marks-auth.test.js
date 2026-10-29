import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/staff/faculty/marks/route';
import { getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';
import logger from '@/lib/logger';

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/academic-utils', () => ({
  isSemesterActive: vi.fn().mockResolvedValue(true),
  getTheoryPattern: vi.fn().mockReturnValue({ midMax: 20 }),
  resolveCanonicalSubjectType: vi.fn().mockReturnValue({ status: 'RESOLVED', is_lab: false, subject_type: 'theory' }),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve({ insertId: 1 })) })),
    transaction: vi.fn(),
  },
}));

function createChainMock(resolveValue = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resolveValue)),
    then: (fn) => Promise.resolve(resolveValue).then(fn),
  };
  return chain;
}

describe('Multi-Branch Marks Authorization & Monitoring Isolation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockImplementation(() => createChainMock([]));
  });

  describe('GET /api/staff/faculty/marks (Read Inspection)', () => {
    it('allows multi-branch HOD to inspect marks within authorized branches', async () => {
      getAuthUser.mockResolvedValue({
        id: 20,
        role: 'faculty',
        branch: 'CSE',
        is_hod: true,
        authorized_branches: ['CSE', 'IT', 'CSD']
      });

      // 1. Assignment lookup (in IT branch)
      db.select.mockReturnValueOnce(createChainMock([{
        id: 80,
        faculty_id: 12,
        subject_code: 'IT301',
        branch: 'IT',
        course_semester: 3,
        academic_year: '2025-26',
        mid_max: 20,
        canonical_subject_type: 'theory'
      }]));

      // 2. Canonical assignment lookup
      db.select.mockReturnValueOnce(createChainMock([{ id: 80 }]));

      // 3. Student list with marks
      db.select.mockReturnValueOnce(createChainMock([
        { id: 1, roll_no: '24567T1801', name: 'Student 1', is_published: 1, mid1_marks: 18 }
      ]));

      const req = new Request('http://localhost/api/staff/faculty/marks?assignment_id=80');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBe(1);
    });

    it('rejects HOD attempting to inspect marks outside authorized branches', async () => {
      getAuthUser.mockResolvedValue({
        id: 20,
        role: 'faculty',
        branch: 'CSE',
        is_hod: true,
        authorized_branches: ['CSE']
      });

      // Assignment in MECH
      db.select.mockReturnValueOnce(createChainMock([{
        id: 85,
        faculty_id: 14,
        subject_code: 'ME301',
        branch: 'MECH',
        course_semester: 3,
        academic_year: '2025-26',
        mid_max: 20,
        canonical_subject_type: 'theory'
      }]));

      // Substitute check
      db.select.mockReturnValueOnce(createChainMock([]));

      const req = new Request('http://localhost/api/staff/faculty/marks?assignment_id=85');
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it('allows First Year Coordinator to inspect marks for Semester 1 or 2 across any branch', async () => {
      getAuthUser.mockResolvedValue({
        id: 30,
        role: 'faculty',
        branch: 'ECE',
        is_first_year_coordinator: true
      });

      // Assignment in EEE Sem 2
      db.select.mockReturnValueOnce(createChainMock([{
        id: 90,
        faculty_id: 15,
        subject_code: 'EE101',
        branch: 'EEE',
        course_semester: 2,
        academic_year: '2025-26',
        mid_max: 20,
        canonical_subject_type: 'theory'
      }]));

      // Canonical lookup
      db.select.mockReturnValueOnce(createChainMock([{ id: 90 }]));

      // Students
      db.select.mockReturnValueOnce(createChainMock([]));

      const req = new Request('http://localhost/api/staff/faculty/marks?assignment_id=90');
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('rejects First Year Coordinator from inspecting Semester 5 marks', async () => {
      getAuthUser.mockResolvedValue({
        id: 30,
        role: 'faculty',
        branch: 'ECE',
        is_first_year_coordinator: true
      });

      // Assignment in EEE Sem 5
      db.select.mockReturnValueOnce(createChainMock([{
        id: 95,
        faculty_id: 15,
        subject_code: 'EE501',
        branch: 'EEE',
        course_semester: 5,
        academic_year: '2025-26',
        mid_max: 20,
        canonical_subject_type: 'theory'
      }]));

      // Substitute check
      db.select.mockReturnValueOnce(createChainMock([]));

      const req = new Request('http://localhost/api/staff/faculty/marks?assignment_id=95');
      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/staff/faculty/marks (Strict Write Isolation)', () => {
    it('strictly forbids First Year Coordinator from modifying/saving marks (monitoring role only)', async () => {
      getAuthUser.mockResolvedValue({
        id: 30,
        role: 'faculty',
        branch: 'ECE',
        is_first_year_coordinator: true
      });

      // Assignment in EEE Sem 1 (Assigned to faculty 15)
      db.select.mockReturnValueOnce(createChainMock([{
        id: 90,
        faculty_id: 15,
        subject_code: 'EE101',
        branch: 'EEE',
        course_semester: 1,
        academic_year: '2025-26',
        mid_max: 20,
        canonical_subject_type: 'theory'
      }]));

      // Substitute check
      db.select.mockReturnValueOnce(createChainMock([]));

      const req = new Request('http://localhost/api/staff/faculty/marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 90,
          marks_data: [{ student_id: 1, mid1_marks: 18 }]
        })
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden');
    });

    it('allows assigned faculty to save marks', async () => {
      getAuthUser.mockResolvedValue({
        id: 15,
        role: 'faculty',
        branch: 'EEE',
        is_hod: false
      });

      // Assignment assigned to user 15
      db.select.mockReturnValueOnce(createChainMock([{
        id: 90,
        faculty_id: 15,
        subject_code: 'EE101',
        branch: 'EEE',
        course_semester: 1,
        academic_year: '2025-26',
        mid_max: 20,
        canonical_subject_type: 'theory'
      }]));

      // Canonical assignment lookup
      db.select.mockReturnValueOnce(createChainMock([{ id: 90 }]));

      // Mock transaction
      db.transaction.mockImplementation(async (cb) => {
        const mockTx = {
          select: vi.fn(() => createChainMock([])),
          insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve({ insertId: 1 })) })),
          update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve({})) })) }))
        };
        return await cb(mockTx);
      });

      const req = new Request('http://localhost/api/staff/faculty/marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: 90,
          marks_data: [{ student_id: 1, mid1_marks: 18 }]
        })
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });
});
