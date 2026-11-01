import ExcelJS from 'exceljs';
import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAdmissionDrafts,
  auditLogs 
} from '@/db/schema';
import { eq, and, ne, or, desc } from 'drizzle-orm';
import { 
  validateRollNo, 
  getBranchFromRoll, 
  branchCodes 
} from '@/lib/rollNumber';
import { calculateStudentYearAndSemester, getCurrentCalendarSession } from '@/lib/academic-utils';

export const INSTITUTIONAL_BRANCHES = [
  { code: '09', name: 'CSE', fullName: 'Computer Science & Engineering' },
  { code: '18', name: 'IT', fullName: 'Information Technology' },
  { code: '30', name: 'CSD', fullName: 'Computer Science & Data Science' },
  { code: '15', name: 'ECE', fullName: 'Electronics & Communication Engineering' },
  { code: '12', name: 'EEE', fullName: 'Electrical & Electronics Engineering' },
  { code: '00', name: 'CIVIL', fullName: 'Civil Engineering' },
  { code: '03', name: 'MECH', fullName: 'Mechanical Engineering' }
];

export function sanitizeSpreadsheetValue(val) {
  if (typeof val === 'string' && /^[=+\-@]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

export function formatApaarDisplay(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export class FirstYearApaarService {
  /**
   * Helper: Resolves standard uppercase branch name (e.g. 'CSE', 'ECE')
   * from 2-digit code or name string.
   */
  static normalizeBranch(input) {
    if (!input) return 'UNKNOWN';
    const clean = String(input).trim().toUpperCase();
    if (branchCodes[clean]) return branchCodes[clean].toUpperCase();
    const foundEntry = Object.entries(branchCodes).find(([, name]) => name.toUpperCase() === clean);
    if (foundEntry) return foundEntry[1].toUpperCase();
    return clean;
  }

  /**
   * Checks whether a student with the given roll number is currently in their First Year
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
    // Fallback based on intake year if session is not configured
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentAcademicYear = now.getMonth() >= 6 
      ? `${currentYear}-${String(currentYear + 1).slice(-2)}` 
      : `${currentYear - 1}-${String(currentYear).slice(-2)}`;
    const currentSemester = now.getMonth() >= 6 ? 1 : 2;
    const calc = calculateStudentYearAndSemester(rollNo, currentAcademicYear, currentSemester);
    return calc.yearOfStudy === 1;
  }

  /**
   * Retrieves all authoritative First-Year student records including APAAR submission status.
   * Handles students who do not yet have a university roll number by using their admission number
   * or draft application identifier, while strictly eliminating duplicate records.
   */
  static async getFirstYearStudents({ branch = 'ALL', status = 'ALL', search = '' } = {}) {
    const session = await getCurrentCalendarSession().catch(() => null);
    const normBranchFilter = branch && branch !== 'ALL' ? this.normalizeBranch(branch) : 'ALL';
    const normStatusFilter = status ? String(status).toUpperCase().trim() : 'ALL';
    const searchClean = search ? String(search).trim().toLowerCase() : '';

    // 1. Fetch active students from studentsTable joined with personal details
    const studentRows = await db
      .select({
        id: studentsTable.id,
        roll_no: studentsTable.roll_no,
        admission_no: studentsTable.admission_no,
        name: studentsTable.name,
        admission_date: studentsTable.admission_date,
        student_status: studentsTable.student_status,
        academic_status: studentsTable.academic_status,
        apaar_id: studentPersonalDetails.apaar_id,
      })
      .from(studentsTable)
      .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
      .where(
        and(
          eq(studentsTable.student_status, 'ACTIVE'),
          ne(studentsTable.academic_status, 'DROPPED')
        )
      )
      .orderBy(desc(studentsTable.id));

    // 2. Fetch admission drafts that represent pending/newly admitted students without final roll numbers
    const draftRows = await db
      .select({
        id: studentAdmissionDrafts.id,
        admission_year: studentAdmissionDrafts.admission_year,
        branch: studentAdmissionDrafts.branch,
        name: studentAdmissionDrafts.name,
        apaar_id: studentAdmissionDrafts.apaar_id,
        status: studentAdmissionDrafts.status,
      })
      .from(studentAdmissionDrafts)
      .where(
        or(
          eq(studentAdmissionDrafts.status, 'PROCESSED'),
          eq(studentAdmissionDrafts.status, 'FINALIZED'),
          eq(studentAdmissionDrafts.status, 'DRAFT')
        )
      )
      .orderBy(desc(studentAdmissionDrafts.id));

    const studentList = [];
    const seenRolls = new Set();
    const seenAdmissionNos = new Set();
    const seenNames = new Set();

    // Process finalized & active students in studentsTable
    for (const row of studentRows) {
      const hasRoll = Boolean(row.roll_no && String(row.roll_no).trim() !== '');
      let isFirstYear = false;
      let studentBranch = 'UNKNOWN';

      if (hasRoll) {
        const rollClean = String(row.roll_no).trim().toUpperCase();
        if (seenRolls.has(rollClean)) continue;

        const validated = validateRollNo(rollClean);
        if (validated.isValid) {
          studentBranch = this.normalizeBranch(validated.branch || getBranchFromRoll(rollClean));
        } else {
          studentBranch = this.normalizeBranch(getBranchFromRoll(rollClean));
        }

        isFirstYear = await this.isStudentFirstYear(rollClean, session);
      } else {
        // Newly admitted student in studentsTable without roll number yet
        isFirstYear = true;
        studentBranch = 'FIRST_YEAR';
      }

      if (!isFirstYear) continue;

      if (row.roll_no) seenRolls.add(String(row.roll_no).trim().toUpperCase());
      if (row.admission_no) seenAdmissionNos.add(String(row.admission_no).trim().toUpperCase());
      if (row.name) seenNames.add(String(row.name).trim().toLowerCase());

      const rawApaar = row.apaar_id ? String(row.apaar_id).replace(/\s+/g, '') : null;
      const isValidApaar = Boolean(rawApaar && /^\d{12}$/.test(rawApaar));

      studentList.push({
        id: row.id,
        name: row.name || 'Unnamed Student',
        roll_no: row.roll_no || null,
        admission_no: row.admission_no || (row.roll_no ? null : `APP-${row.id}`),
        branch: studentBranch,
        status: isValidApaar ? 'Submitted' : 'Pending',
        apaar_id: isValidApaar ? rawApaar : null,
      });
    }

    // Process drafts for students not yet in studentsTable
    const currentYearStr = String(new Date().getFullYear());
    for (const draft of draftRows) {
      if (draft.admission_year && !draft.admission_year.includes(currentYearStr)) continue;

      const normName = String(draft.name || '').trim().toLowerCase();
      if (normName && seenNames.has(normName)) continue; // avoid duplication with studentsTable

      const draftBranch = this.normalizeBranch(draft.branch);
      const rawApaar = draft.apaar_id ? String(draft.apaar_id).replace(/\s+/g, '') : null;
      const isValidApaar = Boolean(rawApaar && /^\d{12}$/.test(rawApaar));

      seenNames.add(normName);

      studentList.push({
        id: `DRAFT-${draft.id}`,
        name: draft.name || 'Admitted Student',
        roll_no: null,
        admission_no: `ADM-DRAFT-${draft.id}`,
        branch: draftBranch,
        status: isValidApaar ? 'Submitted' : 'Pending',
        apaar_id: isValidApaar ? rawApaar : null,
      });
    }

    // Calculate global First-Year cohort summary before filters
    const globalSummary = {
      totalStudents: studentList.length,
      submittedCount: studentList.filter(s => s.status === 'Submitted').length,
      pendingCount: studentList.filter(s => s.status === 'Pending').length,
      submissionPercentage: studentList.length > 0 
        ? Math.round((studentList.filter(s => s.status === 'Submitted').length / studentList.length) * 100)
        : 0
    };

    // Apply filters
    let filteredList = studentList;

    if (normBranchFilter !== 'ALL') {
      filteredList = filteredList.filter(s => s.branch === normBranchFilter);
    }

    if (normStatusFilter !== 'ALL') {
      filteredList = filteredList.filter(s => s.status.toUpperCase() === normStatusFilter);
    }

    if (searchClean) {
      filteredList = filteredList.filter(s => {
        const nameMatch = (s.name || '').toLowerCase().includes(searchClean);
        const rollMatch = (s.roll_no || '').toLowerCase().includes(searchClean);
        const admMatch = (s.admission_no || '').toLowerCase().includes(searchClean);
        return nameMatch || rollMatch || admMatch;
      });
    }

    const filteredSummary = {
      totalStudents: filteredList.length,
      submittedCount: filteredList.filter(s => s.status === 'Submitted').length,
      pendingCount: filteredList.filter(s => s.status === 'Pending').length,
      submissionPercentage: filteredList.length > 0 
        ? Math.round((filteredList.filter(s => s.status === 'Submitted').length / filteredList.length) * 100)
        : 0
    };

    return {
      allStudents: studentList,
      filteredStudents: filteredList,
      globalSummary,
      filteredSummary
    };
  }

  /**
   * Retrieves paginated student records for the interactive First-Year APAAR dashboard.
   */
  static async getMonitoringData({ branch = 'ALL', status = 'ALL', search = '', page = 1, limit = 20 } = {}) {
    const { filteredStudents, globalSummary, filteredSummary } = await this.getFirstYearStudents({
      branch,
      status,
      search
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (parsedPage - 1) * parsedLimit;
    const paginated = filteredStudents.slice(offset, offset + parsedLimit);
    const totalPages = Math.ceil(filteredStudents.length / parsedLimit) || 1;

    return {
      students: paginated,
      pagination: {
        total: filteredStudents.length,
        page: parsedPage,
        limit: parsedLimit,
        totalPages
      },
      summary: globalSummary,
      filteredSummary,
      availableBranches: INSTITUTIONAL_BRANCHES.map(b => b.name)
    };
  }

  /**
   * Generates a styled Excel spreadsheet report containing First-Year APAAR monitoring data.
   * Enforces formula-injection sanitization, appropriate column formatting, and audit logging.
   */
  static async generateExcelWorkbook({ branch = 'ALL', status = 'ALL', staffUser = null, ipAddress = null, userAgent = null } = {}) {
    const { filteredStudents } = await this.getFirstYearStudents({
      branch,
      status,
      search: ''
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KUCET College Management System';
    workbook.lastModifiedBy = staffUser?.name || staffUser?.email || 'First Year Coordinator';
    workbook.created = new Date();
    workbook.modified = new Date();

    const normBranch = branch && branch !== 'ALL' ? this.normalizeBranch(branch) : 'AllBranches';
    const normStatus = status ? String(status).toUpperCase().trim() : 'ALL';
    const sheetName = normStatus === 'PENDING' ? 'Pending_APAAR' : 'FirstYear_APAAR';

    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }]
    });

    // Minimum necessary columns matching academic requirement
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Student Name', key: 'name', width: 30 },
      { header: 'Roll Number', key: 'roll_no', width: 18 },
      { header: 'Admission / App ID', key: 'admission_no', width: 20 },
      { header: 'Academic Branch', key: 'branch', width: 16 },
      { header: 'APAAR Status', key: 'status', width: 16 },
      { header: 'APAAR ID', key: 'apaar_id', width: 22 }
    ];

    // Format Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B3578' } // Kakatiya Navy
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    // Populate rows
    let index = 1;
    for (const student of filteredStudents) {
      const isSubmitted = student.status === 'Submitted';
      const formattedApaar = isSubmitted && student.apaar_id 
        ? formatApaarDisplay(student.apaar_id) 
        : '';

      const rowValues = {
        sno: index,
        name: sanitizeSpreadsheetValue(student.name || ''),
        roll_no: sanitizeSpreadsheetValue(student.roll_no || 'Not Assigned'),
        admission_no: sanitizeSpreadsheetValue(student.admission_no || 'N/A'),
        branch: sanitizeSpreadsheetValue(student.branch || ''),
        status: sanitizeSpreadsheetValue(student.status),
        apaar_id: sanitizeSpreadsheetValue(formattedApaar)
      };

      const addedRow = worksheet.addRow(rowValues);
      addedRow.height = 24;

      addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colKey = worksheet.columns[colNumber - 1]?.key;
        cell.alignment = {
          vertical: 'middle',
          horizontal: ['sno', 'roll_no', 'branch', 'status', 'apaar_id'].includes(colKey) 
            ? 'center' 
            : 'left'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Text formatting for identifiers
        if (colKey === 'roll_no' || colKey === 'apaar_id' || colKey === 'admission_no') {
          cell.numFmt = '@';
        }

        // Highlight status cell
        if (colKey === 'status') {
          if (isSubmitted) {
            cell.font = { color: { argb: 'FF047857' }, bold: true }; // Emerald
          } else {
            cell.font = { color: { argb: 'FFB45309' }, bold: true }; // Amber
          }
        }
      });

      index++;
    }

    const fileBuffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    let reportPrefix = 'KUCET_FirstYear_APAAR_Report';
    if (normStatus === 'PENDING') reportPrefix = 'KUCET_FirstYear_APAAR_Pending';
    if (normStatus === 'SUBMITTED') reportPrefix = 'KUCET_FirstYear_APAAR_Submitted';
    
    const filename = `${reportPrefix}_${normBranch}_${dateStr}.xlsx`;

    // Audit Logging
    if (staffUser) {
      try {
        await db.insert(auditLogs).values({
          user_id: staffUser.id || staffUser.staffId || null,
          user_type: staffUser.role === 'admin' ? 'admin' : 'staff',
          action: 'EXPORT_FIRST_YEAR_APAAR',
          target_id: normBranch,
          target_type: 'first_year_cohort',
          payload_before: null,
          payload_after: {
            report_type: reportPrefix,
            branch: normBranch,
            status_filter: normStatus,
            total_records: filteredStudents.length,
            filename,
            timestamp: new Date().toISOString()
          },
          ip_address: ipAddress || '127.0.0.1',
          user_agent: userAgent || 'KUCET First Year Workspace'
        });
      } catch (auditErr) {
        logger.warn({ error: auditErr.message }, 'Failed to write APAAR export audit log');
      }
    }

    return { fileBuffer, filename, totalRecords: filteredStudents.length };
  }
}
