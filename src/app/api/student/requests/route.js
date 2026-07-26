import logger from '@/lib/logger';
import { db } from "@/db";
import { 
  students, 
  studentRequests, 
  collegeInfo as collegeInfoTable,
  studentRequestImages
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getResolvedCurrentAcademicYear, getAdmissionTypeFromRoll } from "@/lib/rollNumber";
import { apiError, apiResponse, getAuthUser } from "@/lib/api-utils";
import { getNow } from "@/lib/clock";
import { storage } from '@/lib/providers';
import IdempotencyService from '@/services/IdempotencyService';
import { FinanceService } from '@/services/FinanceService';
import crypto from 'crypto';

export async function GET() {
  const user = await getAuthUser("student");
  if (!user || !user.student_id) return apiError("Unauthorized", 401);

  try {
    const requests = await db.query.studentRequests.findMany({
      where: eq(studentRequests.student_id, user.student_id),
      orderBy: [desc(studentRequests.created_at)]
    });

    const { parsePurpose, formatPurpose } = require('@/lib/certificate-utils');
    const mappedRequests = requests.map(r => {
      const parsed = parsePurpose(r.purpose);
      return {
        ...r,
        purpose_type: parsed.purpose_type,
        purpose_custom: parsed.purpose_custom,
        purpose: formatPurpose(r.purpose) || r.purpose
      };
    });

    return apiResponse(mappedRequests);
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
    const purposeType = formData.get("purpose_type")?.toString().trim() || formData.get("purpose")?.toString().trim();
    const purposeCustom = formData.get("purpose_custom")?.toString().trim();
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

    const isBonafide = certificateType === 'Bonafide Certificate';
    const isTC = certificateType === 'Transfer Certificate (TC)';
    const isNOC = certificateType === 'No Objection Certificate';

    const { parsePurpose } = require('@/lib/certificate-utils');

    // --- PHASE 4: MODULAR CERTIFICATE ELIGIBILITY VALIDATION ---
    if (isBonafide || isTC || isNOC) {
      const { StudentService } = await import('@/services/StudentService');
      const eligibilityMap = await StudentService.getCertificateEligibility(user.student_id, user.roll_no);
      
      let eligibility = null;
      if (isBonafide) eligibility = eligibilityMap.bonafide;
      else if (isTC) eligibility = eligibilityMap.tc;
      else if (isNOC) eligibility = eligibilityMap.noc;

      if (eligibility && !eligibility.isEligible) {
        return apiError(eligibility.reason || `You are not eligible for a ${certificateType} at this time.`, 403);
      }

      if (isBonafide) {
        const approvedBonafides = await db.query.studentRequests.findMany({
          where: and(
            eq(studentRequests.student_id, user.student_id),
            eq(studentRequests.certificate_type, 'Bonafide Certificate'),
            eq(studentRequests.status, 'APPROVED'),
            eq(studentRequests.academic_year, academicYear)
          )
        });
        const alreadyHasApprovedPurpose = approvedBonafides.some(r => {
          const parsed = parsePurpose(r.purpose);
          return parsed.purpose_type === purposeType;
        });
        if (alreadyHasApprovedPurpose) {
          return apiError(`A Bonafide Certificate has already been approved for: ${purposeType} in the current academic year.`, 403);
        }
      }
    }

    const finalStoredPurpose = isBonafide 
      ? JSON.stringify({ purpose_type: purposeType || null, purpose_custom: purposeCustom || null })
      : (purposeType || null);

    // Check existing per-purpose for Bonafide
    let existing = null;
    if (isBonafide) {
      const existingAll = await db.query.studentRequests.findMany({
        where: and(
          eq(studentRequests.student_id, user.student_id),
          eq(studentRequests.certificate_type, certificateType),
          eq(studentRequests.academic_year, academicYear)
        ),
        orderBy: [desc(studentRequests.created_at)]
      });
      existing = existingAll.find(r => {
        const parsed = parsePurpose(r.purpose);
        return parsed.purpose_type === purposeType;
      }) || null;
    } else {
      existing = await db.query.studentRequests.findFirst({
        where: and(
          eq(studentRequests.student_id, user.student_id),
          eq(studentRequests.certificate_type, certificateType),
          eq(studentRequests.academic_year, academicYear)
        ),
        orderBy: [desc(studentRequests.created_at)]
      });
    }

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

      // Total Limit Check (4 for Regular, 3 for Lateral) - Backup check
      const admissionType = getAdmissionTypeFromRoll(user.roll_no);
      const maxAllowed = admissionType === 'Lateral' ? 3 : 4;

      if (approvedRequests.length >= maxAllowed) {
        return apiError(`You have reached the maximum limit of ${maxAllowed} Bonafide Certificates for your course duration.`, 403);
      }

      // Free for subsequent requests logic (only free if already paid once in a previous year)
      const hasPreviousPaidBonafide = approvedRequests.some(req => req.academic_year !== academicYear && req.payment_amount > 0);
      if (hasPreviousPaidBonafide && approvedRequests.length > 0) {
        finalPaymentAmount = 0;
      }
    }

    const isFileValid = paymentScreenshotFile && typeof paymentScreenshotFile === 'object' && paymentScreenshotFile.size > 0;

    // --- INTEGRITY GUARD: Multi-Vector Conflict Check ---
    let isFlagged = false;
    let flagDetails = null;
    let paymentHash = null;

    if (finalPaymentAmount > 0) {
      if (isFileValid) {
        const buffer = Buffer.from(await paymentScreenshotFile.arrayBuffer());
        paymentHash = crypto.createHash('sha256').update(buffer).digest('hex');
      }

      const integrity = await FinanceService.verifyTransactionIntegrity({
        transactionId: transactionId,
        paymentHash,
        studentId: user.student_id,
        requestId
      });

      isFlagged = integrity.isFlagged;
      flagDetails = integrity.flagDetails;
    }

    // If an active (PENDING) request already exists for this purpose/academic year, block new one.
    if (existing && existing.status === "PENDING") {
      return apiError("An active request already exists for this purpose. Please wait for it to be processed.", 409);
    }

    if (existing && existing.status === "REJECTED") {
      // Re-check yearly limit for the purpose before allowing re-submission
      if (certificateType === 'Bonafide Certificate') {
        const approvedBonafides = await db.query.studentRequests.findMany({
          where: and(
            eq(studentRequests.student_id, user.student_id),
            eq(studentRequests.certificate_type, 'Bonafide Certificate'),
            eq(studentRequests.status, 'APPROVED'),
            eq(studentRequests.academic_year, academicYear)
          )
        });
        const hasApprovedPurpose = approvedBonafides.some(r => {
          const parsed = parsePurpose(r.purpose);
          return parsed.purpose_type === purposeType;
        });
        if (hasApprovedPurpose) {
          return apiError(`You have already received a Bonafide Certificate for ${purposeType} in the current academic year (${academicYear}). Cannot re-submit rejected request.`, 403);
        }
      }
      // Update the rejected one to PENDING again (original behavior)
      requestId = existing.request_id;
      await db.update(studentRequests)
        .set({
          payment_amount: finalPaymentAmount,
          transaction_id: transactionId || null,
          purpose: finalStoredPurpose,
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
      // Insert new request
      const result = await db.insert(studentRequests).values({
        student_id: user.student_id,
        certificate_type: certificateType,
        academic_year: academicYear,
        payment_amount: finalPaymentAmount,
        transaction_id: transactionId || null,
        purpose: finalStoredPurpose,
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

      const screenshotUrl = await storage.upload(paymentScreenshotFile, "certificates/payments");
      
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
