import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAdmissionDrafts, students, clerks, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';
import { checkRateLimit } from '@/lib/rate-limit';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { z } from 'zod';
import { getStorageProvider } from '@/lib/providers/storage/factory';

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(`admission:${ip}`, 5, 3600); // 5 per hour
    
    if (!rateCheck.success) {
      return apiError('Too many attempts. Please try again in an hour.', 429);
    }

    const json = await req.json();

    // --- ZERO TRUST VALIDATION ---
    const admissionSchema = z.object({
      name: z.string().trim().min(3).max(255).regex(/^[a-zA-Z\s.]+$/),
      admission_year: z.string().regex(/^\d{4}-\d{2}$/),
      entrance_exam: z.enum(['TG EAPCET', 'TG ECET', 'PGECET', 'Other']),
      branch: z.string().trim().min(2).max(50),
      seat_allotted_category: z.string().trim().min(1).max(50),
      religion: z.string().trim().min(1).max(100),
      mother_tongue: z.string().trim().min(1).max(100),
      email: z.string().trim().email().toLowerCase().nullable().optional().or(z.literal('')),
      student_mobile: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v.length === 10),
      guardian_mobile: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v === '' || v.length === 10).nullable().optional(),
      aadhaar_no: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v === '' || v.length === 12).nullable().optional(),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
      father_name: z.string().trim().max(255).nullable().optional(),
      mother_name: z.string().trim().max(255).nullable().optional(),
      exam_rank: z.preprocess(v => v === '' ? null : Number(v), z.number().int().positive().nullable().optional()),
      area_status: z.enum(['URBAN', 'RURAL', 'LOCAL', 'NON-LOCAL']).nullable().optional(),
      category: z.string().trim().max(50).nullable().optional(),
      sub_caste: z.string().trim().max(100).nullable().optional(),
      ssc_marks: z.string().trim().max(50).nullable().optional(),
      inter_diploma_marks: z.string().trim().max(50).nullable().optional(),
      nationality: z.string().trim().max(100).default('Indian'),
      blood_group: z.string().trim().max(20).nullable().optional(),
      place_of_birth: z.string().trim().max(255).nullable().optional(),
      father_occupation: z.string().trim().max(255).nullable().optional(),
      annual_income: z.string().trim().max(50).nullable().optional(),
      fee_reimbursement: z.enum(['YES', 'NO', 'GOV']).default('NO'),
      identification_mark_1: z.string().trim().max(500).nullable().optional(),
      identification_mark_2: z.string().trim().max(500).nullable().optional(),
      permanent_address: z.string().trim().max(1000).nullable().optional(),
      pfp: z.string().nullable().optional(),
      signature: z.string().nullable().optional()
    });

    const validatedData = admissionSchema.parse(json);
    const { 
      name, admission_year, entrance_exam, branch, seat_allotted_category, 
      religion, mother_tongue, email, student_mobile, guardian_mobile, 
      aadhaar_no, dob, gender, father_name, mother_name, exam_rank,
      area_status, category, sub_caste, ssc_marks, inter_diploma_marks,
      nationality, blood_group, place_of_birth, father_occupation, 
      annual_income, fee_reimbursement, identification_mark_1, 
      identification_mark_2, permanent_address, pfp, signature
    } = validatedData;
    
    // 1. Email Uniqueness Check (Plain text)
    if (email) {
        const emailInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.email, email) });
        const emailInStudent = await db.query.students.findFirst({ where: eq(students.email, email) });
        const emailInClerk = await db.query.clerks.findFirst({ where: eq(clerks.email, email) });
        
        if (emailInDraft || emailInStudent || emailInClerk) {
            return apiError('This email address is already registered in our system.', 409);
        }
    }

    // 2. Mobile Uniqueness Check (Using Blind Index)
    const mobileHash = hashForIndex(student_mobile);
    const mobileInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.mobile_hash, mobileHash) });
    const mobileInStudent = await db.query.students.findFirst({ where: eq(students.mobile_hash, mobileHash) });
    
    if (mobileInDraft || mobileInStudent) {
        return apiError('This mobile number is already in use.', 409);
    }

    // 3. Aadhaar Uniqueness Check (Using Blind Index)
    if (aadhaar_no) {
        const aHash = hashForIndex(aadhaar_no);
        const aadhaarInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.aadhaar_hash, aHash) });
        const aadhaarInStudent = await db.query.studentPersonalDetails.findFirst({ where: eq(studentPersonalDetails.aadhaar_hash, aHash) });
        
        if (aadhaarInDraft || aadhaarInStudent) {
            return apiError('This Aadhaar number is already registered.', 409);
        }
    }

    // 4. Upload to Storage
    let pfpUrl = null;
    let signatureUrl = null;

    const storage = getStorageProvider();

    try {
      if (pfp) {
        pfpUrl = await storage.upload(pfp, 'admission_drafts/pfp');
      }
      if (signature) {
        signatureUrl = await storage.upload(signature, 'admission_drafts/signatures');
      }

      // 5. Encrypt Sensitive Fields
      const encryptedMobile = encrypt(student_mobile);
      const encryptedGuardianMobile = guardian_mobile ? encrypt(guardian_mobile) : null;
      const encryptedAadhaar = aadhaar_no ? encrypt(aadhaar_no) : null;
      const aHash = aadhaar_no ? hashForIndex(aadhaar_no) : null;

      const [result] = await db.insert(studentAdmissionDrafts).values({
          status: 'DRAFT',
          admission_year,
          entrance_exam,
          branch,
          name,
          father_name: father_name || null,
          mother_name: mother_name || null,
          dob: toMySQLDate(dob),
          gender: gender || null,
          email: email || null,
          student_mobile: encryptedMobile,
          mobile_hash: mobileHash,
          guardian_mobile: encryptedGuardianMobile,
          pfp: pfpUrl,
          signature: signatureUrl,
          exam_rank: exam_rank || null,
          area_status: area_status || null,
          category: category || null,
          sub_caste: sub_caste || null,
          seat_allotted_category: seat_allotted_category || null,
          ssc_marks: ssc_marks || null,
          inter_diploma_marks: inter_diploma_marks || null,
          nationality: nationality || null,
          religion: religion || null,
          mother_tongue: mother_tongue || null,
          blood_group: blood_group || null,
          place_of_birth: place_of_birth || null,
          father_occupation: father_occupation || null,
          annual_income: annual_income || null,
          aadhaar_no: encryptedAadhaar,
          aadhaar_hash: aHash,
          fee_reimbursement: fee_reimbursement || null,
          identification_mark_1: identification_mark_1 || null,
          identification_mark_2: identification_mark_2 || null,
          permanent_address: permanent_address || null
      });

      // 6. Broadcast Real-time Event
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        await broadcastUpdate('NEW_ADMISSION_APPLICATION', {
          branch: branch,
          name: name,
          admission_year: admission_year
        });
      } catch (broadcastErr) {
        logger.error(broadcastErr, '[ADMISSION_BROADCAST_ERROR]');
      }

      return apiResponse({ success: true, draftId: result.insertId, message: 'Your application has been submitted successfully.' });
    } catch (e) {
      // Cleanup uploaded files on error
      if (pfpUrl) {
        try { await storage.delete(pfpUrl); }
        catch (delErr) { logger.error({ err: delErr, path: pfpUrl }, 'Orphaned pfp cleanup failed'); }
      }
      if (signatureUrl) {
        try { await storage.delete(signatureUrl); }
        catch (delErr) { logger.error({ err: delErr, path: signatureUrl }, 'Orphaned signature cleanup failed'); }
      }
      throw e;
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid input data', 400);
    }
    logger.error(error, 'Error saving admission draft');
    return apiError('Failed to submit application.', 500);
  }
}
