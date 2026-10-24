import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import { staffAccounts } from '@/db/schema';
import { db } from '@/db';

// Mock DB
let mockStaff = [];
let mockAssignments = [];

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((_cond) => {
          // If querying staffAccounts
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
        insert: vi.fn(() => ({
          values: vi.fn((vals) => {
            const newId = mockAssignments.length + 1;
            mockAssignments.push({ id: newId, ...vals });
            // Genuine mysql2 / TiDB ResultSetHeader structure
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
  });
});
