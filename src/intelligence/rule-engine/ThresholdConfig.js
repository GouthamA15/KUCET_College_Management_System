import { db } from '@/db';
import { systemConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cacheAside } from '@/lib/cache';
import { getIntelligenceConfig } from '../shared/IntelligenceConfig';

const DEFAULT_THRESHOLDS = {
  attendance: { warning: 75, critical: 65, condonation_min: 65 },
  fee: { warning_days: 7, critical_days: 15 }
};

export async function getThresholds() {
  const config = await getIntelligenceConfig();
  if (config && config.thresholds) {
    return { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  }
  return cacheAside('INTELLIGENCE_THRESHOLDS', async () => {
    try {
      const result = await db.select().from(systemConfigs).where(eq(systemConfigs.config_key, 'INTELLIGENCE_THRESHOLDS')).limit(1);
      if (result.length > 0 && result[0].config_value) {
        return { ...DEFAULT_THRESHOLDS, ...JSON.parse(result[0].config_value) };
      }
    } catch (error) {
      console.error('Error fetching INTELLIGENCE_THRESHOLDS', error);
    }
    return DEFAULT_THRESHOLDS;
  }, { ttl: 300, tags: ['intelligence'] });
}
