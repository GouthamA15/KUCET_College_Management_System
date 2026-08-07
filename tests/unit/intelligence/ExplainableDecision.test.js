/* global describe, it, expect */
import { ExplainableDecision } from '../../../src/intelligence/reports/ExplainableDecision';

describe('ExplainableDecision', () => {
  describe('formatRuleResult', () => {
    it('includes why, rulesApplied, dataUsed, thresholdsCrossed, suggestedAction', () => {
      const result = { passed: true, ruleName: 'TestRule' };
      const context = { data: 'test' };
      
      const formatted = ExplainableDecision.formatRuleResult(result, context);
      
      expect(formatted.decision).toEqual(result);
      expect(formatted.explanation.why).toBe('Condition met successfully');
      expect(formatted.explanation.rulesApplied).toContain('TestRule');
      expect(formatted.explanation.dataUsed).toEqual(context);
      expect(formatted.explanation.suggestedAction).toBe('No action needed');
      expect(formatted.explanation.confidence).toBe('HIGH');
    });
  });

  describe('formatPolicyResult', () => {
    it('INELIGIBLE policy has failedConditions in explanation', () => {
      const result = { status: 'INELIGIBLE', failedConditions: ['Low marks'] };
      const context = { marks: 30 };
      
      const formatted = ExplainableDecision.formatPolicyResult('Scholarship', result, context);
      
      expect(formatted.explanation.why).toBe('Scholarship criteria not met');
      expect(formatted.explanation.thresholdsCrossed).toContain('Low marks');
      expect(formatted.explanation.suggestedAction).toBe('Reject request');
    });
  });

  describe('formatScore', () => {
    it('breakdown appears in explanation', () => {
      const score = { total: 85, breakdown: { attendance: 40, marks: 45 } };
      
      const formatted = ExplainableDecision.formatScore(score, { data: 'test' });
      
      expect(formatted.explanation.thresholdsCrossed).toEqual(['attendance', 'marks']);
      expect(formatted.explanation.suggestedAction).toBe('Maintain good standing');
    });
  });

  describe('formatRecommendation', () => {
    it('reason is non-empty string', () => {
      const rec = { reason: 'Low attendance alert', action: 'Contact parents' };
      
      const formatted = ExplainableDecision.formatRecommendation(rec, {});
      
      expect(formatted.explanation.why).toBe('Low attendance alert');
      expect(formatted.explanation.suggestedAction).toBe('Contact parents');
    });
  });

  describe('Confidence scoring', () => {
    it('confidence = LOW when data is incomplete (empty context)', () => {
      const result = { passed: true };
      const formatted = ExplainableDecision.formatRuleResult(result, {});
      
      expect(formatted.explanation.confidence).toBe('LOW');
    });

    it('confidence = LOW when context is null', () => {
      const result = { passed: true };
      const formatted = ExplainableDecision.formatRuleResult(result, null);
      
      expect(formatted.explanation.confidence).toBe('LOW');
    });
  });
});
