import logger from '@/lib/logger';
import { db } from '@/db';
import { _collegeInfo } from '@/db/schema';
import { apiResponse, apiError } from '@/lib/api-utils';

export async function GET() {
  try {
    // PUBLIC API: No auth required
    const config = await db.query.collegeInfo.findFirst();
    
    // Return the config, or defaults if none exists
    // The client will merge this with COLLEGE_CONFIG defaults
    return apiResponse({ config: config || { /* empty */ } });
  } catch (error) {
    logger.error(error, 'Error fetching public college config');
    return apiError('Internal Server Error', 500);
  }
}
