import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

async function getRollNumberFromToken(request) {
  const token = request.cookies.get('student_auth')?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return payload.roll_no;
  } catch (error) {
    return null;
  }
}

export async function GET(request) {
  const roll_number = await getRollNumberFromToken(request);
  if (!roll_number) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await query(
      'SELECT request_id, certificate_type, status, created_at FROM student_requests WHERE roll_number = ? ORDER BY created_at DESC',
      [roll_number]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request) {
  const roll_number = await getRollNumberFromToken(request);
  if (!roll_number) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const result = await query(
      'INSERT INTO student_requests (roll_number, certificate_type, clerk_type, payment_amount, transaction_id, payment_screenshot) VALUES (?, ?, ?, ?, ?, ?)',
      [roll_number, certificateType, clerkType, paymentAmount, transactionId, paymentScreenshotBuffer]
    );

    if (result.affectedRows === 1) {
      return NextResponse.json({ success: true, requestId: result.insertId });
    } else {
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred while creating the request' }, { status: 500 });
  }
}
