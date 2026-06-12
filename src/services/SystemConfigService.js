import { db } from '@/db';
import { systemConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';

export class SystemConfigService {
  /**
   * Fetch a configuration value from the database
   * @param {string} key - Configuration Key
   * @param {any} defaultValue - Fallback value if not found
   */
  static async getConfig(key, defaultValue = null) {
    try {
      const config = await db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.config_key, key)
      });
      if (!config) return defaultValue;
      
      switch (config.data_type) {
        case 'NUMBER': return Number(config.config_value);
        case 'BOOLEAN': return config.config_value === 'true';
        case 'JSON': return JSON.parse(config.config_value);
        default: return config.config_value;
      }
    } catch (e) {
      logger.error({ err: e.message, key }, 'Error fetching system config');
      return defaultValue;
    }
  }

  /**
   * Set or update a configuration value
   */
  static async setConfig(key, value, type = 'STRING', description = '', updatedBy = 'system') {
    let stringValue = value;
    if (type === 'JSON') stringValue = JSON.stringify(value);
    else if (type === 'BOOLEAN') stringValue = value ? 'true' : 'false';
    else stringValue = String(value);

    await db.insert(systemConfigs).values({
      config_key: key,
      config_value: stringValue,
      data_type: type,
      description,
      updated_by: updatedBy
    }).onDuplicateKeyUpdate({
      set: {
        config_value: stringValue,
        data_type: type,
        description,
        updated_by: updatedBy
      }
    });
  }

  // --- Predefined Configurations Helpers ---

  static async getFeeStructures() {
    return await this.getConfig('FEE_STRUCTURES', {
      REGULAR: 35000,
      SFC: 70000,
      SFC_COURSES: ['CSD', 'IT', 'CIVIL']
    });
  }

  static async getInstitutionalDetails() {
    return await this.getConfig('INSTITUTION_DETAILS', {
      name: "KU COLLEGE OF ENGINEERING & TECHNOLOGY",
      shortName: "KUCET",
      accreditation: "NAAC A+",
      address: "KAKATIYA UNIVERSITY CAMPUS, WARANGAL - 506 009",
      contact: "0870-2970125"
    });
  }
}
