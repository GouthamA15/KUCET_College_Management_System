import { z } from 'zod';
import { validateRollNo, _branchCodes } from '@/lib/rollNumber';
import { _COLLEGE_CONFIG } from '@/lib/college-config';

/**
 * Zod schema for creating a new student record.
 * Strictly enforces KUCET institutional standards.
 */
export const studentCreateSchema = z.object({
  roll_no: z.string()
    .transform((val) => val.trim().toUpperCase())
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
    .transform((val) => val?.replace(/\D/g, '') || '')
    .refine((val) => val === '' || val.length === 10, "Mobile number must be exactly 10 digits")
    .optional(),
  aadhaar_no: z.string()
    .transform((val) => val?.replace(/\D/g, '') || '')
    .refine((val) => val === '' || val.length === 12, "Aadhaar number must be exactly 12 digits")
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
    .refine((val) => {
      if (!val) return true;
      const num = parseInt(val.replace(/,/g, ''));
      return !isNaN(num) && num <= 2000000;
    }, {
      message: "Annual income must be a valid number up to 20,00,000",
    })
    .optional()
    .or(z.literal('')),
  perm_house_no: z.string().trim().max(255).optional().or(z.literal('')),
  perm_street: z.string().trim().max(255).optional().or(z.literal('')),
  perm_apartment: z.string().trim().max(255).optional().or(z.literal('')),
  perm_city: z.string().trim().max(255).optional().or(z.literal('')),
  perm_state: z.string().trim().max(255).optional().or(z.literal('')),
  perm_pincode: z.string().trim().max(20).optional().or(z.literal('')),
  perm_country: z.string().trim().max(100).optional().or(z.literal('')),
  curr_house_no: z.string().trim().max(255).optional().or(z.literal('')),
  curr_street: z.string().trim().max(255).optional().or(z.literal('')),
  curr_apartment: z.string().trim().max(255).optional().or(z.literal('')),
  curr_city: z.string().trim().max(255).optional().or(z.literal('')),
  curr_state: z.string().trim().max(255).optional().or(z.literal('')),
  curr_pincode: z.string().trim().max(20).optional().or(z.literal('')),
  curr_country: z.string().trim().max(100).optional().or(z.literal('')),
  is_current_same_as_permanent: z.boolean().optional(),
  qualifying_exam: z.enum(['TG EAPCET', 'TG ECET', 'PGECET', 'Other']).optional().or(z.literal('')),
  fee_reimbursement: z.preprocess(
    (v) => typeof v === 'string' ? v.toUpperCase() : v,
    z.enum(['YES', 'NO', 'GOV']).optional().or(z.literal(''))
  ),
  nationality: z.string().trim().max(100).optional().or(z.literal('')),
  mother_tongue: z.string().trim().max(100).optional().or(z.literal('')),
  place_of_birth: z.string().trim().max(255).optional().or(z.literal('')),
  father_occupation: z.string().trim().max(255).optional().or(z.literal('')),
  guardian_mobile: z.string()
    .transform((val) => val?.replace(/\D/g, '') || '')
    .refine((val) => val === '' || val.length === 10, "Guardian mobile number must be exactly 10 digits")
    .optional()
    .or(z.literal('')),
  blood_group: z.preprocess(
    (v) => (v === '' || v === 'Not available') ? null : v,
    z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional()
  ),
  seat_allotted_category: z.string().trim().max(100).optional().or(z.literal('')),
  identification_marks: z.string().trim().optional().or(z.literal('')),
  ranks: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : Number(v),
    z.number().min(0).optional()
  ),
  ssc_marks: z.string().trim().max(50).optional().or(z.literal('')),
  inter_marks: z.string().trim().max(50).optional().or(z.literal('')),
  previous_college_details: z.string().trim().optional().or(z.literal('')),
  medium_of_instruction: z.string().trim().max(50).optional().or(z.literal('')),
  pfp: z.string().optional().or(z.literal('')),
  signature: z.string().optional().or(z.literal('')),
  admission_date: z.preprocess(
    (input) => input === '' ? input : new Date(input),
    z.union([
      z.literal(''),
      z.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid date")
    ])
  ).optional(),
  area_status: z.enum(['Local', 'Non-Local']).optional().or(z.literal('')),
});

/**
 * Zod schema for updating a student record.
 * Similar to creation but fields are optional.
 */
export const studentUpdateSchema = studentCreateSchema.partial();
