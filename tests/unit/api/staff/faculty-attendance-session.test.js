import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/staff/faculty/attendance/session/route';
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
  getNow: vi.fn(() => new Date('2026-09-12T10:00:00Z')),
}));

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn(),
}));

describe('Faculty Attendance Session API (/api/staff/faculty/attendance/session)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DELETE', () => {
    it('returns 401 if user is not authenticated or not faculty/admin', async () => {
      getAuthUser.mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session?assignment_id=101', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 if assignment_id is missing', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE', is_hod: false });
      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing assignment_id');
    });

    it('returns 404 if assignment does not exist', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE', is_hod: false });
      db.select = vi.fn().mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([])
          })
        })
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session?assignment_id=999', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Assignment not found');
    });

    it('returns message if no active session is found', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE', is_hod: false });
      db.select = vi.fn()
        // Assignment exists
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 101, branch: 'CSE', faculty_id: 10 }])
            })
          })
        })
        // No active session
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([])
            })
          })
        });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session?assignment_id=101', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('No active session found');
    });

    it('allows primary faculty to end the active session', async () => {
      getAuthUser.mockResolvedValue({ id: 10, role: 'faculty', branch: 'CSE', is_hod: false });
      db.select = vi.fn()
        // Assignment query
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 101, branch: 'CSE', faculty_id: 10 }])
            })
          })
        })
        // Active session query
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 501, faculty_id: 10 }])
            })
          })
        });

      const updateWhere = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateWhere
        })
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session?assignment_id=101', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Session ended successfully');
      expect(updateWhere).toHaveBeenCalled();
    });

    it('allows branch HOD to end a session created by someone else', async () => {
      // HOD user is faculty id 99, branch CSE, is_hod true
      getAuthUser.mockResolvedValue({ id: 99, role: 'faculty', branch: 'CSE', is_hod: true });
      db.select = vi.fn()
        // Assignment query: primary faculty is 10
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 101, branch: 'CSE', faculty_id: 10 }])
            })
          })
        })
        // Active session query: created by substitute faculty 20
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 501, faculty_id: 20 }])
            })
          })
        });

      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
        })
      });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session?assignment_id=101', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Session ended successfully');
    });

    it('rejects unauthorized faculty from another department or unassigned faculty', async () => {
      // User is faculty id 50, branch ECE, not assigned, not creator, not HOD of CSE
      getAuthUser.mockResolvedValue({ id: 50, role: 'faculty', branch: 'ECE', is_hod: false });
      db.select = vi.fn()
        // Assignment query
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 101, branch: 'CSE', faculty_id: 10 }])
            })
          })
        })
        // Active session query
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 501, faculty_id: 10 }])
            })
          })
        });

      const req = new Request('http://localhost:3000/api/staff/faculty/attendance/session?assignment_id=101', { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('You are not authorized to end this session');
    });
  });
});
