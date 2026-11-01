import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground,
  studentImages,
  studentSignatures,
  auditLogs
} from '@/db/schema';
import { eq, _sql } from 'drizzle-orm';
import { toMySQLDate } from '@/lib/date';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { COLLEGE_CONFIG, normalizeAreaStatus } from '@/lib/college-config';
import { storage } from '@/lib/providers';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { StudentService } from '@/services/StudentService';

const toNull = (value) => (value === undefined || value === '' ? null : value);

/**
 * GET /api/staff/admission/students/[rollno]
 * Fetch full student profile for admission staff
 */
export async function GET(req, context) {
  const user = await getAuthUser('staff');
  if (!user) {
    return apiError('Unauthorized', 401);
  }
  const userRole = (user.role || '').toLowerCase();
  const isAuthorized = [
    'admin', 'super_admin', 'principal',
    'admission', 'admission_clerk',
    'scholarship', 'scholarship_clerk'
  ].includes(userRole) || user.is_first_year_coordinator || user.is_hod || user.isHod;

  if (!isAuthorized) {
    return apiError('Forbidden: Insufficient permissions to view student profile', 403);
  }

  try {
    const params = await context.params;
    let { rollno } = params;
    if (!rollno) return apiError('Missing rollno parameter', 400);

    const profile = await StudentService.getStudentProfile(rollno);
    if (!profile) return apiError('Student not found', 404);

    return apiResponse(profile);
  } catch (error) {
    logger.error(error, 'Error fetching student profile for staff');
    return apiError('Failed to fetch student details', 500, error.message);
  }
}

/**
 * PUT /api/staff/admission/students/[rollno]
 * Update student details and APAAR ID corrections by authorized admission/scholarship staff
 */
export async function PUT(req, context) {
  const user = await getAuthUser('staff');
  if (!user) {
    return apiError('Unauthorized', 401);
  }
  const userRole = (user.role || '').toLowerCase();
  const allowedRoles = ['admission', 'admission_clerk', 'scholarship', 'scholarship_clerk', 'admin', 'super_admin'];
  if (!allowedRoles.includes(userRole)) {
    return apiError('Forbidden: Only admission and scholarship staff can update student details and perform APAAR corrections', 403);
  }

  const staffId = user?.staffId || user?.id || null;
  if (!staffId) return apiError('Unauthorized: staff id missing in token', 401);

  try {
    const params = await context.params;
    let { rollno } = params;
    if (!rollno) return apiError('Missing rollno parameter', 400);

    // Normalize Roll Number
    rollno = StudentService.normalizeRollNo(rollno);

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
    if (updatedData.gender !== undefined) {
      const g = updatedData.gender == null ? null : String(updatedData.gender).trim().toUpperCase();
      if (g && !COLLEGE_CONFIG.genders.includes(g)) return apiError('Invalid gender value. Must be MALE or FEMALE', 400);
    }

    const studentRows = await db.select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.roll_no, rollno))
      .limit(1);
    if (studentRows.length === 0) return apiError('Student not found', 404);
    const studentId = studentRows[0].id;

    await db.transaction(async (tx) => {
      // 1. Update Core Students
      const studentUpdate = { /* empty */ };
      if (updatedData.name !== undefined) studentUpdate.name = toNull(updatedData.name ? String(updatedData.name).trim().toUpperCase() : null);
      if (updatedData.admission_no !== undefined) studentUpdate.admission_no = toNull(updatedData.admission_no);
      if (updatedData.admission_date !== undefined) studentUpdate.admission_date = toMySQLDate(updatedData.admission_date) ? new Date(toMySQLDate(updatedData.admission_date)) : null;
      if (updatedData.academic_status !== undefined) studentUpdate.academic_status = toNull(String(updatedData.academic_status).trim().toUpperCase());
      if (updatedData.academic_offset_years !== undefined) studentUpdate.academic_offset_years = parseInt(updatedData.academic_offset_years) || 0;
      if (updatedData.fee_reimbursement !== undefined) studentUpdate.fee_reimbursement = toNull(String(updatedData.fee_reimbursement).trim().toUpperCase());
      if (updatedData.date_of_birth !== undefined) studentUpdate.date_of_birth = toMySQLDate(updatedData.date_of_birth) ? new Date(toMySQLDate(updatedData.date_of_birth)) : null;
      if (updatedData.gender !== undefined) studentUpdate.gender = toNull(updatedData.gender ? String(updatedData.gender).trim().toUpperCase() : null);
      
      if (updatedData.mobile !== undefined) {
          const val = toNull(updatedData.mobile);
          const normalizedMobile = val ? String(val).replace(/\D/g, '') : null;
          studentUpdate.mobile = normalizedMobile ? encrypt(normalizedMobile) : null;
          studentUpdate.mobile_hash = normalizedMobile ? hashForIndex(normalizedMobile) : null;
      }
      
      if (Object.keys(studentUpdate).length > 0) {
        await tx.update(studentsTable)
          .set({ ...studentUpdate, updated_at: new Date(), updated_by_staff_id: staffId })
          .where(eq(studentsTable.id, studentId));
      } else {
        // Just audit update if other tables change
        await tx.update(studentsTable)
          .set({ updated_at: new Date(), updated_by_staff_id: staffId })
          .where(eq(studentsTable.id, studentId));
      }

      // 2. Update Personal Details
      const personalFields = [
        'father_name', 'mother_name', 'nationality', 'religion', 'category', 'sub_caste', 'area_status', 'mother_tongue', 'place_of_birth', 'father_occupation', 'annual_income', 'guardian_mobile', 'aadhaar_no', 'apaar_id', 'seat_allotted_category', 'identification_marks', 'blood_group',
        'perm_house_no', 'perm_street', 'perm_apartment', 'perm_city', 'perm_state', 'perm_pincode', 'perm_country',
        'curr_house_no', 'curr_street', 'curr_apartment', 'curr_city', 'curr_state', 'curr_pincode', 'curr_country',
        'is_current_same_as_permanent'
      ];
      const personalUpdate = { /* empty */ };
      for (const col of personalFields) {
        if (updatedData[col] !== undefined) {
          let val = toNull(updatedData[col]);
          
          if (col === 'aadhaar_no' && val !== null) {
            val = String(val).replace(/\D/g, '');
            personalUpdate.aadhaar_no = encrypt(val);
            personalUpdate.aadhaar_hash = hashForIndex(val);
          } else if (col === 'apaar_id') {
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              const clean = String(val).replace(/\s+/g, '');
              if (!/^\d{12}$/.test(clean)) {
                return apiError('Invalid APAAR ID. Must be exactly 12 numeric digits', 400);
              }
              personalUpdate.apaar_id = clean;
            } else {
              personalUpdate.apaar_id = null;
            }
          } else if (col === 'guardian_mobile' && val !== null) {
            personalUpdate.guardian_mobile = encrypt(val);
          } else if (col === 'is_current_same_as_permanent') {
            personalUpdate.is_current_same_as_permanent = val === null ? null : !!val;
          } else if (col === 'blood_group') {
            personalUpdate.blood_group = (val && ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(String(val).trim())) ? String(val).trim() : null;
          } else if (col === 'area_status') {
            if (val !== null && val !== undefined && val !== '') {
              const norm = normalizeAreaStatus(val);
              if (!norm) return apiError("Invalid area status. Must be 'Local' or 'Non-Local'", 400);
              personalUpdate.area_status = norm;
            } else {
              personalUpdate.area_status = null;
            }
          } else {
            personalUpdate[col] = val;
          }
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
        const existing = await tx.select({ 
          id: studentPersonalDetails.id,
          apaar_id: studentPersonalDetails.apaar_id
        })
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

        // Audit Trail for APAAR ID correction by staff
        if (personalUpdate.apaar_id !== undefined) {
          const oldApaar = existing[0]?.apaar_id || null;
          const newApaar = personalUpdate.apaar_id || null;
          if (oldApaar !== newApaar) {
            await tx.insert(auditLogs).values({
              user_id: staffId,
              user_type: userRole === 'admin' || userRole === 'super_admin' ? 'admin' : 'staff',
              action: 'APAAR_ID_CORRECTED',
              target_id: String(studentId),
              target_type: 'student',
              payload_before: { apaar_id: oldApaar, roll_no: rollno },
              payload_after: { 
                apaar_id: newApaar, 
                roll_no: rollno,
                correction_reason: updatedData.correction_reason || 'Staff administrative correction',
                corrected_by_role: userRole,
                timestamp: new Date().toISOString()
              },
              ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
              user_agent: req.headers.get('user-agent') || 'KUCET Staff Console'
            });
          }
        }
      }

      // 3. Update Academic Background
      const academicFields = ['qualifying_exam', 'previous_college_details', 'medium_of_instruction', 'ranks', 'ssc_marks', 'inter_marks'];
      const academicUpdate = { /* empty */ };
      academicFields.forEach(col => {
        if (updatedData[col] !== undefined) academicUpdate[col] = toNull(updatedData[col]);
      });

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
      const { STORAGE_FOLDERS } = await import('@/lib/storage-config');
      if (updatedData.pfp) {
        const res = await storage.upload(updatedData.pfp, STORAGE_FOLDERS.STUDENTS_PFP);
        const pfpUrl = typeof res === 'string' ? res : res?.path;
        await tx.insert(studentImages)
          .values({ student_id: studentId, pfp: pfpUrl })
          .onDuplicateKeyUpdate({ set: { pfp: pfpUrl } });
      }
      if (updatedData.signature) {
        const res = await storage.upload(updatedData.signature, STORAGE_FOLDERS.STUDENTS_SIGNATURES);
        const sigUrl = typeof res === 'string' ? res : res?.path;
        await tx.insert(studentSignatures)
          .values({ student_id: studentId, signature: sigUrl })
          .onDuplicateKeyUpdate({ set: { signature: sigUrl } });
      }
    });

    return apiResponse({ success: true, message: 'Student details updated successfully' });
  } catch (error) {
    logger.error(error, 'Error updating student details for staff');
    return apiError('Failed to update student details', 500, error.message);
  }
}
