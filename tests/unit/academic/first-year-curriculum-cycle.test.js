import { describe, it, expect } from 'vitest';

/**
 * Unit Test Suite: First-Year B.Tech Semester Curriculum Cycle & Invariants
 * 
 * Tests the canonical AICTE load-balanced cycle distribution:
 * - Group A (Chemistry Cycle in Sem 1, Physics Cycle in Sem 2): CIVIL, CSD, ECE, IT
 * - Group B (Physics Cycle in Sem 1, Chemistry Cycle in Sem 2): CSE, EEE, MECH
 * - Common Mathematics Progression:
 *     Semester 1: BSC103 (Mathematics-I) for ALL branches
 *     Semester 2: BSC104 (Mathematics-II) for ALL branches
 */

export const GROUP_A_BRANCHES = ['CIVIL', 'CSD', 'ECE', 'IT'];
export const GROUP_B_BRANCHES = ['CSE', 'EEE', 'MECH'];
export const ALL_INSTITUTIONAL_BRANCHES = ['CIVIL', 'CSD', 'CSE', 'ECE', 'EEE', 'IT', 'MECH'];

export const CHEMISTRY_CYCLE_SUBJECTS = [
  'BSC102',   // Chemistry
  'BSC102L',  // Chemistry Laboratory
  'ESC103',   // Programming for Problem Solving
  'ESC103L',  // Programming for Problem Solving Lab
  'HSMC101',  // English
  'HSMC101L', // English Language Lab
  'ESC104L',  // Workshop and Manufacturing Practices Lab
];

export const PHYSICS_CYCLE_SUBJECTS = [
  'BSC101',   // Physics
  'BSC101L',  // Physics-Practical
  'ESC101',   // Basic Electrical Engineering
  'ESC101L',  // Basic Electrical Engineering Lab
  'ESC102',   // Engineering Graphics & Design
  'ESC104',   // Engineering Mechanics
];

export function getExpectedFirstYearCurriculum(branch, semester) {
  const normBranch = branch.toUpperCase();
  const isGroupA = GROUP_A_BRANCHES.includes(normBranch);
  const isGroupB = GROUP_B_BRANCHES.includes(normBranch);

  if (!isGroupA && !isGroupB) {
    throw new Error(`Unknown institutional branch: ${branch}`);
  }

  if (semester === 1) {
    const coreCycle = isGroupA ? CHEMISTRY_CYCLE_SUBJECTS : PHYSICS_CYCLE_SUBJECTS;
    const subjects = ['BSC103', ...coreCycle];
    if (normBranch === 'CSD' && !isGroupA) {
      subjects.push('ESC102L');
    }
    return subjects.sort();
  }

  if (semester === 2) {
    const coreCycle = isGroupA ? PHYSICS_CYCLE_SUBJECTS : CHEMISTRY_CYCLE_SUBJECTS;
    const subjects = ['BSC104', ...coreCycle];
    if (normBranch === 'CSD' && isGroupA) {
      subjects.push('ESC102L');
    }
    return subjects.sort();
  }

  throw new Error(`Invalid first-year semester: ${semester}`);
}

describe('First-Year Curriculum Cycle & Dashboard Invariant Verification', () => {
  describe('Group A (CIVIL, CSD, ECE, IT) — Chemistry Cycle in Sem 1', () => {
    it.each(GROUP_A_BRANCHES)('%s should have Chemistry Cycle + Mathematics-I in Semester 1', (branch) => {
      const sem1 = getExpectedFirstYearCurriculum(branch, 1);
      
      expect(sem1).toContain('BSC103'); // Mathematics-I
      expect(sem1).not.toContain('BSC104'); // No Mathematics-II in Sem 1
      
      // Must contain Chemistry Cycle
      expect(sem1).toContain('BSC102'); // Chemistry
      expect(sem1).toContain('BSC102L'); // Chemistry Lab
      expect(sem1).toContain('ESC103'); // PPS
      expect(sem1).toContain('ESC103L'); // PPS Lab
      expect(sem1).toContain('HSMC101'); // English
      expect(sem1).toContain('HSMC101L'); // English Lab
      expect(sem1).toContain('ESC104L'); // Workshop

      // Must NOT contain Physics Cycle in Sem 1
      expect(sem1).not.toContain('BSC101'); // Physics
      expect(sem1).not.toContain('BSC101L'); // Physics Lab
      expect(sem1).not.toContain('ESC101'); // BEE
      expect(sem1).not.toContain('ESC101L'); // BEE Lab
      expect(sem1).not.toContain('ESC102'); // EG
      expect(sem1).not.toContain('ESC104'); // EM
    });

    it.each(GROUP_A_BRANCHES)('%s should have Physics Cycle + Mathematics-II in Semester 2', (branch) => {
      const sem2 = getExpectedFirstYearCurriculum(branch, 2);

      expect(sem2).toContain('BSC104'); // Mathematics-II
      expect(sem2).not.toContain('BSC103'); // No Mathematics-I in Sem 2

      // Must contain Physics Cycle
      expect(sem2).toContain('BSC101'); // Physics
      expect(sem2).toContain('BSC101L'); // Physics Lab
      expect(sem2).toContain('ESC101'); // BEE
      expect(sem2).toContain('ESC101L'); // BEE Lab
      expect(sem2).toContain('ESC102'); // EG
      expect(sem2).toContain('ESC104'); // EM

      // Must NOT contain Chemistry Cycle in Sem 2
      expect(sem2).not.toContain('BSC102'); // Chemistry
      expect(sem2).not.toContain('BSC102L'); // Chemistry Lab
      expect(sem2).not.toContain('ESC103'); // PPS
      expect(sem2).not.toContain('ESC103L'); // PPS Lab
      expect(sem2).not.toContain('HSMC101'); // English
      expect(sem2).not.toContain('HSMC101L'); // English Lab
      expect(sem2).not.toContain('ESC104L'); // Workshop
    });
  });

  describe('Group B (CSE, EEE, MECH) — Physics Cycle in Sem 1', () => {
    it.each(GROUP_B_BRANCHES)('%s should have Physics Cycle + Mathematics-I in Semester 1', (branch) => {
      const sem1 = getExpectedFirstYearCurriculum(branch, 1);

      expect(sem1).toContain('BSC103'); // Mathematics-I
      expect(sem1).not.toContain('BSC104'); // No Mathematics-II

      // Must contain Physics Cycle
      expect(sem1).toContain('BSC101'); // Physics
      expect(sem1).toContain('BSC101L'); // Physics Lab
      expect(sem1).toContain('ESC101'); // BEE
      expect(sem1).toContain('ESC101L'); // BEE Lab
      expect(sem1).toContain('ESC102'); // EG
      expect(sem1).toContain('ESC104'); // EM

      // Must NOT contain Chemistry Cycle in Sem 1
      expect(sem1).not.toContain('BSC102'); // Chemistry
      expect(sem1).not.toContain('ESC103'); // PPS
      expect(sem1).not.toContain('HSMC101'); // English
    });

    it.each(GROUP_B_BRANCHES)('%s should have Chemistry Cycle + Mathematics-II in Semester 2', (branch) => {
      const sem2 = getExpectedFirstYearCurriculum(branch, 2);

      expect(sem2).toContain('BSC104'); // Mathematics-II
      expect(sem2).not.toContain('BSC103'); // No Mathematics-I

      // Must contain Chemistry Cycle
      expect(sem2).toContain('BSC102'); // Chemistry
      expect(sem2).toContain('BSC102L'); // Chemistry Lab
      expect(sem2).toContain('ESC103'); // PPS
      expect(sem2).toContain('ESC103L'); // PPS Lab
      expect(sem2).toContain('HSMC101'); // English
      expect(sem2).toContain('HSMC101L'); // English Lab
      expect(sem2).toContain('ESC104L'); // Workshop

      // Must NOT contain Physics Cycle in Sem 2
      expect(sem2).not.toContain('BSC101'); // Physics
      expect(sem2).not.toContain('ESC101'); // BEE
      expect(sem2).not.toContain('ESC102'); // EG
      expect(sem2).not.toContain('ESC104'); // EM
    });
  });

  describe('Curricular Hygiene & Anti-Collision Guarantees', () => {
    it('guarantees no subject appears in both Semester 1 and Semester 2 for any branch', () => {
      for (const branch of ALL_INSTITUTIONAL_BRANCHES) {
        const sem1 = new Set(getExpectedFirstYearCurriculum(branch, 1));
        const sem2 = new Set(getExpectedFirstYearCurriculum(branch, 2));

        const intersection = [...sem1].filter(code => sem2.has(code));
        expect(intersection).toEqual([]);
      }
    });

    it('rejects unknown branches without fallback to default branch', () => {
      expect(() => getExpectedFirstYearCurriculum('AERO', 1)).toThrow(/Unknown institutional branch/);
      expect(() => getExpectedFirstYearCurriculum('BIO', 2)).toThrow(/Unknown institutional branch/);
    });

    it('rejects out-of-bounds semesters for first year', () => {
      expect(() => getExpectedFirstYearCurriculum('CSE', 3)).toThrow(/Invalid first-year semester/);
      expect(() => getExpectedFirstYearCurriculum('ECE', 0)).toThrow(/Invalid first-year semester/);
    });
  });
});
