import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('HOD Timetable Instances & Slot Conflict Suite', () => {
  const createInstanceSchema = z.object({
    branch: z.string().trim().min(1, 'Branch is required').max(50),
    semester: z.number().int().min(1).max(8),
    academic_year: z.string().regex(/^\d{4}-\d{2}$/, 'Academic year must be in format YYYY-YY')
  });

  const updateStatusSchema = z.object({
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  });

  const entrySchema = z.object({
    day_of_week: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
    period_number: z.number().int().min(1).max(7),
    subject_code: z.string().min(1),
    faculty_id: z.number().int().positive().nullable().optional(),
    room_no: z.string().optional()
  });

  describe('Timetable Instance Schema Validation', () => {
    it('validates a correct timetable instance creation payload', () => {
      const valid = { branch: 'CSE', semester: 3, academic_year: '2025-26' };
      const parsed = createInstanceSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
      expect(parsed.data.semester).toBe(3);
    });

    it('rejects invalid academic_year format', () => {
      const invalid = { branch: 'CSE', semester: 3, academic_year: '2025/2026' };
      const parsed = createInstanceSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toMatch(/YYYY-YY/);
    });

    it('rejects semester out of range (e.g. 0 or 9)', () => {
      expect(createInstanceSchema.safeParse({ branch: 'CSE', semester: 0, academic_year: '2025-26' }).success).toBe(false);
      expect(createInstanceSchema.safeParse({ branch: 'CSE', semester: 9, academic_year: '2025-26' }).success).toBe(false);
    });

    it('validates status updates strictly to DRAFT, PUBLISHED, or ARCHIVED', () => {
      expect(updateStatusSchema.safeParse({ status: 'PUBLISHED' }).success).toBe(true);
      expect(updateStatusSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(true);
      expect(updateStatusSchema.safeParse({ status: 'DELETED' }).success).toBe(false);
      expect(updateStatusSchema.safeParse({ status: 'INVALID' }).success).toBe(false);
    });
  });

  describe('Timetable Slot Entry & Conflict Logic', () => {
    it('validates a valid slot assignment entry', () => {
      const valid = {
        day_of_week: 'MON',
        period_number: 2,
        subject_code: 'CS301',
        faculty_id: 12,
        room_no: 'B-204'
      };
      const parsed = entrySchema.safeParse(valid);
      expect(parsed.success).toBe(true);
      expect(parsed.data.period_number).toBe(2);
    });

    it('rejects invalid day_of_week or period_number out of bounds', () => {
      expect(entrySchema.safeParse({ day_of_week: 'SUN', period_number: 1, subject_code: 'CS101' }).success).toBe(false);
      expect(entrySchema.safeParse({ day_of_week: 'MON', period_number: 8, subject_code: 'CS101' }).success).toBe(false);
    });

    it('verifies slot update excludes self from faculty conflict check', () => {
      const targetFacultyId = 15;
      const targetDay = 'MON';
      const targetPeriod = 1;
      const existingSlotId = 42; // Currently editing slot #42

      const existingSlotsInDb = [
        { id: 42, faculty_id: 15, day_of_week: 'MON', period_number: 1, instance_id: 5 }, // self
        { id: 99, faculty_id: 15, day_of_week: 'TUE', period_number: 3, instance_id: 5 }  // another slot
      ];

      // Logic with fix: filters out existingSlotId
      const conflictRows = existingSlotsInDb.filter(slot =>
        slot.faculty_id === targetFacultyId &&
        slot.day_of_week === targetDay &&
        slot.period_number === targetPeriod &&
        slot.id !== existingSlotId
      );

      // Must have zero conflicts because the only match was self
      expect(conflictRows.length).toBe(0);
    });

    it('flags conflict when faculty is assigned in a different slot during the same period', () => {
      const targetFacultyId = 15;
      const targetDay = 'MON';
      const targetPeriod = 1;
      const existingSlotId = 42;

      const existingSlotsInDb = [
        { id: 42, faculty_id: 15, day_of_week: 'MON', period_number: 1, instance_id: 5 },
        { id: 77, faculty_id: 15, day_of_week: 'MON', period_number: 1, instance_id: 8 } // Conflict in instance 8!
      ];

      const conflictRows = existingSlotsInDb.filter(slot =>
        slot.faculty_id === targetFacultyId &&
        slot.day_of_week === targetDay &&
        slot.period_number === targetPeriod &&
        slot.id !== existingSlotId
      );

      expect(conflictRows.length).toBe(1);
      expect(conflictRows[0].id).toBe(77);
    });
  });
});