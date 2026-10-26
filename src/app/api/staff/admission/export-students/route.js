import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getAuthUser, apiError, apiResponse } from '@/lib/api-utils';
import { StudentService } from '@/services/StudentService';
import { branchCodes, getBatchFromRoll } from '@/lib/rollNumber';
import { formatDate } from '@/lib/date';
import { getAssetUrl } from '@/lib/assets';
import { resolveLocalFilePath } from '@/app/api/assets/view/[...path]/route';
import ExcelJS from 'exceljs';
import fs from 'fs';

const maskAadhaar = (val) => {
  if (!val || typeof val !== 'string' || val.length < 4) return 'N/A';
  return `XXXX-XXXX-${val.slice(-4)}`;
};

/**
 * Escapes characters that Excel and spreadsheet software evaluate as formulas (=, +, -, @)
 * to prevent CSV/Excel Formula Injection attacks.
 */
function sanitizeSpreadsheetValue(val) {
  if (typeof val === 'string' && /^[=+\-@]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

/**
 * Validates image buffer magic bytes and returns the ExcelJS-compatible extension.
 */
function detectImageExtension(buffer) {
  if (!buffer || buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpeg';
  // GIF: GIF87a or GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'gif';
  // WebP: RIFF....WEBP (ExcelJS embeds with png container format for openxml)
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'png';
  return null;
}

/**
 * Robustly fetches an image buffer using local persistent storage first,
 * with failover to remote Cloudinary/S3 and in-memory deduplication.
 */
async function fetchImageBuffer(assetPath, imageBufferCache) {
  if (!assetPath || typeof assetPath !== 'string') return null;
  const clean = assetPath.trim();
  if (clean === '' || clean === 'N/A' || clean === 'NA' || clean === 'None') return null;

  if (imageBufferCache.has(clean)) {
    return imageBufferCache.get(clean);
  }

  // 1. Data URI
  if (clean.startsWith('data:image/')) {
    try {
      const base64Data = clean.split(',')[1];
      if (base64Data) {
        const buf = Buffer.from(base64Data, 'base64');
        const ext = detectImageExtension(buf) || 'png';
        const res = { buffer: buf, extension: ext };
        imageBufferCache.set(clean, res);
        return res;
      }
    } catch (_e) {
      /* ignore and try next source */
    }
  }

  // 2. Local VPS persistent storage disk check
  try {
    const cleanStorageKey = clean
      .replace(/^\/api\/assets\/view\//, '')
      .replace(/^https?:\/\/[^/]+\/api\/assets\/view\//, '')
      .replace(/^\/+/, '');
    const { filePath, stat } = resolveLocalFilePath(cleanStorageKey);
    if (stat && stat.isFile() && filePath) {
      const buf = await fs.promises.readFile(filePath);
      if (buf && buf.length >= 12) {
        const ext = detectImageExtension(buf) || 'png';
        const res = { buffer: buf, extension: ext };
        imageBufferCache.set(clean, res);
        return res;
      }
    }
  } catch (_e) {
    /* ignore and try next source */
  }

  // 3. Remote URL check (getAssetUrl)
  try {
    let url = getAssetUrl(clean);
    if (url && url.startsWith('http')) {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf && buf.length >= 12) {
          const ext = detectImageExtension(buf) || 'png';
          const res = { buffer: buf, extension: ext };
          imageBufferCache.set(clean, res);
          return res;
        }
      }
    }
  } catch (_e) {
    /* ignore and try next source */
  }

  // 4. Cloudinary direct fallback
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
                      process.env.CLOUDINARY_CLOUD_NAME || 
                      'djs0ry74r';
    let cleanKey = clean
      .replace(/^\/api\/assets\/view\//, '')
      .replace(/^https?:\/\/[^/]+\/api\/assets\/view\//, '')
      .replace(/^\/+/, '');
    if (!cleanKey.startsWith('kucet/')) {
      cleanKey = `kucet/${cleanKey}`;
    }
    const directCloudUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${cleanKey}`;
    const directRes = await fetch(directCloudUrl, { signal: AbortSignal.timeout(6000) });
    if (directRes.ok) {
      const arrayBuf = await directRes.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf && buf.length >= 12) {
        const ext = detectImageExtension(buf) || 'png';
        const res = { buffer: buf, extension: ext };
        imageBufferCache.set(clean, res);
        return res;
      }
    }
  } catch (_e) {
    /* ignore and fallback to null */
  }

  return null;
}

export const EXPORT_SCOPES = {
  MASTER: 'master',
  SCHOLARSHIP: 'scholarship',
  DEPARTMENT: 'department',
  FIRST_YEAR: 'first_year'
};

export async function GET(req) {
  try {
    const user = await getAuthUser('staff');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const year = searchParams.get('year');
    const format = searchParams.get('format');
    const scope = searchParams.get('scope')?.toLowerCase()?.trim() || EXPORT_SCOPES.MASTER;

    if (!branch || !year) {
      return apiError('Branch and Year are required.', 400);
    }

    // Role-based access control per Scope
    const userRole = (user.role || '').toLowerCase();
    const isSuperAdminOrPrincipal = ['admin', 'super_admin', 'principal'].includes(userRole);
    const isAdmissionStaff = ['admission', 'admission_clerk'].includes(userRole);
    const isScholarshipStaff = ['scholarship', 'scholarship_clerk'].includes(userRole);
    const isHod = Boolean(user.is_hod || user.isHod);
    const isCoordinator = Boolean(user.is_first_year_coordinator);

    if (scope === EXPORT_SCOPES.MASTER) {
      if (!isSuperAdminOrPrincipal && !isAdmissionStaff) {
        return apiError('Forbidden: Access denied. Only admission staff and administrators can export student records.', 403);
      }
    } else if (scope === EXPORT_SCOPES.SCHOLARSHIP) {
      if (!isSuperAdminOrPrincipal && !isScholarshipStaff) {
        return apiError('Forbidden: Access denied. Only scholarship staff and administrators can export scholarship data.', 403);
      }
    } else if (scope === EXPORT_SCOPES.DEPARTMENT) {
      if (!isSuperAdminOrPrincipal && !isHod) {
        return apiError('Forbidden: Access denied. Only Heads of Department (HOD) and administrators can export departmental student data.', 403);
      }
      if (!isSuperAdminOrPrincipal) {
        const allowedBranches = (user.authorized_branches || user.hod_branches || (user.branch ? [user.branch] : []))
          .map(b => String(b).toUpperCase().trim());
        
        if (allowedBranches.length === 0) {
          return apiError('Forbidden: No departmental branch assignments found for HOD', 403);
        }

        const reqUpper = String(branch).toUpperCase().trim();
        const reqName = (branchCodes[reqUpper] || reqUpper).toUpperCase();
        const reqCode = (Object.keys(branchCodes).find(k => branchCodes[k].toUpperCase() === reqUpper) || reqUpper).toUpperCase();

        const isAllowed = allowedBranches.some(b => {
          const bName = (branchCodes[b] || b).toUpperCase();
          const bCode = (Object.keys(branchCodes).find(k => branchCodes[k].toUpperCase() === b) || b).toUpperCase();
          return b === reqUpper || bName === reqName || bCode === reqCode;
        });

        if (!isAllowed) {
          return apiError(`Forbidden: You do not have permission to export students for branch ${reqName || branch}`, 403);
        }
      }
    } else if (scope === EXPORT_SCOPES.FIRST_YEAR) {
      if (!isSuperAdminOrPrincipal && !isCoordinator) {
        return apiError('Forbidden: Access denied. Only First-Year Coordinators and administrators can export first-year cohort data.', 403);
      }
      if (!isSuperAdminOrPrincipal) {
        const strYear = String(year).trim();
        const isFirstYear = strYear === '1' || strYear === 'I' || strYear.toLowerCase().includes('1st') || strYear.toLowerCase().includes('first');
        const batchStart = parseInt(strYear.split('-')[0], 10);
        const currentYear = new Date().getFullYear();
        const isCurrentFirstYearBatch = !isNaN(batchStart) && batchStart >= currentYear;

        if (!isFirstYear && !isCurrentFirstYearBatch) {
          return apiError('Forbidden: First-Year Coordinators can only export the first-year cohort', 403);
        }
      }
    } else {
      return apiError(`Invalid export scope: ${scope}`, 400);
    }

    const isAuthorizedForFullAadhaar = isSuperAdminOrPrincipal || isAdmissionStaff;

    const students = await StudentService.getFullStudentDataForExport(year, branch);
    const branchName = branchCodes[branch] || branch;

    // --- SCOPE: SCHOLARSHIP EXPORT ---
    if (scope === EXPORT_SCOPES.SCHOLARSHIP) {
      if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'KUCET College Management System';
        workbook.lastModifiedBy = user.name || user.email || 'KUCET Scholarship Section';
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet('Scholarship_Students', { views: [{ showGridLines: true }] });
        worksheet.columns = [
          { header: 'Roll Number', key: 'roll_no', width: 16 },
          { header: 'Admission Number', key: 'admission_no', width: 18 },
          { header: 'Batch', key: 'batch', width: 14 },
          { header: 'Full Name', key: 'name', width: 28 },
          { header: 'Gender', key: 'gender', width: 12 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Academic Branch', key: 'branch', width: 16 },
          { header: 'Category', key: 'category', width: 12 },
          { header: 'Sub-Caste', key: 'sub_caste', width: 16 },
          { header: 'Seat Allotted Category', key: 'seat_allotted_category', width: 22 },
          { header: 'Fee Reimbursement', key: 'fee_reimbursement', width: 18 },
          { header: 'APAAR ID', key: 'apaar_id', width: 18 },
          { header: 'Academic Status', key: 'academic_status', width: 16 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3578' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
        });

        for (const s of students) {
          const rowValues = {
            roll_no: sanitizeSpreadsheetValue(s.roll_no || ''),
            admission_no: sanitizeSpreadsheetValue(s.admission_no || ''),
            batch: sanitizeSpreadsheetValue(getBatchFromRoll(s.roll_no) || year),
            name: sanitizeSpreadsheetValue(s.name || ''),
            gender: sanitizeSpreadsheetValue(s.gender || ''),
            email: sanitizeSpreadsheetValue(s.email || ''),
            branch: sanitizeSpreadsheetValue(branchCodes[branch] || branch),
            category: sanitizeSpreadsheetValue(s.category || ''),
            sub_caste: sanitizeSpreadsheetValue(s.sub_caste || ''),
            seat_allotted_category: sanitizeSpreadsheetValue(s.seat_allotted_category || ''),
            fee_reimbursement: sanitizeSpreadsheetValue(s.fee_reimbursement || 'NO'),
            apaar_id: sanitizeSpreadsheetValue(s.apaar_id || 'Not Submitted'),
            academic_status: sanitizeSpreadsheetValue(s.academic_status || 'ACTIVE'),
          };

          const addedRow = worksheet.addRow(rowValues);
          addedRow.height = 24;
          addedRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
          });
        }

        const fileBuffer = await workbook.xlsx.writeBuffer();
        const exportFilename = `KUCET_Scholarship_Students_${branchName}_Batch_${year}.xlsx`;
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${exportFilename}"`,
            'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          }
        });
      }

      const scholarshipStudents = students.map(s => ({
        roll_no: sanitizeSpreadsheetValue(s.roll_no || ''),
        admission_no: sanitizeSpreadsheetValue(s.admission_no || ''),
        batch: sanitizeSpreadsheetValue(getBatchFromRoll(s.roll_no) || year),
        name: sanitizeSpreadsheetValue(s.name || ''),
        gender: sanitizeSpreadsheetValue(s.gender || ''),
        email: sanitizeSpreadsheetValue(s.email || ''),
        branch: sanitizeSpreadsheetValue(branchCodes[branch] || branch),
        category: sanitizeSpreadsheetValue(s.category || ''),
        sub_caste: sanitizeSpreadsheetValue(s.sub_caste || ''),
        seat_allotted_category: sanitizeSpreadsheetValue(s.seat_allotted_category || ''),
        fee_reimbursement: sanitizeSpreadsheetValue(s.fee_reimbursement || 'NO'),
        apaar_id: sanitizeSpreadsheetValue(s.apaar_id || 'Not Submitted'),
        academic_status: sanitizeSpreadsheetValue(s.academic_status || 'ACTIVE'),
      }));

      return apiResponse({
        students: scholarshipStudents,
        scope: EXPORT_SCOPES.SCHOLARSHIP,
        canViewFullAadhaar: false
      });
    }

    // --- SCOPE: DEPARTMENT (HOD) EXPORT ---
    if (scope === EXPORT_SCOPES.DEPARTMENT) {
      if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'KUCET College Management System';
        workbook.lastModifiedBy = user.name || user.email || 'KUCET Head of Department';
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet('Department_Students', { views: [{ showGridLines: true }] });
        worksheet.columns = [
          { header: 'Roll Number', key: 'roll_no', width: 16 },
          { header: 'Admission Number', key: 'admission_no', width: 18 },
          { header: 'Batch', key: 'batch', width: 14 },
          { header: 'Full Name', key: 'name', width: 28 },
          { header: 'Gender', key: 'gender', width: 12 },
          { header: 'Date of Birth', key: 'date_of_birth', width: 16 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Academic Branch', key: 'branch', width: 16 },
          { header: 'Category', key: 'category', width: 12 },
          { header: 'Blood Group', key: 'blood_group', width: 14 },
          { header: 'APAAR ID', key: 'apaar_id', width: 18 },
          { header: 'Qualifying Exam', key: 'qualifying_exam', width: 16 },
          { header: 'Entrance Exam Rank', key: 'entrance_exam_rank', width: 18 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3578' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
        });

        for (const s of students) {
          const rawDob = s.date_of_birth || s.dob;
          const formattedDob = rawDob ? formatDate(rawDob, 'N/A') : 'N/A';
          const bloodGroupDisplay = s.blood_group && s.blood_group !== 'Not available' ? s.blood_group : 'Not available';

          const rowValues = {
            roll_no: sanitizeSpreadsheetValue(s.roll_no || ''),
            admission_no: sanitizeSpreadsheetValue(s.admission_no || ''),
            batch: sanitizeSpreadsheetValue(getBatchFromRoll(s.roll_no) || year),
            name: sanitizeSpreadsheetValue(s.name || ''),
            gender: sanitizeSpreadsheetValue(s.gender || ''),
            date_of_birth: sanitizeSpreadsheetValue(formattedDob),
            email: sanitizeSpreadsheetValue(s.email || ''),
            branch: sanitizeSpreadsheetValue(branchCodes[branch] || branch),
            category: sanitizeSpreadsheetValue(s.category || ''),
            blood_group: sanitizeSpreadsheetValue(bloodGroupDisplay),
            apaar_id: sanitizeSpreadsheetValue(s.apaar_id || 'Not Submitted'),
            qualifying_exam: sanitizeSpreadsheetValue(s.qualifying_exam || ''),
            entrance_exam_rank: sanitizeSpreadsheetValue(s.entrance_exam_rank || '')
          };

          const addedRow = worksheet.addRow(rowValues);
          addedRow.height = 24;
          addedRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
          });
        }

        const fileBuffer = await workbook.xlsx.writeBuffer();
        const exportFilename = `KUCET_Department_Students_${branchName}_Batch_${year}.xlsx`;
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${exportFilename}"`,
            'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          }
        });
      }

      const departmentStudents = students.map(s => ({
        roll_no: sanitizeSpreadsheetValue(s.roll_no || ''),
        admission_no: sanitizeSpreadsheetValue(s.admission_no || ''),
        batch: sanitizeSpreadsheetValue(getBatchFromRoll(s.roll_no) || year),
        name: sanitizeSpreadsheetValue(s.name || ''),
        gender: sanitizeSpreadsheetValue(s.gender || ''),
        date_of_birth: sanitizeSpreadsheetValue(s.date_of_birth || s.dob ? formatDate(s.date_of_birth || s.dob, 'N/A') : 'N/A'),
        email: sanitizeSpreadsheetValue(s.email || ''),
        branch: sanitizeSpreadsheetValue(branchCodes[branch] || branch),
        category: sanitizeSpreadsheetValue(s.category || ''),
        blood_group: sanitizeSpreadsheetValue(s.blood_group && s.blood_group !== 'Not available' ? s.blood_group : 'Not available'),
        apaar_id: sanitizeSpreadsheetValue(s.apaar_id || 'Not Submitted'),
        qualifying_exam: sanitizeSpreadsheetValue(s.qualifying_exam || ''),
        entrance_exam_rank: sanitizeSpreadsheetValue(s.entrance_exam_rank || '')
      }));

      return apiResponse({
        students: departmentStudents,
        scope: EXPORT_SCOPES.DEPARTMENT,
        canViewFullAadhaar: false
      });
    }

    // --- SCOPE: FIRST YEAR COORDINATOR EXPORT ---
    if (scope === EXPORT_SCOPES.FIRST_YEAR) {
      if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'KUCET College Management System';
        workbook.lastModifiedBy = user.name || user.email || 'KUCET First Year Coordinator';
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet('FirstYear_Students', { views: [{ showGridLines: true }] });
        worksheet.columns = [
          { header: 'Roll Number', key: 'roll_no', width: 16 },
          { header: 'Admission Number', key: 'admission_no', width: 18 },
          { header: 'Batch', key: 'batch', width: 14 },
          { header: 'Full Name', key: 'name', width: 28 },
          { header: 'Gender', key: 'gender', width: 12 },
          { header: 'Date of Birth', key: 'date_of_birth', width: 16 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Academic Branch', key: 'branch', width: 16 },
          { header: 'Category', key: 'category', width: 12 },
          { header: 'Blood Group', key: 'blood_group', width: 14 },
          { header: 'APAAR ID', key: 'apaar_id', width: 18 },
          { header: 'Qualifying Exam', key: 'qualifying_exam', width: 16 },
          { header: 'SSC Marks', key: 'ssc_marks', width: 14 },
          { header: 'Inter/Diploma Marks', key: 'inter_marks', width: 18 },
          { header: 'Entrance Exam Rank', key: 'entrance_exam_rank', width: 18 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3578' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
        });

        for (const s of students) {
          const rawDob = s.date_of_birth || s.dob;
          const formattedDob = rawDob ? formatDate(rawDob, 'N/A') : 'N/A';
          const bloodGroupDisplay = s.blood_group && s.blood_group !== 'Not available' ? s.blood_group : 'Not available';

          const rowValues = {
            roll_no: sanitizeSpreadsheetValue(s.roll_no || ''),
            admission_no: sanitizeSpreadsheetValue(s.admission_no || ''),
            batch: sanitizeSpreadsheetValue(getBatchFromRoll(s.roll_no) || year),
            name: sanitizeSpreadsheetValue(s.name || ''),
            gender: sanitizeSpreadsheetValue(s.gender || ''),
            date_of_birth: sanitizeSpreadsheetValue(formattedDob),
            email: sanitizeSpreadsheetValue(s.email || ''),
            branch: sanitizeSpreadsheetValue(branchCodes[branch] || branch),
            category: sanitizeSpreadsheetValue(s.category || ''),
            blood_group: sanitizeSpreadsheetValue(bloodGroupDisplay),
            apaar_id: sanitizeSpreadsheetValue(s.apaar_id || 'Not Submitted'),
            qualifying_exam: sanitizeSpreadsheetValue(s.qualifying_exam || ''),
            ssc_marks: sanitizeSpreadsheetValue(s.ssc_marks || ''),
            inter_marks: sanitizeSpreadsheetValue(s.inter_marks || ''),
            entrance_exam_rank: sanitizeSpreadsheetValue(s.entrance_exam_rank || '')
          };

          const addedRow = worksheet.addRow(rowValues);
          addedRow.height = 24;
          addedRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
          });
        }

        const fileBuffer = await workbook.xlsx.writeBuffer();
        const exportFilename = `KUCET_FirstYear_Students_${branchName}_Batch_${year}.xlsx`;
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${exportFilename}"`,
            'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          }
        });
      }

      const firstYearStudents = students.map(s => ({
        roll_no: sanitizeSpreadsheetValue(s.roll_no || ''),
        admission_no: sanitizeSpreadsheetValue(s.admission_no || ''),
        batch: sanitizeSpreadsheetValue(getBatchFromRoll(s.roll_no) || year),
        name: sanitizeSpreadsheetValue(s.name || ''),
        gender: sanitizeSpreadsheetValue(s.gender || ''),
        date_of_birth: sanitizeSpreadsheetValue(s.date_of_birth || s.dob ? formatDate(s.date_of_birth || s.dob, 'N/A') : 'N/A'),
        email: sanitizeSpreadsheetValue(s.email || ''),
        branch: sanitizeSpreadsheetValue(branchCodes[branch] || branch),
        category: sanitizeSpreadsheetValue(s.category || ''),
        blood_group: sanitizeSpreadsheetValue(s.blood_group && s.blood_group !== 'Not available' ? s.blood_group : 'Not available'),
        apaar_id: sanitizeSpreadsheetValue(s.apaar_id || 'Not Submitted'),
        qualifying_exam: sanitizeSpreadsheetValue(s.qualifying_exam || ''),
        ssc_marks: sanitizeSpreadsheetValue(s.ssc_marks || ''),
        inter_marks: sanitizeSpreadsheetValue(s.inter_marks || ''),
        entrance_exam_rank: sanitizeSpreadsheetValue(s.entrance_exam_rank || '')
      }));

      return apiResponse({
        students: firstYearStudents,
        scope: EXPORT_SCOPES.FIRST_YEAR,
        canViewFullAadhaar: false
      });
    }

    // --- SCOPE: MASTER EXPORT (ADMISSION & SUPER ADMIN ONLY) ---
    // If Excel format requested, generate and stream complete Excel workbook with embedded photographs
    if (format === 'excel') {
      const branchName = branchCodes[branch] || branch;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'KUCET College Management System';
      workbook.lastModifiedBy = user.name || user.email || 'KUCET Staff';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Students', {
        views: [{ showGridLines: true }]
      });

      // 33 Standardized Columns matching complete institutional admission register
      worksheet.columns = [
        { header: 'Roll Number', key: 'roll_no', width: 16 },
        { header: 'Admission Number', key: 'admission_no', width: 18 },
        { header: 'Batch', key: 'batch', width: 14 },
        { header: 'Full Name', key: 'name', width: 28 },
        { header: 'Gender', key: 'gender', width: 12 },
        { header: 'Date of Birth', key: 'date_of_birth', width: 16 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Mobile Number', key: 'mobile', width: 16 },
        { header: 'Father Name', key: 'father_name', width: 26 },
        { header: 'Mother Name', key: 'mother_name', width: 26 },
        { header: 'Nationality', key: 'nationality', width: 14 },
        { header: 'Religion', key: 'religion', width: 14 },
        { header: 'Category', key: 'category', width: 12 },
        { header: 'Sub-Caste', key: 'sub_caste', width: 16 },
        { header: 'Area Status', key: 'area_status', width: 14 },
        { header: 'Mother Tongue', key: 'mother_tongue', width: 16 },
        { header: 'Place of Birth', key: 'place_of_birth', width: 20 },
        { header: 'Father Occupation', key: 'father_occupation', width: 22 },
        { header: 'Annual Income', key: 'annual_income', width: 18 },
        { header: 'Aadhaar Number', key: 'aadhaar_no', width: 20 },
        { header: 'APAAR ID', key: 'apaar_id', width: 18 },
        { header: 'Guardian Mobile', key: 'guardian_mobile', width: 16 },
        { header: 'Permanent Address', key: 'permanent_address', width: 40 },
        { header: 'Identification Marks', key: 'identification_marks', width: 32 },
        { header: 'Seat Allotted Category', key: 'seat_allotted_category', width: 22 },
        { header: 'Blood Group', key: 'blood_group', width: 14 },
        { header: 'Fee Reimbursement', key: 'fee_reimbursement', width: 18 },
        { header: 'Qualifying Exam', key: 'qualifying_exam', width: 16 },
        { header: 'SSC Marks', key: 'ssc_marks', width: 14 },
        { header: 'Inter/Diploma Marks', key: 'inter_marks', width: 18 },
        { header: 'Entrance Exam Rank', key: 'entrance_exam_rank', width: 18 },
        { header: 'Previous College', key: 'previous_college', width: 30 },
        { header: 'Photo', key: 'photo', width: 16 },
        { header: 'Signature', key: 'signature', width: 20 }
      ];

      // Format Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 32;
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
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      const imageBufferCache = new Map();
      const centerAlignedKeys = new Set([
        'roll_no', 'admission_no', 'batch', 'gender', 'date_of_birth',
        'mobile', 'nationality', 'religion', 'category', 'sub_caste',
        'area_status', 'mother_tongue', 'annual_income', 'aadhaar_no',
        'guardian_mobile', 'seat_allotted_category', 'blood_group',
        'fee_reimbursement', 'qualifying_exam', 'ssc_marks',
        'inter_marks', 'entrance_exam_rank', 'photo', 'signature'
      ]);

      // Populate student rows
      let rowIndex = 2;
      for (const s of students) {
        const rawDob = s.date_of_birth || s.dob;
        const formattedDob = rawDob ? formatDate(rawDob, 'N/A') : 'N/A';

        // Complete Aadhaar strictly preserved as text for authorized roles, masked for others
        const plainAadhaar = s.aadhaar_no ? String(s.aadhaar_no).trim() : '';
        const finalAadhaar = isAuthorizedForFullAadhaar 
          ? (plainAadhaar || 'N/A') 
          : maskAadhaar(plainAadhaar);

        const bloodGroupDisplay = s.blood_group && s.blood_group !== 'Not available' 
          ? s.blood_group 
          : 'Not available';

        const rowValues = {
          roll_no: sanitizeSpreadsheetValue(s.roll_no || ''),
          admission_no: sanitizeSpreadsheetValue(s.admission_no || ''),
          batch: sanitizeSpreadsheetValue(getBatchFromRoll(s.roll_no) || year),
          name: sanitizeSpreadsheetValue(s.name || ''),
          gender: sanitizeSpreadsheetValue(s.gender || ''),
          date_of_birth: sanitizeSpreadsheetValue(formattedDob),
          email: sanitizeSpreadsheetValue(s.email || ''),
          mobile: sanitizeSpreadsheetValue(s.mobile || ''),
          father_name: sanitizeSpreadsheetValue(s.father_name || ''),
          mother_name: sanitizeSpreadsheetValue(s.mother_name || ''),
          nationality: sanitizeSpreadsheetValue(s.nationality || 'Indian'),
          religion: sanitizeSpreadsheetValue(s.religion || ''),
          category: sanitizeSpreadsheetValue(s.category || ''),
          sub_caste: sanitizeSpreadsheetValue(s.sub_caste || ''),
          area_status: sanitizeSpreadsheetValue(s.area_status || ''),
          mother_tongue: sanitizeSpreadsheetValue(s.mother_tongue || ''),
          place_of_birth: sanitizeSpreadsheetValue(s.place_of_birth || ''),
          father_occupation: sanitizeSpreadsheetValue(s.father_occupation || ''),
          annual_income: sanitizeSpreadsheetValue(s.annual_income || ''),
          aadhaar_no: sanitizeSpreadsheetValue(finalAadhaar),
          apaar_id: sanitizeSpreadsheetValue(s.apaar_id || 'Not Submitted'),
          guardian_mobile: sanitizeSpreadsheetValue(s.guardian_mobile || ''),
          permanent_address: sanitizeSpreadsheetValue(s.permanent_address || ''),
          identification_marks: sanitizeSpreadsheetValue(s.identification_marks || ''),
          seat_allotted_category: sanitizeSpreadsheetValue(s.seat_allotted_category || ''),
          blood_group: sanitizeSpreadsheetValue(bloodGroupDisplay),
          fee_reimbursement: sanitizeSpreadsheetValue(s.fee_reimbursement || 'NO'),
          qualifying_exam: sanitizeSpreadsheetValue(s.qualifying_exam || ''),
          ssc_marks: sanitizeSpreadsheetValue(s.ssc_marks || ''),
          inter_marks: sanitizeSpreadsheetValue(s.inter_marks || ''),
          entrance_exam_rank: sanitizeSpreadsheetValue(s.entrance_exam_rank || ''),
          previous_college: sanitizeSpreadsheetValue(s.previous_college || ''),
          photo: '', // placeholder, will embed image or set text
          signature: '' // placeholder
        };

        const addedRow = worksheet.addRow(rowValues);
        addedRow.height = 75; // Accommodates visible, crisp photo embedding

        // Cell borders, alignment, and explicit text format for Aadhaar & DOB
        addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colKey = worksheet.columns[colNumber - 1]?.key;
          cell.alignment = {
            vertical: 'middle',
            horizontal: centerAlignedKeys.has(colKey) ? 'center' : 'left',
            wrapText: colKey === 'permanent_address' || colKey === 'identification_marks'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          // Inviolable text formatting for sensitive identifiers
          if (colKey === 'aadhaar_no' || colKey === 'date_of_birth' || colKey === 'mobile' || colKey === 'guardian_mobile') {
            cell.numFmt = '@';
          }
        });

        // 1. Photo Retrieval & Embedding (Column 32, 0-indexed column 31)
        if (s.photo) {
          try {
            const photoResult = await fetchImageBuffer(s.photo, imageBufferCache);
            if (photoResult && photoResult.buffer) {
              const imageId = workbook.addImage({
                buffer: photoResult.buffer,
                extension: photoResult.extension,
              });

              worksheet.addImage(imageId, {
                tl: { col: 31 + 0.15, row: (rowIndex - 1) + 0.08 },
                ext: { width: 66, height: 66 },
                editAs: 'oneCell'
              });
            } else {
              addedRow.getCell('photo').value = 'Photo unavailable';
              addedRow.getCell('photo').font = { italic: true, color: { argb: 'FF94A3B8' } };
            }
          } catch (imgErr) {
            logger.warn({ roll_no: s.roll_no, err: imgErr.message }, 'Failed to embed student photograph');
            addedRow.getCell('photo').value = 'Photo unavailable';
            addedRow.getCell('photo').font = { italic: true, color: { argb: 'FF94A3B8' } };
          }
        } else {
          addedRow.getCell('photo').value = 'Photo unavailable';
          addedRow.getCell('photo').font = { italic: true, color: { argb: 'FF94A3B8' } };
        }

        // 2. Signature Retrieval & Embedding (Column 33, 0-indexed column 32)
        if (s.signature) {
          try {
            const sigResult = await fetchImageBuffer(s.signature, imageBufferCache);
            if (sigResult && sigResult.buffer) {
              const sigImageId = workbook.addImage({
                buffer: sigResult.buffer,
                extension: sigResult.extension,
              });

              worksheet.addImage(sigImageId, {
                tl: { col: 32 + 0.15, row: (rowIndex - 1) + 0.25 },
                ext: { width: 95, height: 36 },
                editAs: 'oneCell'
              });
            } else {
              addedRow.getCell('signature').value = 'None';
              addedRow.getCell('signature').font = { italic: true, color: { argb: 'FF94A3B8' } };
            }
          } catch (sigErr) {
            logger.warn({ roll_no: s.roll_no, err: sigErr.message }, 'Failed to embed student signature');
            addedRow.getCell('signature').value = 'None';
            addedRow.getCell('signature').font = { italic: true, color: { argb: 'FF94A3B8' } };
          }
        } else {
          addedRow.getCell('signature').value = 'None';
          addedRow.getCell('signature').font = { italic: true, color: { argb: 'FF94A3B8' } };
        }

        rowIndex++;
      }

      const fileBuffer = await workbook.xlsx.writeBuffer();
      const exportFilename = `KUCET_Students_${branchName}_Batch_${year}.xlsx`;

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${exportFilename}"`,
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        }
      });
    }

    // Default JSON response for UI preview table
    const sanitizedStudents = students.map(s => ({
      ...s,
      apaar_id: s.apaar_id || 'Not Submitted',
      aadhaar_no: isAuthorizedForFullAadhaar ? (s.aadhaar_no || 'N/A') : maskAadhaar(s.aadhaar_no)
    }));

    return apiResponse({ 
      students: sanitizedStudents,
      scope: EXPORT_SCOPES.MASTER,
      canViewFullAadhaar: isAuthorizedForFullAadhaar 
    });

  } catch (error) {
    logger.error(error, 'Error exporting student data');
    return apiError('Internal Server Error', 500);
  }
}
