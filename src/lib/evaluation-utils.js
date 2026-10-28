/**
 * Pure, browser-safe assessment evaluation utilities for KUCET CMS.
 * ZERO server, database, filesystem, or network dependencies.
 * Safe for use in React 19 Client Components, Server Components, and API routes.
 */

/**
 * Authoritative Theory Assessment Patterns for KUCET CMS Continuous Internal Evaluation (CIE).
 * All theory patterns sum to a total maximum of 30 marks.
 * Mid contributions are computed as the Best of MID-1 and MID-2 (Math.max(mid1, mid2)).
 */
export const THEORY_ASSESSMENT_PATTERNS = Object.freeze({
  PATTERN_1: {
    id: 'MID_20_ASSIGNMENT_10',
    key: '20_10',
    number: 1,
    name: 'Pattern 1 — 20 + 10',
    shortName: '20 + 10',
    badge: 'Standard (20 + 10)',
    midMax: 20,
    assignmentMax: 10,
    totalMax: 30,
    hasAssignment: true,
    description: 'Mid components evaluate up to 20 marks (Best of MID-1 & MID-2). Assignment evaluates up to 10 marks. Total: 30 marks.',
    summary: 'Mids: 20 marks | Assignment: 10 marks'
  },
  PATTERN_2: {
    id: 'MID_25_ASSIGNMENT_5',
    key: '25_5',
    number: 2,
    name: 'Pattern 2 — 25 + 5',
    shortName: '25 + 5',
    badge: 'Extended Mids (25 + 5)',
    midMax: 25,
    assignmentMax: 5,
    totalMax: 30,
    hasAssignment: true,
    description: 'Mid components evaluate up to 25 marks (Best of MID-1 & MID-2). Assignment evaluates up to 5 marks. Total: 30 marks.',
    summary: 'Mids: 25 marks | Assignment: 5 marks'
  },
  PATTERN_3: {
    id: 'MID_30_ONLY',
    key: '30_0',
    number: 3,
    name: 'Pattern 3 — 30 for Mids',
    shortName: '30 for Mids',
    badge: 'Mids Only (30)',
    midMax: 30,
    assignmentMax: null, // Explicitly Not Applicable
    totalMax: 30,
    hasAssignment: false,
    description: 'Mid components evaluate up to 30 marks (Best of MID-1 & MID-2). Assignment is Not Applicable. Total: 30 marks.',
    summary: 'Mids: 30 marks | Assignment: Not applicable'
  }
});

/**
 * Resolves a theory assessment pattern from an ID, key, or midMax numeric value.
 *
 * @param {string|number|null|undefined} patternOrMidMax
 * @returns {typeof THEORY_ASSESSMENT_PATTERNS.PATTERN_1 | null}
 */
export function getTheoryPattern(patternOrMidMax) {
  if (patternOrMidMax === null || patternOrMidMax === undefined) return null;

  if (typeof patternOrMidMax === 'number') {
    if (patternOrMidMax === 20) return THEORY_ASSESSMENT_PATTERNS.PATTERN_1;
    if (patternOrMidMax === 25) return THEORY_ASSESSMENT_PATTERNS.PATTERN_2;
    if (patternOrMidMax === 30) return THEORY_ASSESSMENT_PATTERNS.PATTERN_3;
    return null;
  }

  const str = String(patternOrMidMax).trim().toUpperCase();
  if (str === 'MID_20_ASSIGNMENT_10' || str === '20_10' || str === '20' || str === 'PATTERN_1' || str === 'PATTERN 1') {
    return THEORY_ASSESSMENT_PATTERNS.PATTERN_1;
  }
  if (str === 'MID_25_ASSIGNMENT_5' || str === '25_5' || str === '25' || str === 'PATTERN_2' || str === 'PATTERN 2') {
    return THEORY_ASSESSMENT_PATTERNS.PATTERN_2;
  }
  if (str === 'MID_30_ONLY' || str === '30_0' || str === '30' || str === 'PATTERN_3' || str === 'PATTERN 3') {
    return THEORY_ASSESSMENT_PATTERNS.PATTERN_3;
  }

  return null;
}

/**
 * Validates a single student's theory marks against a chosen pattern.
 *
 * @param {string|number|Object} patternRef
 * @param {Object} marks
 * @param {number|null} [marks.mid1]
 * @param {number|null} [marks.mid2]
 * @param {number|null} [marks.assignment]
 * @returns {{ valid: boolean, error?: string, total: number | null }}
 */
export function validateTheoryMarks(patternRef, { mid1 = null, mid2 = null, assignment = null } = {}) {
  const pattern = patternRef && typeof patternRef === 'object' && patternRef.id
    ? patternRef
    : getTheoryPattern(patternRef);

  if (!pattern) {
    return { valid: false, error: 'Invalid or undefined assessment pattern', total: null };
  }

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const m1 = toNum(mid1);
  const m2 = toNum(mid2);
  const a = toNum(assignment);

  if (m1 !== null && (m1 < 0 || m1 > pattern.midMax)) {
    return { valid: false, error: `MID-1 marks (${m1}) exceed the maximum limit of ${pattern.midMax}`, total: null };
  }
  if (m2 !== null && (m2 < 0 || m2 > pattern.midMax)) {
    return { valid: false, error: `MID-2 marks (${m2}) exceed the maximum limit of ${pattern.midMax}`, total: null };
  }

  if (pattern.hasAssignment) {
    if (a !== null && (a < 0 || a > pattern.assignmentMax)) {
      return { valid: false, error: `Assignment marks (${a}) exceed the maximum limit of ${pattern.assignmentMax}`, total: null };
    }
  } else {
    // Pattern 3: Assignment is Not Applicable. Any numeric input (including 0) is rejected.
    if (a !== null) {
      return { valid: false, error: `Assignment marks are not applicable for ${pattern.name}`, total: null };
    }
  }

  const hasAny = m1 !== null || m2 !== null || (pattern.hasAssignment && a !== null);
  if (!hasAny) {
    return { valid: true, total: null };
  }

  const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
  const total = pattern.hasAssignment ? bestMid + (a ?? 0) : bestMid;
  const roundedTotal = Math.round(total * 100) / 100;

  if (roundedTotal > 30) {
    return { valid: false, error: `Overall CIE total marks (${roundedTotal}) exceed the maximum allowable limit of 30`, total: roundedTotal };
  }

  return { valid: true, total: roundedTotal };
}

/**
 * Checks whether existing draft marks are compatible with switching to a target pattern.
 *
 * @param {Array<Object>} existingMarks List of existing marks records
 * @param {string|number|Object} targetPatternRef Target pattern to evaluate
 * @returns {{ compatible: boolean, reason?: string, details: Object }}
 */
export function checkPatternSwitchCompatibility(existingMarks = [], targetPatternRef) {
  const targetPattern = targetPatternRef && typeof targetPatternRef === 'object' && targetPatternRef.id
    ? targetPatternRef
    : getTheoryPattern(targetPatternRef);

  if (!targetPattern) {
    return {
      compatible: false,
      reason: 'Invalid target assessment pattern specified',
      details: {}
    };
  }

  let maxMid1 = 0;
  let maxMid2 = 0;
  let maxAssignment = 0;
  let hasAnyMarks = false;
  let hasAssignmentMarks = false;
  let marksCount = 0;

  for (const m of existingMarks) {
    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const m1 = toNum(m.mid1_marks);
    const m2 = toNum(m.mid2_marks);
    const a = toNum(m.assignment_marks);

    if (m1 !== null || m2 !== null || a !== null) {
      hasAnyMarks = true;
      marksCount += 1;
    }

    if (m1 !== null && m1 > maxMid1) maxMid1 = m1;
    if (m2 !== null && m2 > maxMid2) maxMid2 = m2;
    if (a !== null && a > maxAssignment) maxAssignment = a;
    if (a !== null && a > 0) hasAssignmentMarks = true;
  }

  const details = {
    hasAnyMarks,
    hasAssignmentMarks,
    marksCount,
    maxMid1,
    maxMid2,
    maxAssignment,
    targetPattern: targetPattern.id,
    targetMidMax: targetPattern.midMax,
    targetAssignmentMax: targetPattern.assignmentMax
  };

  // If no marks exist, free to switch
  if (!hasAnyMarks) {
    return { compatible: true, details };
  }

  // 1. Check Mid-1
  if (maxMid1 > targetPattern.midMax) {
    return {
      compatible: false,
      reason: `Existing MID-1 marks (up to ${maxMid1}) exceed the maximum allowable limit of ${targetPattern.midMax} for ${targetPattern.name}. Please adjust existing marks before switching.`,
      details
    };
  }

  // 2. Check Mid-2
  if (maxMid2 > targetPattern.midMax) {
    return {
      compatible: false,
      reason: `Existing MID-2 marks (up to ${maxMid2}) exceed the maximum allowable limit of ${targetPattern.midMax} for ${targetPattern.name}. Please adjust existing marks before switching.`,
      details
    };
  }

  // 3. Check Assignment
  if (targetPattern.hasAssignment) {
    if (maxAssignment > targetPattern.assignmentMax) {
      return {
        compatible: false,
        reason: `Existing Assignment marks (up to ${maxAssignment}) exceed the maximum allowable limit of ${targetPattern.assignmentMax} for ${targetPattern.name}. Please adjust existing assignment marks before switching.`,
        details
      };
    }
  } else {
    // Pattern 3: Assignment is Not Applicable
    if (hasAssignmentMarks) {
      return {
        compatible: false,
        reason: `Existing Assignment marks (up to ${maxAssignment}) were entered. ${targetPattern.name} does not include an Assignment component. Please clear assignment marks before switching to Pattern 3.`,
        details
      };
    }
  }

  return { compatible: true, details };
}
