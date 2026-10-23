import crypto from 'crypto';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
import logger from '@/lib/logger';
import { getAssetUrl } from '@/lib/assets';
import { getStorageProvider } from '@/lib/providers/storage/factory';
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

export const CANONICAL_BRANCHES = [
  { code: '09', name: 'CSE', fullName: 'Computer Science & Engineering' },
  { code: '30', name: 'CSD', fullName: 'Computer Science & Data Science' },
  { code: '15', name: 'ECE', fullName: 'Electronics & Communication Engineering' },
  { code: '12', name: 'EEE', fullName: 'Electrical & Electronics Engineering' },
  { code: '00', name: 'CIVIL', fullName: 'Civil Engineering' },
  { code: '18', name: 'IT', fullName: 'Information Technology' },
  { code: '03', name: 'MECH', fullName: 'Mechanical Engineering' },
];

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

    return {
      id: row.id,
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
  static async getBranchSummaryStats({ allowedBranches = null, batch = null } = {}) {
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
  } = {}) {
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
    const summaryStats = await this.getBranchSummaryStats({ allowedBranches, batch });

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
   * Retrieves single student details for ID card preview or generation
   */
  static async getStudentRecordByRollNo(rollNo) {
    if (!rollNo) return null;
    const cleanRoll = String(rollNo).toUpperCase().trim();

    const validated = validateRollNo(cleanRoll);
    if (!validated.isValid) return null;

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
      const qrPayload = JSON.stringify({
        roll: student.rollNo,
        name: student.studentName,
        branch: student.branch,
        batch: student.batch,
      });
      qrUrl = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 120,
        color: { dark: '#000000', light: '#ffffff' },
      });
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
  static async getStudentsForBulk(rollNos, allowedBranches = null) {
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
      matches.push(student);
    }

    // Format each record with QR code and resolved photo URL
    const enriched = await Promise.all(
      matches.map(async (student) => {
        let qrUrl = null;
        try {
          const qrPayload = JSON.stringify({
            roll: student.rollNo,
            name: student.studentName,
            branch: student.branch,
            batch: student.batch,
          });
          qrUrl = await QRCode.toDataURL(qrPayload, {
            margin: 1,
            width: 120,
            color: { dark: '#000000', light: '#ffffff' },
          });
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
  }) {
    if (!branch) {
      throw new Error('Academic branch is required for ID card data export');
    }

    const normBranch = String(branch).toUpperCase().trim();

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

    // 4. Generate Export File
    const isCsv = String(format).toLowerCase() === 'csv';

    if (isCsv) {
      // CSV Format
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

    // Excel (XLSX) Format using ExcelJS
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

    // Populate Data Rows
    eligibleStudents.forEach((st, idx) => {
      const row = worksheet.addRow({
        sno: idx + 1,
        roll_no: st.rollNo,
        student_name: st.studentName,
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

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 2, 4, 6, 10, 11].includes(colNumber) ? 'center' : 'left',
        };
        cell.font = { size: 10, color: { argb: 'FF1E293B' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Highlight photo status
        if (colNumber === 11) {
          if (st.photoStatus === 'AVAILABLE') {
            cell.font = { color: { argb: 'FF15803D' }, bold: true, size: 10 }; // Green
          } else {
            cell.font = { color: { argb: 'FFDC2626' }, bold: true, size: 10 }; // Red
          }
        }
      });
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
  }) {
    if (!rollNo || !fileBuffer) {
      throw new Error('Roll number and image file buffer are required');
    }

    const cleanRoll = String(rollNo).toUpperCase().trim();
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
