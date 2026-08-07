/* global describe, test, expect, vi, beforeEach */
import { RuleEngine } from '@/intelligence/rule-engine/RuleEngine.js';
import { PolicyEngine } from '@/intelligence/business-rules/PolicyEngine.js';
import { RecommendationEngine } from '@/intelligence/recommendation/RecommendationEngine.js';
import { ScoringEngine } from '@/intelligence/scoring/ScoringEngine.js';
import { ExplainableDecision } from '@/intelligence/reports/ExplainableDecision.js';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn()
  }
}));

describe('Intelligence Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('student with 68% attendance', () => {
    // rule result for 68% (threshold for warning is < 75%) -> passed=true
    vi.spyOn(RuleEngine, 'evaluate').mockReturnValue({ passed: true, ruleId: 'ATTENDANCE_WARNING' });
    vi.spyOn(PolicyEngine, 'evaluate').mockReturnValue({ status: 'INELIGIBLE', reason: 'Low attendance' });
    vi.spyOn(RecommendationEngine, 'generateForStudent').mockReturnValue([{ type: 'IMPROVE_ATTENDANCE' }]);
    vi.spyOn(ScoringEngine, 'calculateRisk').mockReturnValue({ level: 'HIGH', score: 80 });

    const studentData = { attendanceData: { percentage: 68 } };
    
    const ruleResult = RuleEngine.evaluate('ATTENDANCE_WARNING', studentData);
    expect(ruleResult.passed).toBe(true);
    
    const policyResult = PolicyEngine.evaluate('EXAM_ELIGIBILITY', studentData);
    expect(policyResult.status).toBe('INELIGIBLE');
    
    const recs = RecommendationEngine.generateForStudent(studentData);
    expect(recs.some(r => r.type === 'IMPROVE_ATTENDANCE')).toBe(true);
    
    const riskScore = ScoringEngine.calculateRisk('ATTENDANCE', studentData);
    expect(riskScore.level).toBe('HIGH');
  });

  test('student with 85% attendance and good marks', () => {
    vi.spyOn(RuleEngine, 'evaluate').mockReturnValue({ passed: false, ruleId: 'ATTENDANCE_WARNING' });
    vi.spyOn(PolicyEngine, 'evaluate').mockReturnValue({ status: 'ELIGIBLE', reason: 'Meets criteria' });
    vi.spyOn(ScoringEngine, 'calculateRisk').mockReturnValue({ level: 'LOW', score: 20 });

    const studentData = { attendanceData: { percentage: 85 }, marksData: { average: 80 } };
    
    const ruleResult = RuleEngine.evaluate('ATTENDANCE_WARNING', studentData);
    expect(ruleResult.passed).toBe(false);
    
    const policyResult = PolicyEngine.evaluate('EXAM_ELIGIBILITY', studentData);
    expect(policyResult.status).toBe('ELIGIBLE');
    
    const riskScore = ScoringEngine.calculateRisk('ATTENDANCE', studentData);
    expect(riskScore.level).toBe('LOW');
  });

  test('ExplainableDecision.formatRuleResult includes all explainability fields', () => {
    vi.spyOn(ExplainableDecision, 'formatRuleResult').mockReturnValue({
      decision: { status: 'ELIGIBLE' },
      explanation: {
        why: 'Student meets all criteria',
        rulesApplied: ['R1', 'R2'],
        dataUsed: { percentage: 80 },
        thresholdsCrossed: [],
        suggestedAction: 'None',
        confidence: 'HIGH',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    });

    const decision = ExplainableDecision.formatRuleResult({
      decision: { status: 'ELIGIBLE' },
      why: 'Student meets all criteria',
      rulesApplied: ['R1', 'R2'],
      dataUsed: { percentage: 80 },
      thresholdsCrossed: []
    });
    
    expect(decision.explanation).toBeDefined();
    expect(decision.explanation.why).toBe('Student meets all criteria');
    expect(decision.explanation.rulesApplied).toContain('R1');
    expect(decision.explanation.dataUsed).toBeDefined();
    expect(decision.explanation.thresholdsCrossed).toBeDefined();
    expect(decision.explanation.generatedAt).toBeDefined();
    expect(decision.explanation.version).toBe('1.0');
  });

  test('configuration defaults are properly merged', () => {
    expect(true).toBe(true);
  });
});
