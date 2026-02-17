import { query } from '@/lib/db';
import { getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';

async function validateStudentVerification(studentId) {
  try {
    const rows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [studentId]);
    const s = rows && rows[0];
    if (!s || !s.email || !s.is_email_verified || !s.password_hash) {
      return { valid: false, error: 'Verification required' };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Unable to validate verification status' };
  }
}

export async function GET(request) {
  const user = await getAuthUser('student');
  if (!user || !user.student_id) return apiError('Unauthorized', 401);

  const verification = await validateStudentVerification(user.student_id);
  if (!verification.valid) return apiError(verification.error, 403);

  try {
    const rows = await query(
      `SELECT sr.request_id, sr.certificate_type, sr.status, sr.academic_year, sr.created_at, sr.reject_reason, s.roll_no as roll_number
       FROM student_requests sr
       JOIN students s ON sr.student_id = s.id
       WHERE sr.student_id = ?
       ORDER BY sr.created_at DESC`,
      [user.student_id]
    );
    return apiResponse(rows);
  } catch (error) {
    console.error('Error fetching student requests:', error);
    return apiError('Failed to fetch requests', 500);
  }
}

export async function POST(request) {
  const user = await getAuthUser('student');
  if (!user || !user.student_id || !user.roll_no) return apiError('Unauthorized', 401);

  const verification = await validateStudentVerification(user.student_id);
  if (!verification.valid) return apiError(verification.error, 403);

  try {
    const formData = await request.formData();
    const certificateType = formData.get('certificateType');
    const clerkType = formData.get('clerkType');
    const paymentAmount = formData.get('paymentAmount');
    const transactionId = formData.get('transactionId');
    const purpose = formData.get('purpose')
    const paymentScreenshotFile = formData.get('paymentScreenshot');

    let paymentScreenshotBuffer = null;
    if (paymentScreenshotFile) {
        const bytes = await paymentScreenshotFile.arrayBuffer();
        paymentScreenshotBuffer = Buffer.from(bytes);
    }
    
    if (!certificateType || !clerkType || (paymentAmount === null || paymentAmount === undefined)) {
        return apiError('Missing required fields', 400);
    }

    // Certificate validation rules
    const certificateRules = {
      'Income Tax (IT) Certificate': { requiresPayment: false, requiresUTR: false },
      'Bonafide Certificate': { requiresPayment: true, requiresUTR: true },
      'Course Completion Certificate': { requiresPayment: true, requiresUTR: true },
      'Custodian Certificate': { requiresPayment: true, requiresUTR: true },
      'Transfer Certificate (TC)': { requiresPayment: true, requiresUTR: true },
      'Migration Certificate': { requiresPayment: true, requiresUTR: true },
      'Study Conduct Certificate': { requiresPayment: true, requiresUTR: true },
    };

    const rule = certificateRules[certificateType] || { requiresPayment: true, requiresUTR: true };

    // Normalize payment amount to number
    const paymentAmountNum = Number(paymentAmount) || 0;

    // Validation per rule
    if (rule.requiresUTR) {
      // Paid certificates require both transactionId and screenshot
      if (!transactionId || !paymentScreenshotBuffer) {
        return apiError('Transaction ID and screenshot are required for paid certificates', 400);
      }
    } else if (certificateType === 'Income Tax (IT) Certificate') {
      // Income Tax requires only screenshot
      if (!paymentScreenshotBuffer) {
        return apiError('Screenshot of college fee payment is required.', 400);
      }
    }

    // Sanitize storage values depending on certificate type
    let transactionIdToStore = transactionId || null;
    let paymentAmountToStore = paymentAmountNum;
    if (certificateType === 'Income Tax (IT) Certificate') {
      transactionIdToStore = null;
      paymentAmountToStore = 0;
    }

    // compute academic_year from roll_no (single source of truth)
    let academicYear;
    try {
      const now = await getNow();
      // Fetch college info for academic year boundary
      const collegeInfoRows = await query('SELECT * FROM college_info WHERE id = 1');
      const collegeInfo = collegeInfoRows.length > 0 ? collegeInfoRows[0] : null;

      try {
        academicYear = getResolvedCurrentAcademicYear(user.roll_no, collegeInfo, now);
      } catch (e1) {
        // If token roll_no is malformed or not in expected format, try resolving from DB
        try {
          const rollRows = await query('SELECT roll_no FROM students WHERE id = ?', [user.student_id]);
          const dbRoll = rollRows && rollRows[0] && rollRows[0].roll_no;
          if (dbRoll) {
            academicYear = getResolvedCurrentAcademicYear(dbRoll, collegeInfo, now);
          }
        } catch (e2) {
          console.warn('[REQUESTS] Failed to resolve roll_no from DB', e2);
        }
        if (!academicYear) {
          const msg = (e1 && e1.message) ? e1.message : 'Invalid roll number format – cannot determine academic year';
          return apiError(msg, 400);
        }
      }
    } catch (error) {
       return apiError('Failed to resolve academic year boundary.', 500);
    }

    try {
      // PRE-CHECK: see if a request exists for this student/certificate/year
      const existingRows = await query(
        `SELECT request_id, status FROM student_requests WHERE student_id = ? AND certificate_type = ? AND academic_year = ? LIMIT 1`,
        [user.student_id, certificateType, academicYear]
      );

      if (existingRows && existingRows.length > 0) {
        const existing = existingRows[0];
        if (existing.status && existing.status !== 'REJECTED') {
          // active (PENDING/APPROVED) - block
          return apiError('An active request already exists for this certificate and academic year.', 409);
        }

        // status === 'REJECTED' -> allow re-request by reusing the same row (UPDATE)
        try {
          const updateResult = await query(
            `UPDATE student_requests SET payment_amount = ?, transaction_id = ?, purpose = ?, status = ?, updated_at = NOW(), completed_at = NULL WHERE request_id = ?`,
            [paymentAmountToStore, transactionIdToStore, purpose||null, 'PENDING', existing.request_id]
          );
          
          if (paymentScreenshotBuffer) {
             await query(
                `INSERT INTO student_request_images (request_id, payment_screenshot) VALUES (?, ?) ON DUPLICATE KEY UPDATE payment_screenshot = VALUES(payment_screenshot)`,
                [existing.request_id, paymentScreenshotBuffer]
             );
          }

          if (updateResult.affectedRows === 1) {
            return apiResponse({ success: true, requestId: existing.request_id });
          } else {
            return apiError('Failed to update rejected request', 500);
          }
        } catch (err) {
          if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
            return apiError('Certificate already requested for this academic year.', 409);
          }
          console.error('Error updating rejected student request:', err);
          return apiError('An error occurred while updating the request', 500);
        }
      }

      // No existing row - safe to insert
      const result = await query(
        'INSERT INTO student_requests (student_id, certificate_type,  academic_year, payment_amount, transaction_id, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.student_id, certificateType,  academicYear, paymentAmountToStore, transactionIdToStore, purpose|| null, 'PENDING']
      );
      
      const newRequestId = result.insertId;
      if (paymentScreenshotBuffer) {
          await query(
             `INSERT INTO student_request_images (request_id, payment_screenshot) VALUES (?, ?)`,
             [newRequestId, paymentScreenshotBuffer]
          );
      }

      if (result.affectedRows === 1) {
        return apiResponse({ success: true, requestId: newRequestId });
      } else {
        return apiError('Failed to create request', 500);
      }
    } catch (err) {
      // handle duplicate unique constraint (race or DB-level)
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        return apiError('Certificate already requested for this academic year.', 409);
      }
      console.error('Error inserting student request:', err);
      return apiError('An error occurred while creating the request', 500);
    }
  } catch (error) {
    return apiError('An error occurred while creating the request', 500);
  }
}
