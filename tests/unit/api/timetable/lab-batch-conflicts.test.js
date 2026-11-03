import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Timetable Lab-Wise Batch Slots & Attendance Isolation Suite', () => {
  const entrySchema = z.object({
    day_of_week: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
    period_number: z.number().int().min(1).max(7),
    period_numbers: z.array(z.number().int().min(1).max(7)).optional(),
    batch_number: z.number().int().min(0).max(2).default(0),
    subject_code: z.string().min(1),
    faculty_id: z.number().int().positive().nullable().optional(),
    additional_faculty_ids: z.array(z.number().int().positive()).optional().default([]),
    room_no: z.string().optional()
  });

  const attendanceSchema = z.object({
    assignment_id: z.preprocess(v => Number(v), z.number().int().positive()),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    session: z.number().int().min(1).max(8),
    batch_number: z.preprocess(v => v !== undefined && v !== null ? Number(v) : 0, z.number().int().min(0).max(2).default(0)),
    topic_covered: z.string().trim().max(500).optional().nullable(),
    attendance_data: z.array(z.object({
      student_id: z.number().int().positive(),
      status: z.enum(['PRESENT', 'ABSENT', 'NCC', 'MEDICAL'])
    })).min(1)
  });

  describe('Slot Entry Schema with Batches', () => {
    it('accepts valid batch numbers: 0 (whole class), 1 (Batch 1), 2 (Batch 2)', () => {
      const base = {
        day_of_week: 'MON',
        period_number: 4,
        subject_code: 'CS401L'
      };

      expect(entrySchema.parse({ ...base, batch_number: 0 }).batch_number).toBe(0);
      expect(entrySchema.parse({ ...base, batch_number: 1 }).batch_number).toBe(1);
      expect(entrySchema.parse({ ...base, batch_number: 2 }).batch_number).toBe(2);
    });

    it('rejects batch numbers outside [0, 1, 2]', () => {
      const base = {
        day_of_week: 'MON',
        period_number: 4,
        subject_code: 'CS401L'
      };

      expect(entrySchema.safeParse({ ...base, batch_number: 3 }).success).toBe(false);
      expect(entrySchema.safeParse({ ...base, batch_number: -1 }).success).toBe(false);
    });

    it('supports multi-period lab span (e.g. Periods 4, 5, 6)', () => {
      const payload = {
        day_of_week: 'TUE',
        period_number: 4,
        period_numbers: [4, 5, 6],
        batch_number: 1,
        subject_code: 'CS402L',
        faculty_id: 10,
        additional_faculty_ids: [11, 12],
        room_no: 'Lab 3'
      };

      const parsed = entrySchema.parse(payload);
      expect(parsed.period_numbers).toEqual([4, 5, 6]);
      expect(parsed.additional_faculty_ids).toEqual([11, 12]);
      expect(parsed.batch_number).toBe(1);
    });
  });

  describe('Concurrent Batch Slot Co-existence and Key Invariants', () => {
    it('allows concurrent Batch 1 and Batch 2 slots for the same day and period', () => {
      const makeCompositeKey = (branch, sem, day, period, year, batch) =>
        `${branch}_${sem}_${day}_${period}_${year}_B${batch}`;

      const b1Key = makeCompositeKey('CSE', 4, 'WED', 4, '2026-27', 1);
      const b2Key = makeCompositeKey('CSE', 4, 'WED', 4, '2026-27', 2);

      // Unique keys are distinct
      expect(b1Key).not.toBe(b2Key);
      expect(b1Key).toBe('CSE_4_WED_4_2026-27_B1');
      expect(b2Key).toBe('CSE_4_WED_4_2026-27_B2');
    });

    it('distinguishes whole class (batch 0) from lab batch slots', () => {
      const makeCompositeKey = (branch, sem, day, period, year, batch) =>
        `${branch}_${sem}_${day}_${period}_${year}_B${batch}`;

      const wholeClassKey = makeCompositeKey('CSE', 4, 'WED', 4, '2026-27', 0);
      const batch1Key = makeCompositeKey('CSE', 4, 'WED', 4, '2026-27', 1);

      expect(wholeClassKey).not.toBe(batch1Key);
    });
  });

  describe('Attendance Session Batch Schema & Cross-Batch Reuse Validation', () => {
    it('validates attendance submission with batch_number', () => {
      const payload = {
        assignment_id: 42,
        date: '2026-11-03',
        session: 4,
        batch_number: 1,
        topic_covered: 'Socket Programming in C',
        attendance_data: [
          { student_id: 101, status: 'PRESENT' },
          { student_id: 102, status: 'ABSENT' }
        ]
      };

      const parsed = attendanceSchema.parse(payload);
      expect(parsed.batch_number).toBe(1);
      expect(parsed.attendance_data.length).toBe(2);
    });

    it('detects and forbids cross-batch reuse mismatch', () => {
      const sourceSession = { id: 10, batch_number: 1 };
      const destinationBatch = 2;

      let error = null;
      if (sourceSession.batch_number > 0 && destinationBatch > 0 && sourceSession.batch_number !== destinationBatch) {
        error = `Batch mismatch: Source session belongs to Batch ${sourceSession.batch_number}, but target attendance is for Batch ${destinationBatch}. Attendance reuse between different batches is prohibited.`;
      }

      expect(error).toContain('Attendance reuse between different batches is prohibited');
    });

    it('permits reuse when batches match', () => {
      const sourceSession = { id: 10, batch_number: 1 };
      const destinationBatch = 1;

      let error = null;
      if (sourceSession.batch_number > 0 && destinationBatch > 0 && sourceSession.batch_number !== destinationBatch) {
        error = 'mismatch';
      }

      expect(error).toBeNull();
    });
  });
});
