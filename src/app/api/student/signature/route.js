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
import { safeJsonParse } from '@/lib/json-utils';
import { storage } from '@/lib/providers';
import { encrypt, decrypt, _hashForIndex } from '@/lib/encryption';
import { getPermanentAddressFromDetails, getContactAddressFromDetails } from '@/lib/address-utils';

export async function GET(_req) {
  const user = await getAuthUser('student');
  if (!user) return apiError('Unauthorized', 401);

  try {
    // Helper to handle both URLs and legacy Buffer data
    const imageHelper = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:') || val.startsWith('/api/'))) return val;
      if (Buffer.isBuffer(val)) return `data:image/png;base64,${val.toString('base64')}`;
      if (typeof val === 'string') return storage.getUrl(val);
      return null;
    };
    
    // 1. Fetch current signature
    const sigRow = await db.query.studentSignatures.findFirst({
      where: eq(studentSignatures.student_id, user.student_id)
    });

    // 2. Fetch current image (PFP)
    const pfpRow = await db.query.studentImages.findFirst({
      where: eq(studentImages.student_id, user.student_id)
    });

    // 3. Fetch all requests (history)
    const allRequestsRows = await db.query.studentProfileRequests.findMany({
      where: eq(studentProfileRequests.student_id, user.student_id),
      orderBy: [desc(studentProfileRequests.created_at)]
    });

    const history = allRequestsRows.map(row => {
      let newData = row.new_data;
      if (newData) {
          const data = safeJsonParse(newData, newData);
          if (data && typeof data === 'object') {
            if (data.mobile) data.mobile = decrypt(data.mobile);
            if (data.guardian_mobile) data.guardian_mobile = decrypt(data.guardian_mobile);
            if (data.aadhaar_no) data.aadhaar_no = decrypt(data.aadhaar_no);
          }
          newData = data;
      }

      return {
        ...row,
        new_data: newData,
        new_signature: imageHelper(row.new_signature),
        new_pfp: imageHelper(row.new_pfp),
        proof_url: imageHelper(row.proof_url)
      };
    });

    const latestRequest = history.length > 0 ? history[0] : null;

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
        email: true,
        date_of_birth: true
      },
      where: eq(students.id, user.student_id)
    });

    // Decrypt current sensitive fields
    if (studentRow) studentRow.mobile = decrypt(studentRow.mobile);
    if (personalRow) {
        personalRow.guardian_mobile = decrypt(personalRow.guardian_mobile);
        personalRow.aadhaar_no = decrypt(personalRow.aadhaar_no);
        personalRow.contact_address = getContactAddressFromDetails(personalRow);
        personalRow.permanent_address = getPermanentAddressFromDetails(personalRow);
    }

    return apiResponse({
      signature: currentSignature,
      pfp: currentPfp,
      latestRequest: latestRequest,
      history: history,
      details: {
        student: studentRow || { /* empty */ },
        personal: { 
          ...(personalRow || { /* empty */ }), 
          dob: studentRow?.date_of_birth || null 
        },
        academic: academicRow || { /* empty */ }
      }
    });
  } catch (err) {
    logger.error(err, 'Profile fetch error');
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

    // Encrypt sensitive fields in the data payload before storing
    const encryptedData = data ? { ...data } : null;
    if (encryptedData) {
        if (encryptedData.mobile) encryptedData.mobile = encrypt(encryptedData.mobile);
        if (encryptedData.guardian_mobile) encryptedData.guardian_mobile = encrypt(encryptedData.guardian_mobile);
        if (encryptedData.aadhaar_no) encryptedData.aadhaar_no = encrypt(encryptedData.aadhaar_no);
    }
    
    // Upload images to Cloudinary / Local storage if provided
    const { STORAGE_FOLDERS } = await import('@/lib/storage-config');
    let signatureUrl = null;
    let pfpUrl = null;
    let proofUrl = null;

    try {
      if (signature) {
        if (signature === 'REMOVE') signatureUrl = 'REMOVE';
        else {
          const res = await storage.upload(signature, STORAGE_FOLDERS.REQUESTS_SIGNATURES);
          signatureUrl = typeof res === 'string' ? res : res?.path;
        }
      }
      if (pfp) {
        if (pfp === 'REMOVE') pfpUrl = 'REMOVE';
        else {
          const res = await storage.upload(pfp, STORAGE_FOLDERS.REQUESTS_PFP);
          pfpUrl = typeof res === 'string' ? res : res?.path;
        }
      }
      if (proof) {
        const res = await storage.upload(proof, STORAGE_FOLDERS.REQUESTS_PROOFS);
        proofUrl = typeof res === 'string' ? res : res?.path;
      }
    } catch (uploadError) {
      if (signatureUrl) await storage.delete(signatureUrl).catch(e => logger.error(e, 'Rollback signature failed'));
      if (pfpUrl) await storage.delete(pfpUrl).catch(e => logger.error(e, 'Rollback pfp failed'));
      if (proofUrl) await storage.delete(proofUrl).catch(e => logger.error(e, 'Rollback proof failed'));
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    try {
      // Check if there's already a pending request
      const pending = await db.query.studentProfileRequests.findFirst({
        where: and(
          eq(studentProfileRequests.student_id, user.student_id),
          eq(studentProfileRequests.status, 'pending')
        )
      });

      if (pending) {
        // --- ACTIVE REQUEST GUARD ---
        const existingData = pending.new_data ? safeJsonParse(pending.new_data, {}) : {};
        const newFields = data ? Object.keys(data) : [];
        const existingFields = Object.keys(existingData);
        
        const overlaps = newFields.filter(f => existingFields.includes(f));
        
        if (overlaps.length > 0) {
          return apiError(`You already have a pending request for: ${overlaps.map(f => f.replace(/_/g, ' ')).join(', ')}. Please wait for clerk approval before submitting new changes for these fields.`, 400);
        }

        if (signature && pending.new_signature) {
          return apiError('You already have a pending signature update request.', 400);
        }
        if (pfp && pending.new_pfp) {
          return apiError('You already have a pending profile photo update request.', 400);
        }

        // Merge data for non-overlapping fields
        const mergedData = { ...existingData, ...(encryptedData || { /* empty */ }) };

        // Update existing pending request
        const updateData = { /* empty */ };
        if (signatureUrl) updateData.new_signature = signatureUrl;
        if (pfpUrl) updateData.new_pfp = pfpUrl;
        if (Object.keys(mergedData).length > 0) updateData.new_data = mergedData;
        if (proofUrl) updateData.proof_url = proofUrl; // Latest proof replaces old one
        
        await db.update(studentProfileRequests)
          .set(updateData)
          .where(eq(studentProfileRequests.id, pending.id));
      } else {
        // Create a new request (status defaults to 'pending')
        await db.insert(studentProfileRequests).values({
          student_id: user.student_id,
          new_signature: signatureUrl,
          new_pfp: pfpUrl,
          new_data: encryptedData || null,
          proof_url: proofUrl
        });
      }
    } catch (dbError) {
      if (signatureUrl) await storage.delete(signatureUrl).catch(e => logger.error(e, 'Rollback signature failed'));
      if (pfpUrl) await storage.delete(pfpUrl).catch(e => logger.error(e, 'Rollback pfp failed'));
      if (proofUrl) await storage.delete(proofUrl).catch(e => logger.error(e, 'Rollback proof failed'));
      throw dbError;
    }

    // REAL-TIME: Broadcast to admission clerks
    try {
      const { broadcastUpdate } = await import('@/lib/sse');
      broadcastUpdate('PROFILE_UPDATE_REQUESTED', {
        student_id: user.student_id,
        roll_no: user.roll_no
      });
    } catch (e) {
      logger.error(e, 'SSE Broadcast error');
    }

    return apiResponse({ success: true, message: 'Profile update request submitted for clerk approval.' });
  } catch (err) {
    logger.error(err, 'Profile request error');
    return apiError('Server error', 500, err.message);
  }
}
