import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authLib from '@/lib/auth';
import { GET as listStaffRequests } from '@/app/api/admin/staff-requests/route.js';
import { POST as approveStaffRequest } from '@/app/api/admin/staff-requests/[id]/approve/route.js';
import { POST as rejectStaffRequest } from '@/app/api/admin/staff-requests/[id]/reject/route.js';
import { GET as listHodRequests } from '@/app/api/admin/hod-requests/route.js';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name) => (name === 'admin_auth' ? { value: 'mock-admin-token' } : undefined))
  })),
  headers: vi.fn(() => new Headers()),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

describe('Admin Staff & HOD Requests Workflow API Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/staff-requests', () => {
    it('should return 401 if user is not authenticated as admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await listStaffRequests(new Request('http://localhost/api/admin/staff-requests'));
      expect(res.status).toBe(401);
    });

    it('should return 200 with formatted registration requests for admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      
      const res = await listStaffRequests(new Request('http://localhost/api/admin/staff-requests'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.requests)).toBe(true);
    });
  });

  describe('POST /api/admin/staff-requests/[id]/approve', () => {
    it('should return 401 if user is not admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await approveStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/999/approve', { method: 'POST' }),
        { params: Promise.resolve({ id: '999' }) }
      );
      expect(res.status).toBe(401);
    });

    it('should return 400 when invalid request ID is supplied', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      const res = await approveStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/invalid/approve', { method: 'POST' }),
        { params: Promise.resolve({ id: 'invalid' }) }
      );
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/admin/staff-requests/[id]/reject', () => {
    it('should reject when rejection reason is too short', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      const res = await rejectStaffRequest(
        new Request('http://localhost/api/admin/staff-requests/1/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason: 'No' })
        }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/hod-requests', () => {
    it('should return 401 if user is not authenticated as admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue(null);
      const res = await listHodRequests(new Request('http://localhost/api/admin/hod-requests'));
      expect(res.status).toBe(401);
    });

    it('should return 200 with enriched HOD requests for admin', async () => {
      vi.spyOn(authLib, 'verifyJwt').mockResolvedValue({ id: 1, email: 'admin@kucet.ac.in', role: 'admin' });
      const res = await listHodRequests(new Request('http://localhost/api/admin/hod-requests'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.requests)).toBe(true);
    });
  });
});
