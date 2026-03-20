import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAdmissionDrafts, students, clerks, studentPersonalDetails } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { apiError, apiResponse } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = await checkRateLimit(`admission:${ip}`, 5, 3600); // 5 per hour
    
    if (!rateCheck.success) {
      return apiError('Too many attempts. Please try again in an hour.', 429);
    }

    const draftData = await req.json();

    // Basic validation
    if (!draftData.name || !draftData.admission_year || !draftData.entrance_exam || !draftData.branch || !draftData.seat_allotted_category || !draftData.religion || !draftData.mother_tongue) {
      return apiError('Missing required fields.', 400);
    }
    
    // 1. Comprehensive Uniqueness Checks
    if (draftData.email) {
        const emailInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.email, draftData.email) });
        const emailInStudent = await db.query.students.findFirst({ where: eq(students.email, draftData.email) });
        const emailInClerk = await db.query.clerks.findFirst({ where: eq(clerks.email, draftData.email) });
        
        if (emailInDraft || emailInStudent || emailInClerk) {
            return apiError('This email address is already registered in our system.', 409);
        }
    }

    if (draftData.student_mobile) {
        const mobileInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.student_mobile, draftData.student_mobile) });
        const mobileInStudent = await db.query.students.findFirst({ where: eq(students.mobile, draftData.student_mobile) });
        
        if (mobileInDraft || mobileInStudent) {
            return apiError('This mobile number is already in use.', 409);
        }
    }

    if (draftData.aadhaar_no) {
        const aadhaarInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.aadhaar_no, draftData.aadhaar_no) });
        const aadhaarInStudent = await db.query.studentPersonalDetails.findFirst({ where: eq(studentPersonalDetails.aadhaar_no, draftData.aadhaar_no) });
        
        if (aadhaarInDraft || aadhaarInStudent) {
            return apiError('This Aadhaar number is already registered.', 409);
        }
    }

    // 2. Upload to Cloudinary
    let pfpUrl = null;
    let signatureUrl = null;

    if (draftData.pfp) {
      pfpUrl = await uploadToCloudinary(draftData.pfp, 'admission_drafts/pfp');
    }
    if (draftData.signature) {
      signatureUrl = await uploadToCloudinary(draftData.signature, 'admission_drafts/signatures');
    }

    const [result] = await db.insert(studentAdmissionDrafts).values({
        status: 'DRAFT',
        admission_year: draftData.admission_year,
        entrance_exam: draftData.entrance_exam,
        branch: draftData.branch,
        name: draftData.name,
        father_name: draftData.father_name || null,
        mother_name: draftData.mother_name || null,
        dob: toMySQLDate(draftData.dob),
        gender: draftData.gender || null,
        email: draftData.email || null,
        student_mobile: draftData.student_mobile || null,
        guardian_mobile: draftData.guardian_mobile || null,
        pfp: pfpUrl,
        signature: signatureUrl,
        exam_rank: draftData.exam_rank || null,
        area_status: draftData.area_status || null,
        category: draftData.category || null,
        sub_caste: draftData.sub_caste || null,
        seat_allotted_category: draftData.seat_allotted_category || null,
        ssc_marks: draftData.ssc_marks || null,
        inter_diploma_marks: draftData.inter_diploma_marks || null,
        nationality: draftData.nationality || null,
        religion: draftData.religion || null,
        mother_tongue: draftData.mother_tongue || null,
        blood_group: draftData.blood_group || null,
        place_of_birth: draftData.place_of_birth || null,
        father_occupation: draftData.father_occupation || null,
        annual_income: draftData.annual_income || null,
        aadhaar_no: draftData.aadhaar_no || null,
        fee_reimbursement: draftData.fee_reimbursement || null,
        identification_mark_1: draftData.identification_mark_1 || null,
        identification_mark_2: draftData.identification_mark_2 || null,
        permanent_address: draftData.permanent_address || null
    });

    return apiResponse({ success: true, draftId: result.insertId, message: 'Your application has been submitted successfully.' });

  } catch (error) {
    logger.error('Error saving admission draft:', error);
    return apiError('Failed to submit application.', 500);
  }
}
