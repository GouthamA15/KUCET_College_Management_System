import { z } from 'zod';
import { validateRollNo, branchCodes } from '@/lib/rollNumber';
import { COLLEGE_CONFIG } from '@/lib/college-config';

/**
 * Zod schema for creating a new student record.
 * Strictly enforces KUCET institutional standards.
 */
export const studentCreateSchema = z.object({
  roll_no: z.string()
    .trim()
    .toUpperCase()
    .refine((val) => validateRollNo(val).isValid, {
      message: "Invalid KUCET roll number format (e.g., 22567T0901 or 225670901L)",
    }),
  name: z.string()
    .trim()
    .min(3, "Full name must be at least 3 characters")
    .max(255)
    .regex(/^[a-zA-Z\s.]+$/, "Name should only contain letters, spaces, and dots"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .toLowerCase()
    .optional()
    .or(z.literal('')),
  mobile: z.string()
    .trim()
    .length(10, "Mobile number must be exactly 10 digits")
    .regex(/^\d+$/, "Mobile number must contain only digits"),
  aadhaar_no: z.string()
    .trim()
    .length(12, "Aadhaar number must be exactly 12 digits")
    .regex(/^\d+$/, "Aadhaar number must contain only digits")
    .optional()
    .or(z.literal('')),
  admission_no: z.string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal('')),
  date_of_birth: z.preprocess(
    (input) => input === '' ? input : new Date(input),
    z.union([
      z.literal(''),
      z.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid date")
    ])
  ).optional(),
  gender: z.preprocess(
    (v) => typeof v === 'string' ? v.toUpperCase() : v,
    z.enum(['MALE', 'FEMALE', 'OTHER']).optional()
  ),
  father_name: z.string().trim().max(255).optional().or(z.literal('')),
  mother_name: z.string().trim().max(255).optional().or(z.literal('')),
  religion: z.string().trim().max(100).optional().or(z.literal('')),
  sub_caste: z.string().trim().max(100).optional().or(z.literal('')),
  category: z.string().trim().max(50).optional().or(z.literal('')),
  annual_income: z.string()
    .refine((val) => !val || COLLEGE_CONFIG.incomeRanges.includes(val), {
      message: "Invalid annual income range",
    })
    .optional()
    .or(z.literal('')),
  address: z.string().trim().max(1000).optional().or(z.literal('')),
  qualifying_exam: z.enum(['EAMCET', 'ECET', 'PGECET', 'Other']).optional().or(z.literal('')),
});

/**
 * Zod schema for updating a student record.
 * Similar to creation but fields are optional.
 */
export const studentUpdateSchema = studentCreateSchema.partial();
