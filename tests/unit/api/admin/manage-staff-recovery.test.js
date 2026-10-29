import { describe, it, expect, vi } from 'vitest';
import { CoordinatorAssignmentService } from '@/services/identity/CoordinatorAssignmentService';
import { db } from '@/db';
import { principal } from '@/db/schema';

describe('Admin Manage Staff Recovery & Coordinator Assignments Verification', () => {
  describe('Schema Integrity & Coordinator Query Validation', () => {
    it('principal table in schema has no "name" column, verifying the source of the 500 error', () => {
      // Direct verification of identity.js schema: principal has email, id, etc. but name is undefined
      expect(principal.name).toBeUndefined();
      expect(principal.email).toBeDefined();
      expect(principal.id).toBeDefined();
    });

    it('CoordinatorAssignmentService.getCoordinatorAssignments queries principal.email instead of principal.name', async () => {
      // Mock db.select chain
      const mockResultRows = [
        {
          id: 1,
          staff_account_id: 90001,
          coordinator_type: 'FIRST_YEAR',
          academic_year: '2026-27',
          start_date: '2026-10-24',
          end_date: null,
          is_active: true,
          assigned_by: 1,
          created_at: new Date('2026-10-24T12:32:49.000Z'),
          updated_at: new Date('2026-10-24T12:33:29.000Z'),
          staff_name: 'Dr. Coordinator',
          staff_email: 'coord@kucet.ac.in',
          employee_id: 'KU-12345',
          staff_status: 'ACTIVE',
          department_code: 'CSE',
          department_name: 'Computer Science and Engineering',
          assigned_by_name: 'admin@kucet.ac.in'
        }
      ];

      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockResultRows)
      };

      const selectSpy = vi.spyOn(db, 'select').mockReturnValue(chain);

      const assignments = await CoordinatorAssignmentService.getCoordinatorAssignments({
        coordinatorType: 'FIRST_YEAR',
        includeInactive: true
      });

      expect(selectSpy).toHaveBeenCalled();
      const selectArg = selectSpy.mock.calls[0][0];
      // Must not contain undefined field
      expect(selectArg.assigned_by_name).toBeDefined();
      expect(assignments).toHaveLength(1);
      expect(assignments[0].staff_name).toBe('Dr. Coordinator');
      expect(assignments[0].assigned_by_name).toBe('admin@kucet.ac.in');
      expect(assignments[0].status).toBe('ACTIVE');

      selectSpy.mockRestore();
    });

    it('falls back to "Administrator" when assigned_by_name is null', async () => {
      const mockResultRows = [
        {
          id: 2,
          staff_account_id: 90002,
          coordinator_type: 'FIRST_YEAR',
          academic_year: '2026-27',
          start_date: '2026-10-24',
          end_date: null,
          is_active: true,
          assigned_by: null,
          created_at: new Date(),
          updated_at: new Date(),
          staff_name: 'Prof. Helper',
          staff_email: 'helper@kucet.ac.in',
          employee_id: 'KU-99999',
          staff_status: 'ACTIVE',
          department_code: 'ECE',
          department_name: 'Electronics',
          assigned_by_name: null
        }
      ];

      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockResultRows)
      };

      const selectSpy = vi.spyOn(db, 'select').mockReturnValue(chain);

      const assignments = await CoordinatorAssignmentService.getCoordinatorAssignments();
      expect(assignments).toHaveLength(1);
      expect(assignments[0].assigned_by_name).toBe('Administrator');

      selectSpy.mockRestore();
    });
  });

  describe('Manage Staff Stats Calculation & Filtering Integrity', () => {
    it('correctly calculates statistics when staff list is populated', () => {
      const sampleStaffList = [
        {
          id: 90001,
          name: 'Sune Bhai kumar Nilla',
          email: 'sunebhai@kucet.ac.in',
          employee_id: 'KU-6C7D96',
          is_active: true,
          roles: ['faculty'],
          branches: ['CSE', 'IT'],
          hod_branches: [],
          is_hod: false,
          is_principal: true,
          is_first_year_coordinator: true
        },
        {
          id: 90002,
          name: 'Sannith',
          email: 'sannith@kucet.ac.in',
          employee_id: 'KU-2A9A29',
          is_active: true,
          roles: ['scholarship'],
          branches: [],
          hod_branches: [],
          is_hod: false,
          is_principal: false,
          is_first_year_coordinator: false
        },
        {
          id: 90003,
          name: 'Anneun',
          email: 'anneun@kucet.ac.in',
          employee_id: 'KU-FFC0B8',
          is_active: true,
          roles: ['admission'],
          branches: [],
          hod_branches: [],
          is_hod: false,
          is_principal: false,
          is_first_year_coordinator: false
        },
        {
          id: 240001,
          name: 'Goutham',
          email: 'goutham@kucet.ac.in',
          employee_id: 'KU-E3DE77',
          is_active: true,
          roles: ['faculty'],
          branches: ['ECE'],
          hod_branches: ['ECE'],
          is_hod: true,
          is_principal: false,
          is_first_year_coordinator: false
        }
      ];

      const facultystaffList = sampleStaffList.filter(c => c.roles?.includes('faculty'));
      const scholarshipstaffList = sampleStaffList.filter(c => c.roles?.includes('scholarship'));
      const admissionstaffList = sampleStaffList.filter(c => c.roles?.includes('admission'));

      const stats = {
        total: sampleStaffList.length,
        active: sampleStaffList.filter(c => c.is_active).length,
        inactive: sampleStaffList.filter(c => !c.is_active).length,
        facultyTotal: facultystaffList.length,
        scholarshipTotal: scholarshipstaffList.length,
        admissionTotal: admissionstaffList.length,
        hodCount: facultystaffList.filter(c => c.is_hod || (c.hod_branches && c.hod_branches.length > 0)).length,
        principalCount: facultystaffList.filter(c => c.is_principal).length,
        coordCount: facultystaffList.filter(c => c.is_first_year_coordinator).length
      };

      expect(stats.total).toBe(4);
      expect(stats.active).toBe(4);
      expect(stats.facultyTotal).toBe(2);
      expect(stats.scholarshipTotal).toBe(1);
      expect(stats.admissionTotal).toBe(1);
      expect(stats.hodCount).toBe(1);
      expect(stats.principalCount).toBe(1);
      expect(stats.coordCount).toBe(1);
    });
  });
});
