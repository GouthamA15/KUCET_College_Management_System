export class ExplainableDecision {
  static formatRuleResult(result, context) {
    const isPassing = result.passed || result.value === true || result.score > 0;
    return {
      decision: result,
      explanation: {
        why: isPassing ? 'Condition met successfully' : 'Condition failed',
        rulesApplied: [result.ruleName || 'Unknown Rule'],
        dataUsed: context || {},
        thresholdsCrossed: result.thresholds || [],
        suggestedAction: isPassing ? 'No action needed' : 'Review criteria',
        confidence: context && Object.keys(context).length > 0 ? 'HIGH' : 'LOW',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  static formatPolicyResult(policy, result, context) {
    const isEligible = result.eligible || result.status === 'ELIGIBLE';
    return {
      decision: result,
      explanation: {
        why: isEligible ? `${policy} criteria met` : `${policy} criteria not met`,
        rulesApplied: result.rulesApplied || [],
        dataUsed: context || {},
        thresholdsCrossed: result.failedConditions || [],
        suggestedAction: isEligible ? 'Proceed with approval' : 'Reject request',
        confidence: context && Object.keys(context).length > 0 ? 'HIGH' : 'LOW',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  static formatRecommendation(rec, context) {
    return {
      decision: rec,
      explanation: {
        why: rec.reason || 'Based on recent activity patterns',
        rulesApplied: ['RecommendationEngine.Rule1'],
        dataUsed: context || {},
        thresholdsCrossed: [],
        suggestedAction: rec.action || 'Review recommendation',
        confidence: context && Object.keys(context).length > 0 ? 'HIGH' : 'LOW',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  static formatScore(score, context) {
    return {
      decision: score,
      explanation: {
        why: `Score calculated based on weighted criteria`,
        rulesApplied: ['ScoringEngine.Weights'],
        dataUsed: context || {},
        thresholdsCrossed: score.breakdown ? Object.keys(score.breakdown) : [],
        suggestedAction: score.total > 70 ? 'Maintain good standing' : 'Improve performance',
        confidence: context && Object.keys(context).length > 0 ? 'HIGH' : 'LOW',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  static async generateStudentReport(studentId, academicYear) {
    return {
      decision: { status: 'Generated' },
      explanation: {
        why: 'Periodic student intelligence report',
        rulesApplied: ['All Student Rules'],
        dataUsed: { studentId, academicYear },
        thresholdsCrossed: [],
        suggestedAction: 'Review report',
        confidence: 'HIGH',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  static async generateDepartmentReport(branch, academicYear) {
    return {
      decision: { status: 'Generated' },
      explanation: {
        why: 'Periodic department intelligence report',
        rulesApplied: ['All Department Rules'],
        dataUsed: { branch, academicYear },
        thresholdsCrossed: [],
        suggestedAction: 'Review report',
        confidence: 'HIGH',
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }
}
