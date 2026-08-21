import { z } from 'zod';

/**
 * Zod schema for Staff roles.
 */
export const staffRoleSchema = z.enum([
  'admin',
  'admission',
  'scholarship',
  'faculty',
  'principal',
  'hod',
  'staff'
]);

/**
 * Zod schema for creating/updating a staff record.
 * Used by Super Admin.
 */
export const staffSchema = z.object({
  name: z.string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(255)
    .regex(/^[a-zA-Z\s.]+$/, "Name should only contain letters, spaces, and dots"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),
  role: staffRoleSchema,
  branch: z.string().trim().max(50).nullable().optional(),
  is_hod: z.boolean().default(false),
  status: z.enum(['active', 'inactive']).default('active'),
  mobile: z.string()
    .transform((val) => val?.replace(/\D/g, '') || '')
    .refine((val) => val === '' || val.length === 10, "Mobile number must be exactly 10 digits")
    .optional()
});

/**
 * Zod schema for Timetable Slots.
 */
export const timetableSlotSchema = z.object({
  day_of_week: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
  period_number: z.number().int().min(1).max(8),
  subject_code: z.string().trim().min(1).max(50).toUpperCase(),
  faculty_id: z.number().int().positive(),
  room_no: z.string().trim().max(50).toUpperCase().optional().nullable(),
  semester: z.number().int().min(1).max(8)
});

/**
 * Zod schema for Internal Marks.
 */
export const internalMarksSchema = z.object({
  student_id: z.number().int().positive(),
  assignment_id: z.number().int().positive(),
  internal_marks: z.number().min(0).max(100), // Adjust max based on pattern
  attendance_marks: z.number().min(0).max(10).optional().nullable(),
  total_marks: z.number().min(0).max(110).optional().nullable()
});

/**
 * Zod schema for Scholarship Sanctions.
 */
export const scholarshipSanctionSchema = z.object({
  roll_no: z.string().trim().toUpperCase().min(10),
  academic_year: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-YY"),
  application_no: z.string().trim().min(6).max(20).regex(/^\d+$/, "Must be numeric").optional().nullable(),
  proceeding_no: z.string().trim().max(100).optional().nullable(),
  sanctioned_amount: z.number().min(0).max(150000).optional().nullable(),
  released_amount: z.number().min(0).max(150000).optional().nullable(),
  status: z.enum(['PENDING', 'SANCTIONED', 'RELEASED', 'REJECTED'])
});


