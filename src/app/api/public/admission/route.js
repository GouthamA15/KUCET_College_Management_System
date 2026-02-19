import { query } from '@/lib/db';
import { apiError, apiResponse } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';

export async function POST(req) {
  try {
    const draftData = await req.json();

    // Basic validation
    if (!draftData.name || !draftData.admission_year || !draftData.entrance_exam || !draftData.branch) {
      return apiError('Missing required fields: name, admission_year, entrance_exam, or branch.', 400);
    }
    
    // 1. Comprehensive Uniqueness Checks
    
    // Check Email uniqueness across Drafts, Students, and Clerks
    const [emailInDraft] = await query('SELECT id FROM student_admission_drafts WHERE email = ?', [draftData.email]);
    const [emailInStudent] = await query('SELECT id FROM students WHERE email = ?', [draftData.email]);
    const [emailInClerk] = await query('SELECT id FROM clerks WHERE email = ?', [draftData.email]);
    
    if (emailInDraft || emailInStudent || emailInClerk) {
        return apiError('This email address is already registered in our system.', 409);
    }

    // Check Mobile uniqueness across Drafts and Students
    const [mobileInDraft] = await query('SELECT id FROM student_admission_drafts WHERE student_mobile = ?', [draftData.student_mobile]);
    const [mobileInStudent] = await query('SELECT id FROM students WHERE mobile = ?', [draftData.student_mobile]);
    
    if (mobileInDraft || mobileInStudent) {
        return apiError('This mobile number is already in use.', 409);
    }

    // Check Aadhaar uniqueness across Drafts and Personal Details
    if (draftData.aadhaar_no) {
        const [aadhaarInDraft] = await query('SELECT id FROM student_admission_drafts WHERE aadhaar_no = ?', [draftData.aadhaar_no]);
        const [aadhaarInStudent] = await query('SELECT student_id FROM student_personal_details WHERE aadhaar_no = ?', [draftData.aadhaar_no]);
        
        if (aadhaarInDraft || aadhaarInStudent) {
            return apiError('This Aadhaar number is already registered.', 409);
        }
    }

    const pfpBuffer = draftData.pfp ? Buffer.from(draftData.pfp.split(',')[1], 'base64') : null;
    const signatureBuffer = draftData.signature ? Buffer.from(draftData.signature.split(',')[1], 'base64') : null;


    const sql = `
      INSERT INTO student_admission_drafts (
        status, admission_year, entrance_exam, branch, name, father_name, mother_name, dob, gender, email, student_mobile, guardian_mobile,
        pfp, signature, exam_rank, area_status, category, sub_caste, seat_allotted_category, ssc_marks, inter_diploma_marks,
        nationality, religion, mother_tongue, blood_group, place_of_birth, father_occupation, annual_income, aadhaar_no,
        fee_reimbursement, identification_mark_1, identification_mark_2, permanent_address
      ) VALUES (
        'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `;

    const params = [
      draftData.admission_year, draftData.entrance_exam, draftData.branch, draftData.name,
      draftData.father_name || null, draftData.mother_name || null, toMySQLDate(draftData.dob),
      draftData.gender || null, draftData.email || null, draftData.student_mobile || null,
      draftData.guardian_mobile || null, pfpBuffer, signatureBuffer, draftData.exam_rank || null,
      draftData.area_status || null, draftData.category || null, draftData.sub_caste || null,
      draftData.seat_allotted_category || null, draftData.ssc_marks || null,
      draftData.inter_diploma_marks || null, draftData.nationality || null, draftData.religion || null,
      draftData.mother_tongue || null, draftData.blood_group || null, draftData.place_of_birth || null,
      draftData.father_occupation || null, draftData.annual_income || null, draftData.aadhaar_no || null,
      draftData.fee_reimbursement || null, draftData.identification_mark_1 || null,
      draftData.identification_mark_2 || null, draftData.permanent_address || null
    ];
    
    const result = await query(sql, params);

    return apiResponse({ success: true, draftId: result.insertId, message: 'Your application has been submitted successfully.' });

  } catch (error) {
    console.error('Error saving admission draft:', error);
    if (error.code === 'ER_DATA_TOO_LONG') {
        return apiError('One of the provided files is too large.', 413) // 413 Payload Too Large
    }
    return apiError('Failed to submit application.', 500);
  }
}
