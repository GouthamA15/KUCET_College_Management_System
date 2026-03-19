import { getDb } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function GET(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const db = getDb();

    // Helper to handle both URLs and legacy Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };
    
    // 1. Fetch current signature
    const [sigRows] = await db.execute(
      'SELECT signature FROM student_signatures WHERE student_id = ?',
      [user.student_id]
    );

    // 2. Fetch current image (PFP)
    const [pfpRows] = await db.execute(
      'SELECT pfp FROM student_images WHERE student_id = ?',
      [user.student_id]
    );

    // 3. Fetch latest request (pending or rejected)
    const [reqRows] = await db.execute(
      'SELECT id, status, rejection_reason, new_signature, new_pfp, new_data, proof_url, created_at FROM student_profile_requests ' +
      'WHERE student_id = ? ORDER BY created_at DESC LIMIT 1',
      [user.student_id]
    );

    let latestRequest = null;
    if (reqRows.length > 0) {
      const row = reqRows[0];
      
      latestRequest = {
        id: row.id,
        status: row.status,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        new_signature: imageHelper(row.new_signature),
        new_pfp: imageHelper(row.new_pfp),
        new_data: row.new_data, // JSON is handled automatically by mysql2
        proof_url: imageHelper(row.proof_url)
      };
    }

    const currentSignature = sigRows.length > 0 ? imageHelper(sigRows[0].signature) : null;
    const currentPfp = pfpRows.length > 0 ? imageHelper(pfpRows[0].pfp) : null;

    // 4. Fetch full student details for comparison
    const [personalRows] = await db.execute('SELECT * FROM student_personal_details WHERE student_id = ?', [user.student_id]);
    const [academicRows] = await db.execute('SELECT * FROM student_academic_background WHERE student_id = ?', [user.student_id]);
    const [studentRows] = await db.execute('SELECT roll_no, name, mobile, email FROM students WHERE id = ?', [user.student_id]);

    return apiResponse({
      signature: currentSignature,
      pfp: currentPfp,
      latestRequest: latestRequest,
      details: {
        student: studentRows[0] || {},
        personal: personalRows[0] || {},
        academic: academicRows[0] || {}
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return apiError('Server error', 500, err.message);
  }
}

// Handle profile/signature update requests
export async function POST(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const { checkRateLimit } = require('@/lib/rate-limit');
    const rateCheck = await checkRateLimit(`profile_req:${user.student_id}`, 5, 86400); // 5 per day
    if (!rateCheck.success) {
      return apiError('You can only submit 5 update requests per day.', 429);
    }

    const body = await req.json();
    const { signature, pfp, data, proof } = body;
    
    // If updating text data, proof is mandatory
    if (data && !proof) {
      return apiError('Verification proof (image) is required for updating profile details.', 400);
    }

    if (!signature && !pfp && !data) {
      return apiError('No changes provided to request an update.', 400);
    }

    const db = getDb();
    
    // Upload images to Cloudinary if provided
    const signatureUrl = signature ? await uploadToCloudinary(signature, 'requests/signatures') : null;
    const pfpUrl = pfp ? await uploadToCloudinary(pfp, 'requests/pfp') : null;
    const proofUrl = proof ? await uploadToCloudinary(proof, 'requests/proofs') : null;

    // Check if there's already a pending request
    const [pending] = await db.execute(
      'SELECT id FROM student_profile_requests WHERE student_id = ? AND status = "pending"',
      [user.student_id]
    );

    if (pending.length > 0) {
      // Update existing pending request
      let updateSql = 'UPDATE student_profile_requests SET updated_at = CURRENT_TIMESTAMP';
      let params = [];
      if (signatureUrl) {
        updateSql += ', new_signature = ?';
        params.push(signatureUrl);
      }
      if (pfpUrl) {
        updateSql += ', new_pfp = ?';
        params.push(pfpUrl);
      }
      if (data) {
        updateSql += ', new_data = ?';
        params.push(JSON.stringify(data));
      }
      if (proofUrl) {
        updateSql += ', proof_url = ?';
        params.push(proofUrl);
      }
      updateSql += ' WHERE id = ?';
      params.push(pending[0].id);
      
      await db.execute(updateSql, params);
    } else {
      // Create a new request (status defaults to 'pending')
      await db.execute(
        'INSERT INTO student_profile_requests (student_id, new_signature, new_pfp, new_data, proof_url) VALUES (?, ?, ?, ?, ?)',
        [user.student_id, signatureUrl, pfpUrl, data ? JSON.stringify(data) : null, proofUrl]
      );
    }

    // REAL-TIME: Broadcast to admission clerks
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('PROFILE_UPDATE_REQUESTED', {
        student_id: user.student_id,
        roll_no: user.roll_no
      });
    } catch (e) {
      console.error('SSE Broadcast error:', e);
    }

    return apiResponse({ success: true, message: 'Profile update request submitted for clerk approval.' });
  } catch (err) {
    console.error('Profile request error:', err);
    return apiError('Server error', 500, err.message);
  }
}
