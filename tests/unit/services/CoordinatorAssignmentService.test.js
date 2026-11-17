import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import { staffAccounts, auditLogs, facultyCoordinatorAssignments } from '@/db/schema';
import { db } from '@/db';

// Mock DB
let mockStaff = [];
let mockAssignments = [];
let mockAuditLogs = [];

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((_cond) => {
          return {
            limit: vi.fn((_lim) => mockStaff)
          };
        }),
        limit: vi.fn((_lim) => mockStaff)
      }))
    })),
    transaction: vi.fn(async (cb) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn((table) => ({
            where: vi.fn(() => {
              if (table === staffAccounts) {
                const res = [...mockStaff];
                res.limit = vi.fn(() => mockStaff);
                return res;
              }
              const res = mockAssignments.filter(a => a.is_active);
              res.limit = vi.fn(() => res);
              return res;
            }),
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => [{ role_code: 'FACULTY' }])
            })),
            limit: vi.fn(() => mockStaff)
          }))
        })),
        query: {
          staffAccounts: {
            findFirst: vi.fn(async () => {
              return mockStaff[0] || null;
            })
          },
          facultyCoordinatorAssignments: {
            findFirst: vi.fn(async () => mockAssignments[0] || null)
          }
        },
        insert: vi.fn((table) => ({
          values: vi.fn((vals) => {
            if (table === auditLogs) {
              if (vals.ip_address && vals.ip_address.length > 45) {
                throw new Error("ER_DATA_TOO_LONG: Data too long for column 'ip_address' at row 1");
              }
              mockAuditLogs.push(vals);
              return [{ affectedRows: 1, insertId: mockAuditLogs.length }];
            }

            const newId = mockAssignments.length + 1;
            mockAssignments.push({ id: newId, ...vals });
            return [{
              fieldCount: 0,
              affectedRows: 1,
              insertId: newId,
              info: '',
              serverStatus: 2,
              warningStatus: 0,
              changedRows: 0,
            }];
          })
        })),
        update: vi.fn(() => ({
          set: vi.fn((vals) => ({
            where: vi.fn(() => {
              if (mockAssignments.length > 0) {
                Object.assign(mockAssignments[0], vals);
              }
              return [{ affectedRows: 1 }];
            })
          }))
        }))
      };
      return await cb(tx);
    })
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}));

describe('CoordinatorAssignmentService', () => {
  beforeEach(() => {
    mockStaff = [
      { id: 10, name: 'Dr. Jane Smith', employee_id: 'FAC-010', is_active: true, account_status: 'ACTIVE' }
    ];
    mockAssignments = [];
    mockAuditLogs = [];
  });

  describe('assignCoordinator', () => {
    it('successfully assigns an active faculty member as First Year Coordinator', async () => {
      const result = await CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: 10,
        coordinatorType: 'FIRST_YEAR',
        academicYear: '2024-2025',
        startDate: '2024-07-01',
        endDate: '2025-06-30',
        assignedBy: 1
      });

      expect(result.id).toBeDefined();
      expect(result.coordinator_type).toBe('FIRST_YEAR');
      expect(result.academic_year).toBe('2024-2025');
    });

    it('rejects nonexistent staff account', async () => {
      mockStaff = []; // no staff found

      await expect(CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: 999,
        coordinatorType: 'FIRST_YEAR',
        academicYear: '2024-2025',
        startDate: '2024-07-01',
        assignedBy: 1
      })).rejects.toThrow('Staff account not found');
    });

    it('rejects inactive or disabled staff account', async () => {
      mockStaff = [
        { id: 10, name: 'Dr. Jane Smith', employee_id: 'FAC-010', is_active: false, account_status: 'INACTIVE' }
      ];

      await expect(CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: 10,
        coordinatorType: 'FIRST_YEAR',
        academicYear: '2024-2025',
        startDate: '2024-07-01',
        assignedBy: 1
      })).rejects.toThrow(/Cannot assign coordinator role to an inactive/);
    });

    it('fails the transaction when database does not return a valid inserted assignment ID', async () => {
      db.transaction.mockImplementationOnce(async (cb) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn((table) => ({
              where: vi.fn(() => {
                if (table === staffAccounts) {
                  const res = [...mockStaff];
                  res.limit = vi.fn(() => mockStaff);
                  return res;
                }
                const res = [];
                res.limit = vi.fn(() => res);
                return res;
              }),
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => [{ role_code: 'FACULTY' }])
              })),
              limit: vi.fn(() => mockStaff)
            }))
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => [{ affectedRows: 0, insertId: 0 }])
          }))
        };
        return await cb(tx);
      });

      await expect(CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: 10,
        coordinatorType: 'FIRST_YEAR',
        academicYear: '2024-25',
        startDate: '2024-07-01',
        assignedBy: 1
      })).rejects.toThrow(/database did not return a valid inserted assignment ID/);
    });

    it('sanitizes long proxy-forwarded IP addresses (> 45 chars) into audit_logs without throwing ER_DATA_TOO_LONG', async () => {
      const longProxyChainIp = '203.0.113.195, 70.41.3.18, 150.172.238.178, 192.168.1.1, 10.0.0.1';
      expect(longProxyChainIp.length).toBeGreaterThan(45);

      const result = await CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: 10,
        coordinatorType: 'FIRST_YEAR',
        academicYear: '2024-2025',
        startDate: '2024-07-01',
        assignedBy: 1,
        ip: longProxyChainIp,
        userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'
      });

      expect(result.id).toBeDefined();
      expect(mockAuditLogs.length).toBeGreaterThan(0);
      const lastAudit = mockAuditLogs[mockAuditLogs.length - 1];
      expect(lastAudit.ip_address).toBe('203.0.113.195');
      expect(lastAudit.ip_address.length).toBeLessThanOrEqual(45);
      expect(lastAudit.action).toBe('COORDINATOR_ASSIGNED');
    });

    it('enforces single college-wide coordinator invariant for INTERNSHIP by deactivating previous holder and auditing', async () => {
      // First, set up a prior active internship assignment
      mockAssignments = [
        {
          id: 1,
          staff_account_id: 5,
          coordinator_type: 'INTERNSHIP',
          academic_year: '2024-2025',
          start_date: '2024-01-01',
          end_date: null,
          is_active: true
        }
      ];

      const result = await CoordinatorAssignmentService.assignCoordinator({
        staffAccountId: 10,
        coordinatorType: 'INTERNSHIP',
        academicYear: '2024-2025',
        startDate: '2024-07-01',
        assignedBy: 1,
        ip: '198.51.100.22, 10.0.0.1',
      });

      expect(result.id).toBeDefined();
      expect(result.coordinator_type).toBe('INTERNSHIP');
      // The prior assignment should have been deactivated
      expect(mockAssignments[0].is_active).toBe(false);
      // Both revocation and new assignment should have audit logs
      const revokeAudit = mockAuditLogs.find(a => a.action === 'COORDINATOR_REVOKED');
      expect(revokeAudit).toBeDefined();
      expect(revokeAudit.target_id).toBe('1');
      const assignAudit = mockAuditLogs.find(a => a.action === 'COORDINATOR_ASSIGNED');
      expect(assignAudit).toBeDefined();
      expect(assignAudit.target_id).toBe(String(result.id));
    });
  });

  describe('getCoordinatorAssignments & status computation', () => {
    it('computes ACTIVE status when within start and end date', () => {
      const status = CoordinatorAssignmentService.computeStatus({
        is_active: true,
        start_date: '2020-01-01',
        end_date: '2030-12-31'
      });
      expect(status).toBe('ACTIVE');
    });

    it('computes SCHEDULED status when start date is in the future', () => {
      const status = CoordinatorAssignmentService.computeStatus({
        is_active: true,
        start_date: '2099-01-01',
        end_date: '2099-12-31'
      });
      expect(status).toBe('SCHEDULED');
    });

    it('computes EXPIRED status when end date is in the past', () => {
      const status = CoordinatorAssignmentService.computeStatus({
        is_active: true,
        start_date: '2020-01-01',
        end_date: '2021-01-01'
      });
      expect(status).toBe('EXPIRED');
    });

    it('computes REVOKED status when is_active is false', () => {
      const status = CoordinatorAssignmentService.computeStatus({
        is_active: false,
        start_date: '2024-01-01',
        end_date: '2025-12-31'
      });
      expect(status).toBe('REVOKED');
    });

    it('computes EXPIRED status correctly when end_date is a Date object in the past', () => {
      const pastDate = new Date('2020-01-01T00:00:00.000Z');
      const status = CoordinatorAssignmentService.computeStatus({
        is_active: true,
        start_date: new Date('2019-01-01T00:00:00.000Z'),
        end_date: pastDate
      });
      expect(status).toBe('EXPIRED');
    });

    it('computes SCHEDULED status correctly when start_date is a Date object in the future', () => {
      const futureDate = new Date('2099-01-01T00:00:00.000Z');
      const status = CoordinatorAssignmentService.computeStatus({
        is_active: true,
        start_date: futureDate,
        end_date: new Date('2099-12-31T00:00:00.000Z')
      });
      expect(status).toBe('SCHEDULED');
    });

    it('computes DISABLED status when staff account status is not ACTIVE', () => {
      const status = CoordinatorAssignmentService.computeStatus({
        is_active: true,
        start_date: '2020-01-01',
        end_date: '2030-12-31',
        staff_status: 'SUSPENDED'
      });
      expect(status).toBe('DISABLED');
    });

    it('rejects updateCoordinatorDates when end date is earlier than start date', async () => {
      await expect(CoordinatorAssignmentService.updateCoordinatorDates(1, {
        startDate: '2025-06-30',
        endDate: '2025-01-01'
      })).rejects.toThrow('End date cannot be earlier than start date');
    });
  });
});
