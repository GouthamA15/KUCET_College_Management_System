import { describe, it, expect, vi } from 'vitest';
import { cacheAside, invalidateKey, invalidateTag, CACHE_KEYS } from '@/lib/cache';

describe('Redis Cache Layer (Cache-Aside & Tag Invalidation)', () => {
  it('should cache data using cacheAside and return cached result on second call', async () => {
    const fetcher = vi.fn().mockResolvedValue({ collegeName: 'KUCET Campus' });
    const key = CACHE_KEYS.COLLEGE_CONFIG;

    const res1 = await cacheAside(key, fetcher, { ttl: 60, tags: ['config'] });
    expect(res1).toEqual({ collegeName: 'KUCET Campus' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const res2 = await cacheAside(key, fetcher, { ttl: 60, tags: ['config'] });
    expect(res2).toEqual({ collegeName: 'KUCET Campus' });
    expect(fetcher).toHaveBeenCalledTimes(1); // Cached, no second fetch
  });

  it('should re-fetch data after key invalidation', async () => {
    const fetcher = vi.fn().mockResolvedValue({ timetable: 'S1-CSE' });
    const key = CACHE_KEYS.TIMETABLE('CSE', 'S1');

    await cacheAside(key, fetcher, { ttl: 60 });
    await invalidateKey(key);

    await cacheAside(key, fetcher, { ttl: 60 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should invalidate keys by tag', async () => {
    const fetcher = vi.fn().mockResolvedValue({ calendar: '2026-2027' });
    const key = CACHE_KEYS.ACADEMIC_CALENDAR;

    await cacheAside(key, fetcher, { ttl: 60, tags: ['academic'] });
    await invalidateTag('academic');

    await cacheAside(key, fetcher, { ttl: 60, tags: ['academic'] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
