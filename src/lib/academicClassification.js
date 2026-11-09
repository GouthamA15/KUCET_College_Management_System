import { validateRollNo } from '@/lib/rollNumber';
import { normalizePurposeKey } from './certificate-utils';

/**
 * Resolves academic classification, institutional years at KUCET,
 * curricular study year, and certificate format for a student.
 *
 * Invariants:
 * 1. Pure and stateless.
 * 2. years_at_kucet is calculated EXCLUSIVELY from:
 *    - student admission year at KUCET
 *    - current academic year starting year
 * 3. academic_offset_years is completely excluded from years_at_kucet and certificateFormat.
 * 4. Invalid, unsupported, or future admission years safely return isValid: false.
 * 5. No fabricated semester fallback: semester must be explicitly provided or resolved from calendar.
 *
 * @param {Object} params
 * @param {string} params.rollNo - Student roll number
 * @param {string} params.academicYear - Academic year string (e.g. "2026-27")
 * @param {number|null} [params.studySemester=null] - Authoritative resolved semester (1-8)
 * @returns {Object} Resolved academic classification
 */
export function resolveAcademicClassification({ rollNo, academicYear, studySemester = null }) {
  const rollValidation = validateRollNo(rollNo);
  if (!rollValidation.isValid) {
    return {
      isValid: false,
      error: 'Invalid student roll number',
      admissionType: null,
      yearsAtKucet: null,
      studyYear: null,
      studySemester: null,
      certificateFormat: null,
      isFirstYearAtKucet: false,
      branch: null,
      entryYear: null
    };
  }

  const { admissionType, entryYear, branch } = rollValidation;
  const entryYearNum = parseInt(entryYear, 10);
  const currentStartYear = parseInt(String(academicYear).slice(0, 4), 10);

  if (Number.isNaN(currentStartYear) || Number.isNaN(entryYearNum)) {
    return {
      isValid: false,
      error: `Invalid academic year or entry year format: ${academicYear} / ${entryYear}`,
      admissionType,
      yearsAtKucet: null,
      studyYear: null,
      studySemester: null,
      certificateFormat: null,
      isFirstYearAtKucet: false,
      branch,
      entryYear: null
    };
  }

  // Safety check: admission year cannot be in the future relative to current academic year
  if (entryYearNum > currentStartYear) {
    return {
      isValid: false,
      error: `Future admission year detected (${entryYearNum} > ${currentStartYear})`,
      admissionType,
      yearsAtKucet: null,
      studyYear: null,
      studySemester: null,
      certificateFormat: null,
      isFirstYearAtKucet: false,
      branch,
      entryYear: entryYearNum
    };
  }

  // Institutional years at KUCET: calendar academic years since institutional admission.
  // Calculated exclusively from currentStartYear and entryYearNum.
  // academic_offset_years is completely excluded.
  const yearsAtKucet = currentStartYear - entryYearNum + 1;
  const isFirstYearAtKucet = yearsAtKucet === 1;

  // Format Selection Rule:
  // First year at KUCET (Regular Year 1 or Lateral Year 2) -> ORDINARY
  // Second year onward at KUCET -> PERCENTAGE
  const certificateFormat = isFirstYearAtKucet ? 'ORDINARY' : 'PERCENTAGE';

  // Curricular B.Tech Study Year:
  // Regular entry starts at B.Tech Year 1.
  // Lateral entry enters into B.Tech Year 2.
  const baseCurricularYear = admissionType === 'Lateral'
    ? yearsAtKucet + 1
    : yearsAtKucet;

  const studyYear = Math.max(1, Math.min(4, baseCurricularYear));

  // Authoritative study semester: must be an integer between 1 and 8 if provided
  let validSemester = null;
  if (studySemester !== null && studySemester !== undefined) {
    const semNum = Number(studySemester);
    if (!Number.isNaN(semNum) && semNum >= 1 && semNum <= 8) {
      validSemester = semNum;
    }
  }

  return {
    isValid: true,
    error: null,
    admissionType, // 'Regular' | 'Lateral'
    yearsAtKucet,
    studyYear,
    studySemester: validSemester,
    certificateFormat, // 'ORDINARY' | 'PERCENTAGE'
    isFirstYearAtKucet,
    branch,
    entryYear: entryYearNum
  };
}

/**
 * Pure in-memory fee evaluator for Bonafide Certificate requests.
 * Evaluates lifetime Bonafide requests to determine fee requirement, pending locks,
 * payment state conflicts, and duplicate purpose restrictions.
 *
 * Order of evaluation:
 * 1. Retrieve complete relevant Bonafide payment history across all academic years.
 * 2. Ignore rejected requests for entitlement and active-payment-lock calculations.
 * 3. Detect inconsistent payment states (approved + pending; multiple approved; multiple pending).
 * 4. If a paid request is pending, block all new submissions.
 * 5. Evaluate fee entitlement (Option B: ₹100 once in Year 1; free after approval; free Year 2+).
 * 6. Independently enforce current-academic-year purpose restrictions.
 *
 * @param {Object} params
 * @param {Array<Object>} params.allBonafideRows - Lifetime Bonafide requests for this student
 * @param {boolean} params.isFirstYearAtKucet - Evaluated academic standing (yearsAtKucet === 1)
 * @param {string} [params.currentAcademicYear] - Current academic year string (e.g. "2026-27")
 * @param {string} [params.requestedPurposeType] - Requested purpose category
 * @param {string} [params.requestedPurposeCustom] - Custom purpose description
 * @returns {Object} Evaluation outcome
 */
export function evaluateBonafideFeeEntitlement({
  allBonafideRows = [],
  isFirstYearAtKucet = false,
  currentAcademicYear = null,
  requestedPurposeType = null,
  requestedPurposeCustom = null
}) {
  // 1 & 2. Filter lifetime records, ignoring REJECTED requests for entitlement and payment locks
  const activePaidRows = allBonafideRows.filter(
    (r) => Number(r.payment_amount) > 0 && r.status !== 'REJECTED'
  );

  const paidApprovedRows = activePaidRows.filter((r) => r.status === 'APPROVED');
  const paidPendingRows = activePaidRows.filter((r) => r.status === 'PENDING');

  // 3. Detect Inconsistent Payment States (Fail Closed):
  // - Approved paid request coexisting with a pending paid request
  // - Multiple approved paid requests (only 1 initial payment entitlement should exist)
  // - Multiple pending paid requests
  if (paidApprovedRows.length > 0 && paidPendingRows.length > 0) {
    return {
      canSubmit: false,
      isPendingLocked: true,
      conflictDetected: true,
      requiredFee: null,
      feeReason: 'Payment state conflict detected: An approved paid request and a pending paid request both exist. Please contact academic administration.'
    };
  }

  if (paidApprovedRows.length > 1) {
    return {
      canSubmit: false,
      isPendingLocked: false,
      conflictDetected: true,
      requiredFee: null,
      feeReason: 'Payment state conflict detected: Multiple approved paid requests exist in payment history. Please contact academic administration.'
    };
  }

  if (paidPendingRows.length > 1) {
    return {
      canSubmit: false,
      isPendingLocked: true,
      conflictDetected: true,
      requiredFee: null,
      feeReason: 'Payment state conflict detected: Multiple pending paid requests exist simultaneously. Please contact academic administration.'
    };
  }

  // 4. Pending Payment Lock:
  // An active pending paid request blocks ALL further submissions, regardless of:
  // - student's institutional year (even seniors!)
  // - requested purpose
  // - academic year rollover
  if (paidPendingRows.length > 0) {
    return {
      canSubmit: false,
      isPendingLocked: true,
      conflictDetected: false,
      requiredFee: null,
      feeReason: 'You have a pending Bonafide request undergoing payment verification. Additional requests cannot be submitted until it is resolved.'
    };
  }

  // 5. Evaluate Fee Entitlement:
  // Option B: ₹100 once during first year at KUCET; free after verified approval; free year 2+
  let requiredFee = 0;
  let feeReason = '';

  if (!isFirstYearAtKucet) {
    // Senior Year Free Entitlement (Year 2+ at KUCET)
    requiredFee = 0;
    feeReason = 'Free under Senior Year Bonafide Entitlement (Year 2+ at KUCET)';
  } else {
    // First Year at KUCET
    if (paidApprovedRows.length === 1) {
      // Consumed First-Year Entitlement
      requiredFee = 0;
      feeReason = 'Free under One-Time First-Year Payment Entitlement (Initial payment verified and approved)';
    } else {
      // Initial First-Year Paid Request Required
      requiredFee = 100;
      feeReason = 'First-Year Bonafide Processing Fee (₹100 payable once in Year 1 at KUCET)';
    }
  }

  // 6. Purpose Duplicate Checks (scoped to current academic year):
  // Rule: Max 1 approved request and 1 active pending request per normalized purpose per academic year.
  // Rejected requests for the same purpose can be re-applied.
  if (requestedPurposeType && currentAcademicYear) {
    const targetKey = normalizePurposeKey(requestedPurposeType, requestedPurposeCustom);
    
    const sameYearBonafides = allBonafideRows.filter(
      (r) => r.academic_year === currentAcademicYear && r.status !== 'REJECTED'
    );

    let hasSamePurposeApproved = false;
    let hasSamePurposePending = false;

    for (const req of sameYearBonafides) {
      let reqPurposeType = req.purpose;
      let reqPurposeCustom = null;

      if (req.purpose && typeof req.purpose === 'object') {
        reqPurposeType = req.purpose.purpose_type || req.purpose.purpose;
        reqPurposeCustom = req.purpose.purpose_custom;
      } else if (typeof req.purpose === 'string') {
        const trimmed = req.purpose.trim();
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            reqPurposeType = parsed.purpose_type;
            reqPurposeCustom = parsed.purpose_custom;
          } catch (_e) {
            reqPurposeType = req.purpose;
          }
        }
      }

      const existingKey = normalizePurposeKey(reqPurposeType, reqPurposeCustom);
      if (existingKey === targetKey) {
        if (req.status === 'APPROVED') {
          hasSamePurposeApproved = true;
        } else if (req.status === 'PENDING') {
          hasSamePurposePending = true;
        }
      }
    }

    if (hasSamePurposePending) {
      return {
        canSubmit: false,
        isPendingLocked: false,
        conflictDetected: false,
        requiredFee,
        feeReason: 'You already have an active pending Bonafide request for this purpose in the current academic year.'
      };
    }

    if (hasSamePurposeApproved) {
      return {
        canSubmit: false,
        isPendingLocked: false,
        conflictDetected: false,
        requiredFee,
        feeReason: 'You have already received an approved Bonafide Certificate for this purpose in the current academic year.'
      };
    }
  }

  return {
    canSubmit: true,
    isPendingLocked: false,
    conflictDetected: false,
    requiredFee,
    feeReason
  };
}
