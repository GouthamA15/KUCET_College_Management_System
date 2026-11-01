import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import archiver from 'archiver';
import logger from '@/lib/logger';
import { getAssetUrl } from '@/lib/assets';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentImages, 
  auditLogs 
} from '@/db/schema';
import { eq, and, ne, isNotNull, like, or, inArray, desc } from 'drizzle-orm';
import { 
  validateRollNo, 
  getBranchFromRoll, 
  getBatchFromRoll, 
  branchCodes 
} from '@/lib/rollNumber';
import { decrypt } from '@/lib/encryption';
import { getPermanentAddressFromDetails } from '@/lib/address-utils';
import { calculateStudentYearAndSemester, getCurrentCalendarSession } from '@/lib/academic-utils';

export const CANONICAL_BRANCHES = [
  { code: '09', name: 'CSE', fullName: 'Computer Science & Engineering' },
  { code: '30', name: 'CSD', fullName: 'Computer Science & Data Science' },
  { code: '15', name: 'ECE', fullName: 'Electronics & Communication Engineering' },
  { code: '12', name: 'EEE', fullName: 'Electrical & Electronics Engineering' },
  { code: '00', name: 'CIVIL', fullName: 'Civil Engineering' },
  { code: '18', name: 'IT', fullName: 'Information Technology' },
  { code: '03', name: 'MECH', fullName: 'Mechanical Engineering' },
];

/**
 * Resolves official student serial number printed on the ID card, if one exists.
 * Invariant: Never substitutes the internal database primary key (id).
 */
function resolveOfficialSerialNo(student) {
  if (!student) return '';
  const raw = student.slNo ?? student.sl_no ?? student.sNo ?? student.s_no ?? student.serialNo ?? student.serial_no ?? student.sno;
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }
  return str;
}

/**
 * Resolves official hall ticket / roll number.
 */
function resolveHallTicketNo(student) {
  if (!student) return '';
  const raw = student.rollNo ?? student.hallTicketNumber ?? student.roll ?? student.admissionNo;
  if (!raw) return '';
  const str = String(raw).trim().toUpperCase();
  if (str === 'N/A' || str === 'NULL' || str === 'UNDEFINED') return '';
  return str;
}

/**
 * Resolves student full name.
 */
function resolveStudentName(student) {
  if (!student) return '';
  const raw = student.studentName ?? student.fullName ?? student.name;
  if (!raw) return '';
  const str = String(raw).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  if (str === 'N/A' || str === 'NULL' || str === 'UNDEFINED') return '';
  return str;
}

/**
 * Resolves father's name.
 */
function resolveFatherName(student) {
  if (!student) return '';
  const raw = student.fatherName ?? student.father_name;
  if (!raw) return '';
  const str = String(raw).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  if (str === 'N/A' || str === 'NULL' || str === 'UNDEFINED') return '';
  return str;
}

/**
 * Resolves course in approved college format, e.g. B.TECH (IT) or B.TECH (CIVIL).
 */
function resolveCourse(student) {
  if (!student) return '';
  let raw = student.courseDisplay;
  if (!raw && student.branch) {
    raw = `B.TECH (${student.branch.toUpperCase().trim()})`;
  } else if (!raw && student.course) {
    const c = String(student.course).trim();
    raw = c.toUpperCase().startsWith('B.TECH') ? c : `B.TECH (${c})`;
  }
  if (!raw) return '';
  const str = String(raw).trim().toUpperCase();
  if (str === 'N/A' || str === 'NULL' || str === 'UNDEFINED') return '';
  return str;
}

/**
 * Formats address readably on one single line without line-breaks.
 */
function resolveAddress(student) {
  if (!student) return '';
  const raw = student.studentAddress ?? student.address ?? student.permanentAddress ?? student.permanent_address;
  if (!raw) return '';
  const str = String(raw)
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,+/g, ', ')
    .replace(/^[, ]+|[, ]+$/g, '')
    .trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }
  return str;
}

/**
 * Resolves registered mobile number with decryption if encrypted.
 */
function resolveMobileNo(student) {
  if (!student) return '';
  let raw = student.studentPhone ?? student.mobile ?? student.phone;
  if (!raw) return '';
  if (typeof raw === 'string' && raw.split(':').length === 3) {
    try {
      raw = decrypt(raw);
    } catch {
      // Fallback
    }
  }
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }
  return str;
}

/**
 * Resolves approved academic validity range, e.g. 2026-2030 or 2025-2028.
 */
function resolveValidUpto(student) {
  if (!student) return '';
  let raw = student.validUpto ?? student.valid_upto ?? student.batch ?? student.academicYear;
  if (!raw && student.rollNo) {
    try {
      raw = getBatchFromRoll(student.rollNo);
    } catch {
      raw = '';
    }
  }
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }
  return str;
}

/**
 * Resolves academic branch name.
 */
function resolveBranch(student) {
  if (!student) return '';
  const raw = student.branch ?? (student.rollNo ? getBranchFromRoll(student.rollNo) : '');
  if (!raw) return '';
  const str = String(raw).trim().toUpperCase();
  if (str === 'N/A' || str === 'NULL' || str === 'UNDEFINED') return '';
  return str;
}

/**
 * Resolves academic year.
 */
function resolveAcademicYear(student) {
  if (!student) return '';
  const raw = student.academicYear ?? student.batch ?? (student.rollNo ? getBatchFromRoll(student.rollNo) : '');
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';
  return str;
}

/**
 * Resolves admission year.
 */
function resolveAdmissionYear(student) {
  if (!student) return '';
  let raw = student.admissionYear;
  if (!raw && student.batch && String(student.batch).includes('-')) {
    raw = String(student.batch).split('-')[0].trim();
  }
  if (!raw && student.admissionDate) {
    try {
      raw = new Date(student.admissionDate).getFullYear().toString();
    } catch {
      raw = '';
    }
  }
  if (!raw && student.rollNo) {
    const valid = validateRollNo(student.rollNo);
    if (valid.isValid && valid.entryYear) {
      raw = valid.entryYear;
    }
  }
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';
  return str;
}

/**
 * Resolves institutional college name.
 */
function resolveCollegeName(student) {
  if (!student) return '';
  const raw = student.collegeName ?? 'KU COLLEGE OF ENGINEERING & TECHNOLOGY';
  const str = String(raw).trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';
  return str;
}

/**
 * Resolves institutional college address.
 */
function resolveCollegeAddress(student) {
  if (!student) return '';
  const raw = student.collegeAddress ?? 'Kakatiya University Campus, Vidyaranyapuri, Warangal 506 009';
  const str = String(raw)
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,+/g, ', ')
    .trim();
  if (str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';
  return str;
}

/**
 * Resolves student blood group.
 */
function resolveBloodGroup(student) {
  if (!student) return '';
  const raw = student.bloodGroup ?? student.blood_group;
  if (!raw) return '';
  const str = String(raw).trim().toUpperCase();
  if (str === 'N/A' || str === 'NULL' || str === 'UNDEFINED') return '';
  return str;
}

/**
 * Dedicated reusable plain-text QR payload builder for student ID cards.
 * Generates a human-readable labeled text format with one field per line.
 * Mandated order: First 8 primary fields followed by preserved institutional fields.
 */
export function buildStudentIDCardQRPayload(student) {
  if (!student) return null;

  const slNo = resolveOfficialSerialNo(student);
  const hallTicketNo = resolveHallTicketNo(student);
  const name = resolveStudentName(student);
  const fatherName = resolveFatherName(student);
  const course = resolveCourse(student);
  const address = resolveAddress(student);
  const mobile = resolveMobileNo(student);
  const validUpto = resolveValidUpto(student);
  const branch = resolveBranch(student);
  const academicYear = resolveAcademicYear(student);
  const admissionYear = resolveAdmissionYear(student);
  const collegeName = resolveCollegeName(student);
  const collegeAddress = resolveCollegeAddress(student);
  const bloodGroup = resolveBloodGroup(student);

  const lines = [
    `SL-NO : ${slNo}`,
    `HALL-TICKET-NO : ${hallTicketNo}`,
    `NAME : ${name}`,
    `FATHER-S-NAME : ${fatherName}`,
    `COURSE : ${course}`,
    `ADDRESS : ${address}`,
    `MOBILE-NO : ${mobile}`,
    `VALID-UPTO- : ${validUpto}`,
    `BRANCH : ${branch}`,
    `ACADEMIC-YEAR : ${academicYear}`,
    `ADMISSION-YEAR : ${admissionYear}`,
    `COLLEGE-NAME : ${collegeName}`,
    `COLLEGE-ADDRESS : ${collegeAddress}`,
    `BLOOD-GROUP : ${bloodGroup}`,
  ];

  if (student.roll && String(student.roll).trim().toUpperCase() !== hallTicketNo) {
    lines.push(`ROLL-NO : ${String(student.roll).trim().toUpperCase()}`);
  }

  return lines.join('\n');
}

export class IDCardDataService {
  /**
   * Helper: Resolves two-digit numeric branch code from canonical branch name
   */
  static getBranchCodeFromName(branchName) {
    if (!branchName) return null;
    const norm = String(branchName).trim().toUpperCase();
    const entry = Object.entries(branchCodes).find(([, name]) => name.toUpperCase() === norm);
    return entry ? entry[0] : null;
  }

  /**
   * Helper: Checks whether a student is currently in their First Year (Sem 1 / 2)
   * using the authoritative academic calendar session.
   */
  static async isStudentFirstYear(rollNo, currentSession = null) {
    if (!rollNo) return false;
    let session = currentSession;
    if (!session) {
      session = await getCurrentCalendarSession().catch(() => null);
    }
    if (session && session.academicYear && session.semester) {
      const calc = calculateStudentYearAndSemester(rollNo, session.academicYear, session.semester);
      return calc.yearOfStudy === 1;
    }
    // Fallback if calendar session not configured in DB
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentAcademicYear = now.getMonth() >= 6 ? `${currentYear}-${String(currentYear + 1).slice(-2)}` : `${currentYear - 1}-${String(currentYear).slice(-2)}`;
    const currentSemester = now.getMonth() >= 6 ? 1 : 2;
    const calc = calculateStudentYearAndSemester(rollNo, currentAcademicYear, currentSemester);
    return calc.yearOfStudy === 1;
  }

  /**
   * Maps raw database row into an authoritative student record for ID card operations.
   */
  static mapAuthoritativeStudent(row) {
    if (!row || !row.roll_no) return null;
    if (row.student_status && row.student_status !== 'ACTIVE') return null;
    if (row.academic_status && ['DROPPED', 'SUSPENDED', 'DISCONTINUED'].includes(row.academic_status)) return null;

    const validated = validateRollNo(row.roll_no);
    if (!validated.isValid) return null;

    const branch = validated.branch || getBranchFromRoll(row.roll_no);
    if (!branch) return null;

    const batch = getBatchFromRoll(row.roll_no);
    const photoKey = row.pfp || null;
    const photoStatus = photoKey && String(photoKey).trim() !== '' ? 'AVAILABLE' : 'MISSING';
    const photoUrl = photoKey ? getAssetUrl(photoKey) : null;

    const decryptedMobile = row.mobile ? decrypt(row.mobile) : null;
    const fatherName = row.father_name || 'N/A';
    const permanentAddress = getPermanentAddressFromDetails(row) || 'N/A';
    const bloodGroup = row.blood_group || 'N/A';
    const slNo = row.sl_no ?? row.slNo ?? row.s_no ?? row.sNo ?? row.serial_no ?? row.serialNo ?? row.sno ?? null;

    return {
      id: row.id,
      slNo,
      rollNo: row.roll_no,
      admissionNo: row.admission_no || row.roll_no,
      studentName: row.name || 'N/A',
      branch,
      batch,
      courseDisplay: `B.Tech (${branch})`,
      fatherName,
      studentPhone: decryptedMobile || 'N/A',
      studentAddress: permanentAddress,
      bloodGroup,
      photoKey,
      photoUrl,
      photoStatus,
      studentStatus: row.student_status,
      academicStatus: row.academic_status,
      admissionDate: row.admission_date,
    };
  }

  /**
   * Base SQL query selecting authoritative finalized student records
   */
  static getAuthoritativeBaseQuery() {
    return db
      .select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        admission_no: studentsTable.admission_no,
        name: studentsTable.name,
        date_of_birth: studentsTable.date_of_birth,
        gender: studentsTable.gender,
        email: studentsTable.email,
        mobile: studentsTable.mobile,
        admission_date: studentsTable.admission_date,
        student_status: studentsTable.student_status,
        academic_status: studentsTable.academic_status,
        // Personal Details
        father_name: studentPersonalDetails.father_name,
        mother_name: studentPersonalDetails.mother_name,
        blood_group: studentPersonalDetails.blood_group,
        perm_house_no: studentPersonalDetails.perm_house_no,
        perm_street: studentPersonalDetails.perm_street,
        perm_apartment: studentPersonalDetails.perm_apartment,
        perm_city: studentPersonalDetails.perm_city,
        perm_state: studentPersonalDetails.perm_state,
        perm_pincode: studentPersonalDetails.perm_pincode,
        perm_country: studentPersonalDetails.perm_country,
        // Image
        pfp: studentImages.pfp,
      })
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
      .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
      .where(
        and(
          eq(studentsTable.student_status, 'ACTIVE'),
          ne(studentsTable.academic_status, 'DROPPED'),
          isNotNull(studentsTable.roll_no),
          ne(studentsTable.roll_no, '')
        )
      );
  }

  /**
   * Calculates dynamic statistics for each canonical academic branch.
   * All counts are derived directly from the authoritative database tables.
   */
  static async getBranchSummaryStats({ allowedBranches = null, batch = null, firstYearOnly = false } = {}) {
    const session = await getCurrentCalendarSession().catch(() => null);

    // 1. Fetch all active finalized student roll numbers and photo keys
    const rows = await db
      .select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        pfp: studentImages.pfp,
      })
      .from(studentsTable)
      .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
      .where(
        and(
          eq(studentsTable.student_status, 'ACTIVE'),
          ne(studentsTable.academic_status, 'DROPPED'),
          isNotNull(studentsTable.roll_no),
          ne(studentsTable.roll_no, '')
        )
      );

    const allowedSet = Array.isArray(allowedBranches) && allowedBranches.length > 0
      ? new Set(allowedBranches.map((b) => String(b).toUpperCase().trim()))
      : null;

    const statsMap = {};
    for (const b of CANONICAL_BRANCHES) {
      statsMap[b.name] = {
        branch: b.name,
        branchCode: b.code,
        branchFullName: b.fullName,
        totalEligible: 0,
        photosAvailable: 0,
        photosMissing: 0,
        isAllowed: allowedSet ? allowedSet.has(b.name) : true,
      };
    }

    let globalTotal = 0;
    let globalPhotosAvailable = 0;
    let globalPhotosMissing = 0;

    for (const r of rows) {
      const validated = validateRollNo(r.roll_no);
      if (!validated.isValid) continue;

      const br = validated.branch || getBranchFromRoll(r.roll_no);
      if (!br || !statsMap[br]) continue;

      if (batch && batch !== 'ALL') {
        const studentBatch = getBatchFromRoll(r.roll_no);
        if (studentBatch !== batch) continue;
      }

      if (allowedSet && !allowedSet.has(br)) {
        continue; // Excluded from caller scope
      }

      if (firstYearOnly && !(await IDCardDataService.isStudentFirstYear(r.roll_no, session))) {
        continue;
      }

      const hasPhoto = r.pfp && String(r.pfp).trim() !== '';

      statsMap[br].totalEligible++;
      if (hasPhoto) {
        statsMap[br].photosAvailable++;
        globalPhotosAvailable++;
      } else {
        statsMap[br].photosMissing++;
        globalPhotosMissing++;
      }
      globalTotal++;
    }

    return {
      branches: Object.values(statsMap),
      globalSummary: {
        totalEligible: globalTotal,
        photosAvailable: globalPhotosAvailable,
        photosMissing: globalPhotosMissing,
      },
    };
  }

  /**
   * Retrieves paginated student records for the interactive preview table.
   * Enforces server-side eligibility: active finalized student with persisted roll number.
   */
  static async getStudentRecords({
    branch = 'ALL',
    batch = 'ALL',
    search = '',
    photoStatus = 'ALL',
    page = 1,
    limit = 20,
    allowedBranches = null,
    firstYearOnly = false,
  } = {}) {
    const session = await getCurrentCalendarSession().catch(() => null);

    // 1. Departmental Scoping
    const allowedSet = Array.isArray(allowedBranches) && allowedBranches.length > 0
      ? new Set(allowedBranches.map((b) => String(b).toUpperCase().trim()))
      : null;

    // 2. Query Authoritative Dataset
    let query = this.getAuthoritativeBaseQuery();

    // If specific branch requested, apply database-level LIKE condition
    if (branch && branch !== 'ALL') {
      const normBranch = String(branch).toUpperCase().trim();
      const code = this.getBranchCodeFromName(normBranch);
      if (code) {
        query = db
          .select({
            id: studentsTable.id,
            roll_no: studentsTable.roll_no,
            admission_no: studentsTable.admission_no,
            name: studentsTable.name,
            date_of_birth: studentsTable.date_of_birth,
            gender: studentsTable.gender,
            email: studentsTable.email,
            mobile: studentsTable.mobile,
            admission_date: studentsTable.admission_date,
            student_status: studentsTable.student_status,
            academic_status: studentsTable.academic_status,
            father_name: studentPersonalDetails.father_name,
            mother_name: studentPersonalDetails.mother_name,
            blood_group: studentPersonalDetails.blood_group,
            perm_house_no: studentPersonalDetails.perm_house_no,
            perm_street: studentPersonalDetails.perm_street,
            perm_apartment: studentPersonalDetails.perm_apartment,
            perm_city: studentPersonalDetails.perm_city,
            perm_state: studentPersonalDetails.perm_state,
            perm_pincode: studentPersonalDetails.perm_pincode,
            perm_country: studentPersonalDetails.perm_country,
            pfp: studentImages.pfp,
          })
          .from(studentsTable)
          .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
          .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
          .where(
            and(
              eq(studentsTable.student_status, 'ACTIVE'),
              ne(studentsTable.academic_status, 'DROPPED'),
              isNotNull(studentsTable.roll_no),
              ne(studentsTable.roll_no, ''),
              or(
                like(studentsTable.roll_no, `%567T${code}%`),
                like(studentsTable.roll_no, `%567${code}%L`),
                like(studentsTable.roll_no, `%567T${code}%L`)
              )
            )
          );
      }
    }

    const rows = await query.orderBy(desc(studentsTable.id));

    // 3. In-memory validation and enrichment to guarantee 100% eligibility invariant
    let validStudents = [];
    const seenRolls = new Set();

    for (const r of rows) {
      if (seenRolls.has(r.roll_no)) continue;

      const student = this.mapAuthoritativeStudent(r);
      if (!student) continue;

      // Scoping filter
      if (allowedSet && !allowedSet.has(student.branch)) continue;

      // Branch filter verification
      if (branch && branch !== 'ALL' && student.branch !== String(branch).toUpperCase().trim()) {
        continue;
      }

      // Batch filter
      if (batch && batch !== 'ALL' && student.batch !== batch) {
        continue;
      }

      // Photo Status filter
      if (photoStatus && photoStatus !== 'ALL') {
        const normPhoto = String(photoStatus).toUpperCase().trim();
        if (student.photoStatus !== normPhoto) continue;
      }

      // Search filter (roll_no, studentName, fatherName, phone)
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesRoll = student.rollNo && student.rollNo.toLowerCase().includes(q);
        const matchesName = student.studentName && student.studentName.toLowerCase().includes(q);
        const matchesFather = student.fatherName && student.fatherName.toLowerCase().includes(q);
        const matchesPhone = student.studentPhone && student.studentPhone.includes(q);

        if (!matchesRoll && !matchesName && !matchesFather && !matchesPhone) {
          continue;
        }
      }

      // First-year scope enforcement
      if (firstYearOnly && !(await this.isStudentFirstYear(student.rollNo, session))) {
        continue;
      }

      seenRolls.add(student.rollNo);
      validStudents.push(student);
    }

    // 4. Pagination
    const totalRecords = validStudents.length;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const totalPages = Math.ceil(totalRecords / safeLimit) || 1;
    const offset = (safePage - 1) * safeLimit;

    const paginated = validStudents.slice(offset, offset + safeLimit);

    // 5. Dynamic Branch Stats
    const summaryStats = await this.getBranchSummaryStats({ allowedBranches, batch, firstYearOnly });

    return {
      students: paginated,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalRecords,
        totalPages,
      },
      stats: summaryStats.globalSummary,
      branches: summaryStats.branches,
    };
  }

  /**
   * Dedicated reusable plain-text QR payload builder for student ID cards.
   * Generates a human-readable labeled text format with one field per line:
   * SL-NO : <val>
   * HALL-TICKET-NO : <val>
   * NAME : <val>
   * FATHER-S-NAME : <val>
   * COURSE : <val>
   * ADDRESS : <val>
   * MOBILE-NO : <val>
   * VALID-UPTO- : <val>
   *
   * Invariants:
   * - Excludes raw JSON, schemaVersion, type, and database internal primary keys.
   * - Never outputs 'undefined', 'null', or misleading placeholder data.
   * - Address is formatted readably on a single line.
   * - Retains full backward compatibility with attendance QR scanners.
   */
  static generateStudentQRPayload(student) {
    return buildStudentIDCardQRPayload(student);
  }

  /**
   * Generates a high-contrast, scannable QR Code Data URL with standard quiet zone
   */
  static async generateStudentQRDataUrl(student) {
    const payload = this.generateStudentQRPayload(student);
    if (!payload) return null;

    const qrText = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return QRCode.toDataURL(qrText, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }

  /**
   * Retrieves single student details for ID card preview or generation
   */
  static async getStudentRecordByRollNo(rollNo, { firstYearOnly = false } = {}) {
    if (!rollNo) return null;
    const cleanRoll = String(rollNo).toUpperCase().trim();

    const validated = validateRollNo(cleanRoll);
    if (!validated.isValid) return null;

    if (firstYearOnly && !(await this.isStudentFirstYear(cleanRoll))) {
      return null;
    }

    const rows = await db
      .select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        admission_no: studentsTable.admission_no,
        name: studentsTable.name,
        date_of_birth: studentsTable.date_of_birth,
        gender: studentsTable.gender,
        email: studentsTable.email,
        mobile: studentsTable.mobile,
        admission_date: studentsTable.admission_date,
        student_status: studentsTable.student_status,
        academic_status: studentsTable.academic_status,
        father_name: studentPersonalDetails.father_name,
        mother_name: studentPersonalDetails.mother_name,
        blood_group: studentPersonalDetails.blood_group,
        perm_house_no: studentPersonalDetails.perm_house_no,
        perm_street: studentPersonalDetails.perm_street,
        perm_apartment: studentPersonalDetails.perm_apartment,
        perm_city: studentPersonalDetails.perm_city,
        perm_state: studentPersonalDetails.perm_state,
        perm_pincode: studentPersonalDetails.perm_pincode,
        perm_country: studentPersonalDetails.perm_country,
        pfp: studentImages.pfp,
      })
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
      .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
      .where(
        and(
          eq(studentsTable.roll_no, cleanRoll),
          eq(studentsTable.student_status, 'ACTIVE'),
          ne(studentsTable.academic_status, 'DROPPED')
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    const student = this.mapAuthoritativeStudent(rows[0]);
    if (!student) return null;

    // Generate Verification QR Code
    let qrUrl = null;
    try {
      qrUrl = await this.generateStudentQRDataUrl(student);
    } catch (err) {
      logger.warn({ roll: student.rollNo, err: err.message }, 'Failed to generate QR code for ID card');
    }

    return {
      ...student,
      qrUrl,
    };
  }

  /**
   * Retrieves bulk student records for batch PDF generation directly from authoritative database
   */
  static async getStudentsForBulk(rollNos, allowedBranches = null, { firstYearOnly = false } = {}) {
    if (!Array.isArray(rollNos) || rollNos.length === 0) return [];

    const cleanRolls = Array.from(
      new Set(
        rollNos
          .map((r) => String(r || '').toUpperCase().trim())
          .filter((r) => validateRollNo(r).isValid)
      )
    );

    if (cleanRolls.length === 0) return [];

    const allowedSet = Array.isArray(allowedBranches) && allowedBranches.length > 0
      ? new Set(allowedBranches.map((b) => String(b).toUpperCase().trim()))
      : null;

    const rows = await db
      .select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        admission_no: studentsTable.admission_no,
        name: studentsTable.name,
        date_of_birth: studentsTable.date_of_birth,
        gender: studentsTable.gender,
        email: studentsTable.email,
        mobile: studentsTable.mobile,
        admission_date: studentsTable.admission_date,
        student_status: studentsTable.student_status,
        academic_status: studentsTable.academic_status,
        father_name: studentPersonalDetails.father_name,
        mother_name: studentPersonalDetails.mother_name,
        blood_group: studentPersonalDetails.blood_group,
        perm_house_no: studentPersonalDetails.perm_house_no,
        perm_street: studentPersonalDetails.perm_street,
        perm_apartment: studentPersonalDetails.perm_apartment,
        perm_city: studentPersonalDetails.perm_city,
        perm_state: studentPersonalDetails.perm_state,
        perm_pincode: studentPersonalDetails.perm_pincode,
        perm_country: studentPersonalDetails.perm_country,
        pfp: studentImages.pfp,
      })
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
      .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
      .where(
        and(
          inArray(studentsTable.roll_no, cleanRolls),
          eq(studentsTable.student_status, 'ACTIVE'),
          ne(studentsTable.academic_status, 'DROPPED')
        )
      );

    const matches = [];
    for (const r of rows) {
      const student = this.mapAuthoritativeStudent(r);
      if (!student) continue;

      if (allowedSet && !allowedSet.has(student.branch)) continue;
      if (firstYearOnly && !(await this.isStudentFirstYear(student.rollNo))) continue;
      matches.push(student);
    }

    // Format each record with QR code and resolved photo URL
    const enriched = await Promise.all(
      matches.map(async (student) => {
        let qrUrl = null;
        try {
          qrUrl = await this.generateStudentQRDataUrl(student);
        } catch (_err) {
          logger.debug({ roll: student.rollNo }, 'Bulk QR generation skipped');
        }

        return {
          studentName: student.studentName,
          fatherName: student.fatherName,
          admissionNo: student.rollNo,
          course: student.branch,
          batch: student.batch,
          address: student.studentAddress,
          mobile: student.studentPhone,
          pfpUrl: student.photoUrl,
          qrUrl,
          photoStatus: student.photoStatus,
        };
      })
    );

    return enriched;
  }

  /**
   * One-Click Branch Export Engine.
   * Retrieves ALL eligible finalized students for the requested branch,
   * without pagination truncation, and formats into XLSX or CSV.
   */
  static async exportBranchData({
    branch,
    batch = null,
    format = 'xlsx',
    allowedBranches = null,
    user = null,
    firstYearOnly = false,
  }) {
    if (!branch) {
      throw new Error('Academic branch is required for ID card data export');
    }

    const normBranch = String(branch).toUpperCase().trim();
    const isFirstYearRestricted = firstYearOnly || (user && user.is_first_year_coordinator);
    const session = isFirstYearRestricted ? await getCurrentCalendarSession().catch(() => null) : null;

    // 1. Departmental Scoping Check
    if (normBranch !== 'ALL' && Array.isArray(allowedBranches) && allowedBranches.length > 0) {
      const allowedSet = new Set(allowedBranches.map((b) => String(b).toUpperCase().trim()));
      if (!allowedSet.has(normBranch)) {
        const error = new Error(`Access Denied: You do not have permission to export branch ${normBranch}`);
        error.statusCode = 403;
        throw error;
      }
    }

    // 2. Fetch all matching authoritative records
    let query = this.getAuthoritativeBaseQuery();

    if (normBranch !== 'ALL') {
      const code = this.getBranchCodeFromName(normBranch);
      if (code) {
        query = db
          .select({
            id: studentsTable.id,
            roll_no: studentsTable.roll_no,
            admission_no: studentsTable.admission_no,
            name: studentsTable.name,
            date_of_birth: studentsTable.date_of_birth,
            gender: studentsTable.gender,
            email: studentsTable.email,
            mobile: studentsTable.mobile,
            admission_date: studentsTable.admission_date,
            student_status: studentsTable.student_status,
            academic_status: studentsTable.academic_status,
            father_name: studentPersonalDetails.father_name,
            mother_name: studentPersonalDetails.mother_name,
            blood_group: studentPersonalDetails.blood_group,
            perm_house_no: studentPersonalDetails.perm_house_no,
            perm_street: studentPersonalDetails.perm_street,
            perm_apartment: studentPersonalDetails.perm_apartment,
            perm_city: studentPersonalDetails.perm_city,
            perm_state: studentPersonalDetails.perm_state,
            perm_pincode: studentPersonalDetails.perm_pincode,
            perm_country: studentPersonalDetails.perm_country,
            pfp: studentImages.pfp,
          })
          .from(studentsTable)
          .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
          .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
          .where(
            and(
              eq(studentsTable.student_status, 'ACTIVE'),
              ne(studentsTable.academic_status, 'DROPPED'),
              isNotNull(studentsTable.roll_no),
              ne(studentsTable.roll_no, ''),
              or(
                like(studentsTable.roll_no, `%567T${code}%`),
                like(studentsTable.roll_no, `%567${code}%L`),
                like(studentsTable.roll_no, `%567T${code}%L`)
              )
            )
          );
      }
    }

    const rows = await query.orderBy(studentsTable.roll_no);

    // 3. Filter and Deduplicate
    const eligibleStudents = [];
    const seenRolls = new Set();
    const allowedSet = Array.isArray(allowedBranches) && allowedBranches.length > 0
      ? new Set(allowedBranches.map((b) => String(b).toUpperCase().trim()))
      : null;

    for (const r of rows) {
      if (seenRolls.has(r.roll_no)) continue;

      const student = this.mapAuthoritativeStudent(r);
      if (!student) continue;

      if (allowedSet && !allowedSet.has(student.branch)) continue;
      if (normBranch !== 'ALL' && student.branch !== normBranch) continue;
      if (batch && batch !== 'ALL' && student.batch !== batch) continue;
      if (isFirstYearRestricted && !(await this.isStudentFirstYear(student.rollNo, session))) continue;

      seenRolls.add(student.rollNo);
      eligibleStudents.push(student);
    }

    if (eligibleStudents.length === 0) {
      const error = new Error(`No eligible finalized students found for branch ${normBranch}`);
      error.statusCode = 404;
      throw error;
    }

    // Determine representative batch for filename
    const detectedBatch = eligibleStudents[0]?.batch || (batch && batch !== 'ALL' ? batch : 'CURRENT');
    const cleanBranchLabel = normBranch === 'ALL' ? 'ALL_BRANCHES' : normBranch;
    const filenameBase = `KUCET_${cleanBranchLabel}_ID_CARD_DATA_${detectedBatch}`;

    // Helper: Robustly retrieves student photograph buffer from storage
    const fetchStudentPhotoBuffer = async (photoKey) => {
      if (!photoKey || typeof photoKey !== 'string') return null;
      const clean = photoKey.trim();
      if (clean === '' || clean === 'N/A' || clean === 'None') return null;

      try {
        if (clean.startsWith('data:')) {
          const parts = clean.split(',');
          if (parts[1]) return Buffer.from(parts[1], 'base64');
        }

        const cleanKey = clean
          .replace(/^\/api\/assets\/view\//, '')
          .replace(/^https?:\/\/[^/]+\/api\/assets\/view\//, '')
          .replace(/^kucet\//, '')
          .replace(/^\/+/, '');

        const basePath = getLocalStorageBasePath();
        const candidatePaths = [
          path.join(basePath, 'kucet', cleanKey),
          path.join(basePath, cleanKey),
          path.join('/app/storage', 'kucet', cleanKey),
          path.join('/app/storage', cleanKey),
          path.join('/var/www/kucet-storage', 'kucet', cleanKey),
          path.join('/var/www/kucet-storage', cleanKey),
          path.join(process.cwd(), 'public', 'uploads', cleanKey),
          path.join(process.cwd(), 'public', 'assets', cleanKey),
          path.join('/tmp/kucet_photos_cache', cleanKey),
          path.join('/tmp/kucet_thumbs', `${path.basename(cleanKey, path.extname(cleanKey))}.png`),
        ];

        for (const cand of candidatePaths) {
          if (cand && fs.existsSync(/*turbopackIgnore: true*/ cand)) {
            const stat = fs.statSync(/*turbopackIgnore: true*/ cand);
            if (stat.isFile() && stat.size > 0) {
              return await fs.promises.readFile(cand);
            }
          }
        }

        const remoteUrl = getAssetUrl(clean);
        if (remoteUrl && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'))) {
          const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const arr = await res.arrayBuffer();
            return Buffer.from(arr);
          }
        }
      } catch (err) {
        logger.warn({ photoKey, err: err.message }, 'Failed to fetch student photo buffer for export');
      }

      return null;
    };

    const requestedFormat = String(format).toLowerCase();
    const isCsv = requestedFormat === 'csv';
    const isZip = requestedFormat === 'zip';

    // 4. Generate Export File
    if (isCsv) {
      // CSV Format (Plain text data; RFC 4180 compliant)
      const headers = [
        'S.No',
        'Roll Number',
        'Student Full Name',
        'Academic Branch',
        'Course',
        'Academic Batch',
        'Father Name',
        'Emergency Contact Mobile',
        'Permanent Address',
        'Blood Group',
        'Photo Status',
        'Photo Storage Key',
      ];

      const csvEscape = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const lines = [headers.map(csvEscape).join(',')];
      eligibleStudents.forEach((st, idx) => {
        lines.push([
          idx + 1,
          csvEscape(st.rollNo),
          csvEscape(st.studentName),
          csvEscape(st.branch),
          csvEscape(st.courseDisplay),
          csvEscape(st.batch),
          csvEscape(st.fatherName),
          csvEscape(st.studentPhone),
          csvEscape(st.studentAddress),
          csvEscape(st.bloodGroup),
          csvEscape(st.photoStatus),
          csvEscape(st.photoKey || 'N/A'),
        ].join(','));
      });

      const csvBuffer = Buffer.from(lines.join('\n'), 'utf8');
      return {
        buffer: csvBuffer,
        filename: `${filenameBase}.csv`,
        contentType: 'text/csv; charset=utf-8',
        count: eligibleStudents.length,
      };
    }

    // Retrieve and process photos with bounded concurrency (batches of 10)
    const photoBuffers = new Map();
    for (let i = 0; i < eligibleStudents.length; i += 10) {
      const chunk = eligibleStudents.slice(i, i + 10);
      await Promise.all(
        chunk.map(async (st) => {
          if (st.photoKey && st.photoStatus === 'AVAILABLE') {
            try {
              const rawBuf = await fetchStudentPhotoBuffer(st.photoKey);
              if (rawBuf && rawBuf.length >= 12) {
                const image = sharp(rawBuf).rotate();
                const meta = await image.metadata();
                const jpegBuf = await image.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
                photoBuffers.set(st.rollNo, {
                  buffer: jpegBuf,
                  width: meta.width || 600,
                  height: meta.height || 800,
                });
              }
            } catch (imgErr) {
              logger.warn({ roll: st.rollNo, err: imgErr.message }, 'Failed to transcode student photo for export');
            }
          }
        })
      );
    }

    // ZIP Package: Companion archive containing CSV + Original high-res photographs organized by roll number
    if (isZip) {
      const csvHeaders = [
        'S.No',
        'Roll Number',
        'Student Full Name',
        'Academic Branch',
        'Course',
        'Academic Batch',
        'Father Name',
        'Emergency Contact Mobile',
        'Permanent Address',
        'Blood Group',
        'Photo Status',
        'Photo Image File',
      ];

      const csvEscape = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const csvLines = [csvHeaders.map(csvEscape).join(',')];
      eligibleStudents.forEach((st, idx) => {
        const photoFile = photoBuffers.has(st.rollNo) ? `photographs/${st.rollNo}.jpg` : 'MISSING';
        csvLines.push([
          idx + 1,
          csvEscape(st.rollNo),
          csvEscape(st.studentName),
          csvEscape(st.branch),
          csvEscape(st.courseDisplay),
          csvEscape(st.batch),
          csvEscape(st.fatherName),
          csvEscape(st.studentPhone),
          csvEscape(st.studentAddress),
          csvEscape(st.bloodGroup),
          csvEscape(st.photoStatus),
          csvEscape(photoFile),
        ].join(','));
      });

      const csvContent = csvLines.join('\n');

      const zipBuffer = await new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 6 } });
        const chunks = [];
        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', (err) => reject(err));

        archive.append(csvContent, { name: `${filenameBase}.csv` });

        for (const [rollNo, pInfo] of photoBuffers.entries()) {
          archive.append(pInfo.buffer, { name: `photographs/${rollNo}.jpg` });
        }

        archive.finalize();
      });

      return {
        buffer: zipBuffer,
        filename: `${filenameBase}_PACKAGE.zip`,
        contentType: 'application/zip',
        count: eligibleStudents.length,
      };
    }

    // Excel (XLSX) Format using ExcelJS with Embedded Photographs
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KUCET College Management System';
    workbook.lastModifiedBy = user?.name || user?.email || 'KUCET Admissions Staff';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet(`${cleanBranchLabel} ID Cards`, {
      views: [{ showGridLines: true }],
    });

    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Roll Number', key: 'roll_no', width: 16 },
      { header: 'Student Full Name', key: 'student_name', width: 28 },
      { header: 'Student Photograph', key: 'photo', width: 16 },
      { header: 'Academic Branch', key: 'branch', width: 14 },
      { header: 'Course', key: 'course', width: 18 },
      { header: 'Academic Batch', key: 'batch', width: 16 },
      { header: "Father's Name", key: 'father_name', width: 26 },
      { header: 'Emergency Contact Mobile', key: 'mobile', width: 20 },
      { header: 'Permanent Address', key: 'permanent_address', width: 44 },
      { header: 'Blood Group', key: 'blood_group', width: 14 },
      { header: 'Photo Status', key: 'photo_status', width: 16 },
      { header: 'Photo Storage Reference', key: 'photo_key', width: 32 },
    ];

    // Format Header Row (Kakatiya Navy)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B3578' }, // Kakatiya Navy
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0B3578' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Populate Data Rows with Actual Embedded Photographs
    eligibleStudents.forEach((st, idx) => {
      const rowNum = idx + 2; // Row 1 is header
      const row = worksheet.addRow({
        sno: idx + 1,
        roll_no: st.rollNo,
        student_name: st.studentName,
        photo: '', // placeholder for embedded drawing
        branch: st.branch,
        course: st.courseDisplay,
        batch: st.batch,
        father_name: st.fatherName,
        mobile: st.studentPhone,
        permanent_address: st.studentAddress,
        blood_group: st.bloodGroup,
        photo_status: st.photoStatus,
        photo_key: st.photoKey || 'N/A',
      });

      row.height = 72; // Practical height to clearly preview student photo
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 2, 4, 5, 7, 11, 12].includes(colNumber) ? 'center' : 'left',
        };
        cell.font = { size: 10, color: { argb: 'FF1E293B' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Text formatting for roll number
        if (colNumber === 2) {
          cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
        }

        // Highlight photo status column (col 12)
        if (colNumber === 12) {
          if (st.photoStatus === 'AVAILABLE') {
            cell.font = { color: { argb: 'FF15803D' }, bold: true, size: 10 }; // Green
          } else {
            cell.font = { color: { argb: 'FFDC2626' }, bold: true, size: 10 }; // Red
          }
        }
      });

      // Embed Photograph into Column 4 (0-indexed col 3)
      const photoInfo = photoBuffers.get(st.rollNo);
      if (photoInfo && photoInfo.buffer) {
        try {
          const imageId = workbook.addImage({
            buffer: photoInfo.buffer,
            extension: 'jpeg',
          });

          const aspect = photoInfo.width / photoInfo.height;
          const displayHeight = 64; // height in points
          const displayWidth = Math.min(80, Math.max(36, Math.round(displayHeight * aspect)));

          worksheet.addImage(imageId, {
            tl: { col: 3.15, row: rowNum - 0.92 },
            ext: { width: displayWidth, height: displayHeight },
            editAs: 'oneCell',
          });
        } catch (embedErr) {
          logger.warn({ roll: st.rollNo, err: embedErr.message }, 'Failed to attach image to worksheet row');
          const photoCell = row.getCell('photo');
          photoCell.value = 'PHOTO MISSING';
          photoCell.font = { size: 8, bold: true, color: { argb: 'FFDC2626' } };
          photoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      } else {
        const photoCell = row.getCell('photo');
        photoCell.value = 'PHOTO MISSING';
        photoCell.font = { size: 8, bold: true, color: { argb: 'FFDC2626' } };
        photoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(excelBuffer),
      filename: `${filenameBase}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: eligibleStudents.length,
    };
  }

  /**
   * Uploads and rectifies a student photo directly into the database.
   * Updates DB storage (student_images), logs an audit trail, and avoids ephemeral maps.
   */
  static async updateStudentPhoto({
    rollNo,
    fileBuffer,
    mimeType = 'image/webp',
    extension = 'webp',
    updatedByStaffId = null,
    ip = '127.0.0.1',
    userAgent = 'System',
    firstYearOnly = false,
  }) {
    if (!rollNo || !fileBuffer) {
      throw new Error('Roll number and image file buffer are required');
    }

    const cleanRoll = String(rollNo).toUpperCase().trim();
    if (firstYearOnly && !(await this.isStudentFirstYear(cleanRoll))) {
      const err = new Error(`Access Denied: Student with roll number ${cleanRoll} is not a first year student`);
      err.statusCode = 403;
      throw err;
    }

    const student = await this.getStudentRecordByRollNo(cleanRoll);
    if (!student) {
      throw new Error(`Eligible finalized student with roll number ${cleanRoll} not found`);
    }

    const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const relativeKey = `kucet/students/pfp/${uuid}.${extension}`;

    // 1. Upload to storage provider
    const storage = getStorageProvider();
    await storage.uploadFile(fileBuffer, relativeKey, mimeType);

    // 2. Database persistence into student_images table
    await db
      .insert(studentImages)
      .values({
        student_id: student.id,
        pfp: relativeKey,
      })
      .onDuplicateKeyUpdate({
        set: { pfp: relativeKey },
      });

    // 3. Write structured audit log
    try {
      await db.insert(auditLogs).values({
        user_type: 'staff',
        user_id: updatedByStaffId || 0,
        action: 'UPDATE_STUDENT_ID_PHOTO',
        entity_name: 'student_images',
        entity_id: String(student.id),
        old_data: JSON.stringify({ pfp: student.photoKey }),
        new_data: JSON.stringify({ pfp: relativeKey, rollNo: cleanRoll }),
        ip_address: ip,
        user_agent: userAgent,
        created_at: new Date(),
      });
    } catch (auditErr) {
      logger.warn({ err: auditErr.message, rollNo: cleanRoll }, 'Failed to insert audit log for photo upload');
    }

    logger.info({ rollNo: cleanRoll, studentId: student.id, relativeKey }, 'Student ID card photograph successfully updated in DB');

    return {
      success: true,
      rollNo: cleanRoll,
      photoKey: relativeKey,
      photoUrl: getAssetUrl(relativeKey),
    };
  }
}
