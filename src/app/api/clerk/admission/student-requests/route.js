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
      'SELECT student_id, new_signature, new_pfp FROM student_profile_requests WHERE id = ? AND status = "pending"',
      [requestId]
    );

    if (requestRows.length === 0) return apiError('Request not found or already processed', 404);

    const { student_id, new_signature, new_pfp } = requestRows[0];

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
      
      await db.execute(
        'UPDATE student_profile_requests SET status = "approved", rejection_reason = NULL WHERE id = ?',
        [requestId]
      );
    } else {
      // If rejecting, we should ALSO delete the NEWly uploaded images from Cloudinary 
      // since the student will have to upload again and these will be orphaned.
      if (new_pfp) await deleteFromCloudinary(new_pfp);
      if (new_signature) await deleteFromCloudinary(new_signature);

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
