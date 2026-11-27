import { describe, it, expect } from 'vitest';
import { 
  evaluateMilestoneProgress, 
  validateMilestonesConfig, 
  DEFAULT_STREAK_EMOJI,
  DEFAULT_STREAK_MILESTONES 
} from '@/lib/streak-config';

describe('Milestone Evaluation & Config (evaluateMilestoneProgress)', () => {
  const sampleMilestones = [
    { id: 1, milestone_code: 'STREAK_5', title: '5 Classes In A Row', required_streak: 5, emoji_char: '⚡', emoji_code: 'lightning', is_active: true },
    { id: 2, milestone_code: 'STREAK_10', title: '10 Classes Strong', required_streak: 10, emoji_char: '🔥', emoji_code: 'fire_hot', is_active: true },
    { id: 3, milestone_code: 'STREAK_20', title: '20 Classes Champion', required_streak: 20, emoji_char: '🏆', emoji_code: 'trophy', is_active: true },
    { id: 4, milestone_code: 'STREAK_INACTIVE', title: 'Draft Tier', required_streak: 30, emoji_char: '👑', emoji_code: 'crown', is_active: false },
  ];

  it('1. Correctly calculates progress for a student below the first milestone', () => {
    const { nextMilestone, unlockedMilestones, milestoneProgress } = evaluateMilestoneProgress(3, sampleMilestones);

    expect(unlockedMilestones).toHaveLength(0);
    expect(nextMilestone).not.toBeNull();
    expect(nextMilestone.milestone_code).toBe('STREAK_5');
    expect(milestoneProgress).toEqual({
      current: 3,
      target: 5,
      remaining: 2,
      percentage: 60,
    });
  });

  it('2. Unlocks milestone at the exact required streak threshold', () => {
    const { nextMilestone, unlockedMilestones, milestoneProgress } = evaluateMilestoneProgress(5, sampleMilestones);

    expect(unlockedMilestones).toHaveLength(1);
    expect(unlockedMilestones[0].milestone_code).toBe('STREAK_5');
    expect(nextMilestone.milestone_code).toBe('STREAK_10');
    expect(milestoneProgress.current).toBe(5);
    expect(milestoneProgress.target).toBe(10);
    expect(milestoneProgress.remaining).toBe(5);
    expect(milestoneProgress.percentage).toBe(50);
  });

  it('3. Multiple unlocked milestones when streak exceeds higher tiers', () => {
    const { nextMilestone, unlockedMilestones, milestoneProgress } = evaluateMilestoneProgress(12, sampleMilestones);

    expect(unlockedMilestones).toHaveLength(2);
    expect(unlockedMilestones.map(m => m.milestone_code)).toEqual(['STREAK_5', 'STREAK_10']);
    expect(nextMilestone.milestone_code).toBe('STREAK_20');
    expect(milestoneProgress.remaining).toBe(8);
  });

  it('4. Ignores inactive milestones', () => {
    // Streak 25 unlocks all active milestones; inactive STREAK_30 is ignored
    const { nextMilestone, unlockedMilestones, milestoneProgress } = evaluateMilestoneProgress(25, sampleMilestones);

    expect(unlockedMilestones).toHaveLength(3);
    expect(nextMilestone).toBeNull();
    expect(milestoneProgress).toBeNull();
  });

  it('5. Handles empty milestone configuration gracefully', () => {
    const { nextMilestone, unlockedMilestones, milestoneProgress } = evaluateMilestoneProgress(15, DEFAULT_STREAK_MILESTONES);

    expect(unlockedMilestones).toEqual([]);
    expect(nextMilestone).toBeNull();
    expect(milestoneProgress).toBeNull();
  });

  it('6. Validates milestone configuration to reject duplicates or invalid required streaks', () => {
    const invalidConfig = [
      { milestone_code: 'T1', required_streak: 5, emoji_char: '🔥' },
      { milestone_code: 'T1', required_streak: 10, emoji_char: '⚡' }, // duplicate code
      { milestone_code: 'T3', required_streak: 5, emoji_char: '⭐' }, // duplicate streak
      { milestone_code: 'T4', required_streak: -2, emoji_char: '🎯' }, // negative streak
    ];

    const validation = validateMilestonesConfig(invalidConfig);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('7. Validates valid milestone configuration successfully', () => {
    const validConfig = [
      { milestone_code: 'T1', required_streak: 5, emoji_char: '🔥' },
      { milestone_code: 'T2', required_streak: 10, emoji_char: '⚡' },
    ];

    const validation = validateMilestonesConfig(validConfig);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('8. Default streak emoji provides standard baseline presentation', () => {
    expect(DEFAULT_STREAK_EMOJI.char).toBe('🔥');
    expect(DEFAULT_STREAK_EMOJI.code).toBe('fire');
  });
});
