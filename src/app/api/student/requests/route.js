import logger from '@/lib/logger';
import { db } from "@/db";
import { 
  students, 
  studentRequests, 
  collegeInfo as collegeInfoTable,
  studentRequestImages
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getResolvedCurrentAcademicYear } from "@/lib/rollNumber";
import { apiError, apiResponse, getAuthUser } from "@/lib/api-utils";
import { getNow } from "@/lib/clock";
import { uploadToCloudinary } from "@/lib/cloudinary";
import IdempotencyService from '@/services/IdempotencyService';

export async function GET(request) {
  try {
    const user = await getAuthUser("student");
    if (!user || !user.student_id) return apiError("Unauthorized", 401);

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

    const rows = await db.select({
      request_id: studentRequests.request_id,
      certificate_type: studentRequests.certificate_type,
      status: studentRequests.status,
      academic_year: studentRequests.academic_year,
      created_at: studentRequests.created_at,
      reject_reason: studentRequests.reject_reason,
      roll_number: students.roll_no
    })
    .from(studentRequests)
    .innerJoin(students, eq(studentRequests.student_id, students.id))
    .where(eq(studentRequests.student_id, user.student_id))
    .orderBy(desc(studentRequests.created_at));

    return apiResponse({ data: rows });
  } catch (error) {
    logger.error("Error fetching student requests:", error);
    return apiError("Failed to fetch requests", 500);
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
    const transactionId = formData.get("transactionId");
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
      )
    });

    if (existing && existing.status !== "REJECTED") {
      return apiError("An active request already exists for this academic year.", 409);
    }

    if (existing) {
      // Update
      requestId = existing.request_id;
      await db.update(studentRequests)
        .set({
          payment_amount: paymentAmountNum,
          transaction_id: transactionId || null,
          purpose: purpose || null,
          from_date: fromDateStr || null,
          to_date: toDateStr || null,
          status: 'PENDING',
          updated_at: now,
          completed_at: null
        })
        .where(eq(studentRequests.request_id, requestId));
    } else {
      // Insert
      const result = await db.insert(studentRequests).values({
        student_id: user.student_id,
        certificate_type: certificateType,
        academic_year: academicYear,
        payment_amount: paymentAmountNum,
        transaction_id: transactionId || null,
        purpose: purpose || null,
        from_date: fromDateStr ? new Date(fromDateStr) : null,
        to_date: toDateStr ? new Date(toDateStr) : null,
        status: 'PENDING'
      });
      requestId = result[0].insertId;

      // REAL-TIME: Broadcast to clerks
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        broadcastUpdate('REQUEST_CREATED', {
          clerkType,
          certificateType,
          student_id: user.student_id,
          roll_no: user.roll_no
        });
      } catch (e) {
        logger.error('SSE Broadcast error:', e);
      }
    }

    // formData.get returns a File object in Next.js
    const isFileValid = paymentScreenshotFile && typeof paymentScreenshotFile === 'object' && paymentScreenshotFile.size > 0;
    
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
          .set({ payment_screenshot: screenshotUrl })
          .where(eq(studentRequests.request_id, requestId));
      }
    }

    const responseData = { success: true, requestId };
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
