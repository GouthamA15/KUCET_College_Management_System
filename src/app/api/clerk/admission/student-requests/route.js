import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentProfileRequests, 
  students as studentsTable, 
  studentPersonalDetails, 
  studentAcademicBackground, 
  studentSignatures, 
  studentImages 
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { decrypt, hashForIndex } from '@/lib/encryption';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const rows = await db.select({
      id: studentProfileRequests.id,
      student_id: studentProfileRequests.student_id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      new_signature: studentProfileRequests.new_signature,
      new_pfp: studentProfileRequests.new_pfp,
      new_data: studentProfileRequests.new_data,
      proof_url: studentProfileRequests.proof_url,
      old_signature: studentSignatures.signature,
      old_pfp: studentImages.pfp,
      current_email: studentsTable.email,
      current_mobile: studentsTable.mobile,
      current_father_name: studentPersonalDetails.father_name,
      current_mother_name: studentPersonalDetails.mother_name,
      current_nationality: studentPersonalDetails.nationality,
      current_religion: studentPersonalDetails.religion,
      current_category: studentPersonalDetails.category,
      current_sub_caste: studentPersonalDetails.sub_caste,
      current_area_status: studentPersonalDetails.area_status,
      current_mother_tongue: studentPersonalDetails.mother_tongue,
      current_place_of_birth: studentPersonalDetails.place_of_birth,
      current_father_occupation: studentPersonalDetails.father_occupation,
      current_guardian_mobile: studentPersonalDetails.guardian_mobile,
      current_annual_income: studentPersonalDetails.annual_income,
      current_aadhaar_no: studentPersonalDetails.aadhaar_no,
      current_address: studentPersonalDetails.address,
      current_seat_allotted_category: studentPersonalDetails.seat_allotted_category,
      current_identification_marks: studentPersonalDetails.identification_marks,
      current_blood_group: studentPersonalDetails.blood_group,
      current_qualifying_exam: studentAcademicBackground.qualifying_exam,
      current_previous_college_details: studentAcademicBackground.previous_college_details,
      current_medium_of_instruction: studentAcademicBackground.medium_of_instruction,
      current_ranks: studentAcademicBackground.ranks,
      current_ssc_marks: studentAcademicBackground.ssc_marks,
      current_inter_marks: studentAcademicBackground.inter_marks,
      created_at: studentProfileRequests.created_at
    })
    .from(studentProfileRequests)
    .innerJoin(studentsTable, eq(studentProfileRequests.student_id, studentsTable.id))
    .leftJoin(studentPersonalDetails, eq(studentProfileRequests.student_id, studentPersonalDetails.student_id))
    .leftJoin(studentAcademicBackground, eq(studentProfileRequests.student_id, studentAcademicBackground.student_id))
    .leftJoin(studentSignatures, eq(studentProfileRequests.student_id, studentSignatures.student_id))
    .leftJoin(studentImages, eq(studentProfileRequests.student_id, studentImages.student_id))
    .where(eq(studentProfileRequests.status, 'pending'))
    .orderBy(desc(studentProfileRequests.created_at));

    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    const data = rows.map(row => {
      const currentValues = {};
      Object.keys(row).forEach(key => {
        if (key.startsWith('current_')) {
          let val = row[key];
          // Decrypt current values
          if (val && (key === 'current_mobile' || key === 'current_guardian_mobile' || key === 'current_aadhaar_no')) {
              val = decrypt(val);
          }
          currentValues[key.replace('current_', '')] = val;
        }
      });

      // Decrypt new_data values
      let newData = row.new_data;
      if (newData) {
          const parsed = typeof newData === 'string' ? JSON.parse(newData) : newData;
          if (parsed.mobile) parsed.mobile = decrypt(parsed.mobile);
          if (parsed.guardian_mobile) parsed.guardian_mobile = decrypt(parsed.guardian_mobile);
          if (parsed.aadhaar_no) parsed.aadhaar_no = decrypt(parsed.aadhaar_no);
          newData = parsed;
      }

      return {
        id: row.id,
        student_id: row.student_id,
        roll_no: row.roll_no,
        name: row.name,
        new_signature: imageHelper(row.new_signature),
        new_pfp: imageHelper(row.new_pfp),
        new_data: newData,
        proof_url: imageHelper(row.proof_url),
        old_signature: imageHelper(row.old_signature),
        old_pfp: imageHelper(row.old_pfp),
        current_values: currentValues,
        created_at: row.created_at
      };
    });

    return apiResponse({ data });
  } catch (err) {
    logger.error(err, 'Clerk profile request fetch error');
    return apiError('Server error', 500, err.message);
  }
}

export async function PUT(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { requestId, action, rejectionReason } = body; 
    if (!requestId || !action) return apiError('Missing parameters', 400);

    const request = await db.query.studentProfileRequests.findFirst({
      where: and(eq(studentProfileRequests.id, requestId), eq(studentProfileRequests.status, 'pending'))
    });

    if (!request) return apiError('Request not found or already processed', 404);

    const { student_id, new_signature, new_pfp, new_data, proof_url } = request;

    if (action === 'approve') {
      await db.transaction(async (tx) => {
        // 1. Update Signature
        if (new_signature) {
          const oldSig = await tx.query.studentSignatures.findFirst({ where: eq(studentSignatures.student_id, student_id) });
          if (oldSig?.signature) await deleteFromCloudinary(oldSig.signature);
          await tx.insert(studentSignatures)
            .values({ student_id, signature: new_signature })
            .onDuplicateKeyUpdate({ set: { signature: new_signature } });
        }
        
        // 2. Update PFP
        if (new_pfp) {
          const oldPfp = await tx.query.studentImages.findFirst({ where: eq(studentImages.student_id, student_id) });
          if (oldPfp?.pfp) await deleteFromCloudinary(oldPfp.pfp);
          await tx.insert(studentImages)
            .values({ student_id, pfp: new_pfp })
            .onDuplicateKeyUpdate({ set: { pfp: new_pfp } });
        }

        // 3. Update Text Data
        if (new_data) {
          const data = typeof new_data === 'string' ? JSON.parse(new_data) : new_data;
          
          // Core Student Table Updates
          const studentSets = {};
          if (data.mobile) {
              studentSets.mobile = data.mobile; // Already encrypted in DB
              const plainMobile = decrypt(data.mobile);
              studentSets.mobile_hash = hashForIndex(plainMobile);
          }
          if (data.email) studentSets.email = data.email;
          if (data.name) studentSets.name = data.name;
          if (data.dob) studentSets.date_of_birth = new Date(data.dob);

          if (Object.keys(studentSets).length > 0) {
            await tx.update(studentsTable).set(studentSets).where(eq(studentsTable.id, student_id));
          }

          // Personal Details Updates
          const spd_fields = ['father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','guardian_mobile','annual_income','aadhaar_no','address','seat_allotted_category','identification_marks','blood_group'];
          const spd_data = {};
          spd_fields.forEach(f => { 
              if (data.hasOwnProperty(f)) {
                  spd_data[f] = data[f];
                  if (f === 'aadhaar_no' && data[f]) {
                      const plainAadhaar = decrypt(data[f]);
                      spd_data['aadhaar_hash'] = hashForIndex(plainAadhaar);
                  }
              }
          });
          
          if (Object.keys(spd_data).length > 0) {
            const existingSPD = await tx.query.studentPersonalDetails.findFirst({ where: eq(studentPersonalDetails.student_id, student_id) });
            if (existingSPD) {
                await tx.update(studentPersonalDetails).set(spd_data).where(eq(studentPersonalDetails.student_id, student_id));
            } else {
                await tx.insert(studentPersonalDetails).values({ student_id, ...spd_data });
            }
          }

          // Academic Background Updates
          const sab_fields = ['qualifying_exam','previous_college_details','medium_of_instruction','ranks','ssc_marks','inter_marks'];
          const sab_data = {};
          sab_fields.forEach(f => { if (data.hasOwnProperty(f)) sab_data[f] = data[f]; });
          
          if (Object.keys(sab_data).length > 0) {
            const existingSAB = await tx.query.studentAcademicBackground.findFirst({ where: eq(studentAcademicBackground.student_id, student_id) });
            if (existingSAB) {
                await tx.update(studentAcademicBackground).set(sab_data).where(eq(studentAcademicBackground.student_id, student_id));
            } else {
                await tx.insert(studentAcademicBackground).values({ student_id, ...sab_data });
            }
          }
        }

        // 4. Update Request Status
        await tx.update(studentProfileRequests)
          .set({ status: "approved", rejection_reason: null, updated_at: new Date() })
          .where(eq(studentProfileRequests.id, requestId));
      });
    } else {
      if (new_pfp) await deleteFromCloudinary(new_pfp);
      if (new_signature) await deleteFromCloudinary(new_signature);
      if (proof_url) await deleteFromCloudinary(proof_url);
      await db.update(studentProfileRequests)
        .set({ status: "rejected", rejection_reason: rejectionReason || 'No reason provided', updated_at: new Date() })
        .where(eq(studentProfileRequests.id, requestId));
    }

    // REAL-TIME
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('REQUEST_UPDATED', {
        student_id: student_id,
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        request_id: requestId,
        certificate_type: 'Profile Update'
      });
    } catch (e) {}

    return apiResponse({ success: true });
  } catch (err) {
    logger.error(err, 'Clerk profile request process error');
    return apiError('Server error', 500, err.message);
  }
}
