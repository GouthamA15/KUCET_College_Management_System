import { db } from '@/db';
import { systemConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cacheAside, invalidateTag } from '@/lib/cache';
import { safeJsonParse } from '@/lib/json-utils';

const DEFAULT_THRESHOLDS = {
  attendance: { warning: 75, critical: 65, condonation_min: 65 },
  marks: { pass_percentage: 40, distinction: 75, first_class: 60 },
  fee: { overdue_years: 1, defaulter_years: 2 },
  scholarship: { release_warning_months: 6 }
};

const DEFAULT_SCORE_WEIGHTS = {
  student_performance: {
    attendance: 0.30, marks: 0.40, fee_compliance: 0.20, engagement: 0.10
  },
  faculty_performance: {
    attendance_submission: 0.30, topic_coverage: 0.30, student_pass_rate: 0.40
  },
  department_performance: {
    avg_student_perf: 0.40, faculty_perf: 0.30, fee_collection: 0.20, scholarship: 0.10
  },
  attendance_risk: { overall_attendance: 0.60, subject_min_attendance: 0.40 },
  academic_risk: { avg_marks: 0.50, failed_subjects: 0.30, marks_trend: 0.20 },
  fee_default_risk: { years_unpaid: 0.70, scholarship_status: 0.30 }
};

const DEFAULT_DASHBOARD_CONFIG = {
  maxRecommendations: 10,
  maxAlerts: 5,
  refreshIntervalMinutes: 5,
  kpiCardLimit: 6
};

const DEFAULT_ANALYTICS_CONFIG = {
  defaultDateRangeDays: 30,
  maxDateRangeDays: 365,
  defaultPageLimit: 20,
  maxPageLimit: 100,
  trendWeeks: 12
};

const DEFAULT_RULE_CONFIG = {};

const CONFIG_KEYS = {
  thresholds: 'INTELLIGENCE_THRESHOLDS',
  scoreWeights: 'INTELLIGENCE_SCORE_WEIGHTS',
  ruleConfig: 'INTELLIGENCE_RULE_CONFIG',
  dashboardConfig: 'INTELLIGENCE_DASHBOARD_CONFIG',
  analyticsConfig: 'INTELLIGENCE_ANALYTICS_CONFIG',
};

const DEFAULTS = {
  thresholds: DEFAULT_THRESHOLDS,
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
  ruleConfig: DEFAULT_RULE_CONFIG,
  dashboardConfig: DEFAULT_DASHBOARD_CONFIG,
  analyticsConfig: DEFAULT_ANALYTICS_CONFIG,
};

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;
  
  const output = { ...target };
  Object.keys(source).forEach(key => {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  });
  return output;
}

class ConfigManager {
  async _loadConfig(section) {
    const key = CONFIG_KEYS[section];
    if (!key) throw new Error(`Invalid config section: ${section}`);

    return cacheAside(`intelligence_config_${section}`, async () => {
      const result = await db.select().from(systemConfigs).where(eq(systemConfigs.config_key, key)).limit(1);
      
      const defaults = DEFAULTS[section];
      
      if (result.length > 0 && result[0].config_value) {
        const parsed = safeJsonParse(result[0].config_value, {});
        return deepMerge(defaults, parsed);
      }
      return defaults;
    }, { ttl: 3600, tags: ['intelligence'] });
  }

  async getThresholds() {
    return this._loadConfig('thresholds');
  }

  async getScoreWeights(model = null) {
    const weights = await this._loadConfig('scoreWeights');
    if (model) {
      return weights[model] || {};
    }
    return weights;
  }

  async getRuleConfig() {
    return this._loadConfig('ruleConfig');
  }

  async getDashboardConfig() {
    return this._loadConfig('dashboardConfig');
  }

  async getAnalyticsConfig() {
    return this._loadConfig('analyticsConfig');
  }

  async updateConfig(section, value) {
    const key = CONFIG_KEYS[section];
    if (!key) throw new Error(`Invalid config section: ${section}`);

    const existingConfig = await this._loadConfig(section);
    const newValue = deepMerge(existingConfig, value);
    const strValue = JSON.stringify(newValue);

    const existing = await db.select().from(systemConfigs).where(eq(systemConfigs.config_key, key)).limit(1);

    if (existing.length > 0) {
      await db.update(systemConfigs)
        .set({ config_value: strValue })
        .where(eq(systemConfigs.config_key, key));
    } else {
      await db.insert(systemConfigs).values({
        config_key: key,
        config_value: strValue,
        data_type: 'JSON'
      });
    }

    invalidateTag('intelligence');
  }
}

export const configManager = new ConfigManager();
export {
  DEFAULT_THRESHOLDS,
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_RULE_CONFIG,
  CONFIG_KEYS
};
