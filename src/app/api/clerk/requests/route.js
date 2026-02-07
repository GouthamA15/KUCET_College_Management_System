import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

async function getClerkFromToken(request) {
  const token = request.cookies.get('clerk_auth')?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return payload;
  } catch (error) {
    return null;
  }
}

export async function GET(request) {
  const clerk = await getClerkFromToken(request);
  if (!clerk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clerkType = searchParams.get('clerkType');
  const workspace = searchParams.get('workspace');
  const date = searchParams.get('date');
  const historyDates = searchParams.get('historyDates');
  const statusFilter = searchParams.get('status');
  const certificateTypeFilter = searchParams.get('certificate_type');

  if (!clerkType || clerk.role !== clerkType) {
    // This check ensures a clerk can only access requests for their own role.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Map clerk roles to certificate types (keeps logic consistent with frontend)
    const clerkToTypes = {
      admission: [
        'Bonafide Certificate',
        'Course Completion Certificate',
        'Transfer Certificate (TC)',
        'Migration Certificate',
        'Study Conduct Certificate',
      ],
      scholarship: [
        'Income Tax (IT) Certificate',
        'Custodian Certificate',
      ],
    };

    const certTypes = clerkToTypes[clerkType];
    if (!certTypes || certTypes.length === 0) {
      return NextResponse.json({ error: 'No certificate types configured for this clerk' }, { status: 400 });
    }

    // If asking for history dates: return distinct completed_at dates for approved/rejected
    if (historyDates && historyDates.toString() === 'true') {
      // Return distinct history dates as YYYY-MM-DD strings derived directly from DB
      const placeholders = certTypes.map(() => '?').join(',');
      // Use DATE_FORMAT to ensure the DB returns a plain YYYY-MM-DD string (no timezone conversion here)
      const sqlDates = `SELECT DISTINCT DATE_FORMAT(sr.completed_at, '%Y-%m-%d') AS history_date
        FROM student_requests sr
        WHERE sr.certificate_type IN (${placeholders}) AND sr.status IN ('APPROVED','REJECTED') AND sr.completed_at IS NOT NULL
        ORDER BY history_date DESC`;
      const rows = await query(sqlDates, certTypes);
      const dates = (rows || []).map(r => r.history_date).filter(Boolean);
      return NextResponse.json(dates);
    }

    // Build listing query depending on workspace mode
    const typesParam = [...certTypes];
    let sql;
    const whereClauses = [];
    const params = [];
    // Filter by allowed clerk cert types
    whereClauses.push(`sr.certificate_type IN (${typesParam.map(() => '?').join(',')})`);
    params.push(...typesParam);

    if (workspace && workspace.toString() === 'history') {
      // Only approved/rejected for a specific date
      whereClauses.push("sr.status IN ('APPROVED','REJECTED')");
      if (!date) {
        return NextResponse.json([], { status: 200 });
      }
      // Filter on DATE_FORMAT to match the YYYY-MM-DD string returned by the historyDates API
      whereClauses.push("DATE_FORMAT(sr.completed_at, '%Y-%m-%d') = ?");
      params.push(date);
      sql = `SELECT
        sr.request_id,
        s.roll_no as roll_number,
        s.name as student_name,
        DATE_FORMAT(sr.completed_at, '%Y-%m-%d') AS date,
        sr.certificate_type,
        sr.status,
        sr.payment_amount,
        sr.transaction_id,
        sr.payment_screenshot,
        sr.academic_year,
        sr.created_at,
        sr.completed_at,
        sr.updated_at,
        sr.reject_reason
      FROM student_requests sr
      JOIN students s ON sr.student_id = s.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY sr.completed_at DESC, sr.updated_at DESC`;
    } else {
      // Active mode: pending only
      whereClauses.push("sr.status = 'PENDING'");
      sql = `SELECT
        sr.request_id,
        s.roll_no as roll_number,
        s.name as student_name,
        sr.certificate_type,
        sr.status,
        sr.payment_amount,
        sr.transaction_id,
        sr.payment_screenshot,
        sr.academic_year,
        sr.created_at
      FROM student_requests sr
      JOIN students s ON sr.student_id = s.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY sr.created_at ASC`;
    }

    // Optional single certificate type filter
    if (certificateTypeFilter) {
      whereClauses.push('sr.certificate_type = ?');
      params.push(certificateTypeFilter);
    }
    // Optional status filter (use carefully; overrides defaults if provided)
    if (statusFilter) {
      whereClauses.push('sr.status = ?');
      params.push(statusFilter);
    }

    // Rebuild sql with optional filters if added after initial build
    sql = sql.replace(/WHERE [\s\S]*?ORDER BY/, `WHERE ${whereClauses.join(' AND ')} ORDER BY`);

    const rows = await query(sql, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching clerk requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
