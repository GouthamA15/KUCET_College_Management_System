import logger from '@/lib/logger';
import { db } from "@/db";
import { getDb } from "@/lib/db";
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "@/db/schema";
import { 
  students, 
  studentRequests, 
  studentRequestImages
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCollegeAcademicYear, calculateYearAndSemesterAsync } from "@/lib/academic-utils";
import { apiError, apiResponse, getAuthUser } from "@/lib/api-utils";
import { storage } from '@/lib/providers';
import IdempotencyService from '@/services/IdempotencyService';
import { FinanceService } from '@/services/FinanceService';
import { resolveAcademicClassification, evaluateBonafideFeeEntitlement } from '@/lib/academicClassification';
import { parsePurpose, formatPurpose, generatePaymentLockName } from '@/lib/certificate-utils';
import crypto from 'crypto';

export async function GET() {
  const user = await getAuthUser("student");
  if (!user || !user.student_id) return apiError("Unauthorized", 401);

  try {
    const requests = await db.query.studentRequests.findMany({
      where: eq(studentRequests.student_id, user.student_id),
      orderBy: [desc(studentRequests.created_at)]
    });

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
    const staffType = formData.get("staffType");
    const paymentAmount = formData.get("paymentAmount");
    const transactionId = formData.get("transactionId")?.toString().trim();
    const purposeType = formData.get("purpose_type")?.toString().trim() || formData.get("purpose")?.toString().trim();
    const purposeCustom = formData.get("purpose_custom")?.toString().trim();
    const fromDateStr = formData.get("fromDate");
    const toDateStr = formData.get("toDate");
    const paymentScreenshotFile = formData.get("paymentScreenshot");

    if (!certificateType || !staffType || paymentAmount === null) {
      return apiError("Missing required fields", 400);
    }

    const academicYear = await getCollegeAcademicYear();
    const isBonafide = certificateType === 'Bonafide Certificate';
    const isTC = certificateType === 'Transfer Certificate (TC)';
    const isNOC = certificateType === 'No Objection Certificate';

    // Preliminary validation for TC and NOC
    if (isTC || isNOC) {
      const { StudentService } = await import('@/services/StudentService');
      const eligibilityMap = await StudentService.getCertificateEligibility(user.student_id, user.roll_no);
      const eligibility = isTC ? eligibilityMap.tc : eligibilityMap.noc;
      if (eligibility && !eligibility.isEligible) {
        return apiError(eligibility.reason || `You are not eligible for a ${certificateType} at this time.`, 403);
      }
    }

    const finalStoredPurpose = isBonafide 
      ? JSON.stringify({ purpose_type: purposeType || null, purpose_custom: purposeCustom || null })
      : (purposeType || null);

    let createdRequestId = null;
    let routingResult = null;

    // --- TRANSACTION BOUNDARY ON DEDICATED PHYSICAL CONNECTION ---
    // Guarantees deterministic advisory lock acquisition, transaction atomicity,
    // and lock release strictly AFTER database commit has completed.
    const pool = getDb();
    const conn = await pool.getConnection();
    const tx = drizzle(conn, { schema, mode: 'default' });

    let acquiredLocks = [];
    let txResult = null;

    try {
      // 1. Acquire parent-row lock on students
      await conn.beginTransaction();

      const lockedStudents = await tx.select({
        id: students.id,
        academic_offset_years: students.academic_offset_years
      })
      .from(students)
      .where(eq(students.id, user.student_id))
      .for('update');

      if (!lockedStudents || lockedStudents.length === 0) {
        throw new Error('STUDENT_NOT_FOUND');
      }

      const academicOffsetYears = Number(lockedStudents[0].academic_offset_years || 0);

      if (isBonafide) {
        // 2. Authoritative Semester Resolution (Zero fabricated fallback)
        const semResult = await calculateYearAndSemesterAsync(user.roll_no, academicOffsetYears);
        if (!semResult?.semester || typeof semResult.semester !== 'number') {
          await conn.rollback();
          txResult = { error: 'Active study semester cannot be resolved from the academic calendar. Please contact academic administration.', status: 400 };
          return;
        }
        const studySemester = semResult.semester;

        // 3. Resolve Academic Classification (academic_offset_years completely excluded from years_at_kucet)
        const classification = resolveAcademicClassification({
          rollNo: user.roll_no,
          academicYear,
          studySemester
        });

        if (!classification.isValid) {
          await conn.rollback();
          txResult = { error: classification.error || 'Invalid student classification or academic year.', status: 400 };
          return;
        }

        // 4. Locking read of all lifetime Bonafide requests for this student
        const allBonafides = await tx.select().from(studentRequests)
          .where(and(
            eq(studentRequests.student_id, user.student_id),
            eq(studentRequests.certificate_type, 'Bonafide Certificate')
          ))
          .for('update');

        // 5. In-Memory Fee Entitlement, Conflict & Duplicate Purpose Evaluation
        const feeEntitlement = evaluateBonafideFeeEntitlement({
          allBonafideRows: allBonafides,
          isFirstYearAtKucet: classification.isFirstYearAtKucet,
          currentAcademicYear: academicYear,
          requestedPurposeType: purposeType,
          requestedPurposeCustom: purposeCustom
        });

        if (feeEntitlement.conflictDetected) {
          await conn.rollback();
          txResult = { error: feeEntitlement.feeReason, status: 409 };
          return;
        }

        if (feeEntitlement.isPendingLocked) {
          await conn.rollback();
          txResult = { error: feeEntitlement.feeReason, status: 409 };
          return;
        }

        if (!feeEntitlement.canSubmit) {
          await conn.rollback();
          txResult = { error: feeEntitlement.feeReason, status: 409 };
          return;
        }

        // 6. Server-Authoritative Fee Validation
        const requiredFee = feeEntitlement.requiredFee; // 100 or 0
        const clientAmount = Number(paymentAmount) || 0;

        if (clientAmount !== requiredFee) {
          await conn.rollback();
          txResult = { error: `Invalid payment amount submitted. Server-calculated required fee is ₹${requiredFee}.`, status: 400 };
          return;
        }

        let finalPaymentAmount = 0;
        let finalTransactionId = null;
        let finalPaymentHash = null;
        let isFlagged = false;
        let flagDetails = null;

        if (requiredFee === 100) {
          if (!transactionId || transactionId.length === 0) {
            await conn.rollback();
            txResult = { error: 'Transaction Reference ID (UTR) is required for paid Bonafide requests.', status: 400 };
            return;
          }
          const isFileValid = paymentScreenshotFile && typeof paymentScreenshotFile === 'object' && paymentScreenshotFile.size > 0;
          if (!isFileValid) {
            await conn.rollback();
            txResult = { error: 'Payment receipt screenshot is required for paid Bonafide requests.', status: 400 };
            return;
          }

          finalPaymentAmount = 100;
          finalTransactionId = transactionId.trim();

          const buffer = Buffer.from(await paymentScreenshotFile.arrayBuffer());
          finalPaymentHash = crypto.createHash('sha256').update(buffer).digest('hex');

          // Deterministic Lexicographical Lock Ordering (Prevents Deadlocks)
          // Lock names are bounded (<= 64 chars) and namespace-isolated
          const utrLockName = generatePaymentLockName('utr', finalTransactionId);
          const hashLockName = generatePaymentLockName('hash', finalPaymentHash);
          const lockNames = [utrLockName, hashLockName].filter(Boolean).sort();

          for (const lockName of lockNames) {
            const [lockRes] = await conn.execute(`SELECT GET_LOCK(?, 10) as l`, [lockName]);
            if (lockRes[0]?.l !== 1) {
              await conn.rollback();
              txResult = { error: 'Payment verification lock timed out. Another request is currently being processed.', status: 408 };
              return;
            }
            acquiredLocks.push(lockName);
          }

          // Verify duplicate payment proof under active serialization
          const integrity = await FinanceService.verifyTransactionIntegrity({
            transactionId: finalTransactionId,
            paymentHash: finalPaymentHash,
            studentId: user.student_id,
            dbClient: tx
          });

          if (integrity.isFlagged) {
            await conn.rollback();
            txResult = {
              error: `Duplicate payment detected: This payment proof is already associated with an active request (${integrity.flagDetails?.type || 'CONFLICT'}).`,
              status: 409
            };
            return;
          }
          isFlagged = integrity.isFlagged;
          flagDetails = integrity.flagDetails;
        } else {
          // Free Request: Normalize payment fields to 0 / null, discarding any extraneous proof
          finalPaymentAmount = 0;
          finalTransactionId = null;
          finalPaymentHash = null;
          isFlagged = false;
          flagDetails = null;
        }

        // 7. Workflow Routing
        const { StudentCertificateService } = await import('@/services/StudentService');
        const routing = await StudentCertificateService.determineCertificateRouting(certificateType, user.roll_no);
        routingResult = routing;

        // 8. Always INSERT a new request row (preserves rejected requests in history)
        const insertValues = {
          student_id: user.student_id,
          certificate_type: certificateType,
          academic_year: academicYear,
          payment_amount: finalPaymentAmount,
          transaction_id: finalTransactionId,
          purpose: finalStoredPurpose,
          from_date: fromDateStr ? new Date(fromDateStr) : null,
          to_date: toDateStr ? new Date(toDateStr) : null,
          status: 'PENDING',
          hod_approval_status: routing.hodApprovalStatus,
          hod_staff_id: routing.hodStaffId || null,
          is_flagged: isFlagged,
          flag_details: flagDetails,
          payment_hash: finalPaymentHash,
          certificate_format: classification.certificateFormat,
          study_year: classification.studyYear,
          study_semester: studySemester,
          admission_type: classification.admissionType,
          years_at_kucet: classification.yearsAtKucet,
          created_at: new Date(),
          updated_at: new Date()
        };

        const [insertRes] = await tx.insert(studentRequests).values(insertValues);
        createdRequestId = insertRes.insertId;

        // COMMIT transaction explicitly before releasing locks
        await conn.commit();
        txResult = { success: true, requestId: createdRequestId, is_flagged: isFlagged };

      } else {
        // Non-Bonafide certificate handling
        const existingActive = await tx.select().from(studentRequests)
          .where(and(
            eq(studentRequests.student_id, user.student_id),
            eq(studentRequests.certificate_type, certificateType),
            eq(studentRequests.academic_year, academicYear),
            eq(studentRequests.status, 'PENDING')
          ))
          .for('update');

        if (existingActive.length > 0) {
          await conn.rollback();
          txResult = { error: 'An active request already exists for this certificate type. Please wait for it to be processed.', status: 409 };
          return;
        }

        const { StudentCertificateService } = await import('@/services/StudentService');
        const routing = await StudentCertificateService.determineCertificateRouting(certificateType, user.roll_no);
        routingResult = routing;

        const [insertRes] = await tx.insert(studentRequests).values({
          student_id: user.student_id,
          certificate_type: certificateType,
          academic_year: academicYear,
          payment_amount: Number(paymentAmount) || 0,
          transaction_id: transactionId || null,
          purpose: finalStoredPurpose,
          from_date: fromDateStr ? new Date(fromDateStr) : null,
          to_date: toDateStr ? new Date(toDateStr) : null,
          status: 'PENDING',
          hod_approval_status: routing.hodApprovalStatus,
          hod_staff_id: routing.hodStaffId || null,
          is_flagged: false,
          flag_details: null,
          payment_hash: null,
          created_at: new Date(),
          updated_at: new Date()
        });

        createdRequestId = insertRes.insertId;
        await conn.commit();
        txResult = { success: true, requestId: createdRequestId, is_flagged: false };
      }

    } catch (err) {
      let rollbackSucceeded = false;
      try { 
        await conn.rollback(); 
        rollbackSucceeded = true;
      } catch (rbErr) { 
        logger.warn({ err: rbErr?.message }, '[CONN_ROLLBACK_WARN]'); 
      }
      logger.error('Error during request creation transaction:', err);
      if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
      
      const errorMessage = rollbackSucceeded
        ? (err.message || 'Transaction failed')
        : 'Transaction state ambiguous due to connection error during commit. Please verify existing requests before retrying.';
      return apiError(errorMessage, 500);
    } finally {
      // 9. Release locks strictly AFTER commit (or rollback) and verify cleanup
      let cleanupSuccessful = true;
      for (const lockName of acquiredLocks) {
        try {
          const [relRes] = await conn.execute(`SELECT RELEASE_LOCK(?) as r`, [lockName]);
          if (relRes[0]?.r !== 1) {
            cleanupSuccessful = false;
            logger.error({ lockPrefix: lockName.slice(0, 16) + '...', result: relRes[0]?.r }, '[ADVISORY_LOCK_RELEASE_UNSUCCESSFUL]');
          }
        } catch (lockErr) {
          cleanupSuccessful = false;
          logger.error({ lockPrefix: lockName.slice(0, 16) + '...', err: lockErr?.message }, '[ADVISORY_LOCK_RELEASE_EXCEPTION]');
        }
      }

      if (!cleanupSuccessful) {
        try {
          conn.destroy();
          logger.error('[CONNECTION_DESTROYED_DUE_TO_UNCERTAIN_LOCK_STATE]');
        } catch (destErr) {
          logger.error({ err: destErr?.message }, '[CONNECTION_DESTROY_EXCEPTION]');
        }
      } else {
        conn.release();
      }
    }

    if (txResult && txResult.error) {
      if (idempotencyStarted) await IdempotencyService.fail(idempotencyKey);
      return apiError(txResult.error, txResult.status || 400);
    }

    const newRequestId = txResult.requestId;
    const isFlagged = txResult.is_flagged;

    // 9. Coordinate screenshot upload post-commit if payment was required
    const isFileValid = paymentScreenshotFile && typeof paymentScreenshotFile === 'object' && paymentScreenshotFile.size > 0;
    if (isFileValid && isBonafide && Number(paymentAmount) === 100) {
      if (!paymentScreenshotFile.type.startsWith('image/')) {
        logger.warn({ requestId: newRequestId }, 'Invalid screenshot image format uploaded');
      } else {
        const MAX_SIZE = 1 * 1024 * 1024;
        if (paymentScreenshotFile.size <= MAX_SIZE) {
          const { STORAGE_FOLDERS } = await import('@/lib/storage-config');
          const res = await storage.upload(paymentScreenshotFile, STORAGE_FOLDERS.CERTIFICATES_PAYMENTS);
          const screenshotUrl = typeof res === 'string' ? res : res?.path;
          if (screenshotUrl) {
            await db.insert(studentRequestImages)
              .values({
                request_id: newRequestId,
                payment_screenshot: screenshotUrl
              })
              .onDuplicateKeyUpdate({ set: { payment_screenshot: screenshotUrl } });
          }
        }
      }
    }

    // 10. REAL-TIME: SSE Broadcast to staff
    if (routingResult) {
      try {
        const { broadcastUpdate } = await import('@/lib/sse');
        broadcastUpdate('REQUEST_CREATED', {
          staffType: routingResult.staffType,
          certificateType,
          student_id: user.student_id,
          roll_no: user.roll_no,
          is_flagged: isFlagged
        });
      } catch (e) {
        logger.error('SSE Broadcast error:', e);
      }
    }

    const responseData = { success: true, requestId: newRequestId, is_flagged: isFlagged };
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
