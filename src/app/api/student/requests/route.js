import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getResolvedCurrentAcademicYear } from '@/lib/rollNumber';

const JWT_SECRET = process.env.JWT_SECRET;

async function getStudentFromToken(request) {
  const token = request.cookies.get('student_auth')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    let student_id = payload.student_id || null;
    const roll_no = payload.roll_no || null;
    // If token doesn't include student_id (old tokens), try to resolve it from roll_no
    if (!student_id && roll_no) {
      try {
        const rows = await query('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
        if (rows && rows.length > 0) student_id = rows[0].id;
      } catch (e) {
        console.warn('[AUTH] Failed to resolve student_id from roll_no', e);
      }
    }
    return { student_id, roll_no };
  } catch (error) {
    return null;
  }
}

export async function GET(request) {
  const auth = await getStudentFromToken(request);
  if (!auth || !auth.student_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Block if not verified: email present, verified, and password set
  try {
    const rows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [auth.student_id]);
    const s = rows && rows[0];
    if (!s || !s.email || !s.is_email_verified || !s.password_hash) {
      return NextResponse.json({ error: 'Verification required' }, { status: 403 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Unable to validate verification status' }, { status: 500 });
  }

  // Enforce verification: email present, verified, and password set
  try {
    const verRows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [auth.student_id]);
    const ver = verRows && verRows[0];
    if (!ver || !ver.email || !ver.is_email_verified || !ver.password_hash) {
      return NextResponse.json({ error: 'Verification required: verify email and set password to access requests.' }, { status: 403 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Unable to validate verification status.' }, { status: 500 });
  }

  try {
    const rows = await query(
      `SELECT sr.request_id, sr.certificate_type, sr.status, sr.academic_year, sr.created_at, sr.reject_reason, s.roll_no as roll_number
       FROM student_requests sr
       JOIN students s ON sr.student_id = s.id
       WHERE sr.student_id = ?
       ORDER BY sr.created_at DESC`,
      [auth.student_id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching student requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await getStudentFromToken(request);
  if (!auth || !auth.student_id || !auth.roll_no) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Block if not verified: email present, verified, and password set
  try {
    const rows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [auth.student_id]);
    const s = rows && rows[0];
    if (!s || !s.email || !s.is_email_verified || !s.password_hash) {
      return NextResponse.json({ error: 'Verification required' }, { status: 403 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Unable to validate verification status' }, { status: 500 });
  }

  // Enforce verification: email present, verified, and password set
  try {
    const verRows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [auth.student_id]);
    const ver = verRows && verRows[0];
    if (!ver || !ver.email || !ver.is_email_verified || !ver.password_hash) {
      return NextResponse.json({ error: 'Verification required: verify email and set password to create requests.' }, { status: 403 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Unable to validate verification status.' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const certificateType = formData.get('certificateType');
    const clerkType = formData.get('clerkType');
    const paymentAmount = formData.get('paymentAmount');
    const transactionId = formData.get('transactionId');
    const paymentScreenshotFile = formData.get('paymentScreenshot');

    let paymentScreenshotBuffer = null;
    if (paymentScreenshotFile) {
        const bytes = await paymentScreenshotFile.arrayBuffer();
        paymentScreenshotBuffer = Buffer.from(bytes);
    }
    
    if (!certificateType || !clerkType || !paymentAmount) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (paymentAmount > 0 && (!transactionId || !paymentScreenshotBuffer)) {
        return NextResponse.json({ error: 'Transaction ID and screenshot are required for paid certificates' }, { status: 400 });
    }

    // compute academic_year from roll_no (single source of truth)
    let academicYear;
    try {
      academicYear = getResolvedCurrentAcademicYear(auth.roll_no);
    } catch (e1) {
      // If token roll_no is malformed or not in expected format, try resolving from DB
      try {
        const rollRows = await query('SELECT roll_no FROM students WHERE id = ?', [auth.student_id]);
        const dbRoll = rollRows && rollRows[0] && rollRows[0].roll_no;
        if (dbRoll) {
          academicYear = getResolvedCurrentAcademicYear(dbRoll);
        }
      } catch (e2) {
        console.warn('[REQUESTS] Failed to resolve roll_no from DB', e2);
      }
      if (!academicYear) {
        const msg = (e1 && e1.message) ? e1.message : 'Invalid roll number format – cannot determine academic year';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    try {
      // PRE-CHECK: see if a request exists for this student/certificate/year
      const existingRows = await query(
        `SELECT request_id, status FROM student_requests WHERE student_id = ? AND certificate_type = ? AND academic_year = ? LIMIT 1`,
        [auth.student_id, certificateType, academicYear]
      );

      if (existingRows && existingRows.length > 0) {
        const existing = existingRows[0];
        if (existing.status && existing.status !== 'REJECTED') {
          // active (PENDING/APPROVED) - block
          return NextResponse.json({ error: 'An active request already exists for this certificate and academic year.' }, { status: 409 });
        }

        // status === 'REJECTED' -> allow re-request by reusing the same row (UPDATE)
        try {
          const updateResult = await query(
            `UPDATE student_requests SET payment_amount = ?, transaction_id = ?, payment_screenshot = ?, status = ?, updated_at = NOW(), completed_at = NULL WHERE request_id = ?`,
            [paymentAmount, transactionId, paymentScreenshotBuffer,  'PENDING', existing.request_id]
          );
          if (updateResult.affectedRows === 1) {
            return NextResponse.json({ success: true, requestId: existing.request_id });
          } else {
            return NextResponse.json({ error: 'Failed to update rejected request' }, { status: 500 });
          }
        } catch (err) {
          if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
            return NextResponse.json({ error: 'Certificate already requested for this academic year.' }, { status: 409 });
          }
          console.error('Error updating rejected student request:', err);
          return NextResponse.json({ error: 'An error occurred while updating the request' }, { status: 500 });
        }
      }

      // No existing row - safe to insert
      const result = await query(
        'INSERT INTO student_requests (student_id, certificate_type,  academic_year, payment_amount, transaction_id, payment_screenshot, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [auth.student_id, certificateType,  academicYear, paymentAmount, transactionId, paymentScreenshotBuffer, 'PENDING']
      );
      if (result.affectedRows === 1) {
        return NextResponse.json({ success: true, requestId: result.insertId });
      } else {
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
      }
    } catch (err) {
      // handle duplicate unique constraint (race or DB-level)
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        return NextResponse.json({ error: 'Certificate already requested for this academic year.' }, { status: 409 });
      }
      console.error('Error inserting student request:', err);
      return NextResponse.json({ error: 'An error occurred while creating the request' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred while creating the request' }, { status: 500 });
  }
}
