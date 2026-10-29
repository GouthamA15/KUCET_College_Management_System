import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  isDesignatedAcademicSupervisor, 
  isVerifiedDesignatedSupervisor,
  getAuthorizedAcademicBranches,
  getAllowedAcademicSemesters,
  isAcademicScopeAllowed
} from '@/lib/academic-authorization';
import { GET as getHodAssignments } from '@/app/api/staff/hod/assignments/route';
import { GET as getAcademicMonitoring } from '@/app/api/staff/coordinator/academic-monitoring/route';
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
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
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

describe('Designated Academic Supervisor Fail-Closed Security & Regression Suite', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    process.env = { ...origEnv };
    delete process.env.DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID;
    delete process.env.DESIGNATED_SUPERVISOR_EMAIL;
    db.select.mockReset();
    db.select.mockImplementation(() => createChainMock([]));
  });

  describe('Core Function: isDesignatedAcademicSupervisor (Fail-Closed Guarantees)', () => {
    it('Case 1: correctly designated, active Principal receives Supervisor authorization', async () => {
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

      const isAuth = await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in');
      expect(isAuth).toBe(true);
    });

    it('Case 2: active, non-designated PRINCIPAL account is denied Supervisor authorization', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' }
      ]));

      // Staff 99 holds PRINCIPAL role but is not the configured ID 42
      const isAuth = await isDesignatedAcademicSupervisor(99, 'other_principal@kucet.ac.in');
      expect(isAuth).toBe(false);
    });

    it('Case 3: missing designation configuration strictly returns false (fail-closed)', async () => {
      // Empty systemConfigs and no environment fallback
      db.select.mockReturnValueOnce(createChainMock([]));

      const isAuth = await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in');
      expect(isAuth).toBe(false);
    });

    it('Case 4: empty designation configuration returns false', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '   ' }
      ]));

      const isAuth = await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in');
      expect(isAuth).toBe(false);
    });

    it('Case 5: malformed designation configuration returns false', async () => {
      // Non-numeric ID
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: 'not-a-number' }
      ]));
      expect(await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in')).toBe(false);

      // Negative ID
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '-1' }
      ]));
      expect(await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in')).toBe(false);

      // Literal "null" string
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: 'null' }
      ]));
      expect(await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in')).toBe(false);
    });

    it('Case 6: configured ID that does not resolve to a valid account returns false', async () => {
      db.select
        .mockReturnValueOnce(createChainMock([
          { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '999' }
        ]))
        // staff_accounts lookup returns empty
        .mockReturnValueOnce(createChainMock([]));

      const isAuth = await isDesignatedAcademicSupervisor(999, 'ghost@kucet.ac.in');
      expect(isAuth).toBe(false);
    });

    it('Case 7: inactive designated account is denied (SUSPENDED / DISABLED / PENDING)', async () => {
      db.select
        .mockReturnValueOnce(createChainMock([
          { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' }
        ]))
        .mockReturnValueOnce(createChainMock([
          { id: 42, email: 'principal@kucet.ac.in', account_status: 'SUSPENDED' }
        ]));

      const isAuth = await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in');
      expect(isAuth).toBe(false);
    });

    it('Case 8: staff account with different ID cannot gain access by supplying matching PRINCIPAL role', async () => {
      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' }
      ]));

      // Staff ID 15 attempts to authenticate
      const isAuth = await isDesignatedAcademicSupervisor(15, 'faculty15@kucet.ac.in');
      expect(isAuth).toBe(false);
    });

    it('Case 9: conflicting email configuration cannot override explicitly configured identity', async () => {
      db.select
        .mockReturnValueOnce(createChainMock([
          { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' },
          { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_EMAIL', config_value: 'imposter@external.com' }
        ]))
        .mockReturnValueOnce(createChainMock([
          { id: 42, email: 'principal@kucet.ac.in', account_status: 'ACTIVE' }
        ]));

      // Account 42 has email principal@kucet.ac.in, but configured email is imposter@external.com
      const isAuth = await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in');
      expect(isAuth).toBe(false);
    });

    it('Case 10: configuration lookup failures (DB crash) do not grant authorization', async () => {
      db.select.mockImplementationOnce(() => {
        throw new Error('Database connection pool exhausted');
      });

      const isAuth = await isDesignatedAcademicSupervisor(42, 'principal@kucet.ac.in');
      expect(isAuth).toBe(false);
    });
  });

  describe('Academic Scope & Branch Isolation Invariants', () => {
    it('Case 11A: designated supervisor has institutional scope across all 7 branches and 8 semesters', () => {
      const supervisorUser = {
        id: 42,
        role: 'faculty',
        is_principal: true,
        is_designated_supervisor: true
      };

      expect(getAuthorizedAcademicBranches(supervisorUser)).toBeNull(); // null means global unrestricted
      expect(getAllowedAcademicSemesters(supervisorUser)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(isAcademicScopeAllowed(supervisorUser, { branch: 'CIVIL', semester: 7 })).toBe(true);
      expect(isAcademicScopeAllowed(supervisorUser, { branch: 'MECH', semester: 4 })).toBe(true);
      expect(isAcademicScopeAllowed(supervisorUser, { branch: 'CSE', semester: 1 })).toBe(true);
    });

    it('Case 11B: non-designated PRINCIPAL-role staff does NOT receive global access; restricted to assigned branches', () => {
      const nonDesignatedPrincipal = {
        id: 99,
        role: 'faculty',
        is_principal: true,
        is_designated_supervisor: false,
        is_hod: true,
        authorized_branches: ['CSE']
      };

      // Branches are restricted to CSE only
      expect(getAuthorizedAcademicBranches(nonDesignatedPrincipal)).toEqual(['CSE']);
      expect(isAcademicScopeAllowed(nonDesignatedPrincipal, { branch: 'CSE', semester: 4 })).toBe(true);
      expect(isAcademicScopeAllowed(nonDesignatedPrincipal, { branch: 'ECE', semester: 4 })).toBe(false);
      expect(isAcademicScopeAllowed(nonDesignatedPrincipal, { branch: 'MECH', semester: 2 })).toBe(false);
    });

    it('Case 11C: First Year Coordinator access remains strictly restricted to Semesters 1 and 2', () => {
      const coordUser = {
        id: 88,
        role: 'faculty',
        is_first_year_coordinator: true,
        is_hod: false
      };

      expect(getAllowedAcademicSemesters(coordUser, 'CSE')).toEqual([1, 2]);
      expect(isAcademicScopeAllowed(coordUser, { branch: 'CSE', semester: 1 })).toBe(true);
      expect(isAcademicScopeAllowed(coordUser, { branch: 'ECE', semester: 2 })).toBe(true);
      expect(isAcademicScopeAllowed(coordUser, { branch: 'CSE', semester: 3 })).toBe(false);
      expect(isAcademicScopeAllowed(coordUser, { branch: 'IT', semester: 6 })).toBe(false);
    });

    it('Case 12: Super Admin authorization remains governed by separate admin mechanism', () => {
      const adminUser = {
        id: 1,
        role: 'admin',
        is_principal: false
      };

      expect(getAuthorizedAcademicBranches(adminUser)).toBeNull();
      expect(getAllowedAcademicSemesters(adminUser)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(isAcademicScopeAllowed(adminUser, { branch: 'EEE', semester: 8 })).toBe(true);
    });
  });

  describe('Route-Level Enforcement & HTTP Status Checks', () => {
    it('Case 13: protected supervisor endpoint enforces designation server-side', async () => {
      mockCurrentUser = {
        id: 42,
        role: 'faculty',
        is_principal: true,
        email: 'principal@kucet.ac.in'
      };

      db.select
        .mockReturnValueOnce(createChainMock([
          { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' }
        ]))
        .mockReturnValueOnce(createChainMock([
          { id: 42, email: 'principal@kucet.ac.in', account_status: 'ACTIVE' }
        ]))
        .mockReturnValueOnce(createChainMock([
          { role_code: 'PRINCIPAL' }
        ]))
        .mockReturnValueOnce(createChainMock([])) // assignments
        .mockReturnValueOnce(createChainMock([])); // eligible faculty

      const req = new Request('http://localhost/api/staff/hod/assignments');
      const res = await getHodAssignments(req);
      expect(res.status).toBe(200);
    });

    it('Case 13B: forged or stale is_designated_supervisor token flag cannot bypass server-side check', async () => {
      // Attacker supplies a user object with is_designated_supervisor = true,
      // but in DB the designated supervisor is someone else (ID 42) and this caller is ID 99
      mockCurrentUser = {
        id: 99,
        role: 'faculty',
        is_principal: true,
        is_designated_supervisor: true, // Forged / Stale token claim
        email: 'attacker@kucet.ac.in'
      };

      db.select.mockReturnValueOnce(createChainMock([
        { config_key: 'DESIGNATED_ACADEMIC_SUPERVISOR_STAFF_ID', config_value: '42' }
      ]));

      const req = new Request('http://localhost/api/staff/hod/assignments');
      const res = await getHodAssignments(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Designated Academic Supervisor');
    });

    it('Case 13C: Principal without staffId or account ID is strictly denied global access', async () => {
      mockCurrentUser = {
        role: 'faculty',
        is_principal: true,
        email: 'unidentified_principal@kucet.ac.in'
      };

      const req = new Request('http://localhost/api/staff/hod/assignments');
      const res = await getHodAssignments(req);
      expect(res.status).toBe(403);
    });

    it('Case 13D: user with role principal without staffId or id is strictly denied global access in helpers', () => {
      const malformedPrincipal = {
        role: 'principal'
      };

      expect(getAuthorizedAcademicBranches(malformedPrincipal)).toEqual([]);
      expect(getAllowedAcademicSemesters(malformedPrincipal)).toEqual([]);
      expect(isAcademicScopeAllowed(malformedPrincipal, { branch: 'CSE', semester: 1 })).toBe(false);
    });

    it('Case 14: missing configuration produces 403 Forbidden for non-designated staff at supervisor endpoints', async () => {
      // Configuration is missing in DB
      db.select.mockReturnValue(createChainMock([]));

      // User has is_principal = true, but is NOT designated
      mockCurrentUser = {
        id: 99,
        role: 'faculty',
        is_principal: true,
        is_designated_supervisor: false,
        email: 'other_principal@kucet.ac.in'
      };

      const req = new Request('http://localhost/api/staff/hod/assignments');
      const res = await getHodAssignments(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Designated Academic Supervisor');
    });

    it('Case 15: unauthenticated requests produce 401 Unauthorized', async () => {
      mockCurrentUser = null;

      const req = new Request('http://localhost/api/staff/hod/assignments');
      const res = await getHodAssignments(req);
      expect(res.status).toBe(401);
    });
  });
});
