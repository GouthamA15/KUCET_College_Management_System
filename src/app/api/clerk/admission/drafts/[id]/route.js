import { query } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { toMySQLDate } from '@/lib/date';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function GET(req, context) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') {
    return apiError('Forbidden', 403);
  }

  try {
    const params = await context.params;
    const { id } = params;

    const sql = `SELECT * FROM student_admission_drafts WHERE id = ?`;
    const rows = await query(sql, [id]);

    if (rows.length === 0) return apiError('Draft not found', 404);

    const draft = rows[0];

    // Helper to handle both URLs and legacy Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    if (draft.pfp) draft.pfp = imageHelper(draft.pfp);
    if (draft.signature) draft.signature = imageHelper(draft.signature);
    
    return apiResponse({ data: draft });
  } catch (error) {
    console.error('Error fetching draft detail:', error);
    return apiError('Server Error', 500);
  }
}

export async function PUT(req, context) {
    const user = await getAuthUser('clerk');
    if (!user || user.role !== 'admission') {
      return apiError('Forbidden', 403);
    }
  
    try {
      const params = await context.params;
      const { id } = params;
      const body = await req.json();

      // If only status is provided (legacy or simple verification)
      if (Object.keys(body).length === 1 && body.status) {
          if (!['DRAFT', 'PROCESSED', 'FINALIZED'].includes(body.status)) {
              return apiError('Invalid status', 400);
          }
          await query(`UPDATE student_admission_drafts SET status = ? WHERE id = ?`, [body.status, id]);
          return apiResponse({ success: true, message: `Status updated to ${body.status}` });
      }

      // Handle Image Uploads if provided as base64
      if (body.pfp && body.pfp.startsWith('data:image')) {
        console.log('[API] Uploading new PFP for draft:', id);
        body.pfp = await uploadToCloudinary(body.pfp, 'admission_drafts/pfp');
      }
      if (body.signature && body.signature.startsWith('data:image')) {
        console.log('[API] Uploading new Signature for draft:', id);
        body.signature = await uploadToCloudinary(body.signature, 'admission_drafts/signatures');
      }

      // Full update logic
      const allowedFields = [
        'name', 'father_name', 'mother_name', 'dob', 'gender', 'email', 'student_mobile', 'guardian_mobile',
        'exam_rank', 'area_status', 'category', 'sub_caste', 'seat_allotted_category', 'ssc_marks', 'inter_diploma_marks',
        'nationality', 'religion', 'mother_tongue', 'blood_group', 'place_of_birth', 'father_occupation', 'annual_income', 
        'aadhaar_no', 'fee_reimbursement', 'identification_mark_1', 'identification_mark_2', 'permanent_address', 'branch', 'entrance_exam',
        'pfp', 'signature'
      ];

      const updates = [];
      const values = [];

      for (const field of allowedFields) {
          if (body[field] !== undefined) {
              updates.push(`${field} = ?`);
              if (field === 'dob') {
                  values.push(toMySQLDate(body[field]));
              } else {
                  values.push(body[field] === '' ? null : body[field]);
              }
          }
      }

      if (updates.length === 0) {
          return apiError('No valid fields provided for update', 400);
      }

      const sql = `UPDATE student_admission_drafts SET ${updates.join(', ')} WHERE id = ?`;
      await query(sql, [...values, id]);
  
      return apiResponse({ success: true, message: 'Draft updated successfully' });
    } catch (error) {
      console.error('Error updating draft:', error);
      return apiError('Server Error', 500);
    }
}
