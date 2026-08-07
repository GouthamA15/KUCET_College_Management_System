import { db } from '@/db';
import { systemConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cacheAside } from '@/lib/cache';

const DEFAULT_CONFIG = {
  thresholds: {
    attendance: { warning: 75, critical: 65, condonation_min: 65 },
    fee: { due_days: 15, overdue_days: 30 }
  },
  weights: {
    attendance: 0.4,
    marks: 0.6
  },
  enabled: true
};

export async function getIntelligenceConfig() {
  return cacheAside('INTELLIGENCE_CONFIG', async () => {
    try {
      const result = await db.select().from(systemConfigs).where(eq(systemConfigs.config_key, 'INTELLIGENCE_CONFIG')).limit(1);
      if (result.length > 0 && result[0].config_value) {
        return JSON.parse(result[0].config_value);
      }
    } catch (error) {
      console.error('Error fetching INTELLIGENCE_CONFIG', error);
    }
    return DEFAULT_CONFIG;
  }, { ttl: 300, tags: ['intelligence'] });
}
