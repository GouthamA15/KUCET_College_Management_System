import { describe, it, expect, vi } from 'vitest';
import { LabBatchAllocationService } from '@/services/academic/LabBatchAllocationService';

describe('LabBatchAllocationService Unit Tests', () => {
  describe('extractSerial', () => {
    it('correctly parses numeric serial from regular roll numbers', () => {
      expect(LabBatchAllocationService.extractSerial('23567T0901')).toEqual({
        serial: 1,
        isLateral: false
      });
      expect(LabBatchAllocationService.extractSerial('23567T0930')).toEqual({
        serial: 30,
        isLateral: false
      });
      expect(LabBatchAllocationService.extractSerial('23567T0966')).toEqual({
        serial: 66,
        isLateral: false
      });
    });

    it('correctly parses numeric serial from lateral roll numbers', () => {
      expect(LabBatchAllocationService.extractSerial('245670901L')).toEqual({
        serial: 1,
        isLateral: true
      });
      expect(LabBatchAllocationService.extractSerial('24567T0935L')).toEqual({
        serial: 35,
        isLateral: true
      });
    });

    it('handles alphanumeric or abnormal suffixes gracefully', () => {
      const result = LabBatchAllocationService.extractSerial('23567T09A1');
      expect(result.serial).toBe('A1');
      expect(result.isLateral).toBe(false);
    });

    it('returns null serial for invalid or empty inputs', () => {
      expect(LabBatchAllocationService.extractSerial('')).toEqual({ serial: null, isLateral: false });
      expect(LabBatchAllocationService.extractSerial(null)).toEqual({ serial: null, isLateral: false });
    });
  });

  describe('parseRangeToStudentIds', () => {
    const mockCohort = [
      { id: 101, roll_no: '23567T0901', serial_number: 1, order_index: 1 },
      { id: 102, roll_no: '23567T0902', serial_number: 2, order_index: 2 },
      { id: 103, roll_no: '23567T0915', serial_number: 15, order_index: 3 },
      { id: 104, roll_no: '23567T0930', serial_number: 30, order_index: 4 },
      { id: 105, roll_no: '23567T0931', serial_number: 31, order_index: 5 },
      { id: 106, roll_no: '23567T0966', serial_number: 66, order_index: 6 },
    ];

    it('parses simple range "1-30"', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('1-30', mockCohort);
      expect(matched.has(101)).toBe(true);
      expect(matched.has(102)).toBe(true);
      expect(matched.has(103)).toBe(true);
      expect(matched.has(104)).toBe(true);
      expect(matched.has(105)).toBe(false);
      expect(matched.has(106)).toBe(false);
    });

    it('parses zero-padded range "01-30"', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('01-30', mockCohort);
      expect(matched.size).toBe(4);
      expect(matched.has(101)).toBe(true);
      expect(matched.has(104)).toBe(true);
    });

    it('parses range "31-66"', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('31-66', mockCohort);
      expect(matched.has(101)).toBe(false);
      expect(matched.has(105)).toBe(true);
      expect(matched.has(106)).toBe(true);
    });

    it('parses comma-separated values and ranges "1-2, 66"', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('1-2, 66', mockCohort);
      expect(matched.size).toBe(3);
      expect(matched.has(101)).toBe(true);
      expect(matched.has(102)).toBe(true);
      expect(matched.has(106)).toBe(true);
    });

    it('handles empty or whitespace strings safely', () => {
      expect(LabBatchAllocationService.parseRangeToStudentIds('', mockCohort).size).toBe(0);
      expect(LabBatchAllocationService.parseRangeToStudentIds('   ', mockCohort).size).toBe(0);
      expect(LabBatchAllocationService.parseRangeToStudentIds(null, mockCohort).size).toBe(0);
    });
  });

  describe('previewBatchAllocation and Disjointness Check', () => {
    it('detects disjointness violation if range overlaps', async () => {
      // Mock getCohortStudents
      vi.spyOn(LabBatchAllocationService, 'getCohortStudents').mockResolvedValueOnce([
        { id: 1, roll_no: '23567T0901', name: 'Alice', serial_number: 1, order_index: 1 },
        { id: 2, roll_no: '23567T0902', name: 'Bob', serial_number: 2, order_index: 2 },
        { id: 3, roll_no: '23567T0903', name: 'Charlie', serial_number: 3, order_index: 3 },
      ]);

      // Range 1 overlaps: 1-2 vs 2-3 (student 2 is in both)
      await expect(
        LabBatchAllocationService.previewBatchAllocation({
          academicYear: '2026-27',
          branch: 'CSE',
          semester: 4,
          batch1Range: '1-2',
          batch2Range: '2-3'
        })
      ).rejects.toThrow(/Student 23567T0902 \(Bob\) is matched in both Batch 1 and Batch 2 ranges/);
    });

    it('successfully divides students and detects unallocated students', async () => {
      vi.spyOn(LabBatchAllocationService, 'getCohortStudents').mockResolvedValueOnce([
        { id: 1, roll_no: '23567T0901', name: 'Alice', serial_number: 1, order_index: 1 },
        { id: 2, roll_no: '23567T0902', name: 'Bob', serial_number: 2, order_index: 2 },
        { id: 3, roll_no: '23567T0935', name: 'Charlie', serial_number: 35, order_index: 3 },
        { id: 4, roll_no: '23567T0966', name: 'Dave', serial_number: 66, order_index: 4 },
      ]);

      const result = await LabBatchAllocationService.previewBatchAllocation({
        academicYear: '2026-27',
        branch: 'CSE',
        semester: 4,
        batch1Range: '1-30',
        batch2Range: '31-50' // Student 4 (serial 66) is unallocated
      });

      expect(result.batch_1_count).toBe(2); // Alice & Bob
      expect(result.batch_2_count).toBe(1); // Charlie
      expect(result.unallocated_count).toBe(1); // Dave
      expect(result.unallocated_students[0].roll_no).toBe('23567T0966');
    });

    it('respects manual overrides over ranges', async () => {
      vi.spyOn(LabBatchAllocationService, 'getCohortStudents').mockResolvedValueOnce([
        { id: 1, roll_no: '23567T0901', name: 'Alice', serial_number: 1, order_index: 1 },
        { id: 2, roll_no: '23567T0902', name: 'Bob', serial_number: 2, order_index: 2 },
        { id: 3, roll_no: '23567T0935', name: 'Charlie', serial_number: 35, order_index: 3 },
      ]);

      // Move Alice (ID 1) to Batch 2 via override
      const result = await LabBatchAllocationService.previewBatchAllocation({
        academicYear: '2026-27',
        branch: 'CSE',
        semester: 4,
        batch1Range: '1-30',
        batch2Range: '31-66',
        manualOverrides: { 1: 2 }
      });

      expect(result.batch_1_count).toBe(1); // Bob
      expect(result.batch_2_count).toBe(2); // Alice & Charlie
      expect(result.batch_2_students.map(s => s.id)).toContain(1);
    });
  });
});
