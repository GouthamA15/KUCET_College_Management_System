import logger from '@/lib/logger';
import { db } from "@/db";
import { 
  students, 
  studentRequests, 
  collegeInfo as collegeInfoTable,
  studentRequestImages
} from "@/db/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { getResolvedCurrentAcademicYear, getAdmissionTypeFromRoll } from "@/lib/rollNumber";
import { apiError, apiResponse, getAuthUser } from "@/lib/api-utils";
import { getNow } from "@/lib/clock";
import { uploadToCloudinary } from "@/lib/cloudinary";
import IdempotencyService from '@/services/IdempotencyService';
import crypto from 'crypto';

export async function GET() {
  const user = await getAuthUser("student");
  if (!user || !user.student_id) return apiError("Unauthorized", 401);

  try {
    const requests = await db.query.studentRequests.findMany({
      where: eq(studentRequests.student_id, user.student_id),
      orderBy: [desc(studentRequests.created_at)]
    });

    return apiResponse(requests);
  } catch (error) {
    logger.error('Error fetching student requests:', error);
    return apiError("Internal Server Error", 500);
  }
}

export async function POST(request) {
  const user = await getAuthUser("student");
  if (!user || !user.student_id || !user.roll_no) return apiError("Unauthorized", 401);

  const idempotencyKey = request.headers.get('idempotency-key');
  let idempotencyStarted = false;

  let requestId;
  try {
    if (idempotencyKey) {
      const { isDuplicate, response, code } = await IdempotencyService.start(idempotencyKey);
      if (isDuplicate) {
        logger.info({ key: idempotencyKey }, '[IDEMPOTENCY_HIT] Returning cached response for certificate request');
        return apiResponse(response, code || 200);
      }
      idempotencyStarted = true;
    }

    const s = await db.query.students.findFirst({
      columns: {
        email: true,
        is_email_verified: true,
        password_hash: true
      },
      where: eq(students.id, user.student_id)
    });

    if (!s || !s.email || !s.is_email_verified || !s.password_hash) {
      return apiError("Verification required", 403);
    }

    const formData = await request.formData();
    const certificateType = formData.get("certificateType");
    const clerkType = formData.get("clerkType");
    const paymentAmount = formData.get("paymentAmount");
    const transactionId = formData.get("transactionId")?.toString().trim();
    const purpose = formData.get("purpose");
    const fromDateStr = formData.get("fromDate");
    const toDateStr = formData.get("toDate");
    const paymentScreenshotFile = formData.get("paymentScreenshot");

    if (!certificateType || !clerkType || paymentAmount === null) {
      return apiError("Missing required fields", 400);
    }

    const paymentAmountNum = Number(paymentAmount) || 0;
    const now = await getNow();
    const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1));
    const academicYear = getResolvedCurrentAcademicYear(user.roll_no, collegeRows[0], now);

    // Check existing
    const existing = await db.query.studentRequests.findFirst({
      where: and(
        eq(studentRequests.student_id, user.student_id),
        eq(studentRequests.certificate_type, certificateType),
        eq(studentRequests.academic_year, academicYear)
      ),
      orderBy: [desc(studentRequests.created_at)]
    });

    requestId = existing?.request_id;

    // --- BONAFIDE LIMITS & FREE LOGIC ---
    let finalPaymentAmount = paymentAmountNum;
    if (certificateType === 'Bonafide Certificate') {
      const approvedRequests = await db.query.studentRequests.findMany({
        where: and(
          eq(studentRequests.student_id, user.student_id),
          eq(studentRequests.certificate_type, 'Bonafide Certificate'),
          eq(studentRequests.status, 'APPROVED')
        )
      });

      // 1. Total Limit Check (4 for Regular, 3 for Lateral)
      const admissionType = getAdmissionTypeFromRoll(user.roll_no);
      const maxAllowed = admissionType === 'Lateral' ? 3 : 4;

      if (approvedRequests.length >= maxAllowed) {
        return apiError(`You have reached the maximum limit of ${maxAllowed} Bonafide Certificates for your course duration.`, 403);
      }

      // 2. Per-Year Limit Check (Only one per academic year)
      const alreadyHasYearlyBonafide = approvedRequests.some(req => req.academic_year === academicYear);
      if (alreadyHasYearlyBonafide) {
        return apiError(`You have already received a Bonafide Certificate for the current academic year (${academicYear}). Only one is allowed per year.`, 403);
      }

      // 3. Free for subsequent requests logic
      if (approvedRequests.length > 0) {
        finalPaymentAmount = 0;
      }
    }

    // --- INTEGRITY GUARD: Multi-Vector Conflict Check ---
    let isFlagged = false;
    let flagDetails = null;
    let paymentHash = null;

    // A. Transaction ID Conflict (UTR uniqueness) (only if payment is required)
    if (transactionId && finalPaymentAmount > 0) {
      const conflictTrans = await db.query.studentRequests.findFirst({
        where: and(
          eq(studentRequests.transaction_id, transactionId),
          sql`${studentRequests.status} != 'REJECTED'`
        ),
        with: { student: { columns: { roll_no: true } } }
      });

      if (conflictTrans) {
        // Flag if it's a different student OR a different request by the same student (reusing payment)
        if (conflictTrans.student_id !== user.student_id || (requestId && conflictTrans.request_id !== requestId)) {
          isFlagged = true;
          flagDetails = {
            type: 'TRANSACTION_ID_CONFLICT',
            conflict_roll_no: conflictTrans.student.roll_no,
            conflict_request_id: conflictTrans.request_id,
            conflict_date: conflictTrans.created_at
          };
        }
      }
    }

    // B. Screenshot Hash Conflict (Fingerprinting) (only if payment is required)
    const isFileValid = paymentScreenshotFile && typeof paymentScreenshotFile === 'object' && paymentScreenshotFile.size > 0;
    if (isFileValid && finalPaymentAmount > 0) {
      const buffer = Buffer.from(await paymentScreenshotFile.arrayBuffer());
      paymentHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const conflictHash = await db.query.studentRequests.findFirst({
        where: and(
          eq(studentRequests.payment_hash, paymentHash),
          sql`${studentRequests.status} != 'REJECTED'`
        ),
        with: { student: { columns: { roll_no: true } } }
      });

      if (conflictHash) {
        // Flag if it's a different student OR a different request by the same student
        if (conflictHash.student_id !== user.student_id || (requestId && conflictHash.request_id !== requestId)) {
          isFlagged = true;
          flagDetails = {
            ...(flagDetails || {}),
            hash_conflict: true,
            conflict_roll_no: conflictHash.student.roll_no,
            conflict_request_id: conflictHash.request_id,
            conflict_date: conflictHash.created_at
          };
        }
      }
    }

    // If an active (PENDING) request already exists for this academic year, block new one.
    // If it's APPROVED or REJECTED, we can allow a new one (especially for Bonafide which is free after first)
    if (existing && existing.status === "PENDING") {
      return apiError("An active request already exists for this academic year. Please wait for it to be processed.", 409);
    }

    if (existing && existing.status === "REJECTED") {
      // Update the rejected one to PENDING again (original behavior)
      requestId = existing.request_id;
      await db.update(studentRequests)
        .set({
          payment_amount: finalPaymentAmount,
          transaction_id: transactionId || null,
          purpose: purpose || null,
          from_date: fromDateStr ? new Date(fromDateStr) : null,
          to_date: toDateStr ? new Date(toDateStr) : null,
          status: 'PENDING',
          updated_at: now,
          completed_at: null,
          is_flagged: isFlagged,
          flag_details: flagDetails,
          payment_hash: paymentHash
        })
        .where(eq(studentRequests.request_id, requestId));
    } else {
      // Insert new request (even if an APPROVED one exists for this year, we allow new ones for Bonafide)
      const result = await db.insert(studentRequests).values({
        student_id: user.student_id,
        certificate_type: certificateType,
        academic_year: academicYear,
        payment_amount: finalPaymentAmount,
        transaction_id: transactionId || null,
        purpose: purpose || null,
        from_date: fromDateStr ? new Date(fromDateStr) : null,
        to_date: toDateStr ? new Date(toDateStr) : null,
        status: 'PENDING',
        is_flagged: isFlagged,
        flag_details: flagDetails,
        payment_hash: paymentHash,
        created_at: now,
        updated_at: now
      });
      requestId = result[0].insertId;

      // REAL-TIME: Broadcast to clerks
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        broadcastUpdate('REQUEST_CREATED', {
          clerkType,
          certificateType,
          student_id: user.student_id,
          roll_no: user.roll_no,
          is_flagged: isFlagged
        });
      } catch (e) {
        logger.error('SSE Broadcast error:', e);
      }
    }

    if (isFileValid) {
      const MAX_SIZE = 1 * 1024 * 1024;
      if (paymentScreenshotFile.size > MAX_SIZE) {
        return apiError(`File too large (${(paymentScreenshotFile.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed is 1MB.`, 400);
      }

      const screenshotUrl = await uploadToCloudinary(paymentScreenshotFile, "certificates/payments");
      
      if (screenshotUrl) {
        await db.insert(studentRequestImages)
          .values({
            request_id: requestId,
            payment_screenshot: screenshotUrl
          })
          .onDuplicateKeyUpdate({ set: { payment_screenshot: screenshotUrl } });
        
        await db.update(studentRequests)
          .set({ 
            payment_screenshot: screenshotUrl,
            updated_at: now
          })
          .where(eq(studentRequests.request_id, requestId));
      }
    }

    const responseData = { success: true, requestId, is_flagged: isFlagged };
    if (idempotencyStarted) {
      await IdempotencyService.complete(idempotencyKey, 200, responseData);
    }

    return apiResponse(responseData);
  } catch (error) {
    if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
    logger.error('Error processing certificate request:', error);
    if (error.code === "ER_DUP_ENTRY") return apiError("Duplicate request detected.", 409);
    return apiError("Internal Server Error", 500);
  }
}
