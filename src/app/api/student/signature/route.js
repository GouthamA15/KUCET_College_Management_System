import { getDb } from '@/lib/db';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    const db = getDb();
    
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
      'SELECT id, status, rejection_reason, new_signature, new_pfp, created_at FROM student_profile_requests ' +
      'WHERE student_id = ? ORDER BY created_at DESC LIMIT 1',
      [user.student_id]
    );

    let latestRequest = null;
    if (reqRows.length > 0) {
      latestRequest = {
        id: reqRows[0].id,
        status: reqRows[0].status,
        rejection_reason: reqRows[0].rejection_reason,
        created_at: reqRows[0].created_at,
        new_signature: reqRows[0].new_signature ? `data:image/png;base64,${reqRows[0].new_signature.toString('base64')}` : null,
        new_pfp: reqRows[0].new_pfp ? `data:image/png;base64,${reqRows[0].new_pfp.toString('base64')}` : null
      };
    }

    const currentSignature = sigRows.length > 0 
      ? `data:image/png;base64,${sigRows[0].signature.toString('base64')}` 
      : null;
    
    const currentPfp = pfpRows.length > 0
      ? `data:image/png;base64,${pfpRows[0].pfp.toString('base64')}`
      : null;

    return apiResponse({
      signature: currentSignature,
      pfp: currentPfp,
      latestRequest: latestRequest
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
    const body = await req.json();
    const { signature, pfp } = body;
    if (!signature && !pfp) return apiError('Either signature or profile picture is required', 400);

    const db = getDb();
    const signatureBuffer = signature ? Buffer.from(signature.split(',')[1], 'base64') : null;
    const pfpBuffer = pfp ? Buffer.from(pfp.split(',')[1], 'base64') : null;

    // Check if there's already a pending request
    const [pending] = await db.execute(
      'SELECT id FROM student_profile_requests WHERE student_id = ? AND status = "pending"',
      [user.student_id]
    );

    if (pending.length > 0) {
      // Update existing pending request
      let updateSql = 'UPDATE student_profile_requests SET updated_at = CURRENT_TIMESTAMP';
      let params = [];
      if (signatureBuffer) {
        updateSql += ', new_signature = ?';
        params.push(signatureBuffer);
      }
      if (pfpBuffer) {
        updateSql += ', new_pfp = ?';
        params.push(pfpBuffer);
      }
      updateSql += ' WHERE id = ?';
      params.push(pending[0].id);
      
      await db.execute(updateSql, params);
    } else {
      // Create a new request (status defaults to 'pending')
      await db.execute(
        'INSERT INTO student_profile_requests (student_id, new_signature, new_pfp) VALUES (?, ?, ?)',
        [user.student_id, signatureBuffer, pfpBuffer]
      );
    }

    return apiResponse({ success: true, message: 'Request submitted for approval' });
  } catch (err) {
    console.error('Profile request error:', err);
    return apiError('Server error', 500, err.message);
  }
}
