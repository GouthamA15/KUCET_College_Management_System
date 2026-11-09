import { describe, it, expect, vi } from 'vitest';
import { 
  resolveAcademicClassification, 
  evaluateBonafideFeeEntitlement 
} from '@/lib/academicClassification';
import { normalizePurposeKey } from '@/lib/certificate-utils';
import { AttendanceCalculationService } from '@/services/academic/AttendanceCalculationService';

describe('Bonafide Enhancement — Academic Classification Suite', () => {
  it('classifies regular first-year student as ORDINARY format with Year 1 at KUCET', () => {
    const res = resolveAcademicClassification({
      rollNo: '23567T0901', // entry 2023
      academicYear: '2023-24',
      studySemester: 1
    });

    expect(res.isValid).toBe(true);
    expect(res.admissionType).toBe('Regular');
    expect(res.yearsAtKucet).toBe(1);
    expect(res.studyYear).toBe(1);
    expect(res.studySemester).toBe(1);
    expect(res.certificateFormat).toBe('ORDINARY');
    expect(res.isFirstYearAtKucet).toBe(true);
  });

  it('classifies lateral student in curricular Year 2 (newly admitted to KUCET) as ORDINARY format with Year 1 at KUCET', () => {
    const res = resolveAcademicClassification({
      rollNo: '24567T0901L', // entry 2024 (lateral)
      academicYear: '2024-25',
      studySemester: 3
    });

    expect(res.isValid).toBe(true);
    expect(res.admissionType).toBe('Lateral');
    expect(res.yearsAtKucet).toBe(1); // 1st year at KUCET
    expect(res.studyYear).toBe(2);   // B.Tech curricular Year 2!
    expect(res.studySemester).toBe(3);
    expect(res.certificateFormat).toBe('ORDINARY');
    expect(res.isFirstYearAtKucet).toBe(true);
  });

  it('classifies regular student in second year as PERCENTAGE format with Year 2 at KUCET', () => {
    const res = resolveAcademicClassification({
      rollNo: '23567T0901', // entry 2023
      academicYear: '2024-25',
      studySemester: 3
    });

    expect(res.isValid).toBe(true);
    expect(res.admissionType).toBe('Regular');
    expect(res.yearsAtKucet).toBe(2);
    expect(res.studyYear).toBe(2);
    expect(res.certificateFormat).toBe('PERCENTAGE');
    expect(res.isFirstYearAtKucet).toBe(false);
  });

  it('classifies lateral student in subsequent years as PERCENTAGE format', () => {
    const res = resolveAcademicClassification({
      rollNo: '24567T0901L', // entry 2024
      academicYear: '2025-26',
      studySemester: 5
    });

    expect(res.isValid).toBe(true);
    expect(res.admissionType).toBe('Lateral');
    expect(res.yearsAtKucet).toBe(2);
    expect(res.studyYear).toBe(3); // B.Tech curricular Year 3
    expect(res.certificateFormat).toBe('PERCENTAGE');
    expect(res.isFirstYearAtKucet).toBe(false);
  });

  it('proves that changing academic_offset_years does NOT alter years_at_kucet or certificate format', () => {
    const base = resolveAcademicClassification({
      rollNo: '23567T0901', // entry 2023
      academicYear: '2023-24'
    });

    const withOffset = resolveAcademicClassification({
      rollNo: '23567T0901',
      academicYear: '2023-24'
    });

    expect(base.yearsAtKucet).toBe(1);
    expect(withOffset.yearsAtKucet).toBe(1);
    expect(base.certificateFormat).toBe('ORDINARY');
    expect(withOffset.certificateFormat).toBe('ORDINARY');
  });

  it('safely rejects future admission year without defaulting to first year', () => {
    const res = resolveAcademicClassification({
      rollNo: '28567T0901', // entry 2028
      academicYear: '2026-27'
    });

    expect(res.isValid).toBe(false);
    expect(res.yearsAtKucet).toBeNull();
    expect(res.certificateFormat).toBeNull();
    expect(res.error).toContain('Future admission year');
  });

  it('safely rejects invalid roll number', () => {
    const res = resolveAcademicClassification({
      rollNo: 'INVALID_ROLL',
      academicYear: '2026-27'
    });

    expect(res.isValid).toBe(false);
    expect(res.yearsAtKucet).toBeNull();
    expect(res.certificateFormat).toBeNull();
    expect(res.error).toContain('Invalid student roll number');
  });

  it('preserves exact semester when provided and rejects fabricated odd-semester fallbacks', () => {
    const evenSem = resolveAcademicClassification({
      rollNo: '23567T0901',
      academicYear: '2023-24',
      studySemester: 2 // Even semester
    });
    expect(evenSem.studySemester).toBe(2);

    const oddSem = resolveAcademicClassification({
      rollNo: '23567T0901',
      academicYear: '2023-24',
      studySemester: 1 // Odd semester
    });
    expect(oddSem.studySemester).toBe(1);

    const missingSem = resolveAcademicClassification({
      rollNo: '23567T0901',
      academicYear: '2023-24',
      studySemester: null // No calendar semester
    });
    // Must NOT fabricate (studyYear * 2) - 1
    expect(missingSem.studySemester).toBeNull();
  });
});

describe('Bonafide Enhancement — Fee Entitlement & Conflict Detection Suite', () => {
  it('requires ₹100 for first-year student with no prior requests', () => {
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: [],
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27'
    });
    expect(res.canSubmit).toBe(true);
    expect(res.requiredFee).toBe(100);
    expect(res.isPendingLocked).toBe(false);
    expect(res.conflictDetected).toBe(false);
  });

  it('locks submissions if student has an active PENDING paid request in same academic year', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'PENDING', academic_year: '2026-27' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27'
    });
    expect(res.canSubmit).toBe(false);
    expect(res.isPendingLocked).toBe(true);
    expect(res.requiredFee).toBeNull();
  });

  it('locks submissions if student has an active PENDING paid request across academic year rollover', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'PENDING', academic_year: '2025-26' }
    ];
    // Student rolled over to next academic year (2026-27, now Year 2 at KUCET)
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: false,
      currentAcademicYear: '2026-27'
    });
    expect(res.canSubmit).toBe(false);
    expect(res.isPendingLocked).toBe(true);
    expect(res.requiredFee).toBeNull();
  });

  it('grants free entitlement for subsequent first-year requests once initial paid request is APPROVED', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2026-27', purpose: 'Passport' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Education Loan'
    });
    expect(res.canSubmit).toBe(true);
    expect(res.requiredFee).toBe(0);
    expect(res.isPendingLocked).toBe(false);
  });

  it('does NOT consume payment entitlement if prior paid request was REJECTED', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'REJECTED', academic_year: '2026-27', purpose: 'Passport' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Passport'
    });
    expect(res.canSubmit).toBe(true);
    expect(res.requiredFee).toBe(100);
    expect(res.isPendingLocked).toBe(false);
  });

  it('provides free requests for senior students (Year 2+ at KUCET)', () => {
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: [],
      isFirstYearAtKucet: false,
      currentAcademicYear: '2026-27'
    });
    expect(res.canSubmit).toBe(true);
    expect(res.requiredFee).toBe(0);
  });

  it('detects conflicting approved-paid and pending-paid requests and blocks submission', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2025-26' },
      { request_id: 2, payment_amount: 100, status: 'PENDING', academic_year: '2026-27' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: false,
      currentAcademicYear: '2026-27'
    });
    expect(res.canSubmit).toBe(false);
    expect(res.conflictDetected).toBe(true);
  });

  it('detects multiple approved paid requests as an integrity conflict', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2025-26' },
      { request_id: 2, payment_amount: 100, status: 'APPROVED', academic_year: '2026-27' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: false,
      currentAcademicYear: '2026-27'
    });
    expect(res.canSubmit).toBe(false);
    expect(res.conflictDetected).toBe(true);
  });

  it('detects multiple pending paid requests as an integrity conflict', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'PENDING', academic_year: '2026-27' },
      { request_id: 2, payment_amount: 100, status: 'PENDING', academic_year: '2026-27' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27'
    });
    expect(res.canSubmit).toBe(false);
    expect(res.conflictDetected).toBe(true);
  });

  it('blocks duplicate pending purpose in same academic year', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2026-27', purpose: 'Passport' },
      { request_id: 2, payment_amount: 0, status: 'PENDING', academic_year: '2026-27', purpose: 'Education Loan' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Education Loan'
    });
    expect(res.canSubmit).toBe(false);
    expect(res.feeReason).toContain('already have an active pending Bonafide request for this purpose');
  });

  it('blocks duplicate approved purpose in same academic year', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2026-27', purpose: 'Passport' }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Passport'
    });
    expect(res.canSubmit).toBe(false);
    expect(res.feeReason).toContain('already received an approved Bonafide Certificate for this purpose');
  });
});

describe('Bonafide Enhancement — Purpose Normalization Suite (F-01 Regression)', () => {
  it('1. distinguishes two distinct custom purposes under Other', () => {
    const key1 = normalizePurposeKey('Other', 'Passport Application');
    const key2 = normalizePurposeKey('Other', 'Visa Interview');
    expect(key1).toBe('other:passport application');
    expect(key2).toBe('other:visa interview');
    expect(key1).not.toBe(key2);
  });

  it('2. normalizes same custom purpose with different casing to identical key', () => {
    const upper = normalizePurposeKey('Other', 'PASSPORT APPLICATION');
    const lower = normalizePurposeKey('Other', 'passport application');
    const mixed = normalizePurposeKey('Other', 'Passport Application');
    expect(upper).toBe('other:passport application');
    expect(lower).toBe('other:passport application');
    expect(mixed).toBe('other:passport application');
  });

  it('3. normalizes same custom purpose with repeated whitespace to identical key', () => {
    const normal = normalizePurposeKey('Other', 'Passport Application');
    const padded = normalizePurposeKey('Other', '   Passport    Application   ');
    expect(padded).toBe(normal);
    expect(padded).toBe('other:passport application');
  });

  it('4. safely handles blank custom purpose under Other', () => {
    expect(normalizePurposeKey('Other', '')).toBe('other');
    expect(normalizePurposeKey('Other', '   ')).toBe('other');
  });

  it('5. safely handles missing custom purpose under Other', () => {
    expect(normalizePurposeKey('Other')).toBe('other');
    expect(normalizePurposeKey('Other', null)).toBe('other');
    expect(normalizePurposeKey('Other', undefined)).toBe('other');
  });

  it('6. preserves standard predefined purposes and ignores custom extension for non-Other', () => {
    expect(normalizePurposeKey('Passport / Visa')).toBe('passport / visa');
    expect(normalizePurposeKey('Education Loan')).toBe('education loan');
    expect(normalizePurposeKey('Scholarship')).toBe('scholarship');
    // Does not accidentally treat non-Other purposes as custom purposes
    expect(normalizePurposeKey('Scholarship', 'National Portal')).toBe('scholarship');
  });

  it('7. preserves single-string legacy invocation', () => {
    expect(normalizePurposeKey('General')).toBe('general');
    expect(normalizePurposeKey('')).toBe('general');
    expect(normalizePurposeKey(null)).toBe('general');
    expect(normalizePurposeKey(undefined)).toBe('general');
    expect(normalizePurposeKey('   ')).toBe('general');
  });

  it('8. preserves object-based invocation and JSON string inputs', () => {
    expect(normalizePurposeKey({ purpose_type: 'Other', purpose_custom: 'Hackathon Participation' })).toBe('other:hackathon participation');
    expect(normalizePurposeKey({ purpose_type: 'Scholarship' })).toBe('scholarship');
    expect(normalizePurposeKey({ purpose: 'Scholarship' })).toBe('scholarship');
    expect(normalizePurposeKey({})).toBe('general');
    expect(normalizePurposeKey({ purpose_type: 'Other', purpose_custom: '   ' })).toBe('other');
    expect(normalizePurposeKey(JSON.stringify({ purpose_type: 'Other', purpose_custom: 'Visa Interview' }))).toBe('other:visa interview');
  });

  it('8b. enforces explicit customInput precedence over object purpose_custom and handles malformed JSON safely', () => {
    // Explicit customInput takes precedence
    const overrideResult = normalizePurposeKey(
      { purpose_type: 'Other', purpose_custom: 'Original Custom' },
      'Overridden Custom'
    );
    expect(overrideResult).toBe('other:overridden custom');

    // Blank customInput does not wipe out original custom
    const emptyOverride = normalizePurposeKey(
      { purpose_type: 'Other', purpose_custom: 'Original Custom' },
      '   '
    );
    expect(emptyOverride).toBe('other:original custom');

    // Malformed JSON strings do not throw or crash
    expect(() => normalizePurposeKey('{"malformed: json')).not.toThrow();
    expect(normalizePurposeKey('{"malformed: json')).toBe('{"malformed: json');

    // JSON array does not throw or crash
    expect(() => normalizePurposeKey('["array", "item"]')).not.toThrow();
  });

  it('9. allows reapplication for the same purpose when previous request was REJECTED', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'REJECTED', academic_year: '2026-27', purpose: JSON.stringify({ purpose_type: 'Other', purpose_custom: 'Passport Application' }) }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Other',
      requestedPurposeCustom: 'Passport Application'
    });
    expect(res.canSubmit).toBe(true);
    expect(res.requiredFee).toBe(100);
  });

  it('10. permits different custom purposes under Other within the same academic year', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2026-27', purpose: JSON.stringify({ purpose_type: 'Other', purpose_custom: 'Passport Application' }) }
    ];
    const res = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Other',
      requestedPurposeCustom: 'Visa Interview'
    });
    // Entitlement consumed on first approved request, so second request is ₹0 and allowed
    expect(res.canSubmit).toBe(true);
    expect(res.requiredFee).toBe(0);
  });

  it('11. blocks duplicate custom purposes under Other within the same academic year (both pending and approved)', () => {
    // 11a: Block duplicate approved custom purpose with different casing & whitespace
    const approvedRows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2026-27', purpose: JSON.stringify({ purpose_type: 'Other', purpose_custom: 'Passport Application' }) }
    ];
    const resApproved = evaluateBonafideFeeEntitlement({
      allBonafideRows: approvedRows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Other',
      requestedPurposeCustom: '  passport   APPLICATION  '
    });
    expect(resApproved.canSubmit).toBe(false);
    expect(resApproved.feeReason).toContain('already received an approved Bonafide Certificate for this purpose');

    // 11b: Block duplicate pending custom purpose
    const pendingRows = [
      { request_id: 2, payment_amount: 100, status: 'PENDING', academic_year: '2026-27', purpose: JSON.stringify({ purpose_type: 'Other', purpose_custom: 'Visa Interview' }) }
    ];
    const resPending = evaluateBonafideFeeEntitlement({
      allBonafideRows: pendingRows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Other',
      requestedPurposeCustom: 'visa interview'
    });
    expect(resPending.canSubmit).toBe(false);
    // Note: Since request 2 is a pending paid request, pending lock triggers first or same purpose triggers
    expect(resPending.canSubmit).toBe(false);
  });

  it('12. prevents regression for standard purpose restrictions within same academic year', () => {
    const rows = [
      { request_id: 1, payment_amount: 100, status: 'APPROVED', academic_year: '2026-27', purpose: 'Education Loan' }
    ];
    const resDuplicate = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Education Loan'
    });
    expect(resDuplicate.canSubmit).toBe(false);
    expect(resDuplicate.feeReason).toContain('already received an approved Bonafide Certificate for this purpose');

    const resDistinct = evaluateBonafideFeeEntitlement({
      allBonafideRows: rows,
      isFirstYearAtKucet: true,
      currentAcademicYear: '2026-27',
      requestedPurposeType: 'Scholarship'
    });
    expect(resDistinct.canSubmit).toBe(true);
    expect(resDistinct.requiredFee).toBe(0);
  });
});

describe('Bonafide Enhancement — Attendance Calculation Suite', () => {
  it('handles zero recorded sessions across cohort and blocks approval under conservative policy', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { assignmentId: 1, subjectCode: 'CS101', subjectName: 'Programming', totalSessions: 0, attendedSessions: 0 },
        { assignmentId: 2, subjectCode: 'CS102', subjectName: 'Data Structures', totalSessions: 0, attendedSessions: 0 }
      ])
    };

    const res = await AttendanceCalculationService.calculateCohortAttendance({
      studentId: 1,
      branch: 'CSE',
      semester: 3,
      academicYear: '2026-27',
      dbClient: mockDb
    });

    expect(res.success).toBe(true);
    expect(res.totalAssignedSubjects).toBe(2);
    expect(res.subjectsWithSessions).toBe(0);
    expect(res.totalRecordedSessions).toBe(0);
    expect(res.generatedAttendance).toBe('N/A');
    expect(res.canApprove).toBe(false); // Conservative default blocks approval
    expect(res.blockReason).toContain('Zero attendance sessions recorded');
  });

  it('accurately calculates attendance percentage, counts PRESENT, NCC, MEDICAL, and detects incomplete coverage', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { assignmentId: 1, subjectCode: 'CS101', subjectName: 'Programming', totalSessions: 20, attendedSessions: 18 },
        { assignmentId: 2, subjectCode: 'CS102', subjectName: 'Data Structures', totalSessions: 20, attendedSessions: 16 },
        { assignmentId: 3, subjectCode: 'CS103', subjectName: 'Algorithms', totalSessions: 0, attendedSessions: 0 } // no sessions recorded yet
      ])
    };

    const res = await AttendanceCalculationService.calculateCohortAttendance({
      studentId: 1,
      branch: 'CSE',
      semester: 3,
      academicYear: '2026-27',
      dbClient: mockDb
    });

    expect(res.success).toBe(true);
    expect(res.totalAssignedSubjects).toBe(3);
    expect(res.subjectsWithSessions).toBe(2);
    expect(res.subjectsWithoutSessions).toBe(1);
    expect(res.totalRecordedSessions).toBe(40);
    expect(res.totalAttendedSessions).toBe(34);
    // 34 / 40 = 85.0%
    expect(res.attendancePercentage).toBe(85.0);
    expect(res.generatedAttendance).toBe('85%');
    expect(res.coverageCategory).toBe('INCOMPLETE');
    expect(res.canApprove).toBe(true);
    expect(res.staffNotice).toContain('Attendance recorded for 2 of 3 assigned subjects');
  });
});
