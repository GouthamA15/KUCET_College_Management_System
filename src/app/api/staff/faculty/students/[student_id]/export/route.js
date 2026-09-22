import { NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentAchievements 
} from '@/db/schema';
import { studentMarks } from '@/db/schema/operations';
import { studentFeePayments } from '@/db/schema/finance';
import { staffAcademicAffiliations, academicPrograms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { branchCodes, getBranchFromRoll, getEntryYearFromRoll } from '@/lib/rollNumber';
import { getAssetUrl } from '@/lib/assets';
import { resolveLocalFilePath } from '@/app/api/assets/view/[...path]/route';
import { decrypt } from '@/lib/encryption';
import logger from '@/lib/logger';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { formatDate } from '@/lib/date';

async function fetchAssetBuffer(assetPath) {
  if (!assetPath) return null;
  const url = getAssetUrl(assetPath);
  
  try {
    if (url.startsWith('http')) {
       const res = await fetch(url);
       if (res.ok) {
         const arrayBuf = await res.arrayBuffer();
         return Buffer.from(arrayBuf);
       }
    } else {
       const resolved = resolveLocalFilePath(assetPath);
       if (resolved && resolved.stat && resolved.filePath) {
          return fs.readFileSync(resolved.filePath);
       }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to fetch asset buffer for Excel export');
  }
  return null;
}

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser('faculty');
    if (!user || (user.role !== 'faculty' && user.role !== 'admin' && user.role !== 'hod')) {
      return apiError('Unauthorized', 401);
    }

    const { student_id } = await params;
    if (!student_id) return apiError('Student ID is required', 400);

    let studentIdNum = parseInt(student_id, 10);
    if (isNaN(studentIdNum)) return apiError('Invalid ID', 400);

    const studentRecord = await db.select().from(studentsTable).where(eq(studentsTable.id, studentIdNum));
    if (!studentRecord || studentRecord.length === 0) {
      return apiError('Student not found', 404);
    }
    const student = studentRecord[0];

    // 1. Authorize: Faculty/HOD must be affiliated with student's branch
    if (user.role !== 'admin') {
      const affil = await db.select({ 
        prog_code: academicPrograms.program_code 
      })
      .from(staffAcademicAffiliations)
      .leftJoin(academicPrograms, eq(staffAcademicAffiliations.program_id, academicPrograms.id))
      .where(eq(staffAcademicAffiliations.staff_account_id, user.id));
      
      const allowedPrograms = Array.from(new Set(affil.map(a => a.prog_code).filter(Boolean)));
      const allowedBranchCodes = allowedPrograms.map(p => Object.keys(branchCodes).find(key => branchCodes[key] === p)).filter(Boolean);

      let branchCode = null;
      const rollNo = student.roll_no;
      const match = rollNo.match(/567T(\d{2})/);
      const matchLe = rollNo.match(/567(\d{2}).*L/);
      if (match) branchCode = match[1];
      else if (matchLe) branchCode = matchLe[1];
      else if (rollNo.length === 10) branchCode = rollNo.substring(6, 8);

      const branchName = getBranchFromRoll(rollNo);
      const isAuthorizedBranch = (branchCode && allowedBranchCodes.includes(branchCode)) || 
                                 (branchName && allowedPrograms.includes(branchName));

      if (!isAuthorizedBranch) {
        return apiError('Unauthorized to view this student', 403);
      }
    }

    // 2. Fetch student domain records
    const personalDetails = await db.select().from(studentPersonalDetails).where(eq(studentPersonalDetails.student_id, studentIdNum));
    const academicBg = await db.select().from(studentAcademicBackground).where(eq(studentAcademicBackground.student_id, studentIdNum));
    const performance = await db.select().from(studentMarks).where(eq(studentMarks.student_id, studentIdNum));
    const financials = await db.select().from(studentFeePayments).where(eq(studentFeePayments.student_id, studentIdNum));
    const achievements = await db.select().from(studentAchievements).where(eq(studentAchievements.student_id, studentIdNum));

    // 3. Create Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KUCET CMS';
    workbook.created = new Date();

    const applyHeaderStyle = (sheet, headers) => {
      sheet.addRow(headers);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B3578' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    };

    // --- Profile Sheet ---
    const profileSheet = workbook.addWorksheet('Student Profile');
    applyHeaderStyle(profileSheet, ['Field', 'Value']);
    const pd = personalDetails[0] || {};
    
    // Decrypt sensitive fields safely
    let decryptedMobile = 'N/A';
    try {
      if (student.mobile) decryptedMobile = decrypt(student.mobile) || student.mobile;
    } catch (_e) {
      decryptedMobile = 'Error decrypting';
    }

    let decryptedGuardianMobile = 'N/A';
    try {
      if (pd.guardian_mobile) decryptedGuardianMobile = decrypt(pd.guardian_mobile) || pd.guardian_mobile;
    } catch (_e) {
      decryptedGuardianMobile = 'Error decrypting';
    }

    let decryptedAadhaar = 'N/A';
    try {
      if (pd.aadhaar_no) decryptedAadhaar = decrypt(pd.aadhaar_no) || pd.aadhaar_no;
    } catch (_e) {
      decryptedAadhaar = 'Error decrypting';
    }

    const branch = getBranchFromRoll(student.roll_no) || 'N/A';
    const entryYear = getEntryYearFromRoll(student.roll_no) || 'N/A';
    const permAddress = [pd.perm_house_no, pd.perm_street, pd.perm_city, pd.perm_state, pd.perm_pincode, pd.perm_country].filter(Boolean).join(', ');
    const currAddress = [pd.curr_house_no, pd.curr_street, pd.curr_city, pd.curr_state, pd.curr_pincode, pd.curr_country].filter(Boolean).join(', ');

    const profileData = [
      ['Roll Number', student.roll_no],
      ['Name', student.name],
      ['Email', student.email],
      ['Phone', decryptedMobile],
      ['Branch', branch],
      ['Admission No', student.admission_no || ''],
      ['Entry Year', entryYear],
      ['Date of Birth', formatDate(student.date_of_birth) || student.date_of_birth || ''],
      ['Gender', student.gender || pd.gender || ''],
      ['Fee Reimbursement', student.fee_reimbursement || 'NO'],
      ['Status', student.student_status || 'ACTIVE'],
      ['Father Name', pd.father_name || ''],
      ['Mother Name', pd.mother_name || ''],
      ['Category', pd.category || ''],
      ['Blood Group', pd.blood_group || ''],
      ['Aadhaar Number', decryptedAadhaar],
      ['Parent/Guardian Phone', decryptedGuardianMobile],
      ['Permanent Address', permAddress || 'N/A'],
      ['Current Address', currAddress || permAddress || 'N/A'],
    ];
    profileData.forEach(row => profileSheet.addRow(row));
    profileSheet.getColumn(1).width = 25;
    profileSheet.getColumn(2).width = 60;

    // --- Academic Details Sheet ---
    const acadSheet = workbook.addWorksheet('Academic Details');
    applyHeaderStyle(acadSheet, ['Level', 'Institution', 'Board/University', 'Year of Passing', 'Percentage', 'Grade']);
    academicBg.forEach(ab => {
      acadSheet.addRow([
        ab.qualifying_exam || 'N/A',
        ab.previous_college_details || 'N/A',
        ab.medium_of_instruction || 'N/A',
        ab.ssc_marks || 'N/A',
        ab.inter_marks || 'N/A',
        ab.ranks || 'N/A'
      ]);
    });
    acadSheet.columns.forEach(c => c.width = 20);
    acadSheet.getColumn(2).width = 40;
    acadSheet.getColumn(3).width = 30;

    // --- Performance Sheet ---
    const perfSheet = workbook.addWorksheet('Performance');
    applyHeaderStyle(perfSheet, ['Assignment ID', 'Mid 1', 'Mid 2', 'Assignment', 'Lab Theory', 'Lab Exec', 'Lab Record']);
    performance.forEach(p => {
      perfSheet.addRow([
        p.assignment_id,
        p.mid1_marks || '0',
        p.mid2_marks || '0',
        p.assignment_marks || '0',
        p.lab_theory_marks || '0',
        p.lab_execution_marks || '0',
        p.lab_record_marks || '0'
      ]);
    });
    perfSheet.columns.forEach(c => c.width = 15);

    // --- Financial Records Sheet ---
    const finSheet = workbook.addWorksheet('Financial Records');
    applyHeaderStyle(finSheet, ['Date', 'Academic Year', 'Amount', 'Transaction Ref', 'Mode', 'Bank']);
    financials.forEach(f => {
      finSheet.addRow([
        formatDate(f.transaction_date) || f.transaction_date,
        f.academic_year || 'N/A',
        f.amount,
        f.transaction_ref_no || 'N/A',
        f.payment_mode || 'N/A',
        f.bank_name || 'N/A'
      ]);
    });
    finSheet.columns.forEach(c => c.width = 20);
    finSheet.getColumn(4).width = 30;

    // --- Achievements Sheet ---
    const achSheet = workbook.addWorksheet('Achievements');
    applyHeaderStyle(achSheet, ['Type', 'Title', 'Academic Year', 'Level', 'Description', 'Certificate']);
    achSheet.columns.forEach(c => c.width = 20);
    achSheet.getColumn(2).width = 30;
    achSheet.getColumn(5).width = 40;
    achSheet.getColumn(6).width = 45;

    let currentRow = 2; // header is row 1
    for (const ach of achievements) {
      achSheet.addRow([
        ach.achievement_type,
        ach.title,
        ach.academic_year,
        ach.achievement_level || 'N/A',
        ach.description || 'N/A',
        '' // Image placeholder
      ]);

      if (ach.certificate_file_path) {
        achSheet.getRow(currentRow).height = 100;
        try {
          const imgBuffer = await fetchAssetBuffer(ach.certificate_file_path);
          if (imgBuffer) {
            let imgExt = 'jpeg';
            const ext = ach.certificate_file_path.split('.').pop()?.toLowerCase();
            if (ext === 'png') imgExt = 'png';
            if (ext === 'webp') imgExt = 'png'; // ExcelJS image embedding supports png/jpeg/gif

            const imageId = workbook.addImage({
              buffer: imgBuffer,
              extension: imgExt
            });

            achSheet.addImage(imageId, {
              tl: { col: 5, row: currentRow - 1 },
              ext: { width: 300, height: 120 }
            });
          } else {
             achSheet.getCell(currentRow, 6).value = 'Not uploaded (or missing)';
          }
        } catch (e) {
          logger.error({ err: e }, 'Failed embedding certificate image into Excel');
          achSheet.getCell(currentRow, 6).value = 'Error fetching certificate';
        }
      } else {
        achSheet.getCell(currentRow, 6).value = 'Not uploaded';
      }

      currentRow++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Student_${student.roll_no}_Complete_Record.xlsx"`
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Exporting student comprehensive data failed');
    return apiError('Internal Server Error', 500);
  }
}
