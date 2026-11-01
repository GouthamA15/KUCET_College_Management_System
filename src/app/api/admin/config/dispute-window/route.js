import logger from '@/lib/logger';
import { db } from '@/db';
import { systemConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { z } from 'zod';

const updateSchema = z.object({
  window_days: z.preprocess(v => Number(v), z.number().int().min(1).max(90))
});

export async function GET() {
  try {
    const user = await getAuthUser('admin');
    if (!user || user.role !== 'admin') {
      return apiError('Unauthorized', 401);
    }

    const row = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.config_key, 'ATTENDANCE_DISPUTE_WINDOW_DAYS')
    });

    const windowDays = row ? Number(row.config_value) : 7;
    return apiResponse({ window_days: windowDays });
  } catch (err) {
    logger.error('Error fetching dispute window config:', err);
    return apiError('Internal Server Error', 500);
  }
}

export async function PUT(request) {
  try {
    const user = await getAuthUser('admin');
    if (!user || user.role !== 'admin') {
      return apiError('Unauthorized', 401);
    }

    const body = await request.json();
    const { window_days } = updateSchema.parse(body);

    await db.insert(systemConfigs)
      .values({
        config_key: 'ATTENDANCE_DISPUTE_WINDOW_DAYS',
        config_value: String(window_days),
        data_type: 'NUMBER',
        description: 'Maximum allowable window in calendar days for students to dispute recorded absences',
        updated_by: user.name || 'Super Admin'
      })
      .onDuplicateKeyUpdate({
        set: {
          config_value: String(window_days),
          updated_at: new Date(),
          updated_by: user.name || 'Super Admin'
        }
      });

    return apiResponse({
      success: true,
      window_days,
      message: `Dispute window updated to ${window_days} days`
    });
  } catch (err) {
    if (err?.name === 'ZodError') {
      return apiError(err.errors[0]?.message || 'Validation error', 400);
    }
    logger.error('Error updating dispute window config:', err);
    return apiError('Internal Server Error', 500);
  }
}
