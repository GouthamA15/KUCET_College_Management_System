import logger from '@/lib/logger';
import { db } from '@/db';
import { 
  studentSignatures, 
  studentImages, 
  studentProfileRequests, 
  studentPersonalDetails, 
  studentAcademicBackground, 
  students 
} from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function GET(req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    // Helper to handle both URLs and legacy Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      return val;
    };
    
    // 1. Fetch current signature
    const sigRow = await db.query.studentSignatures.findFirst({
      where: eq(studentSignatures.student_id, user.student_id)
    });

    // 2. Fetch current image (PFP)
    const pfpRow = await db.query.studentImages.findFirst({
      where: eq(studentImages.student_id, user.student_id)
    });

    // 3. Fetch latest request (pending or rejected)
    const latestReqRow = await db.query.studentProfileRequests.findFirst({
      where: eq(studentProfileRequests.student_id, user.student_id),
      orderBy: [desc(studentProfileRequests.created_at)]
    });

    let latestRequest = null;
    if (latestReqRow) {
      latestRequest = {
        ...latestReqRow,
        new_signature: imageHelper(latestReqRow.new_signature),
        new_pfp: imageHelper(latestReqRow.new_pfp),
        proof_url: imageHelper(latestReqRow.proof_url)
      };
    }

    const currentSignature = sigRow ? imageHelper(sigRow.signature) : null;
    const currentPfp = pfpRow ? imageHelper(pfpRow.pfp) : null;

    // 4. Fetch full student details for comparison
    const personalRow = await db.query.studentPersonalDetails.findFirst({
      where: eq(studentPersonalDetails.student_id, user.student_id)
    });
    const academicRow = await db.query.studentAcademicBackground.findFirst({
      where: eq(studentAcademicBackground.student_id, user.student_id)
    });
    const studentRow = await db.query.students.findFirst({
      columns: {
        roll_no: true,
        name: true,
        mobile: true,
        email: true
      },
      where: eq(students.id, user.student_id)
    });

    return apiResponse({
      signature: currentSignature,
      pfp: currentPfp,
      latestRequest: latestRequest,
      details: {
        student: studentRow || {},
        personal: personalRow || {},
        academic: academicRow || {}
      }
    });
  } catch (err) {
    logger.error('Profile fetch error:', err);
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
    
    // Upload images to Cloudinary if provided
    const signatureUrl = signature ? await uploadToCloudinary(signature, 'requests/signatures') : null;
    const pfpUrl = pfp ? await uploadToCloudinary(pfp, 'requests/pfp') : null;
    const proofUrl = proof ? await uploadToCloudinary(proof, 'requests/proofs') : null;

    // Check if there's already a pending request
    const pending = await db.query.studentProfileRequests.findFirst({
      where: and(
        eq(studentProfileRequests.student_id, user.student_id),
        eq(studentProfileRequests.status, 'pending')
      )
    });

    if (pending) {
      // Update existing pending request
      const updateData = {};
      if (signatureUrl) updateData.new_signature = signatureUrl;
      if (pfpUrl) updateData.new_pfp = pfpUrl;
      if (data) updateData.new_data = data;
      if (proofUrl) updateData.proof_url = proofUrl;
      
      await db.update(studentProfileRequests)
        .set(updateData)
        .where(eq(studentProfileRequests.id, pending.id));
    } else {
      // Create a new request (status defaults to 'pending')
      await db.insert(studentProfileRequests).values({
        student_id: user.student_id,
        new_signature: signatureUrl,
        new_pfp: pfpUrl,
        new_data: data || null,
        proof_url: proofUrl
      });
    }

    // REAL-TIME: Broadcast to admission clerks
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('PROFILE_UPDATE_REQUESTED', {
        student_id: user.student_id,
        roll_no: user.roll_no
      });
    } catch (e) {
      logger.error('SSE Broadcast error:', e);
    }

    return apiResponse({ success: true, message: 'Profile update request submitted for clerk approval.' });
  } catch (err) {
    logger.error('Profile request error:', err);
    return apiError('Server error', 500, err.message);
  }
}
