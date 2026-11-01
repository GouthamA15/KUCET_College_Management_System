import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/coordinator-assignments/route.js';
import { PUT } from '@/app/api/admin/coordinator-assignments/[id]/route.js';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';

let mockCurrentUser = null;
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(async () => mockCurrentUser),
    wrapHandler: (optionsOrHandler) => {
      const opts = typeof optionsOrHandler === 'object' ? optionsOrHandler : {};
      const handler = opts.handler || optionsOrHandler;
      return async (req, context) => {
        const user = mockCurrentUser;
        if (!user || (opts.auth && user.role !== opts.auth)) {
          return { status: 403, json: async () => ({ error: 'Forbidden' }) };
        }
        let data = {};
        if (req.method === 'POST' || req.method === 'PUT') {
          try {
            data = await req.json();
          } catch (_e) {
            data = {};
          }
        }
        return await handler(req, { user, data, context });
      };
    }
  };
});

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb())
  }
}));

describe('Admin Coordinator Assignments API Endpoints', () => {
  beforeEach(() => {
    mockCurrentUser = { id: 1, role: 'admin', email: 'admin@kucet.ac.in' };
  });

  describe('GET /api/admin/coordinator-assignments', () => {
    it('returns assignments list for authorized administrator', async () => {
      vi.spyOn(CoordinatorAssignmentService, 'getCoordinatorAssignments').mockResolvedValueOnce([
        {
          id: 1,
          staff_account_id: 10,
          staff_name: 'Dr. Jane Smith',
          status: 'ACTIVE',
          academic_year: '2024-25',
          start_date: '2024-07-01'
        }
      ]);

      const req = new Request('http://localhost/api/admin/coordinator-assignments');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(1);
      expect(json.data[0].staff_name).toBe('Dr. Jane Smith');
      expect(json.data[0].status).toBe('ACTIVE');
    });

    it('blocks non-admin user with HTTP 403', async () => {
      mockCurrentUser = { id: 50, role: 'faculty', email: 'faculty@kucet.ac.in' };

      const req = new Request('http://localhost/api/admin/coordinator-assignments');
      const res = await GET(req);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/coordinator-assignments', () => {
    it('creates coordinator assignment when payload is valid', async () => {
      vi.spyOn(CoordinatorAssignmentService, 'assignCoordinator').mockResolvedValueOnce({
        id: 5,
        staff_account_id: 10,
        coordinator_type: 'FIRST_YEAR',
        academic_year: '2024-25'
      });

      const req = new Request('http://localhost/api/admin/coordinator-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_account_id: 10,
          academic_year: '2024-25',
          start_date: '2024-07-01',
          end_date: '2025-06-30'
        })
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.id).toBe(5);
    });
  });

  describe('PUT /api/admin/coordinator-assignments/[id]', () => {
    it('revokes assignment when action is REVOKE', async () => {
      vi.spyOn(CoordinatorAssignmentService, 'revokeCoordinator').mockResolvedValueOnce({
        id: 5,
        is_active: false,
        message: 'Coordinator assignment successfully revoked'
      });

      const req = new Request('http://localhost/api/admin/coordinator-assignments/5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE' })
      });

      const res = await PUT(req, { params: Promise.resolve({ id: '5' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('revoked');
    });

    it('updates dates when action is UPDATE_DATES', async () => {
      vi.spyOn(CoordinatorAssignmentService, 'updateCoordinatorDates').mockResolvedValueOnce({
        id: 5,
        start_date: '2024-08-01',
        end_date: '2025-07-31',
        message: 'Appointment dates successfully updated'
      });

      const req = new Request('http://localhost/api/admin/coordinator-assignments/5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_DATES',
          start_date: '2024-08-01',
          end_date: '2025-07-31'
        })
      });

      const res = await PUT(req, { params: Promise.resolve({ id: '5' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain('Appointment dates');
    });

    it('renews coordinator when action is RENEW with YYYY-YYYY format', async () => {
      vi.spyOn(CoordinatorAssignmentService, 'renewCoordinator').mockResolvedValueOnce({
        id: 6,
        staff_account_id: 10,
        coordinator_type: 'FIRST_YEAR',
        academic_year: '2025-2026',
        start_date: '2025-07-01'
      });

      const req = new Request('http://localhost/api/admin/coordinator-assignments/5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RENEW',
          academic_year: '2025-2026',
          start_date: '2025-07-01'
        })
      });

      const res = await PUT(req, { params: Promise.resolve({ id: '5' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.academic_year).toBe('2025-2026');
    });
  });
});
