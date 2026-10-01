import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/student/attendance/verify/route';
import { getAuthUser } from '@/lib/api-utils';
import { db } from '@/db';

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

vi.mock('@/lib/clock', () => ({
  Clock: {
    now: vi.fn(() => new Date('2026-09-20T10:00:00Z')),
  },
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn(),
}));

vi.mock('@/lib/rollNumber', () => ({
  getBranchFromRoll: vi.fn((roll) => {
    if (roll?.includes('567T01')) return 'CSE';
    if (roll?.includes('567T02')) return 'ECE';
    return 'CSE';
  }),
}));

vi.mock('@/lib/academic-utils', () => ({
  calculateYearAndSemesterAsync: vi.fn(() => Promise.resolve({ semester: 5, year: 3 })),
}));

describe('Student Attendance Verification API (/api/student/attendance/verify)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    getAuthUser.mockResolvedValue(null);
    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({ assignment_id: 1, pin: '1234', latitude: 17.98, longitude: 79.53 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects missing location coordinates or verification PIN with 400', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0101' });
    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({ assignment_id: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Location and Verification Data');
  });

  it('rejects non-existent session with 404', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0101' });
    db.query = {
      attendanceSessions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: 999,
        pin: '1234',
        latitude: 17.98,
        longitude: 79.53,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('No attendance session found');
  });

  it('rejects closed session (is_active = false) with 403', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0101' });
    db.query = {
      attendanceSessions: {
        findFirst: vi.fn().mockResolvedValue({
          id: 50,
          assignment_id: 10,
          is_active: false,
          expires_at: new Date('2026-09-20T10:30:00Z'),
          session_pin: '4321',
        }),
      },
    };

    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: 10,
        pin: '4321',
        latitude: 17.98,
        longitude: 79.53,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('ended or is closed');
  });

  it('rejects expired session with 403', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0101' });
    db.query = {
      attendanceSessions: {
        findFirst: vi.fn().mockResolvedValue({
          id: 50,
          assignment_id: 10,
          is_active: true,
          expires_at: new Date('2026-09-20T09:55:00Z'), // in past
          session_pin: '4321',
        }),
      },
    };

    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: 10,
        pin: '4321',
        latitude: 17.98,
        longitude: 79.53,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('expired');
  });

  it('rejects student from a different branch with 403', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0201' }); // ECE student
    db.query = {
      attendanceSessions: {
        findFirst: vi.fn().mockResolvedValue({
          id: 50,
          assignment_id: 10,
          is_active: true,
          expires_at: new Date('2026-09-20T10:10:00Z'),
          session_pin: '4321',
        }),
      },
    };

    db.select = vi.fn().mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([
            { id: 10, branch: 'CSE', course_semester: 5, subject_code: 'CS501' }
          ]),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: 10,
        pin: '4321',
        latitude: 17.98,
        longitude: 79.53,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Branch mismatch');
  });

  it('rejects duplicate verification if student already verified in attendanceSessionLogs', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0101' });
    db.query = {
      attendanceSessions: {
        findFirst: vi.fn().mockResolvedValue({
          id: 50,
          assignment_id: 10,
          is_active: true,
          expires_at: new Date('2026-09-20T10:10:00Z'),
          session_pin: '4321',
        }),
      },
    };

    db.select = vi.fn()
      // Assignment query
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([
              { id: 10, branch: 'CSE', course_semester: 5, subject_code: 'CS501' }
            ]),
          }),
        }),
      })
      // Duplicate check: already verified in attendanceSessionLogs
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 999 }]),
          }),
        }),
      });

    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: 10,
        pin: '4321',
        latitude: 17.98,
        longitude: 79.53,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already verified');
  });

  it('rejects wrong PIN and decrements remaining attempts', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0101' });
    db.query = {
      attendanceSessions: {
        findFirst: vi.fn().mockResolvedValue({
          id: 50,
          assignment_id: 10,
          is_active: true,
          expires_at: new Date('2026-09-20T10:10:00Z'),
          session_pin: '4321',
        }),
      },
    };

    db.select = vi.fn()
      // Assignment query
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([
              { id: 10, branch: 'CSE', course_semester: 5, subject_code: 'CS501' }
            ]),
          }),
        }),
      })
      // Duplicate check logs: none
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      })
      // Duplicate check attendance: none
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      })
      // PIN failure count: 0 failures
      .mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ failed_count: 0, is_locked: 0 }]),
        }),
      });

    db.insert = vi.fn().mockReturnValue({
      values: () => Promise.resolve([{ insertId: 1 }]),
    });

    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: 10,
        pin: '9999', // wrong pin
        latitude: 17.98,
        longitude: 79.53,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Invalid PIN. 2 attempts remaining');
  });

  it('accepts correct PIN, atomic transaction writes log and marks PRESENT in studentAttendance', async () => {
    getAuthUser.mockResolvedValue({ student_id: 101, roll_no: '24567T0101' });
    db.query = {
      attendanceSessions: {
        findFirst: vi.fn().mockResolvedValue({
          id: 50,
          assignment_id: 10,
          session_number: 2,
          attendance_date: '2026-09-20',
          is_active: true,
          expires_at: new Date('2026-09-20T10:10:00Z'),
          session_pin: '4321',
        }),
      },
    };

    db.select = vi.fn()
      // Assignment query
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([
              { id: 10, branch: 'CSE', course_semester: 5, subject_code: 'CS501' }
            ]),
          }),
        }),
      })
      // Duplicate check logs: none
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      })
      // Duplicate check attendance: none
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      })
      // PIN failure count: 0 failures
      .mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ failed_count: 0, is_locked: 0 }]),
        }),
      })
      // Proxy device logs: none
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      })
      // Canonical assignment query
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ id: 10 }]),
            }),
          }),
        }),
      });

    let transactionExecuted = false;
    db.transaction = vi.fn(async (callback) => {
      transactionExecuted = true;
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: () => ({
            onDuplicateKeyUpdate: () => Promise.resolve([{ insertId: 1 }]),
          }),
        }),
      };
      return await callback(tx);
    });

    const req = new Request('http://localhost:3000/api/student/attendance/verify', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: 10,
        session_id: 50,
        pin: '4321',
        latitude: 17.98,
        longitude: 79.53,
        accuracy: 15,
        device_id: 'test_device_uuid_123',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Marked as PRESENT');
    expect(transactionExecuted).toBe(true);
  });
});
