import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/staff/hod/assignments/route';
import { isVerifiedDesignatedSupervisor } from '@/lib/academic-authorization';
import { db } from '@/db';

let mockCurrentUser = null;

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(async () => mockCurrentUser),
    wrapHandler: (optionsOrHandler) => {
      const opts = typeof optionsOrHandler === 'object' ? optionsOrHandler : {};
      const handler = opts.handler || optionsOrHandler;
      return async (req, context = {}) => {
        const user = mockCurrentUser;
        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        const result = await handler(req, { user, context });
        if (result instanceof Response) return result;
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
    }
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
  getCollegeAcademicYear: vi.fn().mockResolvedValue('2025-26'),
  deriveDefaultAcademicYear: vi.fn().mockReturnValue('2025-26'),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

function createChainMock(resolveValue = []) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resolveValue)),
    then: (fn) => Promise.resolve(resolveValue).then(fn),
  };
  return chain;
}

function mockSupervisorDb(staffId = 42, email = 'principal@kucet.ac.in') {
  db.select
    .mockReturnValueOnce(createChainMock([
      { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: String(staffId) }
    ]))
    .mockReturnValueOnce(createChainMock([
      { id: staffId, email, account_status: 'ACTIVE' }
    ]))
    .mockReturnValueOnce(createChainMock([
      { role_code: 'PRINCIPAL' }
    ]));
}

describe('Supervisor Global Authority & Restricted HOD Assignment Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    db.select.mockImplementation(() => createChainMock([]));
  });

  describe('isVerifiedDesignatedSupervisor Safeguard', () => {
    it('returns true when staff account matches the configured designated supervisor ID in systemConfigs', async () => {
      db.select
        .mockReturnValueOnce(createChainMock([
          { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' }
        ]))
        .mockReturnValueOnce(createChainMock([
          { id: 42, email: 'principal@kucet.ac.in', account_status: 'ACTIVE' }
        ]))
        .mockReturnValueOnce(createChainMock([
          { role_code: 'PRINCIPAL' }
        ]));

      const isVerified = await isVerifiedDesignatedSupervisor(42, 'principal@kucet.ac.in');
      expect(isVerified).toBe(true);
    });

    it('returns false when a different staff account with PRINCIPAL role attempts to claim global authority', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' }
      ]));

      // Staff ID 99 is a different account
      const isVerified = await isVerifiedDesignatedSupervisor(99, 'other@kucet.ac.in');
      expect(isVerified).toBe(false);
    });
  });

  describe('/api/staff/hod/assignments Access Control', () => {
    it('rejects ordinary faculty with 403', async () => {
      mockCurrentUser = {
        id: 15,
        role: 'faculty',
        branch: 'CSE',
        is_hod: false,
        is_principal: false
      };

      const req = new Request('http://localhost/api/staff/hod/assignments');
      const res = await GET(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Designated Academic Supervisor');
    });

    it('allows designated supervisor to view HOD assignments and eligible faculty', async () => {
      mockCurrentUser = {
        id: 42,
        role: 'faculty',
        is_principal: true,
        is_designated_supervisor: true,
        branch: 'CSE',
        email: 'principal@kucet.ac.in'
      };

      const mockAssignments = [
        { id: 1, staff_account_id: 10, department_code: 'CSE', is_active: true, staff_name: 'Dr. A' }
      ];
      const mockEligibleFaculty = [
        { id: 10, name: 'Dr. A', status: 'ACTIVE' },
        { id: 11, name: 'Dr. B', status: 'ACTIVE' }
      ];

      mockSupervisorDb(42, 'principal@kucet.ac.in');
      db.select
        .mockReturnValueOnce(createChainMock(mockAssignments))
        .mockReturnValueOnce(createChainMock(mockEligibleFaculty));

      const req = new Request('http://localhost/api/staff/hod/assignments');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.departments.length).toBe(7);
      expect(data.assignments.length).toBe(1);
      expect(data.eligible_faculty.length).toBe(2);
    });
  });

  describe('POST /api/staff/hod/assignments (Restricted Assignment Lifecycle)', () => {
    it('returns 409 conflict when target department already has an active HOD and reassignment is not confirmed', async () => {
      mockCurrentUser = {
        id: 42,
        role: 'faculty',
        is_principal: true,
        is_designated_supervisor: true,
        email: 'principal@kucet.ac.in'
      };

      // 1. Authoritative supervisor verification in DB
      mockSupervisorDb(42, 'principal@kucet.ac.in');

      // 2. Staff lookup (target is active faculty ID 11)
      db.select.mockReturnValueOnce(createChainMock([
        { id: 11, name: 'Dr. B', email: 'b@kucet.ac.in', status: 'ACTIVE' }
      ]));

      // 2. Transaction: conflict lookup finds existing HOD Dr. A (ID 10)
      db.transaction.mockImplementation(async (cb) => {
        const mockTx = {
          select: vi.fn(() => createChainMock([
            { id: 10, name: 'Dr. A', assignment_id: 1 }
          ])),
        };
        return await cb(mockTx);
      });

      const req = new Request('http://localhost/api/staff/hod/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_code: 'CSE',
          staff_account_id: 11,
          confirm_reassign: false
        })
      });

      try {
        const res = await POST(req);
        expect(res.status).toBe(409);
      } catch (err) {
        expect(err.statusCode || err.status).toBe(409);
        expect(err.conflictDetails.conflict).toBe(true);
        expect(err.conflictDetails.current_hod.name).toBe('Dr. A');
      }
    });

    it('successfully reassigns HOD when confirmed, preserving accounts and credentials untouched', async () => {
      mockCurrentUser = {
        id: 42,
        role: 'faculty',
        is_principal: true,
        is_designated_supervisor: true,
        email: 'principal@kucet.ac.in'
      };

      // 1. Authoritative supervisor verification in DB
      mockSupervisorDb(42, 'principal@kucet.ac.in');

      // 2. Target staff is active faculty ID 11
      db.select.mockReturnValueOnce(createChainMock([
        { id: 11, name: 'Dr. B', email: 'b@kucet.ac.in', status: 'ACTIVE' }
      ]));

      const mockTxUpdate = vi.fn(() => ({ where: vi.fn(() => Promise.resolve({})) }));
      const mockTxInsert = vi.fn(() => Promise.resolve([{ insertId: 5 }]));
      const mockTxDelete = vi.fn(() => ({ where: vi.fn(() => Promise.resolve({})) }));

      db.transaction.mockImplementation(async (cb) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce(createChainMock([{ id: 10, name: 'Dr. A', assignment_id: 1 }])) // Conflict found
            .mockReturnValueOnce(createChainMock([])) // Remaining HOD roles check for predecessor
            .mockReturnValueOnce(createChainMock([{ id: 99, role_code: 'HOD' }])) // HOD role def lookup
            .mockReturnValueOnce(createChainMock([{ id: 99, role_code: 'HOD' }])) // HOD role def for new appointee
            .mockReturnValueOnce(createChainMock([])), // Role assignment check for new appointee
          update: vi.fn(() => ({ set: mockTxUpdate })),
          insert: vi.fn(() => ({ values: mockTxInsert })),
          delete: mockTxDelete,
        };
        return await cb(mockTx);
      });

      const req = new Request('http://localhost/api/staff/hod/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_code: 'CSE',
          staff_account_id: 11,
          confirm_reassign: true
        })
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.assignment_id || data.data?.assignment_id).toBe(5);

      // Verify that predecessor assignment was deactivated (is_active = false)
      expect(mockTxUpdate).toHaveBeenCalledWith(expect.objectContaining({
        is_active: false
      }));

      // Verify new assignment was inserted
      expect(mockTxInsert).toHaveBeenCalledWith(expect.objectContaining({
        staff_account_id: 11,
        department_code: 'CSE',
        is_active: true
      }));
    });
  });
});
