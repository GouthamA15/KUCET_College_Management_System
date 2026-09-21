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
import { eq, inArray } from 'drizzle-orm';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { branchCodes } from '@/lib/rollNumber';
import { getAssetUrl } from '@/lib/assets';
import { resolveLocalFilePath } from '@/app/api/assets/view/[...path]/route';
import { ACHIEVEMENT_CONFIG } from '@/lib/achievement-config';
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
    console.error('Failed to fetch asset buffer', err);
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

    let studentIdNum = parseInt(student_id);
    if (isNaN(studentIdNum)) return apiError('Invalid ID', 400);

    const studentRecord = await db.select().from(studentsTable).where(eq(studentsTable.id, studentIdNum));
    if (!studentRecord || studentRecord.length === 0) {
      return apiError('Student not found', 404);
    }
    const student = studentRecord[0];

    // 1. Authorize exactly like class-lookup & achievements
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

      if (!branchCode || !allowedBranchCodes.includes(branchCode)) {
        return apiError('Unauthorized to view this student', 403);
      }
    }

    // 2. Fetch everything
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
    const profileData = [
      ['Roll Number', student.roll_no],
      ['Name', student.name],
      ['Email', student.email],
      ['Phone', student.phone],
      ['Branch', student.branch],
      ['Current Year', student.current_year || ''],
      ['Batch', student.batch_year || ''],
      ['Admission No', student.admission_no || ''],
      ['Date of Birth', formatDate(student.dob) || student.dob || ''],
      ['Father Name', student.father_name || ''],
      ['Mother Name', student.mother_name || ''],
      ['Address', student.address || ''],
      ['Gender', pd.gender || ''],
      ['Category', pd.category || ''],
      ['Blood Group', pd.blood_group || ''],
      ['Aadhar Number', pd.aadhar_number || ''],
      ['Parent Phone', pd.parent_phone || ''],
      ['Permanent Address', [pd.perm_house_no, pd.perm_street, pd.perm_village, pd.perm_mandal, pd.perm_district, pd.perm_state, pd.perm_pincode].filter(Boolean).join(', ')],
    ];
    profileData.forEach(row => profileSheet.addRow(row));
    profileSheet.getColumn(1).width = 25;
    profileSheet.getColumn(2).width = 60;

    // --- Academic Details Sheet ---
    const acadSheet = workbook.addWorksheet('Academic Details');
    applyHeaderStyle(acadSheet, ['Level', 'Institution', 'Board/University', 'Year of Passing', 'Percentage', 'Grade']);
    academicBg.forEach(ab => {
      acadSheet.addRow([
        ab.education_level || 'N/A',
        ab.institution_name || 'N/A',
        ab.board_university || 'N/A',
        ab.year_of_passing || 'N/A',
        ab.percentage || 'N/A',
        ab.grade || 'N/A'
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

    let currentRow = 2; // header is 1
    for (const ach of achievements) {
      achSheet.addRow([
        ach.achievement_type,
        ach.title,
        ach.academic_year,
        ach.achievement_level || 'N/A',
        ach.description || 'N/A',
        '' // Image placeholder
      ]);
      
      const config = ACHIEVEMENT_CONFIG[ach.achievement_type] || {};

      if (ach.certificate_file_path) {
        achSheet.getRow(currentRow).height = 100;
        try {
          const imgBuffer = await fetchAssetBuffer(ach.certificate_file_path);
          if (imgBuffer) {
            let imgExt = 'jpeg';
            const ext = ach.certificate_file_path.split('.').pop()?.toLowerCase();
            if (ext === 'png') imgExt = 'png';
            if (ext === 'gif') imgExt = 'gif';

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
          console.error('Failed embedding image', e);
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
    console.error('Individual Export Error:', error);
    return apiError('Server error generating export', 500);
  }
}
