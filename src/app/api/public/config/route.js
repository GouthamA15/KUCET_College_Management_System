import logger from '@/lib/logger';
import { db } from '@/db';
import { collegeInfo } from '@/db/schema';
import { apiResponse, apiError } from '@/lib/api-utils';
import { SystemConfigService } from '@/services/SystemConfigService';

export async function GET() {
  try {
    // PUBLIC API: No auth required
    const dbConfig = await db.query.collegeInfo.findFirst();
    
    // Fetch dynamic configurations from the new system_configs table
    const feeStructures = await SystemConfigService.getFeeStructures();
    const institutionalDetails = await SystemConfigService.getInstitutionalDetails();
    
    // Merge everything so the client receives a unified config object
    return apiResponse({ 
      config: dbConfig || {},
      systemConfigs: {
        feeStructures,
        institutionalDetails
      }
    });
  } catch (error) {
    logger.error(error, 'Error fetching public college config');
    return apiError('Internal Server Error', 500);
  }
}
