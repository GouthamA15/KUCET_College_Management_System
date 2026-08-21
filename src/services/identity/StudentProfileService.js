import { db } from '@/db';
import { 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground, 
  studentImages, 
  studentSignatures 
} from '@/db/schema';
import { eq, or, like } from 'drizzle-orm';
import { encrypt, decrypt, hashForIndex } from '@/lib/encryption';
import { getPermanentAddressFromDetails, getContactAddressFromDetails, mapAddressStringsToFields } from '@/lib/address-utils';

/**
 * Domain Service for Student Profile and Registry operations
 */
export class StudentProfileService {
  /**
   * Helper to normalize roll number
   */
  static normalizeRollNo(val) {
    if (!val) return '';
    return String(val).trim().toUpperCase();
  }

  /**
   * Helper to normalize mobile
   */
  static normalizeMobile(val) {
    if (!val) return '';
    return String(val).replace(/\D/g, '');
  }

  /**
   * Helper to normalize Aadhaar
   */
  static normalizeAadhaar(val) {
    if (!val) return '';
    return String(val).replace(/\D/g, '');
  }

  /**
   * Fetch full student registry data for export or admin review
   */
  static async getFullStudentDataForExport(year, branch) {
    if (!year || !branch) {
      throw new Error('Year and branch are required');
    }

    const startYear = year.split('-')[0];
    const startYearInt = parseInt(startYear, 10);
    const regularYearShort = String(startYearInt).slice(-2);
    const lateralYearShort = String(startYearInt + 1).slice(-2);
    
    const regularRollPattern = `${regularYearShort}567T${branch}%`;
    const lateralRollPattern = `${lateralYearShort}567${branch}%L`;

    const results = await db.select({
      admission_no: studentsTable.admission_no,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      date_of_birth: studentsTable.date_of_birth,
      gender: studentsTable.gender,
      email: studentsTable.email,
      mobile: studentsTable.mobile,
      fee_reimbursement: studentsTable.fee_reimbursement,
      father_name: studentPersonalDetails.father_name,
      mother_name: studentPersonalDetails.mother_name,
      nationality: studentPersonalDetails.nationality,
      religion: studentPersonalDetails.religion,
      category: studentPersonalDetails.category,
      sub_caste: studentPersonalDetails.sub_caste,
      mother_tongue: studentPersonalDetails.mother_tongue,
      place_of_birth: studentPersonalDetails.place_of_birth,
      area_status: studentPersonalDetails.area_status,
      father_occupation: studentPersonalDetails.father_occupation,
      identification_marks: studentPersonalDetails.identification_marks,
      annual_income: studentPersonalDetails.annual_income,
      aadhaar_no: studentPersonalDetails.aadhaar_no,
      guardian_mobile: studentPersonalDetails.guardian_mobile,
      perm_house_no: studentPersonalDetails.perm_house_no,
      perm_street: studentPersonalDetails.perm_street,
      perm_apartment: studentPersonalDetails.perm_apartment,
      perm_city: studentPersonalDetails.perm_city,
      perm_state: studentPersonalDetails.perm_state,
      perm_pincode: studentPersonalDetails.perm_pincode,
      perm_country: studentPersonalDetails.perm_country,
      curr_house_no: studentPersonalDetails.curr_house_no,
      curr_street: studentPersonalDetails.curr_street,
      curr_apartment: studentPersonalDetails.curr_apartment,
      curr_city: studentPersonalDetails.curr_city,
      curr_state: studentPersonalDetails.curr_state,
      curr_pincode: studentPersonalDetails.curr_pincode,
      curr_country: studentPersonalDetails.curr_country,
      seat_allotted_category: studentPersonalDetails.seat_allotted_category,
      blood_group: studentPersonalDetails.blood_group,
      qualifying_exam: studentAcademicBackground.qualifying_exam,
      ssc_marks: studentAcademicBackground.ssc_marks,
      inter_marks: studentAcademicBackground.inter_marks,
      entrance_exam_rank: studentAcademicBackground.ranks,
      previous_college: studentAcademicBackground.previous_college_details,
      photo: studentImages.pfp,
      signature: studentSignatures.signature
    })
    .from(studentsTable)
    .leftJoin(studentPersonalDetails, eq(studentsTable.id, studentPersonalDetails.student_id))
    .leftJoin(studentAcademicBackground, eq(studentsTable.id, studentAcademicBackground.student_id))
    .leftJoin(studentImages, eq(studentsTable.id, studentImages.student_id))
    .leftJoin(studentSignatures, eq(studentsTable.id, studentSignatures.student_id))
    .where(or(
      like(studentsTable.roll_no, regularRollPattern),
      like(studentsTable.roll_no, lateralRollPattern)
    ));

    const uniqueResultsMap = new Map();
    for (const row of results) {
      if (!uniqueResultsMap.has(row.roll_no)) {
        uniqueResultsMap.set(row.roll_no, row);
      }
    }
    const uniqueResults = Array.from(uniqueResultsMap.values());

    return uniqueResults.map(row => ({
      ...row,
      mobile: row.mobile ? decrypt(row.mobile) : null,
      aadhaar_no: row.aadhaar_no ? decrypt(row.aadhaar_no) : null,
      guardian_mobile: row.guardian_mobile ? decrypt(row.guardian_mobile) : null,
      permanent_address: getPermanentAddressFromDetails(row),
      contact_address: getContactAddressFromDetails(row)
    }));
  }

  /**
   * Upsert a student record with all related details (personal, academic, images)
   */
  static async upsertStudent(data, clerkId, tx = null) {
    const {
      admission_no, roll_no, name, date_of_birth, gender, email, mobile,
      father_name, mother_name, nationality, religion, category, sub_caste,
      area_status, mother_tongue, place_of_birth, father_occupation, annual_income,
      guardian_mobile, aadhaar_no, address, contact_address, permanent_address, seat_allotted_category, blood_group,
      identification_marks, qualifying_exam, previous_college_details,
      medium_of_instruction, ranks, ssc_marks, inter_marks, fee_reimbursement,
      pfp, signature, admission_date
    } = data;

    const roll = this.normalizeRollNo(roll_no);
    if (!roll || !name) throw new Error('MISSING_REQUIRED_FIELDS');

    const normMobile = this.normalizeMobile(mobile);
    const normGuardianMobile = this.normalizeMobile(guardian_mobile);
    const normAadhaar = this.normalizeAadhaar(aadhaar_no);

    let addressFields = {};
    if (data.perm_house_no !== undefined || data.curr_house_no !== undefined) {
      addressFields = {
        perm_house_no: data.perm_house_no || null,
        perm_street: data.perm_street || null,
        perm_apartment: data.perm_apartment || null,
        perm_city: data.perm_city || null,
        perm_state: data.perm_state || null,
        perm_pincode: data.perm_pincode || null,
        perm_country: data.perm_country || 'India',

        curr_house_no: data.curr_house_no || null,
        curr_street: data.curr_street || null,
        curr_apartment: data.curr_apartment || null,
        curr_city: data.curr_city || null,
        curr_state: data.curr_state || null,
        curr_pincode: data.curr_pincode || null,
        curr_country: data.curr_country || 'India',

        is_current_same_as_permanent: !!data.is_current_same_as_permanent
      };
    } else {
      const finalPermAddr = permanent_address || address || '';
      const finalContactAddr = contact_address || finalPermAddr || '';
      addressFields = mapAddressStringsToFields(finalContactAddr, finalPermAddr);
    }

    const normalizeToMySQLDate = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const studentValues = {
      admission_no: admission_no || null,
      roll_no: roll,
      name,
      date_of_birth: normalizeToMySQLDate(date_of_birth),
      gender: gender || null,
      email: email ? String(email).toLowerCase() : null,
      mobile: normMobile ? encrypt(normMobile) : null,
      mobile_hash: normMobile ? hashForIndex(normMobile) : null,
      fee_reimbursement: ['YES', 'NO', 'GOV'].includes(String(fee_reimbursement).toUpperCase()) 
        ? String(fee_reimbursement).toUpperCase() 
        : 'NO',
      admission_date: normalizeToMySQLDate(admission_date) || normalizeToMySQLDate(new Date())
    };

    const personalValues = {
      father_name: father_name || null,
      mother_name: mother_name || null,
      nationality: nationality || 'Indian',
      religion: religion || null,
      category: category || null,
      sub_caste: sub_caste || null,
      area_status: area_status || 'Local',
      mother_tongue: mother_tongue || null,
      place_of_birth: place_of_birth || null,
      father_occupation: father_occupation || null,
      annual_income: annual_income || null,
      guardian_mobile: normGuardianMobile ? encrypt(normGuardianMobile) : null,
      aadhaar_no: normAadhaar ? encrypt(normAadhaar) : null,
      aadhaar_hash: normAadhaar ? hashForIndex(normAadhaar) : null,
      ...addressFields,
      seat_allotted_category: seat_allotted_category || null,
      blood_group: blood_group || null,
      identification_marks: identification_marks || null
    };

    const academicValues = {
      qualifying_exam: qualifying_exam || null,
      previous_college_details: previous_college_details || null,
      medium_of_instruction: medium_of_instruction || null,
      ranks: ranks ? parseInt(ranks) : null,
      ssc_marks: ssc_marks || null,
      inter_marks: inter_marks || null
    };

    const executeUpsert = async (innerTx) => {
      // 1. Upsert Student
      await innerTx.insert(studentsTable)
        .values({ ...studentValues, added_by_staff_id: clerkId })
        .onDuplicateKeyUpdate({ set: studentValues });

      const existing = await innerTx.select({ id: studentsTable.id })
        .from(studentsTable).where(eq(studentsTable.roll_no, roll)).limit(1);
      
      let studentId = existing[0]?.id;
      if (!studentId) throw new Error('STUDENT_ID_GENERATION_FAILED');

      // 2. Upsert Personal Details
      await innerTx.insert(studentPersonalDetails)
        .values({ student_id: studentId, ...personalValues })
        .onDuplicateKeyUpdate({ set: personalValues });

      // 3. Upsert Academic Background
      await innerTx.insert(studentAcademicBackground)
        .values({ student_id: studentId, ...academicValues })
        .onDuplicateKeyUpdate({ set: academicValues });

      // 4. Promote temporary media assets (from admission drafts/requests) into permanent student storage
      if (pfp || signature) {
        const { MediaPromotionService } = await import('@/services/storage/MediaPromotionService');
        await MediaPromotionService.promoteAdmissionMedia(
          { studentId, pfp: pfp || null, signature: signature || null },
          innerTx
        );
      }

      return studentId;
    };

    if (tx) {
      return await executeUpsert(tx);
    } else {
      return await db.transaction(executeUpsert);
    }
  }
}
