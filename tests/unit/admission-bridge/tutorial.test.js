import { describe, it, expect } from 'vitest';
import {
  TUTORIAL_STEPS,
  TOTAL_TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_DEMO_STUDENT,
  createTutorialState,
  tutorialNext,
  tutorialBack,
  tutorialGoTo,
  tutorialFinish,
  getTutorialProgressPercent,
} from '@/lib/admission-bridge/tutorial';

describe('KUCET Admission Bridge — Interactive Tutorial Engine', () => {
  it('should define exactly 8 authoritative tutorial steps', () => {
    expect(TOTAL_TUTORIAL_STEPS).toBe(8);
    expect(TUTORIAL_STEPS).toHaveLength(8);

    TUTORIAL_STEPS.forEach((step, idx) => {
      expect(step.step).toBe(idx + 1);
      expect(typeof step.id).toBe('string');
      expect(typeof step.badge).toBe('string');
      expect(typeof step.title).toBe('string');
      expect(typeof step.description).toBe('string');
      expect(Array.isArray(step.keyPoints)).toBe(true);
      expect(step.keyPoints.length).toBeGreaterThanOrEqual(2);
      expect(typeof step.callout).toBe('string');
    });
  });

  it('should define the non-sensitive storage key', () => {
    expect(TUTORIAL_STORAGE_KEY).toBe('kucet_bridge_tutorial_completed');
  });

  describe('Fake Demo Student Data Isolation', () => {
    it('should provide synthetic mock student data without any real student PII', () => {
      expect(TUTORIAL_DEMO_STUDENT.rollNo).toBe('26567T0000');
      expect(TUTORIAL_DEMO_STUDENT.admissionNo).toBe('26-567-000');
      expect(TUTORIAL_DEMO_STUDENT.name).toContain('DEMO STUDENT');
      expect(TUTORIAL_DEMO_STUDENT.scheme).toBe('2013');
      expect(TUTORIAL_DEMO_STUDENT.primaryDetails.nationality).toBe('INDIAN');
      expect(TUTORIAL_DEMO_STUDENT.primaryDetails.portalIncome).toBe(100001);
    });

    it('should ensure fake mock media sizes strictly comply with conservative 190 KiB ceiling', () => {
      const MAX_PORTAL_IMAGE_BYTES = 194560; // 190 KiB
      expect(TUTORIAL_DEMO_STUDENT.photo.sizeBytes).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
      expect(TUTORIAL_DEMO_STUDENT.signature.sizeBytes).toBeLessThanOrEqual(MAX_PORTAL_IMAGE_BYTES);
      expect(TUTORIAL_DEMO_STUDENT.photo.isSimulated).toBe(true);
      expect(TUTORIAL_DEMO_STUDENT.signature.isSimulated).toBe(true);
    });
  });

  describe('Tutorial State Machine', () => {
    it('should initialize at Step 1 by default', () => {
      const state = createTutorialState();
      expect(state.currentStep).toBe(1);
      expect(state.totalSteps).toBe(8);
      expect(state.isCompleted).toBe(false);
      expect(state.stepData.id).toBe('welcome');
      expect(getTutorialProgressPercent(state.currentStep)).toBe(13); // Math.round(1/8*100) = 13%
    });

    it('should advance smoothly through steps with tutorialNext', () => {
      let state = createTutorialState(1);
      state = tutorialNext(state);
      expect(state.currentStep).toBe(2);
      expect(state.stepData.id).toBe('auth_safety');

      state = tutorialNext(state);
      expect(state.currentStep).toBe(3);
      expect(state.stepData.id).toBe('workspace');
    });

    it('should move backward with tutorialBack and clamp at Step 1', () => {
      let state = createTutorialState(3);
      state = tutorialBack(state);
      expect(state.currentStep).toBe(2);

      state = tutorialBack(state);
      expect(state.currentStep).toBe(1);

      // Clamp at 1
      state = tutorialBack(state);
      expect(state.currentStep).toBe(1);
    });

    it('should jump to target step with tutorialGoTo', () => {
      let state = createTutorialState(1);
      state = tutorialGoTo(state, 5);
      expect(state.currentStep).toBe(5);
      expect(state.stepData.id).toBe('admission_info');

      // Clamping bounds
      state = tutorialGoTo(state, 99);
      expect(state.currentStep).toBe(8);

      state = tutorialGoTo(state, -10);
      expect(state.currentStep).toBe(1);
    });

    it('should complete tutorial when advancing past final step or calling tutorialFinish', () => {
      let state = createTutorialState(8);
      expect(state.isCompleted).toBe(false);

      state = tutorialNext(state);
      expect(state.isCompleted).toBe(true);

      const finishedState = tutorialFinish(createTutorialState(4));
      expect(finishedState.isCompleted).toBe(true);
    });

    it('should calculate accurate progress percentages', () => {
      expect(getTutorialProgressPercent(1)).toBe(13);
      expect(getTutorialProgressPercent(2)).toBe(25);
      expect(getTutorialProgressPercent(4)).toBe(50);
      expect(getTutorialProgressPercent(6)).toBe(75);
      expect(getTutorialProgressPercent(8)).toBe(100);
    });
  });
});
