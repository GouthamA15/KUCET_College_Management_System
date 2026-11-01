import { describe, it, expect } from 'vitest';
import { HolidayCandidateService } from '@/lib/holidays/HolidayCandidateService';

describe('P2.1 & P2.2 — Holiday Candidate Discovery Engine', () => {
  const semesterScope = {
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    weekendDays: ['SUNDAY']
  };

  it('discovers national and Telangana state holiday candidates within semester dates', () => {
    const candidates = HolidayCandidateService.generateCandidates(semesterScope);

    expect(candidates.length).toBeGreaterThan(0);

    const dates = candidates.map(c => c.date);
    expect(dates).toContain('2026-08-15'); // Independence Day
    expect(dates).toContain('2026-10-02'); // Gandhi Jayanti

    // Dates outside the semester boundary must NOT be included
    expect(dates).not.toContain('2026-01-26'); // Republic Day in January
    expect(dates).not.toContain('2026-06-02'); // Telangana Formation Day in June

    const indDay = candidates.find(c => c.date === '2026-08-15');
    expect(indDay.occasion_name).toBe('Independence Day');
    expect(indDay.category).toBe('NATIONAL_PUBLIC_HOLIDAY');
  });

  it('detects Kakatiya University institutional foundation day (August 19)', () => {
    const candidates = HolidayCandidateService.generateCandidates(semesterScope);
    const kuDay = candidates.find(c => c.date === '2026-08-19');

    expect(kuDay).toBeDefined();
    expect(kuDay.occasion_name).toBe('Kakatiya University Foundation Day');
    expect(kuDay.category).toBe('INSTITUTION_SPECIFIC');
    expect(kuDay.source).toContain('Kakatiya University');
  });

  it('identifies candidates that fall on configured weekend days', () => {
    // 2026-08-02 is Sunday, 2026-11-08 (Diwali 2026) is Sunday
    const candidates = HolidayCandidateService.generateCandidates({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      weekendDays: ['SUNDAY']
    });

    const diwali = candidates.find(c => c.date === '2026-11-08');
    expect(diwali).toBeDefined();
    expect(diwali.day_of_week).toBe('Sunday');
    expect(diwali.is_weekend).toBe(true);
    expect(diwali.weekend_note).toMatch(/Configured Weekend/);
  });

  it('detects conflicts with existing calendar records', () => {
    const existingEntries = [
      {
        date: '2026-08-15',
        day_type: 'HOLIDAY',
        holiday_name: 'Independence Day'
      },
      {
        date: '2026-10-02',
        day_type: 'EXAM', // Collision!
        holiday_name: null
      },
      {
        date: '2026-10-20',
        day_type: 'HOLIDAY',
        holiday_name: 'Dussehra Vacation'
      }
    ];

    const candidates = HolidayCandidateService.generateCandidates({
      ...semesterScope,
      existingCalendarEntries: existingEntries
    });

    // 1. Independence Day: Already approved with same name
    const indDay = candidates.find(c => c.date === '2026-08-15');
    expect(indDay.conflict_type).toBe('ALREADY_APPROVED');
    expect(indDay.is_already_approved).toBe(true);
    expect(indDay.selected).toBe(false);

    // 2. Gandhi Jayanti: Collides with EXAM
    const gandhiJayanti = candidates.find(c => c.date === '2026-10-02');
    expect(gandhiJayanti.conflict_type).toBe('EXAM_EVENT_COLLISION');
    expect(gandhiJayanti.is_exam_collision).toBe(true);
    expect(gandhiJayanti.selected).toBe(false);
    expect(gandhiJayanti.conflict_warning).toMatch(/Currently designated as EXAM/);

    // 3. Vijaya Dashami: Existing holiday has different name
    const vijaya = candidates.find(c => c.date === '2026-10-20');
    expect(vijaya.conflict_type).toBe('DIFFERENT_HOLIDAY');
  });

  it('is strictly read-only and does not mutate input arrays', () => {
    const inputEntries = Object.freeze([
      Object.freeze({ date: '2026-08-15', day_type: 'WORKING' })
    ]);

    expect(() => {
      HolidayCandidateService.generateCandidates({
        ...semesterScope,
        existingCalendarEntries: inputEntries
      });
    }).not.toThrow();
  });
});
