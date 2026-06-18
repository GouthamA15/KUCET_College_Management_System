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

      // 2. Update Personal Details
      const personalFields = [
        'father_name', 'mother_name', 'nationality', 'religion', 'category', 'sub_caste', 'area_status', 'mother_tongue', 'place_of_birth', 'father_occupation', 'annual_income', 'guardian_mobile', 'aadhaar_no', 'seat_allotted_category', 'identification_marks', 'blood_group',
        'perm_house_no', 'perm_street', 'perm_apartment', 'perm_city', 'perm_state', 'perm_pincode', 'perm_country',
        'curr_house_no', 'curr_street', 'curr_apartment', 'curr_city', 'curr_state', 'curr_pincode', 'curr_country',
        'is_current_same_as_permanent'
      ];
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
          } else if (col === 'is_current_same_as_permanent') {
            personalUpdate.is_current_same_as_permanent = val === null ? null : !!val;
          } else {
            personalUpdate[col] = val;
          }
        }

      // Handle address mapping
      if (updatedData.contact_address !== undefined || updatedData.permanent_address !== undefined || updatedData.address !== undefined) {
        const existingSPD = await tx.query.studentPersonalDetails.findFirst({ where: eq(studentPersonalDetails.student_id, studentId) });
        const { getPermanentAddressFromDetails, getContactAddressFromDetails, mapAddressStringsToFields } = require('@/lib/address-utils');
        
        const existingPerm = getPermanentAddressFromDetails(existingSPD);
        const existingContact = getContactAddressFromDetails(existingSPD);

        const finalPerm = updatedData.permanent_address !== undefined ? updatedData.permanent_address : (updatedData.address !== undefined ? updatedData.address : existingPerm);
        const finalContact = updatedData.contact_address !== undefined ? updatedData.contact_address : existingContact;

        const addressFields = mapAddressStringsToFields(finalContact, finalPerm);
        Object.assign(personalUpdate, addressFields);
      }

      if (Object.keys(personalUpdate).length > 0) {
        const existing = await tx.select({ id: studentPersonalDetails.id })
          .from(studentPersonalDetails)
          .where(eq(studentPersonalDetails.student_id, studentId))
          .limit(1);

        if (existing.length > 0) {
          await tx.update(studentPersonalDetails)
            .set(personalUpdate)
            .where(eq(studentPersonalDetails.student_id, studentId));
        } else {
          await tx.insert(studentPersonalDetails)
            .values({ student_id: studentId, ...personalUpdate });
        }
      }

        if (Object.keys(personalUpdate).length > 0) {
          await tx.insert(studentPersonalDetails)
            .values({ student_id: studentId, ...personalUpdate })
            .onDuplicateKeyUpdate({ set: personalUpdate });
        }

      if (Object.keys(academicUpdate).length > 0) {
        const existing = await tx.select({ id: studentAcademicBackground.id })
          .from(studentAcademicBackground)
          .where(eq(studentAcademicBackground.student_id, studentId))
          .limit(1);

        if (existing.length > 0) {
          await tx.update(studentAcademicBackground)
            .set(academicUpdate)
            .where(eq(studentAcademicBackground.student_id, studentId));
        } else {
          await tx.insert(studentAcademicBackground)
            .values({ student_id: studentId, ...academicUpdate });
        }
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
