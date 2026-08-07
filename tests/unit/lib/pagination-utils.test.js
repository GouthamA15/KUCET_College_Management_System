import { describe, it, expect } from 'vitest';
import { getPaginationParams } from '@/lib/api-utils';

describe('getPaginationParams', () => {
  it('parses valid page and limit from URLSearchParams', () => {
    const params = new URLSearchParams('page=2&limit=30');
    const result = getPaginationParams(params);
    expect(result).toEqual({ page: 2, limit: 30, offset: 30 });
  });

  it('parses valid page and limit from object', () => {
    const params = { page: 3, limit: 15 };
    const result = getPaginationParams(params);
    expect(result).toEqual({ page: 3, limit: 15, offset: 30 });
  });

  it('uses default values when parameters are missing or invalid', () => {
    const result = getPaginationParams(null);
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('enforces maximum limit cap', () => {
    const params = { page: 1, limit: 500 };
    const result = getPaginationParams(params, 20, 100);
    expect(result).toEqual({ page: 1, limit: 100, offset: 0 });
  });
});
