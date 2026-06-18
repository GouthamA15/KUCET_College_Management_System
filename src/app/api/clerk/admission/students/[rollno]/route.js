import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentImages,
  studentSignatures
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { COLLEGE_CONFIG } from '@/lib/college-config';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import { encrypt, hashForIndex } from '@/lib/encryption';

const toNull = (value) => (value === undefined || value === '' ? null : value);

export async function PUT(req, context) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden: Only admission clerks can update student details', 403);
  }

  const clerkId = user?.clerkId || user.id || null;
  if (!clerkId) return apiError('Unauthorized: clerk id missing in token', 401);

  try {
    const params = await context.params;
    let { rollno } = params;
    if (!rollno) return apiError('Missing rollno parameter', 400);

    // Invisible Normalization Hook
    rollno = String(rollno).trim().toUpperCase();

    const updatedData = await req.json();

    // Validations
    if (updatedData.blood_group !== undefined) {
      const bg = updatedData.blood_group == null ? null : String(updatedData.blood_group).trim();
      if (bg && !COLLEGE_CONFIG.bloodGroups.includes(bg)) return apiError('Invalid blood group value', 400);
    }
    if (updatedData.fee_reimbursement !== undefined) {
      const fr = updatedData.fee_reimbursement == null ? null : String(updatedData.fee_reimbursement).trim().toUpperCase();
      if (fr && !['YES', 'NO', 'GOV'].includes(fr)) return apiError('Invalid fee_reimbursement value', 400);
    }

    const studentRows = await db.select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.roll_no, rollno))
      .limit(1);
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const studentId = studentRows[0].id;

    const storage = getStorageProvider();
    let pfpUrl = null;
    let sigUrl = null;
    const uploadedPaths = [];

    if (updatedData.pfp) {
      // 1. Fetch old PFP to delete later
      const oldImg = await db.query.studentImages.findFirst({
        columns: { pfp: true },
        where: eq(studentImages.student_id, studentId)
      });

      pfpUrl = await storage.upload(updatedData.pfp, 'students/pfp', rollno);
      uploadedPaths.push(pfpUrl);
      
      // Cleanup old PFP
      if (oldImg?.pfp) {
        await storage.delete(oldImg.pfp);
      }
    }
    if (updatedData.signature) {
      // 1. Fetch old signature to delete later
      const oldSig = await db.query.studentSignatures.findFirst({
        columns: { signature: true },
        where: eq(studentSignatures.student_id, studentId)
      });

      sigUrl = await storage.upload(updatedData.signature, 'students/signatures', `${rollno}-sig`);
      uploadedPaths.push(sigUrl);

      // Cleanup old signature
      if (oldSig?.signature) {
        await storage.delete(oldSig.signature);
      }
    }

    try {
      await db.transaction(async (tx) => {
        // 1. Update Core Students
        const studentUpdate = {};
        if (updatedData.name !== undefined) studentUpdate.name = toNull(updatedData.name);
        if (updatedData.admission_no !== undefined) studentUpdate.admission_no = toNull(updatedData.admission_no);
        if (updatedData.admission_date !== undefined) studentUpdate.admission_date = toMySQLDate(updatedData.admission_date) ? new Date(toMySQLDate(updatedData.admission_date)) : null;
        if (updatedData.academic_status !== undefined) studentUpdate.academic_status = toNull(String(updatedData.academic_status).trim().toUpperCase());
        if (updatedData.academic_offset_years !== undefined) studentUpdate.academic_offset_years = parseInt(updatedData.academic_offset_years) || 0;
        if (updatedData.fee_reimbursement !== undefined) studentUpdate.fee_reimbursement = toNull(String(updatedData.fee_reimbursement).trim().toUpperCase());
        if (updatedData.date_of_birth !== undefined) studentUpdate.date_of_birth = toMySQLDate(updatedData.date_of_birth) ? new Date(toMySQLDate(updatedData.date_of_birth)) : null;
        if (updatedData.gender !== undefined) studentUpdate.gender = toNull(updatedData.gender);
        
        if (updatedData.mobile !== undefined) {
            const val = toNull(updatedData.mobile);
            const normalizedMobile = val ? String(val).replace(/\D/g, '') : null;
            studentUpdate.mobile = normalizedMobile ? encrypt(normalizedMobile) : null;
            studentUpdate.mobile_hash = normalizedMobile ? hashForIndex(normalizedMobile) : null;
        }
        
        if (updatedData.email !== undefined) studentUpdate.email = toNull(updatedData.email);

        if (Object.keys(studentUpdate).length > 0) {
          await tx.update(studentsTable)
            .set({ ...studentUpdate, updated_at: new Date(), updated_by_clerk_id: clerkId })
            .where(eq(studentsTable.id, studentId));
        } else {
          // Just audit update if other tables change
          await tx.update(studentsTable)
            .set({ updated_at: new Date(), updated_by_clerk_id: clerkId })
            .where(eq(studentsTable.id, studentId));
        }

        // 2. Update Personal Details
        const personalFields = ['father_name', 'mother_name', 'nationality', 'religion', 'category', 'sub_caste', 'area_status', 'mother_tongue', 'place_of_birth', 'father_occupation', 'annual_income', 'guardian_mobile', 'aadhaar_no', 'address', 'seat_allotted_category', 'identification_marks', 'blood_group'];
        const personalUpdate = {};
        personalFields.forEach(col => {
          if (updatedData[col] !== undefined) {
            let val = toNull(updatedData[col]);
            
            if (col === 'aadhaar_no' && val !== null) {
              val = String(val).replace(/\D/g, '');
              personalUpdate.aadhaar_no = encrypt(val);
              personalUpdate.aadhaar_hash = hashForIndex(val);
            } else if (col === 'guardian_mobile' && val !== null) {
              personalUpdate.guardian_mobile = encrypt(val);
            } else {
              personalUpdate[col] = val;
            }
          }
        });

        if (Object.keys(personalUpdate).length > 0) {
          await tx.insert(studentPersonalDetails)
            .values({ student_id: studentId, ...personalUpdate })
            .onDuplicateKeyUpdate({ set: personalUpdate });
        }

        // 3. Update Academic Background
        const academicFields = ['qualifying_exam', 'previous_college_details', 'medium_of_instruction', 'ranks', 'ssc_marks', 'inter_marks'];
        const academicUpdate = {};
        academicFields.forEach(col => {
          if (updatedData[col] !== undefined) academicUpdate[col] = toNull(updatedData[col]);
        });

        if (Object.keys(academicUpdate).length > 0) {
          await tx.insert(studentAcademicBackground)
            .values({ student_id: studentId, ...academicUpdate })
            .onDuplicateKeyUpdate({ set: academicUpdate });
        }

        // 4. Update Images
        if (pfpUrl) {
          await tx.insert(studentImages)
            .values({ student_id: studentId, pfp: pfpUrl })
            .onDuplicateKeyUpdate({ set: { pfp: pfpUrl } });
        }
        if (sigUrl) {
          await tx.insert(studentSignatures)
            .values({ student_id: studentId, signature: sigUrl })
            .onDuplicateKeyUpdate({ set: { signature: sigUrl } });
        }
      });
    } catch (e) {
      for (const path of uploadedPaths) {
        try { await storage.delete(path); }
        catch (delErr) { logger.error({ err: delErr, path }, 'Orphaned student update asset cleanup failed'); }
      }
      throw e;
    }

    return apiResponse({ success: true, message: 'Student details updated successfully' });
  } catch (error) {
    logger.error(error, 'Error updating student details for clerk');
    return apiError('Failed to update student details', 500, error.message);
  }
}
