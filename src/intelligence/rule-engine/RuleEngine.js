import { getRule, getRulesByCategory } from './RuleRegistry';
import { getThresholds } from './ThresholdConfig';
import { getIntelligenceConfig } from '../shared/IntelligenceConfig';

export class RuleEngine {
  constructor() {
    this.config = null;
    this.thresholds = null;
  }

  async init() {
    if (!this.config || !this.thresholds) {
      this.config = await getIntelligenceConfig();
      this.thresholds = await getThresholds();
    }
  }

  _getNestedValue(obj, path) {
    if (!path || !obj) return null;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  async evaluate(ruleId, context) {
    await this.init();
    const rule = getRule(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    if (!rule.enabled || (this.config.enabled === false)) {
      return { passed: true, score: 0, explanation: 'Rule disabled', ruleName: rule.name, severity: rule.severity, threshold: rule.threshold, actualValue: null };
    }

    let threshold = rule.threshold;
    if (rule.defaultThresholdKey) {
      const configThreshold = this._getNestedValue(this.thresholds, rule.defaultThresholdKey);
      if (configThreshold !== undefined && configThreshold !== null) {
        threshold = configThreshold;
      }
    }

    let passed = true;
    let actualValue = null;
    let explanation = 'Passed';
    let score = 0;

    switch (ruleId) {
      case 'ATTENDANCE_WARNING':
      case 'ATTENDANCE_CRITICAL':
      case 'PROMOTION_ATTENDANCE':
        actualValue = context.attendancePercentage;
        if (actualValue !== undefined && threshold !== undefined) {
          if (actualValue < threshold) {
            passed = false;
            explanation = `Attendance ${actualValue}% is below threshold ${threshold}%`;
          }
        }
        break;
      case 'FEE_DUE':
      case 'FEE_OVERDUE':
      case 'FEE_DEFAULTER':
      case 'CERT_PENDING_DUES':
        actualValue = context.pendingDues;
        if (actualValue !== undefined) {
          if (actualValue > 0) {
            passed = false;
            explanation = `Pending dues amount: ${actualValue}`;
          }
        }
        break;
      case 'PROMOTION_BACKLOG':
        actualValue = context.backlogs;
        threshold = threshold || 5; 
        if (actualValue !== undefined && actualValue > threshold) {
          passed = false;
          explanation = `Backlogs ${actualValue} exceeds threshold ${threshold}`;
        }
        break;
      default:
        break;
    }

    return {
      passed,
      score,
      explanation,
      ruleName: rule.name,
      threshold,
      actualValue,
      severity: rule.severity
    };
  }

  async evaluateAll(context, category = null) {
    await this.init();
    const rules = this.getActiveRules(category);
    const results = [];
    for (const rule of rules) {
      const result = await this.evaluate(rule.id, context);
      results.push({ ruleId: rule.id, ...result });
    }
    return results;
  }

  getActiveRules(category = null) {
    const rules = getRulesByCategory(category);
    return rules.filter(r => r.enabled);
  }
}
