import { getDb } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const db = getDb();
    // Fetch pending requests with student details and current profile info
    const [rows] = await db.execute(`
      SELECT 
        spr.id, 
        spr.student_id, 
        s.roll_no, 
        s.name, 
        spr.new_signature, 
        spr.new_pfp,
        spr.new_data,
        spr.proof_url,
        ss.signature as old_signature,
        si.pfp as old_pfp,
        spr.created_at
      FROM student_profile_requests spr
      JOIN students s ON spr.student_id = s.id
      LEFT JOIN student_signatures ss ON spr.student_id = ss.student_id
      LEFT JOIN student_images si ON spr.student_id = si.student_id
      WHERE spr.status = 'pending'
      ORDER BY spr.created_at DESC
    `);

    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };

    const data = rows.map(row => {
      return {
        id: row.id,
        student_id: row.student_id,
        roll_no: row.roll_no,
        name: row.name,
        new_signature: imageHelper(row.new_signature),
        new_pfp: imageHelper(row.new_pfp),
        new_data: row.new_data,
        proof_url: imageHelper(row.proof_url),
        old_signature: imageHelper(row.old_signature),
        old_pfp: imageHelper(row.old_pfp),
        created_at: row.created_at
      };
    });

    return apiResponse({ data });
  } catch (err) {
    console.error('Clerk profile request fetch error:', err);
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

    const db = getDb();
    
    const [requestRows] = await db.execute(
      'SELECT student_id, new_signature, new_pfp, new_data, proof_url FROM student_profile_requests WHERE id = ? AND status = "pending"',
      [requestId]
    );

    if (requestRows.length === 0) return apiError('Request not found or already processed', 404);

    const { student_id, new_signature, new_pfp, new_data, proof_url } = requestRows[0];

    if (action === 'approve') {
      // 1. Update Signature if provided
      if (new_signature) {
        // Fetch and delete old Signature
        const [oldSigRows] = await db.execute('SELECT signature FROM student_signatures WHERE student_id = ?', [student_id]);
        if (oldSigRows.length > 0 && oldSigRows[0].signature) {
          await deleteFromCloudinary(oldSigRows[0].signature);
        }

        await db.execute(
          'INSERT INTO student_signatures (student_id, signature) VALUES (?, ?) ' +
          'ON DUPLICATE KEY UPDATE signature = VALUES(signature)',
          [student_id, new_signature]
        );
      }
      
      // 2. Update PFP if provided
      if (new_pfp) {
        // Fetch and delete old PFP
        const [oldImgRows] = await db.execute('SELECT pfp FROM student_images WHERE student_id = ?', [student_id]);
        if (oldImgRows.length > 0 && oldImgRows[0].pfp) {
          await deleteFromCloudinary(oldImgRows[0].pfp);
        }

        await db.execute(
          'INSERT INTO student_images (student_id, pfp) VALUES (?, ?) ' +
          'ON DUPLICATE KEY UPDATE pfp = VALUES(pfp)',
          [student_id, new_pfp]
        );
      }

      // 3. Update Text Data if provided
      if (new_data) {
        const data = typeof new_data === 'string' ? JSON.parse(new_data) : new_data;
        
        // Update students table fields (mobile, email)
        if (data.mobile || data.email) {
            let sets = [];
            let params = [];
            if (data.mobile) { sets.push('mobile = ?'); params.push(data.mobile); }
            if (data.email) { sets.push('email = ?'); params.push(data.email); }
            params.push(student_id);
            await db.execute(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, params);
        }

        // Update student_personal_details
        const spd_fields = ['father_name','mother_name','nationality','religion','category','sub_caste','area_status','mother_tongue','place_of_birth','father_occupation','guardian_mobile','annual_income','aadhaar_no','address','seat_allotted_category','identification_marks','blood_group'];
        const spd_data = {};
        spd_fields.forEach(f => { if (data.hasOwnProperty(f)) spd_data[f] = data[f]; });

        if (Object.keys(spd_data).length > 0) {
            const fields = Object.keys(spd_data);
            const values = Object.values(spd_data);
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            await db.execute(`UPDATE student_personal_details SET ${setClause} WHERE student_id = ?`, [...values, student_id]);
        }

        // Update student_academic_background
        const sab_fields = ['qualifying_exam','previous_college_details','medium_of_instruction','ranks','ssc_marks','inter_marks'];
        const sab_data = {};
        sab_fields.forEach(f => { if (data.hasOwnProperty(f)) sab_data[f] = data[f]; });

        if (Object.keys(sab_data).length > 0) {
            const fields = Object.keys(sab_data);
            const values = Object.values(sab_data);
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            await db.execute(`UPDATE student_academic_background SET ${setClause} WHERE student_id = ?`, [...values, student_id]);
        }
      }

      // 4. Delete Proof if it was approved (keep storage clean if not needed anymore, or keep it?)
      // Usually good to keep proof in DB history but maybe not Cloudinary if you want to save space.
      // But for audit, it's better to keep it. We'll keep it.
      
      await db.execute(
        'UPDATE student_profile_requests SET status = "approved", rejection_reason = NULL WHERE id = ?',
        [requestId]
      );
    } else {
      // If rejecting, delete the NEWLY uploaded images
      if (new_pfp) await deleteFromCloudinary(new_pfp);
      if (new_signature) await deleteFromCloudinary(new_signature);
      if (proof_url) await deleteFromCloudinary(proof_url);

      await db.execute(
        'UPDATE student_profile_requests SET status = "rejected", rejection_reason = ? WHERE id = ?',
        [rejectionReason || 'No reason provided', requestId]
      );
    }

    return apiResponse({ success: true });
  } catch (err) {
    console.error('Clerk profile request process error:', err);
    return apiError('Server error', 500, err.message);
  }
}
