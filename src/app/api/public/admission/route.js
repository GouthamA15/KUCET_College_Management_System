import logger from '@/lib/logger';
import { db } from '@/db';
import { studentAdmissionDrafts, students, staffAccounts, studentPersonalDetails } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiError, apiResponse } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';
import { getNow } from '@/lib/clock';
import { storage } from '@/lib/providers';
import { checkRateLimit, getTieredKey } from '@/lib/rate-limit';
import { encrypt, hashForIndex } from '@/lib/encryption';
import { z } from 'zod';

export async function POST(req) {
  try {
    const _ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const rateCheck = await checkRateLimit(getTieredKey(req, 'admission'), 5, 3600); // 5 per hour
    
    if (!rateCheck.success) {
      return apiError('Too many attempts. Please try again in an hour.', 429);
    }

    const json = await req.json();

    // --- ZERO TRUST VALIDATION ---
    const admissionSchema = z.object({
      name: z.string().trim().min(3).max(255).regex(/^[a-zA-Z\s.]+$/),
      admission_year: z.string().regex(/^\d{4}-\d{2,4}$/),
      entrance_exam: z.enum(['TG EAPCET', 'TG ECET', 'PGECET', 'Other']),
      branch: z.string().trim().min(2).max(50),
      seat_allotted_category: z.string().trim().max(50).nullable().optional().or(z.literal('')),
      religion: z.string().trim().min(1).max(100),
      mother_tongue: z.string().trim().min(1).max(100),
      email: z.string().trim().email().toLowerCase().nullable().optional().or(z.literal('')),
      student_mobile: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v.length === 10),
      guardian_mobile: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v === '' || v.length === 10).nullable().optional(),
      aadhaar_no: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v === '' || v.length === 12).nullable().optional(),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other']).transform(val => val.toUpperCase()),
      father_name: z.string().trim().max(255).nullable().optional(),
      mother_name: z.string().trim().max(255).nullable().optional(),
      exam_rank: z.preprocess(v => v === '' ? null : Number(v), z.number().int().positive().nullable().optional()),
      area_status: z.enum(['URBAN', 'RURAL', 'LOCAL', 'NON-LOCAL', 'Local', 'Non Local', 'Urban', 'Rural'])
        .nullable()
        .optional()
        .transform(val => {
          if (!val) return val;
          return val.toUpperCase().replace(/\s+/g, '-');
        }),
      category: z.string().trim().max(50).nullable().optional(),
      sub_caste: z.string().trim().max(100).nullable().optional(),
      ssc_marks: z.string().trim().max(50).nullable().optional(),
      inter_diploma_marks: z.string().trim().max(50).nullable().optional().refine(val => {
          if (!val) return true;
          const num = parseFloat(val);
          return !isNaN(num) && num >= 0 && num <= 1000;
      }, {
          message: "Intermediate/Diploma marks must be a valid number between 0 and 1000"
      }),
      nationality: z.string().trim().max(100).default('Indian'),
      blood_group: z.string().trim().max(20).nullable().optional(),
      place_of_birth: z.string().trim().max(255).nullable().optional(),
      father_occupation: z.string().trim().max(255).nullable().optional(),
      annual_income: z.string().trim().max(50).nullable().optional(),
      fee_reimbursement: z.enum(['YES', 'NO', 'GOV']).default('NO'),
      identification_mark_1: z.string().trim().max(500).nullable().optional(),
      identification_mark_2: z.string().trim().max(500).nullable().optional(),
      permanent_address: z.string().trim().max(1000).nullable().optional(),
      contact_address: z.string().trim().max(1000).nullable().optional(),
      perm_house_no: z.string().trim().max(255).nullable().optional(),
      perm_street: z.string().trim().max(255).nullable().optional(),
      perm_apartment: z.string().trim().max(255).nullable().optional(),
      perm_city: z.string().trim().max(255).nullable().optional(),
      perm_state: z.string().trim().max(255).nullable().optional(),
      perm_pincode: z.string().trim().max(20).nullable().optional(),
      perm_country: z.string().trim().max(100).default('India'),
      curr_house_no: z.string().trim().max(255).nullable().optional(),
      curr_street: z.string().trim().max(255).nullable().optional(),
      curr_apartment: z.string().trim().max(255).nullable().optional(),
      curr_city: z.string().trim().max(255).nullable().optional(),
      curr_state: z.string().trim().max(255).nullable().optional(),
      curr_pincode: z.string().trim().max(20).nullable().optional(),
      curr_country: z.string().trim().max(100).default('India'),
      is_current_same_as_permanent: z.boolean().default(false),
      pfp: z.string().nullable().optional(),
      signature: z.string().nullable().optional(),
      legal_consent: z.literal(true, { errorMap: () => ({ message: "You must agree to the Terms & Conditions and Privacy Policy to proceed." }) })
    });

    const validatedData = admissionSchema.parse(json);
    const { 
      name, admission_year, entrance_exam, branch, seat_allotted_category, 
      religion, mother_tongue, email, student_mobile, guardian_mobile, 
      aadhaar_no, dob, gender, father_name, mother_name, exam_rank,
      area_status, category, sub_caste, ssc_marks, inter_diploma_marks,
      nationality, blood_group, place_of_birth, father_occupation, 
      annual_income, fee_reimbursement, identification_mark_1, 
      identification_mark_2, permanent_address, contact_address, 
      perm_house_no, perm_street, perm_apartment, perm_city, perm_state, perm_pincode, perm_country,
      curr_house_no, curr_street, curr_apartment, curr_city, curr_state, curr_pincode, curr_country,
      is_current_same_as_permanent, pfp, signature, legal_consent: _legal_consent
    } = validatedData;
    
    // 1. Email Uniqueness Check (Plain text)
    if (email) {
        const emailInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.email, email) });
        const emailInStudent = await db.query.students.findFirst({ where: eq(students.email, email) });
        const emailInStaff = await db.query.staffAccounts.findFirst({ where: eq(staffAccounts.email, email) });
        
        if (emailInDraft || emailInStudent || emailInStaff) {
            // ─── FIX #9: Generic message — was "email is already registered" which allows email enumeration ───
            return apiError('Please check your details and try again.', 409);
        }
    }

    // 2. Mobile Uniqueness Check (Using Blind Index)
    const mobileHash = hashForIndex(student_mobile);
    const mobileInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.mobile_hash, mobileHash) });
    const mobileInStudent = await db.query.students.findFirst({ where: eq(students.mobile_hash, mobileHash) });
    
    if (mobileInDraft || mobileInStudent) {
        // ─── FIX #9: Generic message — was "mobile already in use" which allows mobile enumeration ───
        return apiError('Please check your details and try again.', 409);
    }

    // 3. Aadhaar Uniqueness Check (Using Blind Index)
    if (aadhaar_no) {
        const aHash = hashForIndex(aadhaar_no);
        const aadhaarInDraft = await db.query.studentAdmissionDrafts.findFirst({ where: eq(studentAdmissionDrafts.aadhaar_hash, aHash) });
        const aadhaarInStudent = await db.query.studentPersonalDetails.findFirst({ where: eq(studentPersonalDetails.aadhaar_hash, aHash) });
        
        if (aadhaarInDraft || aadhaarInStudent) {
            // ─── FIX #9: Generic message — was "Aadhaar already registered" which allows Aadhaar enumeration ───
            return apiError('Please check your details and try again.', 409);
        }
    }

    // 4. Upload to Cloudinary / Local Storage
    const { STORAGE_FOLDERS } = await import('@/lib/storage-config');
    let pfpUrl = null;
    let signatureUrl = null;

    if (pfp) {
      try {
        const res = await storage.upload(pfp, STORAGE_FOLDERS.ADMISSION_DRAFTS_PFP);
        pfpUrl = typeof res === 'string' ? res : res?.path;
      } catch (err) {
        logger.error(err, 'Failed to upload profile picture for admission draft');
        return apiError('Failed to upload profile picture.', 500);
      }
    }
    if (signature) {
      try {
        const res = await storage.upload(signature, STORAGE_FOLDERS.ADMISSION_DRAFTS_SIGNATURES);
        signatureUrl = typeof res === 'string' ? res : res?.path;
      } catch (err) {
        logger.error(err, 'Failed to upload signature for admission draft');
        if (pfpUrl) {
          await storage.delete(pfpUrl).catch(e => logger.error(e, 'Failed to cleanup orphaned pfp in admission draft'));
        }
        return apiError('Failed to upload signature.', 500);
      }
    }

    // 5. Encrypt Sensitive Fields
    const encryptedMobile = encrypt(student_mobile);
    const encryptedGuardianMobile = guardian_mobile ? encrypt(guardian_mobile) : null;
    const encryptedAadhaar = aadhaar_no ? encrypt(aadhaar_no) : null;
    const aHash = aadhaar_no ? hashForIndex(aadhaar_no) : null;

    let addressFields = { /* empty */ };
    if (json.perm_house_no !== undefined || json.curr_house_no !== undefined) {
      addressFields = {
        perm_house_no: perm_house_no || null,
        perm_street: perm_street || null,
        perm_apartment: perm_apartment || null,
        perm_city: perm_city || null,
        perm_state: perm_state || null,
        perm_pincode: perm_pincode || null,
        perm_country: perm_country || 'India',
        curr_house_no: curr_house_no || null,
        curr_street: curr_street || null,
        curr_apartment: curr_apartment || null,
        curr_city: curr_city || null,
        curr_state: curr_state || null,
        curr_pincode: curr_pincode || null,
        curr_country: curr_country || 'India',
        is_current_same_as_permanent: !!is_current_same_as_permanent
      };
    } else {
      const { mapAddressStringsToFields } = require('@/lib/address-utils');
      const finalPermAddr = permanent_address || '';
      const finalContactAddr = contact_address || finalPermAddr || '';
      addressFields = mapAddressStringsToFields(finalContactAddr, finalPermAddr);
    }

    try {
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
          data_policy_consented_at: getNow(),
          ...addressFields
      });

      // Realtime Broadcast for Admission Staff
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        await broadcastUpdate('ADMISSION_DRAFT_CREATED', {
          id: result.insertId,
          name,
          father_name: father_name || null,
          exam_rank: exam_rank || null,
          admission_year,
          entrance_exam,
          branch,
          status: 'DRAFT',
          created_at: new Date().toISOString()
        });
      } catch (_e) {
        // Non-blocking
      }

      return apiResponse({ success: true, draftId: result.insertId, message: 'Your application has been submitted successfully.' });
    } catch (insertError) {
      if (pfpUrl) await storage.delete(pfpUrl).catch(e => logger.error(e, 'Failed to cleanup orphaned pfp in admission draft db insert failure'));
      if (signatureUrl) await storage.delete(signatureUrl).catch(e => logger.error(e, 'Failed to cleanup orphaned signature in admission draft db insert failure'));
      throw insertError;
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors }, 'Validation failed for public admission request');
      const firstError = error.errors[0];
      const field = firstError.path.join('.');
      const msg = field ? `${field}: ${firstError.message}` : firstError.message;
      return apiError(msg, 400);
    }
    logger.error(error, 'Error saving admission draft');
    return apiError('Failed to submit application.', 500);
  }
}
