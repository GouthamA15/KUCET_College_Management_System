import { describe, it, expect } from 'vitest';
import { LabBatchAllocationService } from '@/services/academic/LabBatchAllocationService';

describe('Section 4 Audit: KUCET Roll-Number Extraction & Batch Allocation Engine', () => {
  describe('Roll-Number Extraction Across All KUCET Branches', () => {
    it('extracts serials for regular students across all 7 KUCET branches', () => {
      // 09: CSE, 30: CSD, 15: ECE, 12: EEE, 00: CIVIL, 18: IT, 03: MECH
      const branches = [
        { roll: '23567T0915', expectedSerial: 15, branch: 'CSE' },
        { roll: '24567T3001', expectedSerial: 1, branch: 'CSD' },
        { roll: '22567T1566', expectedSerial: 66, branch: 'ECE' },
        { roll: '21567T1205', expectedSerial: 5, branch: 'EEE' },
        { roll: '22567T0010', expectedSerial: 10, branch: 'CIVIL' },
        { roll: '23567T1825', expectedSerial: 25, branch: 'IT' },
        { roll: '24567T0330', expectedSerial: 30, branch: 'MECH' }
      ];

      for (const item of branches) {
        const result = LabBatchAllocationService.extractSerial(item.roll);
        expect(result.serial).toBe(item.expectedSerial);
        expect(result.isLateral).toBe(false);
      }
    });

    it('extracts serials for lateral entry formats with and without T', () => {
      // Lateral standard: YY567BBSSL
      const latWithoutT = LabBatchAllocationService.extractSerial('245670966L');
      expect(latWithoutT.serial).toBe(66);
      expect(latWithoutT.isLateral).toBe(true);

      // Lateral with T variant: YY567TBBSSL
      const latWithT = LabBatchAllocationService.extractSerial('24567T0966L');
      expect(latWithT.serial).toBe(66);
      expect(latWithT.isLateral).toBe(true);
    });

    it('verifies case-insensitivity: lowercase l vs uppercase L', () => {
      const lower = LabBatchAllocationService.extractSerial('245670966l');
      const upper = LabBatchAllocationService.extractSerial('245670966L');

      expect(lower.serial).toBe(66);
      expect(lower.isLateral).toBe(true);
      expect(upper.serial).toBe(66);
      expect(upper.isLateral).toBe(true);
    });

    it('verifies boundary serials: first (01) and last (66)', () => {
      const first = LabBatchAllocationService.extractSerial('23567T0901');
      const last = LabBatchAllocationService.extractSerial('23567T0966');

      expect(first.serial).toBe(1);
      expect(last.serial).toBe(66);
    });

    it('verifies leading zeros: 01 vs 1 parsing returns integer 1', () => {
      const s01 = LabBatchAllocationService.extractSerial('23567T0901');
      expect(s01.serial).toBe(1);
      expect(typeof s01.serial).toBe('number');
    });

    it('handles malformed or invalid roll numbers gracefully without crashing', () => {
      const malformedCases = ['ABC', '12345', '', '   ', null, undefined, 'NOT_A_ROLL_NUMBER'];

      for (const c of malformedCases) {
        const res = LabBatchAllocationService.extractSerial(c);
        expect(res.serial).toBeNull();
        expect(res.isLateral).toBe(false);
      }
    });

    it('distinguishes identical serial numbers between regular and lateral cohorts', () => {
      const regular = LabBatchAllocationService.extractSerial('23567T0901');
      const lateral = LabBatchAllocationService.extractSerial('245670901L');

      expect(regular.serial).toBe(1);
      expect(regular.isLateral).toBe(false);

      expect(lateral.serial).toBe(1);
      expect(lateral.isLateral).toBe(true);
    });
  });

  describe('Range Parser & Anti-Array-Position Mandate', () => {
    const mockCohort = [
      { id: 101, roll_no: '23567T0901', name: 'Reg Alice', serial_number: 1, is_lateral: false },
      { id: 102, roll_no: '23567T0915', name: 'Reg Bob', serial_number: 15, is_lateral: false },
      { id: 103, roll_no: '23567T0930', name: 'Reg Charlie', serial_number: 30, is_lateral: false },
      { id: 104, roll_no: '23567T0935', name: 'Reg David', serial_number: 35, is_lateral: false },
      { id: 105, roll_no: '245670901L', name: 'Lat Eve', serial_number: 1, is_lateral: true },
      { id: 106, roll_no: '245670905L', name: 'Lat Frank', serial_number: 5, is_lateral: true },
      { id: 107, roll_no: 'UNPARSEABLE', name: 'Grace Unmatched', serial_number: null, is_lateral: false }
    ];

    it('parses un-prefixed numeric range matching all serial numbers', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('1-30', mockCohort);
      // Serial 1 (Reg), 15 (Reg), 30 (Reg), 1 (Lat), 5 (Lat)
      expect(matched.has(101)).toBe(true);
      expect(matched.has(102)).toBe(true);
      expect(matched.has(103)).toBe(true);
      expect(matched.has(105)).toBe(true); // Lat serial 1
      expect(matched.has(106)).toBe(true); // Lat serial 5
      expect(matched.has(104)).toBe(false); // Serial 35 > 30
      expect(matched.has(107)).toBe(false); // Unparseable must NOT match
    });

    it('supports prefix notation R1-R30 to match ONLY regular students', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('R1-R30', mockCohort);
      expect(matched.has(101)).toBe(true); // Reg serial 1
      expect(matched.has(102)).toBe(true); // Reg serial 15
      expect(matched.has(103)).toBe(true); // Reg serial 30
      expect(matched.has(105)).toBe(false); // Lat serial 1 excluded by R prefix!
      expect(matched.has(106)).toBe(false); // Lat serial 5 excluded by R prefix!
      expect(matched.has(104)).toBe(false); // Reg serial 35
      expect(matched.has(107)).toBe(false); // Unparseable
    });

    it('supports prefix notation L1-L10 to match ONLY lateral students', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('L1-L10', mockCohort);
      expect(matched.has(105)).toBe(true); // Lat serial 1
      expect(matched.has(106)).toBe(true); // Lat serial 5
      expect(matched.has(101)).toBe(false); // Reg serial 1 excluded by L prefix!
      expect(matched.has(102)).toBe(false); // Reg serial 15
    });

    it('supports single prefixed serials (R15, L5)', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('R15, L5', mockCohort);
      expect(matched.has(102)).toBe(true); // Reg 15
      expect(matched.has(106)).toBe(true); // Lat 5
      expect(matched.size).toBe(2);
    });

    it('supports exact roll number matching (even for non-standard roll numbers)', () => {
      const matched = LabBatchAllocationService.parseRangeToStudentIds('UNPARSEABLE, 23567T0935', mockCohort);
      expect(matched.has(107)).toBe(true);
      expect(matched.has(104)).toBe(true);
      expect(matched.size).toBe(2);
    });

    it('MANDATE VERIFICATION: Never uses cohort array position as fallback for unparseable serials', () => {
      // If someone specifies "7" or "6-7", student 107 is at index 6 (position 7),
      // but its serial_number is null. It MUST NOT match "7" or "6-7"!
      const matched = LabBatchAllocationService.parseRangeToStudentIds('7', mockCohort);
      expect(matched.has(107)).toBe(false);

      const matchedRange = LabBatchAllocationService.parseRangeToStudentIds('1-10', mockCohort);
      expect(matchedRange.has(107)).toBe(false);
    });
  });
});
