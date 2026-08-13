import { apiResponse, apiError } from '@/lib/api-utils';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import { ClerkRegistrationService } from '@/services/identity/ClerkRegistrationService';
import { FACULTY_BRANCHES } from '@/lib/staff-config';
import logger from '@/lib/logger';
import { z } from 'zod';

export async function POST(req) {
  try {
    const _ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(getTieredKey(req, 'clerk_register'), 5, 3600); // 5 per hour
    
    if (!rateCheck.success) {
      return apiError('Too many registration attempts from this network. Please try again later.', 429);
    }

    const json = await req.json();

    const clerkRegisterSchema = z.object({
      name: z.string().trim().min(2, "Name must be at least 2 characters long"),
      email: z.string().trim().email("Invalid institutional email format").toLowerCase(),
      employee_id: z.string().trim().min(2, "Employee ID is required"),
      staff_category: z.enum(['FACULTY', 'SCHOLARSHIP_CLERK', 'ADMISSION_CLERK'], {
        errorMap: () => ({ message: "Please select a valid staff category (Faculty, Scholarship Clerk, or Admission Clerk)" })
      }),
      branch: z.string().trim().optional().nullable(),
      mobile: z.string().trim().optional().nullable(),
      pfp: z.string().optional().nullable(),
      signature: z.string().optional().nullable(),
    }).refine((data) => {
      if (data.staff_category === 'FACULTY') {
        return !!data.branch && FACULTY_BRANCHES.includes(data.branch.toUpperCase());
      }
      return true;
    }, {
      message: `Faculty registration requires a valid branch selection (${FACULTY_BRANCHES.join(', ')})`,
      path: ['branch']
    });

    const validatedData = clerkRegisterSchema.parse(json);

    const result = await ClerkRegistrationService.submitRegistrationRequest(validatedData);

    return apiResponse(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      const firstError = error.errors[0]?.message || 'Validation error';
      return apiError(firstError, 400);
    }
    if (error.message && (error.message.includes('already exists') || error.message.includes('awaiting administrator') || error.message.includes('Faculty members must select'))) {
      return apiError(error.message, 400);
    }
    logger.error(error, '[CLERK_REGISTER_API_ERROR]');
    return apiError(error.message || 'Failed to submit registration request', 500);
  }
}
