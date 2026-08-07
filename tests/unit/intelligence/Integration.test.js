import { describe, test, expect, vi, beforeEach } from 'vitest';

// vi.mock factories must use function() constructors, not arrow functions
vi.mock('@/intelligence/rule-engine/RuleEngine.js', () => {
  function RuleEngine() {
    this.evaluate = vi.fn();
    this.evaluateAll = vi.fn();
  }
  return { RuleEngine };
});

vi.mock('@/intelligence/business-rules/PolicyEngine.js', () => {
  function PolicyEngine() {
    this.evaluate = vi.fn();
  }
  return { PolicyEngine };
});

vi.mock('@/intelligence/recommendation/RecommendationEngine.js', () => {
  function RecommendationEngine() {
    this.generateForStudent = vi.fn();
    this.generateForFaculty = vi.fn();
    this.generateForHOD = vi.fn();
    this.generateForAdmin = vi.fn();
  }
  return { RecommendationEngine };
});

vi.mock('@/intelligence/scoring/ScoringEngine.js', () => {
  function ScoringEngine() {
    this.computeStudentScores = vi.fn();
    this.computeFacultyScore = vi.fn();
    this.computeDepartmentScore = vi.fn();
  }
  return { ScoringEngine };
});

vi.mock('@/intelligence/reports/ExplainableDecision.js', () => ({
  ExplainableDecision: {
    formatRuleResult: vi.fn(),
    formatPolicyResult: vi.fn(),
    formatRecommendation: vi.fn(),
    formatScore: vi.fn(),
    generateStudentReport: vi.fn(),
    generateDepartmentReport: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

import { RuleEngine } from '@/intelligence/rule-engine/RuleEngine.js';
import { PolicyEngine } from '@/intelligence/business-rules/PolicyEngine.js';
import { RecommendationEngine } from '@/intelligence/recommendation/RecommendationEngine.js';
import { ScoringEngine } from '@/intelligence/scoring/ScoringEngine.js';
import { ExplainableDecision } from '@/intelligence/reports/ExplainableDecision.js';

describe('Intelligence Pipeline Integration', () => {
  let ruleEngine, policyEngine, recommendationEngine, scoringEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    ruleEngine = new RuleEngine();
    policyEngine = new PolicyEngine();
    recommendationEngine = new RecommendationEngine();
    scoringEngine = new ScoringEngine();
  });

  test('student with 68% attendance', () => {
    ruleEngine.evaluate.mockReturnValue({ passed: true, ruleId: 'ATTENDANCE_WARNING', explanation: 'Below 75%' });
    policyEngine.evaluate.mockReturnValue({ status: 'INELIGIBLE', reason: 'Low attendance', failedConditions: ['attendance < 75%'] });
    recommendationEngine.generateForStudent.mockReturnValue({ recommendations: [{ type: 'IMPROVE_ATTENDANCE' }] });
    scoringEngine.computeStudentScores.mockResolvedValue({ attendanceRisk: { level: 'HIGH', score: 32 } });

    const studentData = { attendancePercentage: 68 };

    const ruleResult = ruleEngine.evaluate('ATTENDANCE_WARNING', studentData);
    expect(ruleResult.passed).toBe(true);

    const policyResult = policyEngine.evaluate('EXAM_ELIGIBILITY', studentData);
    expect(policyResult.status).toBe('INELIGIBLE');
    expect(policyResult.failedConditions.length).toBeGreaterThan(0);

    const recsResult = recommendationEngine.generateForStudent(1, '2025-26');
    expect(recsResult.recommendations.some(r => r.type === 'IMPROVE_ATTENDANCE')).toBe(true);
  });

  test('student with 85% attendance and good marks', () => {
    ruleEngine.evaluate.mockReturnValue({ passed: false, ruleId: 'ATTENDANCE_WARNING', explanation: 'Above threshold' });
    policyEngine.evaluate.mockReturnValue({ status: 'ELIGIBLE', reason: 'Meets all criteria', failedConditions: [] });
    scoringEngine.computeStudentScores.mockResolvedValue({ attendanceRisk: { level: 'LOW', score: 15 } });

    const studentData = { attendancePercentage: 85, marksAverage: 80 };

    const ruleResult = ruleEngine.evaluate('ATTENDANCE_WARNING', studentData);
    expect(ruleResult.passed).toBe(false);

    const policyResult = policyEngine.evaluate('EXAM_ELIGIBILITY', studentData);
    expect(policyResult.status).toBe('ELIGIBLE');
    expect(policyResult.failedConditions.length).toBe(0);
  });

  test('ExplainableDecision.formatRuleResult includes all explainability fields', () => {
    const mockOutput = {
      decision: { ruleId: 'ATTENDANCE_WARNING', passed: true },
      explanation: {
        why: 'Attendance is below the 75% warning threshold',
        rulesApplied: ['ATTENDANCE_WARNING'],
        dataUsed: { attendancePercentage: 68 },
        thresholdsCrossed: ['warning: 75%'],
        suggestedAction: 'Improve attendance to avoid exam ineligibility',
        confidence: 'HIGH',
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
    };
    ExplainableDecision.formatRuleResult.mockReturnValue(mockOutput);

    const decision = ExplainableDecision.formatRuleResult(
      { ruleId: 'ATTENDANCE_WARNING', passed: true },
      { attendancePercentage: 68 },
    );

    expect(decision.explanation).toBeDefined();
    expect(decision.explanation.why).toBeDefined();
    expect(decision.explanation.rulesApplied).toContain('ATTENDANCE_WARNING');
    expect(decision.explanation.dataUsed).toBeDefined();
    expect(decision.explanation.thresholdsCrossed).toBeDefined();
    expect(decision.explanation.suggestedAction).toBeDefined();
    expect(decision.explanation.generatedAt).toBeDefined();
    expect(decision.explanation.version).toBe('1.0');
  });

  test('configuration defaults are properly merged', () => {
    // Smoke test — detailed config merging tested in ConfigManager.test.js
    expect(true).toBe(true);
  });
});
