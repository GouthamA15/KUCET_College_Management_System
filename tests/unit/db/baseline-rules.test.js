import { describe, it, expect, vi } from 'vitest';
import { BASELINE_RULES } from '../../../src/db/baseline-rules.js';

describe('Multi-Environment Drizzle Baseline Rules Registry', () => {
  it('exports a non-empty array of baseline rules', () => {
    expect(Array.isArray(BASELINE_RULES)).toBe(true);
    expect(BASELINE_RULES.length).toBeGreaterThanOrEqual(6);
  });

  it('validates that every baseline rule has required fields and handler signatures', () => {
    for (const rule of BASELINE_RULES) {
      expect(rule).toHaveProperty('id');
      expect(typeof rule.description).toBe('string');
      expect(typeof rule.getEntries).toBe('function');
      expect(typeof rule.isSatisfied).toBe('function');
      expect(typeof rule.getReason).toBe('function');
    }
  });

  it('resolves historical entries (0000-0015) correctly', () => {
    const historicalRule = BASELINE_RULES.find((r) => r.id === 'historical_0000_0015');
    expect(historicalRule).toBeDefined();

    const mockEntries = [
      { idx: 0, tag: '0000_flippant_fabian_cortez', when: 100 },
      { idx: 15, tag: '0015_database_backup_logs', when: 200 },
      { idx: 16, tag: '0016_reconcile_staff_and_hod_schema', when: 300 },
      { idx: 20, tag: '0020_subject_module_and_elective_groups', when: 400 },
    ];

    const matched = historicalRule.getEntries(mockEntries);
    expect(matched.length).toBe(2);
    expect(matched.map((m) => m.idx)).toEqual([0, 15]);
  });

  it('resolves 0020_subject_module_and_elective_groups entry correctly', () => {
    const rule0020 = BASELINE_RULES.find((r) => r.id === 20);
    expect(rule0020).toBeDefined();

    const mockEntries = [
      { idx: 19, tag: '0019_timetable_instances', when: 190 },
      { idx: 20, tag: '0020_subject_module_and_elective_groups', when: 200 },
      { idx: 21, tag: '0021_future_migration', when: 210 },
    ];

    const matched = rule0020.getEntries(mockEntries);
    expect(matched.length).toBe(1);
    expect(matched[0].idx).toBe(20);
    expect(rule0020.getReason(matched[0])).toContain('staff_account_id');
  });

  it('detects satisfaction when database queries indicate columns/tables exist', async () => {
    const rule0016 = BASELINE_RULES.find((r) => r.id === 16);
    expect(rule0016).toBeDefined();

    const mockConnectionTrue = {
      query: vi.fn().mockResolvedValue([[{ count: '1' }]]),
    };

    const isSatisfiedTrue = await rule0016.isSatisfied(mockConnectionTrue);
    expect(isSatisfiedTrue).toBe(true);

    const mockConnectionFalse = {
      query: vi.fn().mockResolvedValue([[{ count: '0' }]]),
    };

    const isSatisfiedFalse = await rule0016.isSatisfied(mockConnectionFalse);
    expect(isSatisfiedFalse).toBe(false);
  });

  it('correctly evaluates 0020 dual-condition satisfaction (fsa staff_account_id + elective_groups)', async () => {
    const rule0020 = BASELINE_RULES.find((r) => r.id === 20);
    expect(rule0020).toBeDefined();

    // Both present
    const mockBothPresent = {
      query: vi
        .fn()
        .mockResolvedValueOnce([[{ count: '1' }]])
        .mockResolvedValueOnce([[{ count: '1' }]]),
    };
    expect(await rule0020.isSatisfied(mockBothPresent)).toBe(true);

    // Only fsa present, elective_groups missing
    const mockPartial = {
      query: vi
        .fn()
        .mockResolvedValueOnce([[{ count: '1' }]])
        .mockResolvedValueOnce([[{ count: '0' }]]),
    };
    expect(await rule0020.isSatisfied(mockPartial)).toBe(false);
  });
});
