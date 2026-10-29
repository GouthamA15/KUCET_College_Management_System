import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getInstitutionalRoles } from '@/app/api/admin/institutional-roles/route';
import { POST as mutatePrincipalRole } from '@/app/api/admin/institutional-roles/principal-role/route';
import { POST as mutateAcademicSupervisor } from '@/app/api/admin/institutional-roles/academic-supervisor/route';
import { isDesignatedAcademicSupervisor } from '@/lib/academic-authorization';
import { db } from '@/db';

let mockCurrentUser = null;

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: vi.fn(async (expectedRole) => {
      if (!mockCurrentUser) return null;
      if (expectedRole === 'admin' && mockCurrentUser.role !== 'admin' && mockCurrentUser.role !== 'super_admin') {
        return null;
      }
      return mockCurrentUser;
    }),
    logAudit: vi.fn().mockResolvedValue({ id: 101 }),
  };
});

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
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(async (callback) => {
      return callback({
        select: db.select,
        insert: db.insert,
        update: db.update,
        delete: db.delete,
      });
    }),
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
    values: vi.fn(() => chain),
    set: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(resolveValue)),
    then: (fn) => Promise.resolve(resolveValue).then(fn),
  };
  return chain;
}

describe('Institutional Roles & Academic Supervisor Admin Management Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockReset();
    db.insert.mockReset();
    db.update.mockReset();
    db.delete.mockReset();
    db.insert.mockImplementation(() => createChainMock([{ insertId: 1 }]));
    db.update.mockImplementation(() => createChainMock([]));
    db.delete.mockImplementation(() => createChainMock([]));
    mockCurrentUser = { id: 1, role: 'super_admin', email: 'admin@kucet.ac.in' };
  });

  describe('1. GET /api/admin/institutional-roles Authentication & Data Roster', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      mockCurrentUser = null;
      const res = await getInstitutionalRoles();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('rejects faculty/staff without admin role with HTTP 401', async () => {
      mockCurrentUser = { id: 90001, role: 'faculty' };
      const res = await getInstitutionalRoles();
      expect(res.status).toBe(401);
    });

    it('returns authoritative supervisor, principal roster, eligible staff, and audit history to Super Admin', async () => {
      // 1. systemConfigs select
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' },
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL', config_value: 'sunebhai7705@gmail.com' }
      ]));

      // 2. staffAccounts with joins
      db.select.mockReturnValueOnce(createChainMock([
        {
          id: 90001,
          name: 'Sune Bhai kumar Nilla',
          email: 'sunebhai7705@gmail.com',
          employee_id: 'KU-6C7D96-4823',
          designation: 'Professor',
          staff_category: 'teaching',
          account_status: 'ACTIVE',
          role_code: 'PRINCIPAL',
          role_name: 'Principal',
          branch: 'CSE',
          created_at: new Date('2026-08-16'),
          updated_at: new Date('2026-10-29')
        },
        {
          id: 90002,
          name: 'Sannith',
          email: 'sunnysunnit@gmail.com',
          employee_id: 'KU-2A9A29-2780',
          designation: 'Record Assistant',
          staff_category: 'non-teaching',
          account_status: 'ACTIVE',
          role_code: 'SCHOLARSHIP_STAFF',
          role_name: 'Scholarship Staff',
          branch: null,
          created_at: new Date('2026-08-16'),
          updated_at: new Date('2026-10-29')
        }
      ]));

      // 3. auditLogs select
      db.select.mockReturnValueOnce(createChainMock([
        {
          id: 1,
          user_id: 1,
          user_type: 'admin',
          action: 'ACADEMIC_SUPERVISOR_DESIGNATED',
          target_id: '90001',
          target_type: 'system_configs',
          payload_after: { staff_id: 90001, name: 'Sune Bhai kumar Nilla' },
          created_at: new Date('2026-10-29')
        }
      ]));

      const res = await getInstitutionalRoles();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.designated_supervisor.authorization_status).toBe('ACTIVE_AUTHORIZED');
      expect(json.data.designated_supervisor.id).toBe(90001);
      expect(json.data.principal_accounts).toHaveLength(1);
      expect(json.data.eligible_staff).toHaveLength(2);
      expect(json.data.audit_history).toHaveLength(1);
    });

    it('reports UNCONFIGURED fail-closed status when system_configs is empty', async () => {
      // 1. systemConfigs empty
      db.select.mockReturnValueOnce(createChainMock([]));
      // 2. staffAccounts
      db.select.mockReturnValueOnce(createChainMock([]));
      // 3. auditLogs
      db.select.mockReturnValueOnce(createChainMock([]));

      const res = await getInstitutionalRoles();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.designated_supervisor.authorization_status).toBe('UNCONFIGURED');
      expect(json.data.designated_supervisor.status_description).toContain('fail-closed');
    });

    it('reports PRINCIPAL_ROLE_MISSING when configured staff account lacks Principal role', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' }
      ]));
      db.select.mockReturnValueOnce(createChainMock([
        {
          id: 90001,
          name: 'Sune Bhai kumar Nilla',
          email: 'sunebhai7705@gmail.com',
          account_status: 'ACTIVE',
          role_code: 'FACULTY', // Lacks PRINCIPAL
          branch: 'CSE'
        }
      ]));
      db.select.mockReturnValueOnce(createChainMock([]));

      const res = await getInstitutionalRoles();
      const json = await res.json();
      expect(json.data.designated_supervisor.authorization_status).toBe('PRINCIPAL_ROLE_MISSING');
    });
  });

  describe('2. POST /api/admin/institutional-roles/principal-role', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      mockCurrentUser = null;
      const req = new Request('http://localhost:3000/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: 90001, action: 'ASSIGN' })
      });
      const res = await mutatePrincipalRole(req);
      expect(res.status).toBe(401);
    });

    it('validates payload schema and rejects invalid staff_id or action', async () => {
      const req = new Request('http://localhost:3000/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: -5, action: 'INVALID_ACTION' })
      });
      const res = await mutatePrincipalRole(req);
      expect(res.status).toBe(400);
    });

    it('rejects assigning Principal role to a nonexistent staff account with HTTP 404', async () => {
      // staffAccounts check returns empty
      db.select.mockReturnValueOnce(createChainMock([]));

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: 99999, action: 'ASSIGN' })
      });
      const res = await mutatePrincipalRole(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('not found');
    });

    it('rejects assigning Principal role to a SUSPENDED staff account with HTTP 400', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { id: 90001, name: 'Suspended Staff', account_status: 'SUSPENDED' }
      ]));
      db.select.mockReturnValueOnce(createChainMock([
        { id: 30003, role_code: 'PRINCIPAL' }
      ]));

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: 90001, action: 'ASSIGN' })
      });
      const res = await mutatePrincipalRole(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('inactive');
    });

    it('successfully assigns Principal role and creates audit record', async () => {
      // 1. staffAccounts exists and ACTIVE
      db.select.mockReturnValueOnce(createChainMock([
        { id: 90001, name: 'Sune Bhai kumar Nilla', email: 'sunebhai7705@gmail.com', account_status: 'ACTIVE' }
      ]));
      // 2. staffRoles has PRINCIPAL
      db.select.mockReturnValueOnce(createChainMock([
        { id: 30003, role_code: 'PRINCIPAL' }
      ]));
      // 3. staffAccountRoles does not already have it
      db.select.mockReturnValueOnce(createChainMock([]));

      const insertMock = vi.fn().mockReturnValue(createChainMock());
      db.insert.mockImplementation(insertMock);

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: 90001, action: 'ASSIGN' })
      });
      const res = await mutatePrincipalRole(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(insertMock).toHaveBeenCalled();
    });

    it('blocks revoking Principal role if account is the active designated Academic Supervisor (HTTP 409)', async () => {
      // 1. staffAccounts exists
      db.select.mockReturnValueOnce(createChainMock([
        { id: 90001, name: 'Sune Bhai kumar Nilla', email: 'sunebhai7705@gmail.com', account_status: 'ACTIVE' }
      ]));
      // 2. staffRoles
      db.select.mockReturnValueOnce(createChainMock([
        { id: 30003, role_code: 'PRINCIPAL' }
      ]));
      // 3. systemConfigs shows this staff ID is currently active supervisor
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' }
      ]));

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: 90001, action: 'REVOKE' })
      });
      const res = await mutatePrincipalRole(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain('Cannot revoke the Principal role');
      expect(json.error).toContain('active Designated Academic Supervisor');
    });

    it('successfully revokes Principal role from non-supervisor account', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { id: 90002, name: 'Other Principal', email: 'other@kucet.ac.in', account_status: 'ACTIVE' }
      ]));
      db.select.mockReturnValueOnce(createChainMock([
        { id: 30003, role_code: 'PRINCIPAL' }
      ]));
      // Supervisor is someone else
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' }
      ]));

      const deleteMock = vi.fn().mockReturnValue(createChainMock());
      db.delete.mockImplementation(deleteMock);

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/principal-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: 90002, action: 'REVOKE' })
      });
      const res = await mutatePrincipalRole(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(deleteMock).toHaveBeenCalled();
    });
  });

  describe('3. POST /api/admin/institutional-roles/academic-supervisor', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      mockCurrentUser = null;
      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE', staff_id: 90001 })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(401);
    });

    it('rejects DESIGNATE action when staff_id is missing with HTTP 400', async () => {
      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE' })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(400);
    });

    it('rejects designating nonexistent staff account with HTTP 404', async () => {
      db.select.mockReturnValueOnce(createChainMock([]));

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE', staff_id: 99999 })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(404);
    });

    it('rejects designating an inactive staff account with HTTP 400', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { id: 90001, name: 'Inactive Staff', account_status: 'SUSPENDED' }
      ]));

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE', staff_id: 90001 })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('ACTIVE');
    });

    it('rejects designating a staff account that lacks the PRINCIPAL role (policy enforcement)', async () => {
      // 1. staffAccounts exists and ACTIVE
      db.select.mockReturnValueOnce(createChainMock([
        { id: 90001, name: 'Sune Bhai kumar Nilla', email: 'sunebhai7705@gmail.com', account_status: 'ACTIVE' }
      ]));
      // 2. staffAccountRoles has no PRINCIPAL role
      db.select.mockReturnValueOnce(createChainMock([]));

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE', staff_id: 90001 })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Principal role');
      expect(json.error).toContain('Please assign the Principal role first');
    });

    it('successfully designates eligible staff (ACTIVE + PRINCIPAL) and executes atomic transaction', async () => {
      // 1. staffAccounts exists and ACTIVE
      db.select.mockReturnValueOnce(createChainMock([
        { id: 90001, name: 'Sune Bhai kumar Nilla', email: 'sunebhai7705@gmail.com', account_status: 'ACTIVE' }
      ]));
      // 2. staffAccountRoles has PRINCIPAL role
      db.select.mockReturnValueOnce(createChainMock([
        { role_code: 'PRINCIPAL' }
      ]));
      // 3. current supervisor in systemConfigs (was unconfigured)
      db.select.mockReturnValueOnce(createChainMock([]));
      // 4. systemConfigs select in upsert (staff ID)
      db.select.mockReturnValueOnce(createChainMock([]));
      // 5. systemConfigs select in upsert (email)
      db.select.mockReturnValueOnce(createChainMock([]));

      const insertMock = vi.fn().mockReturnValue(createChainMock());
      db.insert.mockImplementation(insertMock);

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE', staff_id: 90001 })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.message).toContain('Global monitoring authority activated');
      expect(db.transaction).toHaveBeenCalled();
    });

    it('safely replaces an existing supervisor with atomic transition and ACADEMIC_SUPERVISOR_REPLACED audit', async () => {
      // 1. staffAccounts exists
      db.select.mockReturnValueOnce(createChainMock([
        { id: 210001, name: 'Professor Lucky', email: 'lucky.masna1@gmail.com', account_status: 'ACTIVE' }
      ]));
      // 2. has PRINCIPAL role
      db.select.mockReturnValueOnce(createChainMock([
        { role_code: 'PRINCIPAL' }
      ]));
      // 3. current supervisor was 90001
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' }
      ]));
      // 4. upsert selects
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' }
      ]));
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL', config_value: 'sunebhai7705@gmail.com' }
      ]));

      const updateMock = vi.fn().mockReturnValue(createChainMock());
      db.update.mockImplementation(updateMock);
      const insertMock = vi.fn().mockReturnValue(createChainMock());
      db.insert.mockImplementation(insertMock);

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DESIGNATE', staff_id: 210001 })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(200);
      expect(db.transaction).toHaveBeenCalled();
    });

    it('successfully revokes Academic Supervisor designation, sets config to REVOKED and fails closed', async () => {
      // 1. current supervisor
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' }
      ]));
      // 2. upsert selects
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '90001' }
      ]));
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL', config_value: 'sunebhai7705@gmail.com' }
      ]));

      const updateMock = vi.fn().mockReturnValue(createChainMock());
      db.update.mockImplementation(updateMock);
      const insertMock = vi.fn().mockReturnValue(createChainMock());
      db.insert.mockImplementation(insertMock);

      const req = new Request('http://localhost:3000/api/admin/institutional-roles/academic-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE' })
      });
      const res = await mutateAcademicSupervisor(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.message).toContain('explicitly revoked');
      expect(json.message).toContain('fail-closed');
    });

    it('verifies isDesignatedAcademicSupervisor strictly returns false when REVOKED is stored in system_configs', async () => {
      // Mock systemConfigs returning REVOKED
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: 'REVOKED' },
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL', config_value: '' }
      ]));

      const isSupervisor = await isDesignatedAcademicSupervisor(90001, 'sunebhai7705@gmail.com');
      expect(isSupervisor).toBe(false);
    });
  });
});
