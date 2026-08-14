/* global describe, test, expect, beforeEach */
import { PolicyEngine } from '../../../src/intelligence/business-rules/PolicyEngine';

describe('PolicyEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  test('EXAM_ELIGIBILITY: all pass -> ELIGIBLE', () => {
    const result = engine.evaluate('EXAM_ELIGIBILITY', { attendancePercentage: 80, pendingDues: 0 });
    expect(result.status).toBe('ELIGIBLE');
    expect(result.failedConditions.length).toBe(0);
  });

  test('EXAM_ELIGIBILITY: attendance fail -> INELIGIBLE with failedConditions', () => {
    const result = engine.evaluate('EXAM_ELIGIBILITY', { attendancePercentage: 60, pendingDues: 0 });
    expect(result.status).toBe('INELIGIBLE');
    expect(result.failedConditions).toContainEqual(expect.stringContaining('60% < 75%'));
  });

  test('CONDONATION_ELIGIBILITY: 70% -> CONDITIONAL', () => {
    const result = engine.evaluate('CONDONATION_ELIGIBILITY', { attendancePercentage: 70 });
    expect(result.status).toBe('CONDITIONAL');
  });

  test('CERTIFICATE_APPROVAL: pending fee -> INELIGIBLE', () => {
    const result = engine.evaluate('CERTIFICATE_APPROVAL', { pendingDues: 5000 });
    expect(result.status).toBe('INELIGIBLE');
    expect(result.failedConditions).toContainEqual(expect.stringContaining('5000'));
  });
});
