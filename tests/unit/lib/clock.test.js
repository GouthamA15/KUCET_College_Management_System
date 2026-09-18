import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock, getNow, getNowSync, isTimeMachineEnabled, toISTDate } from '@/lib/clock';

describe('Hardened Clock & Time Machine System Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    process.env.NEXT_PUBLIC_WORKING_ENV = 'testing';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // 1. Real Time Mode
  it('Scenario 1: Real time mode returns current IST wall-clock time when no mock is set', () => {
    const now = Clock.now();
    expect(now).toBeInstanceOf(Date);
    expect(isNaN(now.getTime())).toBe(false);

    // Should closely match real system time (+- 2 seconds)
    const realNow = Clock.getRealNow();
    expect(Math.abs(now.getTime() - realNow.getTime())).toBeLessThan(2000);
  });

  // 2. Past Time Travel
  it('Scenario 2: Past time travel returns the configured past moment', () => {
    const pastIso = '2023-08-15T10:00:00.000Z';
    const context = { headers: new Headers({ 'x-app-mock-date': pastIso }) };

    const perceived = Clock.now(context);
    expect(Clock.isTimeTraveling(context)).toBe(true);
    expect(perceived.getFullYear()).toBe(2023);
    expect(perceived.getMonth() + 1).toBe(8); // August
    expect(perceived.getDate()).toBe(15);
  });

  // 3. Future Time Travel
  it('Scenario 3: Future time travel returns the configured future moment', () => {
    const futureIso = '2029-11-20T14:30:00.000Z';
    const context = { headers: new Headers({ 'x-app-mock-date': futureIso }) };

    const perceived = Clock.now(context);
    expect(Clock.isTimeTraveling(context)).toBe(true);
    expect(perceived.getFullYear()).toBe(2029);
    expect(perceived.getMonth() + 1).toBe(11);
    expect(perceived.getDate()).toBe(20);
  });

  // 4. Present Time Travel with Offset
  it('Scenario 4: Present time with specific offset', () => {
    const nowMs = Date.now();
    const offsetMs = 3600000; // +1 hour
    const targetIso = new Date(nowMs + offsetMs).toISOString();

    const payload = JSON.stringify({ target: targetIso, setAt: nowMs, frozen: false });
    const context = { headers: new Headers({ 'x-app-mock-date': payload }) };

    const perceived = Clock.now(context);
    expect(perceived).toBeInstanceOf(Date);
    expect(Clock.isTimeTraveling(context)).toBe(true);
    expect(Clock.getOffset(context)).toBeGreaterThan(3500000);
    expect(Clock.getOffset(context)).toBeLessThan(3700000);
  });

  // 5. Reset to Real Time
  it('Scenario 5: Resetting clock (removing context/cookie) restores real system time', () => {
    const pastIso = '2022-01-01T00:00:00.000Z';
    const travelingContext = { headers: new Headers({ 'x-app-mock-date': pastIso }) };
    const realContext = { headers: new Headers() };

    expect(Clock.now(travelingContext).getFullYear()).toBe(2022);
    expect(Clock.now(realContext).getFullYear()).toBe(Clock.getRealNow().getFullYear());
    expect(Clock.isTimeTraveling(realContext)).toBe(false);
  });

  // 6. Smooth Advancing Mode
  it('Scenario 6: Smooth advancing mode advances simulated time 1:1 with real elapsed time', () => {
    const baseTarget = new Date('2026-03-10T09:30:00.000Z');
    const setAt = Date.now() - 5000; // 5 seconds ago in real time
    const payload = JSON.stringify({ target: baseTarget.toISOString(), setAt, frozen: false });
    const context = { headers: new Headers({ 'x-app-mock-date': payload }) };

    const perceived = Clock.now(context);
    const expectedBase = toISTDate(baseTarget);

    // Difference between perceived and expectedBase should be approximately 5 seconds
    const diff = perceived.getTime() - expectedBase.getTime();
    expect(diff).toBeGreaterThanOrEqual(4900);
    expect(diff).toBeLessThan(6000);
  });

  // 7. Frozen Moment Mode
  it('Scenario 7: Frozen moment mode returns the exact same timestamp regardless of elapsed time', () => {
    const baseTarget = new Date('2026-03-10T09:30:00.000Z');
    const payload = JSON.stringify({ target: baseTarget.toISOString(), frozen: true });
    const context = { headers: new Headers({ 'x-app-mock-date': payload }) };

    const t1 = Clock.now(context);
    const t2 = Clock.now(context);
    expect(t1.getTime()).toBe(t2.getTime());
  });

  // 8. Session/Request Isolation
  it('Scenario 8: Concurrent request isolation - User A and User B operate independently', () => {
    const reqA = { headers: new Headers({ 'x-app-mock-date': '2024-05-10T10:00:00.000Z' }) };
    const reqB = { headers: new Headers({ 'x-app-mock-date': '2028-09-15T15:00:00.000Z' }) };
    const reqC = { headers: new Headers() }; // Real time

    const timeA = Clock.now(reqA);
    const timeB = Clock.now(reqB);
    const timeC = Clock.now(reqC);

    expect(timeA.getFullYear()).toBe(2024);
    expect(timeB.getFullYear()).toBe(2028);
    expect(timeC.getFullYear()).toBe(Clock.getRealNow().getFullYear());
  });

  // 9. Zero Global Mutable State
  it('Scenario 9: Server clock has zero global mutable state; calling now() does not leak to subsequent calls', () => {
    const travelingContext = { headers: new Headers({ 'x-app-mock-date': '2025-01-01T00:00:00.000Z' }) };
    Clock.now(travelingContext);

    // Next call without context gets real time
    const cleanTime = Clock.now();
    expect(cleanTime.getFullYear()).toBe(Clock.getRealNow().getFullYear());
  });

  // 10. Rejection of Malformed / Invalid Input
  it('Scenario 10: Rejects malformed and non-date input safely, falling back to real time', () => {
    const badContexts = [
      { headers: new Headers({ 'x-app-mock-date': 'not-a-date' }) },
      { headers: new Headers({ 'x-app-mock-date': '{malformed:json' }) },
      { headers: new Headers({ 'x-app-mock-date': '' }) },
      { headers: new Headers({ 'x-app-mock-date': 'null' }) },
      { headers: new Headers({ 'cookie': 'dev_mock_date=xyz123' }) },
    ];

    for (const ctx of badContexts) {
      const result = Clock.now(ctx);
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(false);
      expect(Clock.isTimeTraveling(ctx)).toBe(false);
    }
  });

  // 11. Rejection of Out-of-Bounds Dates
  it('Scenario 11: Rejects out-of-bounds dates (< 1970 or > 2100)', () => {
    const tooOld = { headers: new Headers({ 'x-app-mock-date': '1950-01-01T00:00:00.000Z' }) };
    const tooFar = { headers: new Headers({ 'x-app-mock-date': '2150-01-01T00:00:00.000Z' }) };

    expect(Clock.isTimeTraveling(tooOld)).toBe(false);
    expect(Clock.isTimeTraveling(tooFar)).toBe(false);
    expect(Clock.now(tooOld).getFullYear()).toBe(Clock.getRealNow().getFullYear());
    expect(Clock.now(tooFar).getFullYear()).toBe(Clock.getRealNow().getFullYear());
  });

  // 12. Strict Production Lockdown
  it('Scenario 12: Production lockdown strictly ignores cookies/headers when ENABLE_TIME_MACHINE is not set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_WORKING_ENV;
    delete process.env.ENABLE_TIME_MACHINE;
    delete process.env.NEXT_PUBLIC_ENABLE_TIME_MACHINE;

    expect(isTimeMachineEnabled()).toBe(false);

    const context = { headers: new Headers({ 'x-app-mock-date': '2030-01-01T00:00:00.000Z' }) };
    expect(Clock.isTimeTraveling(context)).toBe(false);
    expect(Clock.now(context).getFullYear()).toBe(Clock.getRealNow().getFullYear());
  });

  // 13. Production Override Flag
  it('Scenario 13: Time machine is permitted in production when ENABLE_TIME_MACHINE === "true"', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_WORKING_ENV;
    process.env.ENABLE_TIME_MACHINE = 'true';

    expect(isTimeMachineEnabled()).toBe(true);

    const context = { headers: new Headers({ 'x-app-mock-date': '2030-01-01T00:00:00.000Z' }) };
    expect(Clock.isTimeTraveling(context)).toBe(true);
    expect(Clock.now(context).getFullYear()).toBe(2030);
  });

  // 14. Clock.today() Strict IST Calendar Format
  it('Scenario 14: Clock.today() returns strictly YYYY-MM-DD in IST without UTC boundary shift', () => {
    // 01:30 AM IST on March 10, 2026 is 08:00 PM UTC on March 9, 2026
    const utcDate = new Date('2026-03-09T20:00:00.000Z');
    const context = { headers: new Headers({ 'x-app-mock-date': utcDate.toISOString() }) };

    const todayStr = Clock.today(context);
    expect(todayStr).toBe('2026-03-10');
  });

  // 15. Clock.todayFormatted() Strict UI Format (DD-MM-YYYY)
  it('Scenario 15: Clock.todayFormatted() returns strictly DD-MM-YYYY in IST', () => {
    const utcDate = new Date('2026-03-09T20:00:00.000Z');
    const context = { headers: new Headers({ 'x-app-mock-date': utcDate.toISOString() }) };

    const formatted = Clock.todayFormatted(context);
    expect(formatted).toBe('10-03-2026');
  });

  // 16. Clock.getISTParts()
  it('Scenario 16: Clock.getISTParts() correctly extracts calendar & time components in IST', () => {
    const dateInput = new Date('2026-03-10T04:00:00.000Z'); // 09:30 AM IST (Tuesday)
    const parts = Clock.getISTParts(dateInput);

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(3);
    expect(parts.day).toBe(10);
    expect(parts.hours).toBe(9);
    expect(parts.minutes).toBe(30);
    expect(parts.dayName).toBe('TUE');
    expect(parts.timeNumber).toBe(930);
  });

  // 17. Clock.currentPeriod()
  it('Scenario 17: Clock.currentPeriod() accurately maps college lecture periods 1 through 7 and breaks', () => {
    // Tuesday March 10, 2026
    // Period 1: 09:30 - 10:20 (04:00 - 04:50 UTC)
    expect(Clock.currentPeriod(new Date('2026-03-10T04:00:00.000Z'))).toBe(1);
    expect(Clock.currentPeriod(new Date('2026-03-10T04:15:00.000Z'))).toBe(1);

    // Period 2: 10:20 - 11:10 (04:50 - 05:40 UTC)
    expect(Clock.currentPeriod(new Date('2026-03-10T04:55:00.000Z'))).toBe(2);

    // Tea Break: 11:10 - 11:20 (05:40 - 05:50 UTC) -> null
    expect(Clock.currentPeriod(new Date('2026-03-10T05:45:00.000Z'))).toBeNull();

    // Period 3: 11:20 - 12:10 (05:50 - 06:40 UTC)
    expect(Clock.currentPeriod(new Date('2026-03-10T06:00:00.000Z'))).toBe(3);

    // Period 4: 12:10 - 13:00 (06:40 - 07:30 UTC)
    expect(Clock.currentPeriod(new Date('2026-03-10T07:00:00.000Z'))).toBe(4);

    // Lunch: 13:00 - 14:00 (07:30 - 08:30 UTC) -> null
    expect(Clock.currentPeriod(new Date('2026-03-10T08:00:00.000Z'))).toBeNull();

    // Period 5: 14:00 - 14:50 (08:30 - 09:20 UTC)
    expect(Clock.currentPeriod(new Date('2026-03-10T08:45:00.000Z'))).toBe(5);

    // Period 6: 14:50 - 15:40 (09:20 - 10:10 UTC)
    expect(Clock.currentPeriod(new Date('2026-03-10T09:30:00.000Z'))).toBe(6);

    // Period 7: 15:40 - 16:30 (10:10 - 11:00 UTC)
    expect(Clock.currentPeriod(new Date('2026-03-10T10:30:00.000Z'))).toBe(7);

    // After hours: 17:00 -> null
    expect(Clock.currentPeriod(new Date('2026-03-10T11:30:00.000Z'))).toBeNull();

    // Sunday (March 8, 2026 at 10:00 AM IST) -> null
    expect(Clock.currentPeriod(new Date('2026-03-08T04:30:00.000Z'))).toBeNull();
  });

  // 18. Comparison Helpers (isBefore, isAfter, isBetween)
  it('Scenario 18: Comparison helpers function correctly with various formats', () => {
    expect(Clock.isBefore('2026-01-01', '2026-01-02')).toBe(true);
    expect(Clock.isAfter('2026-01-02', '2026-01-01')).toBe(true);
    expect(Clock.isBetween('2026-01-05', '2026-01-01', '2026-01-10')).toBe(true);
    expect(Clock.isBetween('2026-01-15', '2026-01-01', '2026-01-10')).toBe(false);
  });

  // 19. Authoritative Real System Time Invariant
  it('Scenario 19: getRealNow() and getRealTimestamp() always return real time, unaffected by active time travel', () => {
    const mockContext = { headers: new Headers({ 'x-app-mock-date': '2030-01-01T00:00:00.000Z' }) };
    Clock.now(mockContext); // Traveling to 2030

    const realNow = Clock.getRealNow();
    const realTimestamp = Clock.getRealTimestamp();

    expect(realNow.getFullYear()).toBe(new Date().getFullYear());
    expect(Math.abs(realTimestamp - Date.now())).toBeLessThan(50);
  });

  // 20. Backward Compatibility Exports
  it('Scenario 20: getNow() and getNowSync() remain backward compatible with Clock.now()', () => {
    const context = { headers: new Headers({ 'x-app-mock-date': '2027-07-07T07:00:00.000Z' }) };

    const fromClock = Clock.now(context);
    const fromGetNow = getNow(context);
    const fromGetNowSync = getNowSync(context);

    expect(fromGetNow.getTime()).toBe(fromClock.getTime());
    expect(fromGetNowSync.getTime()).toBe(fromClock.getTime());
    expect(fromGetNow.getFullYear()).toBe(2027);
  });

  // 21. Midnight Hour Cycle Invariant (Never Hour 24 or Day Overflow)
  it('Scenario 21: toISTDate never produces hour 24 or accidental day overflow during midnight window', () => {
    // 18:30:00 UTC on Sep 18 is 00:00:00 IST on Sep 19
    const midnightUtc = new Date('2026-09-18T18:30:00.000Z');
    const istMidnight = toISTDate(midnightUtc);

    expect(istMidnight.getHours()).toBe(0);
    expect(istMidnight.getDate()).toBe(19);
    expect(istMidnight.getMonth() + 1).toBe(9);
    expect(istMidnight.getFullYear()).toBe(2026);

    // 19:20:00 UTC on Sep 18 is 00:50:00 IST on Sep 19
    const midnight50Utc = new Date('2026-09-18T19:20:00.000Z');
    const istMidnight50 = toISTDate(midnight50Utc);

    expect(istMidnight50.getHours()).toBe(0);
    expect(istMidnight50.getMinutes()).toBe(50);
    expect(istMidnight50.getDate()).toBe(19);
  });

  // 22. Exact Offset Consistency Across Day Boundary
  it('Scenario 22: getOffset accurately calculates positive and negative offsets across midnight transitions', () => {
    // Test across all 24 hours of a day
    for (let h = 0; h < 24; h++) {
      const baseUtc = new Date(Date.UTC(2026, 8, 18, h, 30, 0));
      const plus1h = new Date(baseUtc.getTime() + 3600000);
      const minus1h = new Date(baseUtc.getTime() - 3600000);

      const istBase = toISTDate(baseUtc);
      const istPlus = toISTDate(plus1h);
      const istMinus = toISTDate(minus1h);

      expect(istPlus.getTime() - istBase.getTime()).toBe(3600000);
      expect(istMinus.getTime() - istBase.getTime()).toBe(-3600000);
    }
  });

  // 23. Signed Offsets (+1h, -1h, +24h, -24h)
  it('Scenario 23: Accurate signed offsets for +1h, -1h, +24h, and -24h', () => {
    const mockContext = (offset) => ({
      headers: new Headers({
        'x-app-mock-date': JSON.stringify({
          target: new Date(Date.now() + offset).toISOString(),
          setAt: Date.now(),
          frozen: false,
        }),
      }),
    });

    const offsetsToTest = [
      { ms: 3600000, label: '+1 hour' },
      { ms: -3600000, label: '-1 hour' },
      { ms: 86400000, label: '+24 hours' },
      { ms: -86400000, label: '-24 hours' },
    ];

    for (const { ms } of offsetsToTest) {
      const ctx = mockContext(ms);
      const calculatedOffset = Clock.getOffset(ctx);
      expect(Math.abs(calculatedOffset - ms)).toBeLessThan(100);
    }
  });

  // 24. Multiple Concurrent Contexts Without Bleed
  it('Scenario 24: Multiple concurrent contexts operate completely isolated from each other', () => {
    const ctxA = { headers: new Headers({ 'x-app-mock-date': '2025-01-01T00:00:00.000Z' }) };
    const ctxB = { headers: new Headers({ 'x-app-mock-date': '2027-06-01T00:00:00.000Z' }) };
    const ctxC = { headers: new Headers() };

    expect(Clock.now(ctxA).getFullYear()).toBe(2025);
    expect(Clock.now(ctxB).getFullYear()).toBe(2027);
    expect(Clock.now(ctxC).getFullYear()).toBe(Clock.getRealNow().getFullYear());
  });
});
