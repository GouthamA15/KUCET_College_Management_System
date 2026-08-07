import { describe, test, expect, beforeEach, vi } from 'vitest';
import { configManager, DEFAULT_THRESHOLDS, DEFAULT_SCORE_WEIGHTS } from '@/intelligence/shared/ConfigManager';
import { db } from '@/db';
import { cacheAside, invalidateTag } from '@/lib/cache';
import { thresholdsUpdateSchema } from '@/app/api/intelligence/config/thresholds/route';

vi.mock('@/db', () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis()
    }
  };
});

vi.mock('@/db/schema', () => {
  return {
    systemConfigs: {
      config_key: 'config_key'
    }
  };
});

vi.mock('@/lib/cache', () => {
  return {
    cacheAside: vi.fn((key, fetcher) => fetcher()),
    invalidateTag: vi.fn()
  };
});

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('getThresholds returns defaults when no DB config', async () => {
    db.limit.mockResolvedValueOnce([]);

    const thresholds = await configManager.getThresholds();
    expect(thresholds).toEqual(DEFAULT_THRESHOLDS);
  });

  test('getThresholds merges DB overrides with defaults', async () => {
    const dbConfig = {
      attendance: { warning: 80 }
    };

    db.limit.mockResolvedValueOnce([
      { config_value: JSON.stringify(dbConfig) }
    ]);

    const thresholds = await configManager.getThresholds();
    expect(thresholds.attendance.warning).toBe(80);
    expect(thresholds.attendance.critical).toBe(DEFAULT_THRESHOLDS.attendance.critical);
    expect(thresholds.marks.pass_percentage).toBe(DEFAULT_THRESHOLDS.marks.pass_percentage);
  });

  test('getScoreWeights returns expected weights for a model', async () => {
    db.limit.mockResolvedValueOnce([]);

    const studentWeights = await configManager.getScoreWeights('student_performance');
    expect(studentWeights).toEqual(DEFAULT_SCORE_WEIGHTS.student_performance);
    
    db.limit.mockResolvedValueOnce([]);
    const allWeights = await configManager.getScoreWeights();
    expect(allWeights).toEqual(DEFAULT_SCORE_WEIGHTS);
  });

  test('updateConfig calls invalidateTag', async () => {
    db.limit.mockResolvedValueOnce([]);
    db.limit.mockResolvedValueOnce([]);

    await configManager.updateConfig('thresholds', { attendance: { warning: 85 } });

    expect(invalidateTag).toHaveBeenCalledWith('intelligence');
    expect(db.insert).toHaveBeenCalled();
  });

  test('updateConfig updates existing config', async () => {
    db.limit.mockResolvedValueOnce([ { config_value: '{}' } ]);
    db.limit.mockResolvedValueOnce([ { config_value: '{}' } ]);

    await configManager.updateConfig('thresholds', { attendance: { warning: 85 } });

    expect(invalidateTag).toHaveBeenCalledWith('intelligence');
    expect(db.update).toHaveBeenCalled();
  });
});

describe('Thresholds Validation', () => {
  test('warning must be > critical', () => {
    const validData = {
      attendance: {
        warning: 75,
        critical: 65
      }
    };
    
    const validResult = thresholdsUpdateSchema.safeParse(validData);
    expect(validResult.success).toBe(true);

    const invalidData = {
      attendance: {
        warning: 60,
        critical: 65
      }
    };

    const invalidResult = thresholdsUpdateSchema.safeParse(invalidData);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error.issues[0].message).toContain('Attendance warning threshold must be greater than critical threshold');
  });
});
