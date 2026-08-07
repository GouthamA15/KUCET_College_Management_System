/* global describe, test, expect, beforeEach, jest */
import { calcPercentage, calcGrade, calcTrend, calcMovingAverage, calcStdDev, calcPercentile } from '../../../src/intelligence/shared/StatUtils';

describe('StatUtils', () => {
  test('calcPercentage: 3/4 -> 75, 0/0 -> 0', () => {
    expect(calcPercentage(3, 4)).toBe(75);
    expect(calcPercentage(0, 0)).toBe(0);
  });

  test('calcGrade: 90 -> O, 75 -> A, 59 -> B, 39 -> F', () => {
    expect(calcGrade(90)).toBe('O');
    expect(calcGrade(75)).toBe('A');
    expect(calcGrade(59)).toBe('B');
    expect(calcGrade(39)).toBe('F');
  });

  test('calcTrend: [60,65,70] -> IMPROVING', () => {
    expect(calcTrend([60, 65, 70])).toBe('IMPROVING');
    expect(calcTrend([70, 65, 60])).toBe('DECLINING');
    expect(calcTrend([70, 70, 70])).toBe('STABLE');
  });

  test('calcMovingAverage', () => {
    const res = calcMovingAverage([10, 20, 30], 2);
    expect(res).toEqual([null, 15, 25]);
  });

  test('calcStdDev', () => {
    const std = calcStdDev([10, 20, 30]);
    expect(std).toBeCloseTo(8.16, 2);
  });

  test('calcPercentile', () => {
    expect(calcPercentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });
});
