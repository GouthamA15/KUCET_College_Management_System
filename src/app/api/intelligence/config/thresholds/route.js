import { wrapHandler, apiResponse } from '@/lib/api-utils';
import { z } from 'zod';
import { configManager } from '@/intelligence/shared/ConfigManager';

export const GET = wrapHandler({ role: 'admin' }, async (req) => {
  const thresholds = await configManager.getThresholds();
  return apiResponse({ thresholds });
});

export const thresholdsUpdateSchema = z.object({
  attendance: z.object({
    warning: z.number().min(0).max(100),
    critical: z.number().min(0).max(100),
    condonation_min: z.number().min(0).max(100).optional(),
  }).optional(),
  marks: z.object({
    pass_percentage: z.number().min(0).max(100).optional(),
    distinction: z.number().min(0).max(100).optional(),
    first_class: z.number().min(0).max(100).optional(),
  }).optional(),
  fee: z.object({
    overdue_years: z.number().min(0).optional(),
    defaulter_years: z.number().min(0).optional(),
  }).optional(),
  scholarship: z.object({
    release_warning_months: z.number().min(0).optional(),
  }).optional(),
}).refine(data => {
  if (data.attendance && data.attendance.warning !== undefined && data.attendance.critical !== undefined) {
    return data.attendance.warning > data.attendance.critical;
  }
  return true;
}, {
  message: 'Attendance warning threshold must be greater than critical threshold',
  path: ['attendance']
});

export const PUT = wrapHandler({ role: 'admin' }, async (req) => {
  const body = await req.json();
  
  const validation = thresholdsUpdateSchema.safeParse(body);
  if (!validation.success) {
    return apiResponse({ 
      success: false, 
      error: 'Validation failed', 
      details: validation.error.errors 
    }, { status: 400 });
  }

  const parsed = validation.data;
  
  await configManager.updateConfig('thresholds', parsed);

  return apiResponse({ success: true, message: 'Thresholds updated successfully' });
});
