import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  students as studentsTable, 
  studentAcademicBackground,
  studentPersonalDetails,
  studentImages,
  studentSignatures,
  auditLogs 
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { decrypt } from '@/lib/encryption';
import { 
  deriveCollegeAdmissionNo, 
  getPortalImageFilenames, 
  formatAdmissionDate, 
  mapBranchToPortal, 
  mapPreviousStudy,
  mapIncomeRangeToPortal,
  parseDateOfBirth,
  mapBloodGroupToPortal,
  mapGenderToPortal,
  mapLocationToPortal,
  mapNationalityToPortal,
  mapSocialStatusToPortal,
  formatStudentCurrentAddress
} from '@/lib/admission-bridge/derivation';
import { ADMISSION_BRIDGE_CONFIG } from '@/lib/admission-bridge/config';

/**
 * GET /api/staff/admission/bridge/students/[rollno]
 * 
 * Secure, authenticated endpoint providing minimized academic & primary registration details
 * for the KUCET Admission Bridge Chrome Extension.
 * 
 * Zero-Trust & Data Minimization:
 * - Requires active 'admission' or 'admin' staff identity.
 * - Strictly omits APAAR ID, fee/scholarship balances, and student email (per KU Online integration rules).
 * - Only approved Primary Details (Aadhaar & Contact Number) are included for authorized staff.
 * - Records a non-PII audit event for every student access.
 */
export async function GET(req, context) {
  const user = await getAuthUser('staff');
  if (!user) {
    return apiError('Unauthorized: Active staff authentication required', 401);
  }

  const userRole = (user.role || '').toLowerCase();
  const allowedRoles = ['admission', 'admission_clerk', 'admin', 'super_admin'];
  if (!allowedRoles.includes(userRole)) {
    return apiError('Forbidden: Only admission staff and administrators may access the admission bridge', 403);
  }

  try {
    const params = await context.params;
    const { rollno } = params;

    if (!rollno || typeof rollno !== 'string') {
      return apiError('Missing or invalid roll number parameter', 400);
    }

    const cleanRoll = rollno.trim().toUpperCase();

    // 1. Authoritative Derivation & Roll Number Validation
    const derivation = deriveCollegeAdmissionNo(cleanRoll);
    if (!derivation.isValid) {
      return apiError(derivation.error || 'Invalid KUCET roll number format', 400);
    }

    // 2. Query Student Record with Minimal Joins
    const rows = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      admission_no: studentsTable.admission_no,
      admission_date: studentsTable.admission_date,
      student_status: studentsTable.student_status,
      date_of_birth: studentsTable.date_of_birth,
      gender: studentsTable.gender,
      mobile: studentsTable.mobile,
      qualifying_exam: studentAcademicBackground.qualifying_exam,
      pfp: studentImages.pfp,
      signature: studentSignatures.signature,
      // Personal Details for Phase 2 Primary Details
      father_name: studentPersonalDetails.father_name,
      mother_name: studentPersonalDetails.mother_name,
      nationality: studentPersonalDetails.nationality,
      religion: studentPersonalDetails.religion,
      category: studentPersonalDetails.category,
      sub_caste: studentPersonalDetails.sub_caste,
      area_status: studentPersonalDetails.area_status,
      mother_tongue: studentPersonalDetails.mother_tongue,
      place_of_birth: studentPersonalDetails.place_of_birth,
      father_occupation: studentPersonalDetails.father_occupation,
      guardian_mobile: studentPersonalDetails.guardian_mobile,
      annual_income: studentPersonalDetails.annual_income,
      aadhaar_no: studentPersonalDetails.aadhaar_no,
      curr_house_no: studentPersonalDetails.curr_house_no,
      curr_street: studentPersonalDetails.curr_street,
      curr_apartment: studentPersonalDetails.curr_apartment,
      curr_city: studentPersonalDetails.curr_city,
      curr_state: studentPersonalDetails.curr_state,
      curr_pincode: studentPersonalDetails.curr_pincode,
      curr_country: studentPersonalDetails.curr_country,
      perm_house_no: studentPersonalDetails.perm_house_no,
      perm_street: studentPersonalDetails.perm_street,
      perm_apartment: studentPersonalDetails.perm_apartment,
      perm_city: studentPersonalDetails.perm_city,
      perm_state: studentPersonalDetails.perm_state,
      perm_pincode: studentPersonalDetails.perm_pincode,
      perm_country: studentPersonalDetails.perm_country,
      blood_group: studentPersonalDetails.blood_group,
    })
    .from(studentsTable)
    .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id))
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
    .leftJoin(studentSignatures, eq(studentsTable.id, studentSignatures.student_id))
    .where(eq(studentsTable.roll_no, cleanRoll))
    .limit(1);

    if (rows.length === 0) {
      return apiError(`Student with roll number "${cleanRoll}" not found in KUCET CMS`, 404);
    }

    const student = rows[0];

    // Verify student is active for institutional processing
    if (student.student_status === 'DISCONTINUED') {
      return apiError(`Student "${cleanRoll}" is marked as DISCONTINUED in KUCET CMS`, 400);
    }

    // 3. Resolve College Admission Number
    const admissionNo = student.admission_no && student.admission_no.trim() !== ''
      ? student.admission_no.trim().toUpperCase()
      : derivation.admissionNo;

    // 4. Generate Portal Image Filenames
    const imageFilenames = getPortalImageFilenames(admissionNo);

    // 5. Map Branch to KU Online Portal Label
    const branchMapping = mapBranchToPortal(derivation.branch);

    // 6. Map Previous Study Option
    const previousStudyMapping = mapPreviousStudy(student.qualifying_exam, derivation.admissionType);

    // 7. Format Individual Admission Date
    const formattedDate = formatAdmissionDate(student.admission_date);

    // 8. Phase 2: Decrypt & Format Primary Details
    let cleanAadhaar = null;
    if (student.aadhaar_no) {
      try {
        const decrypted = decrypt(student.aadhaar_no);
        cleanAadhaar = decrypted ? String(decrypted).replace(/\D/g, '') : null;
      } catch (err) {
        logger.warn({ err: err.message }, '[AdmissionBridge] Aadhaar decryption failed');
      }
    }

    let cleanContact = null;
    const rawMobile = student.mobile || student.guardian_mobile;
    if (rawMobile) {
      try {
        const decryptedMob = decrypt(rawMobile);
        cleanContact = decryptedMob ? String(decryptedMob).replace(/\D/g, '').slice(-10) : null;
      } catch (err) {
        logger.warn({ err: err.message }, '[AdmissionBridge] Mobile decryption failed');
      }
    }

    const parsedDob = parseDateOfBirth(student.date_of_birth);
    const mappedBloodGroup = mapBloodGroupToPortal(student.blood_group);
    const mappedGender = mapGenderToPortal(student.gender);
    const mappedLocation = mapLocationToPortal(student.area_status);
    const mappedNationality = mapNationalityToPortal(student.nationality);
    const mappedSocialStatus = mapSocialStatusToPortal(student.category);
    const mappedIncome = mapIncomeRangeToPortal(student.annual_income);
    const currentAddress = formatStudentCurrentAddress(student);

    // 9. Compile Warnings
    const warnings = [];
    if (!student.admission_date) {
      warnings.push({
        field: 'admissionDate',
        code: 'MISSING_ADMISSION_DATE',
        message: 'Student has no admission date on record in CMS. Please verify and fill manually.',
      });
    }
    if (!student.pfp) {
      warnings.push({
        field: 'photo',
        code: 'MISSING_PHOTO',
        message: 'Student photograph is not uploaded in KUCET CMS.',
      });
    }
    if (!student.signature) {
      warnings.push({
        field: 'signature',
        code: 'MISSING_SIGNATURE',
        message: 'Student signature is not uploaded in KUCET CMS.',
      });
    }
    if (previousStudyMapping.confidence === 'NEEDS_CONFIRMATION') {
      warnings.push({
        field: 'previousStudying',
        code: 'PREVIOUS_STUDY_REVIEW_REQUIRED',
        message: `Qualifying education "${student.qualifying_exam || 'Unspecified'}" mapped to "${previousStudyMapping.previousStudy}". Please verify with student certificates.`,
      });
    }
    if (!parsedDob.isValid) {
      warnings.push({
        field: 'dateOfBirth',
        code: 'MISSING_OR_INVALID_DOB',
        message: 'Student date of birth is missing or invalid in CMS record.',
      });
    }
    if (!cleanAadhaar) {
      warnings.push({
        field: 'aadhaarNumber',
        code: 'MISSING_AADHAAR',
        message: 'Student Aadhaar number is missing or could not be decrypted.',
      });
    }
    if (!cleanContact) {
      warnings.push({
        field: 'contactNumber',
        code: 'MISSING_CONTACT_NUMBER',
        message: 'Student contact number is missing or could not be decrypted.',
      });
    }
    if (!student.father_name) {
      warnings.push({
        field: 'fatherName',
        code: 'MISSING_FATHER_NAME',
        message: "Father's/Guardian name is missing in CMS record.",
      });
    }
    if (!student.mother_name) {
      warnings.push({
        field: 'motherName',
        code: 'MISSING_MOTHER_NAME',
        message: 'Mother name is missing in CMS record.',
      });
    }
    if (!currentAddress) {
      warnings.push({
        field: 'address',
        code: 'MISSING_ADDRESS',
        message: 'Current address is missing in CMS record.',
      });
    }
    if (mappedIncome.warning) {
      warnings.push({
        field: 'income',
        code: 'INCOME_MAPPING_WARNING',
        message: mappedIncome.warning,
      });
    }

    // 10. Write Non-PII Security Audit Log (Never log Aadhaar or phone numbers)
    try {
      const staffId = user.staffId || user.id || null;
      await db.insert(auditLogs).values({
        action: 'ADMISSION_BRIDGE_STUDENT_ACCESSED',
        user_id: staffId ? Number(staffId) : null,
        user_type: userRole.includes('admin') ? 'admin' : 'staff',
        target_id: String(student.id),
        target_type: 'students',
        payload_after: {
          roll_no: cleanRoll,
          admission_no: admissionNo,
          admission_type: derivation.admissionType,
          portal_branch: branchMapping.portalOption,
        },
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
      });
    } catch (auditErr) {
      logger.warn({ err: auditErr.message, rollNo: cleanRoll }, '[AdmissionBridge] Audit log insertion skipped');
    }

    // 11. Return Minimized Registration Payload with Primary Details
    return apiResponse({
      rollNo: cleanRoll,
      name: student.name,
      admissionNo,
      admissionType: derivation.admissionType,
      course: ADMISSION_BRIDGE_CONFIG.DEFAULT_COURSE, // 'B.TECH'
      year: ADMISSION_BRIDGE_CONFIG.DEFAULT_YEAR, // '1'
      collegeCode: ADMISSION_BRIDGE_CONFIG.COLLEGE_CODE, // '567'
      collegeBriefCode: ADMISSION_BRIDGE_CONFIG.COLLEGE_BRIEF_CODE, // 'UC,KU,WGL'
      collegeName: ADMISSION_BRIDGE_CONFIG.COLLEGE_NAME,
      cmsBranch: derivation.branch,
      portalBranch: branchMapping.portalOption,
      scheme: ADMISSION_BRIDGE_CONFIG.DEFAULT_SCHEME, // Confirmed: '2013'
      previousStudying: previousStudyMapping.previousStudy,
      previousStudyConfidence: previousStudyMapping.confidence,
      admissionDate: student.admission_date ? String(student.admission_date).split('T')[0] : null,
      formattedAdmissionDate: formattedDate,
      hallTicketNumber: cleanRoll,
      photo: {
        available: !!student.pfp,
        downloadUrl: student.pfp ? `/api/staff/admission/bridge/students/${cleanRoll}/photo` : null,
        expectedFilename: imageFilenames.photoFilename,
        portalRequirement: '< 250 KB JPEG',
      },
      signature: {
        available: !!student.signature,
        downloadUrl: student.signature ? `/api/staff/admission/bridge/students/${cleanRoll}/signature` : null,
        expectedFilename: imageFilenames.signatureFilename,
        portalRequirement: '< 250 KB JPEG',
      },
      // Phase 2: Primary Details (Email ID is explicitly excluded)
      primaryDetails: {
        fullName: student.name,
        fatherName: student.father_name || null,
        motherName: student.mother_name || null,
        dateOfBirth: parsedDob.isValid ? parsedDob.formatted : null,
        dobComponents: parsedDob.isValid ? {
          day: parsedDob.day,
          dayPadded: parsedDob.dayPadded,
          month: parsedDob.month,
          monthPadded: parsedDob.monthPadded,
          monthName: parsedDob.monthName,
          monthShort: parsedDob.monthShort,
          year: parsedDob.year,
        } : null,
        placeOfBirth: student.place_of_birth || null,
        bloodGroup: mappedBloodGroup.portalOption,
        gender: mappedGender.portalOption,
        location: mappedLocation.portalOption,
        currentAddress: currentAddress,
        useSameAddressForPermanent: true, // Confirmed institutional rule
        aadhaarNumber: cleanAadhaar,
        contactNumber: cleanContact,
        nationality: mappedNationality.portalOption,
        religion: student.religion || null,
        motherTongue: student.mother_tongue || null,
        socialStatus: mappedSocialStatus.portalOption,
        subCaste: student.sub_caste || null,
        fatherOccupation: student.father_occupation || null,
        incomeRange: student.annual_income || null,
        portalIncome: mappedIncome.portalValue,
        incomeStatus: mappedIncome.status,
      },
      warnings,
    });

  } catch (error) {
    logger.error({ err: error.message, stack: error.stack }, 'Error in Admission Bridge Student API');
    return apiError('Failed to retrieve student admission bridge record', 500, error.message);
  }
}
