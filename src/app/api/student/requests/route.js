import { query } from "@/lib/db";
// Forced rebuild comment
import { getResolvedCurrentAcademicYear } from "@/lib/rollNumber";
import { apiError, apiResponse, getAuthUser } from "@/lib/api-utils";
import { getNow } from "@/lib/clock";
import { uploadToCloudinary } from "@/lib/cloudinary";

export async function GET(request) {
  try {
    const user = await getAuthUser("student");
    if (!user || !user.student_id) return apiError("Unauthorized", 401);

    const [sRows] = await query("SELECT email, is_email_verified, password_hash FROM students WHERE id = ?", [user.student_id]);
    const s = sRows;
    if (!s || !s.email || !s.is_email_verified || !s.password_hash) {
      return apiError("Verification required", 403);
    }

    const rows = await query(
      `SELECT sr.request_id, sr.certificate_type, sr.status, sr.academic_year, sr.created_at, sr.reject_reason, s.roll_no as roll_number
       FROM student_requests sr
       JOIN students s ON sr.student_id = s.id
       WHERE sr.student_id = ?
       ORDER BY sr.created_at DESC`,
      [user.student_id]
    );
    return apiResponse({ data: rows });
  } catch (error) {
    console.error("Error fetching student requests:", error);
    return apiError("Failed to fetch requests", 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser("student");
    if (!user || !user.student_id || !user.roll_no) return apiError("Unauthorized", 401);

    const [sRows] = await query("SELECT email, is_email_verified, password_hash FROM students WHERE id = ?", [user.student_id]);
    const s = sRows;
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
    const [cInfo] = await query("SELECT * FROM college_info WHERE id = 1");
    const academicYear = getResolvedCurrentAcademicYear(user.roll_no, cInfo, now);

    // Check existing
    const [existing] = await query(
      "SELECT request_id, status FROM student_requests WHERE student_id = ? AND certificate_type = ? AND academic_year = ? LIMIT 1",
      [user.student_id, certificateType, academicYear]
    );

    if (existing && existing.status !== "REJECTED") {
      return apiError("An active request already exists for this academic year.", 409);
    }

    let requestId;
    if (existing) {
      // Update
      requestId = existing.request_id;
      await query(
        "UPDATE student_requests SET payment_amount = ?, transaction_id = ?, purpose = ?, from_date = ?, to_date = ?, status = 'PENDING', updated_at = NOW(), completed_at = NULL WHERE request_id = ?",
        [paymentAmountNum, transactionId || null, purpose || null, fromDateStr || null, toDateStr || null, requestId]
      );
    } else {
      // Insert
      const result = await query(
        "INSERT INTO student_requests (student_id, certificate_type, academic_year, payment_amount, transaction_id, purpose, from_date, to_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')",
        [user.student_id, certificateType, academicYear, paymentAmountNum, transactionId || null, purpose || null, fromDateStr || null, toDateStr || null]
      );
      requestId = result.insertId;
    }

    // formData.get returns a File object in Next.js
    const isFileValid = paymentScreenshotFile && typeof paymentScreenshotFile === 'object' && paymentScreenshotFile.size > 0;

    if (isFileValid) {
      // SECURITY: Enforce 1MB limit on backend as well
      const MAX_SIZE = 1 * 1024 * 1024;
      if (paymentScreenshotFile.size > MAX_SIZE) {
        return apiError(`File too large (${(paymentScreenshotFile.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed is 1MB.`, 400);
      }

      console.log(`[DEBUG] Valid screenshot detected for Request ID: ${requestId}. Name: ${paymentScreenshotFile.name}, Size: ${paymentScreenshotFile.size} bytes`);
      const screenshotUrl = await uploadToCloudinary(paymentScreenshotFile, "certificates/payments");
      
      if (screenshotUrl) {
        // Update dedicated images table
        await query(
          "INSERT INTO student_request_images (request_id, payment_screenshot) VALUES (?, ?) ON DUPLICATE KEY UPDATE payment_screenshot = VALUES(payment_screenshot)",
          [requestId, screenshotUrl]
        );
        
        // Update legacy column in main requests table
        await query(
          "UPDATE student_requests SET payment_screenshot = ? WHERE request_id = ?",
          [screenshotUrl, requestId]
        );
        console.log(`[DEBUG] Screenshot uploaded and DB updated: ${screenshotUrl}`);
      }
    } else {
      console.log(`[DEBUG] No valid screenshot file received for Request ID: ${requestId}`);
    }

    return apiResponse({ success: true, requestId });
  } catch (error) {
    console.error("Error processing certificate request:", error);
    if (error.code === "ER_DUP_ENTRY") return apiError("Duplicate request detected.", 409);
    return apiError("Internal Server Error", 500);
  }
}
