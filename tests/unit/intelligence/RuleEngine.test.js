/* global describe, test, expect, beforeEach, jest */
import { RuleEngine } from '../../../src/intelligence/rule-engine/RuleEngine';

describe('RuleEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new RuleEngine();
    // Mock the config for testing
    engine.config = { enabled: true };
    engine.thresholds = {
      attendance: { warning: 75, critical: 65 }
    };
    engine.init = jest.fn().mockResolvedValue();
  });

  test('evaluate() ATTENDANCE_WARNING - triggered', async () => {
    const result = await engine.evaluate('ATTENDANCE_WARNING', { attendancePercentage: 74 });
    expect(result.passed).toBe(false);
    expect(result.threshold).toBe(75);
    expect(result.actualValue).toBe(74);
  });

  test('evaluate() ATTENDANCE_WARNING - not triggered', async () => {
    const result = await engine.evaluate('ATTENDANCE_WARNING', { attendancePercentage: 80 });
    expect(result.passed).toBe(true);
  });

  test('evaluateAll() returns filtered array', async () => {
    const results = await engine.evaluateAll({ attendancePercentage: 80 }, 'attendance');
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.passed).toBeDefined();
    });
  });

  test('disabled rules are skipped', async () => {
    // Modify registry temporarily or rely on engine config disabled
    engine.config.enabled = false;
    const result = await engine.evaluate('ATTENDANCE_WARNING', { attendancePercentage: 74 });
    expect(result.passed).toBe(true);
    expect(result.explanation).toBe('Rule disabled');
  });

  test('threshold config override', async () => {
    engine.thresholds.attendance.warning = 85;
    const result = await engine.evaluate('ATTENDANCE_WARNING', { attendancePercentage: 80 });
    expect(result.passed).toBe(false);
    expect(result.threshold).toBe(85);
  });
});
