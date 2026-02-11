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
  const scope = (searchParams.get('scope') || 'my').toString();
  const statusFilterRaw = searchParams.getAll('status');
  const certificateTypeFilterRaw = searchParams.getAll('certificateType') || searchParams.getAll('certificate_type');

  if (!clerkType || clerk.role !== clerkType) {
    // This check ensures a clerk can only access requests for their own role.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Require clerk DB id in token for history accountability
  if (!clerk.id) {
    return NextResponse.json({ error: 'Clerk identity missing in token' }, { status: 401 });
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
    // Build listing query depending on workspace mode
    const typesParam = [...certTypes];
    const whereClauses = [];
    const params = [];
    // Filter by allowed clerk cert types
    whereClauses.push(`sr.certificate_type IN (${typesParam.map(() => '?').join(',')})`);
    params.push(...typesParam);

    // Handle optional filters coming as repeated query params or comma-separated
    const certificateTypeFilter = [];
    certificateTypeFilterRaw.forEach(v => {
      if (!v) return;
      v.split(',').map(s => s.trim()).filter(Boolean).forEach(s => certificateTypeFilter.push(s));
    });
    const statusFilter = [];
    statusFilterRaw.forEach(v => {
      if (!v) return;
      v.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).forEach(s => statusFilter.push(s));
    });

    let sql;
    if (workspace && workspace.toString() === 'history') {
      // Base: approved or rejected
      whereClauses.push("sr.status IN ('APPROVED','REJECTED')");

      // Scope filtering: my vs all
      if (scope === 'my') {
        whereClauses.push('sr.action_by_clerk_id = ?');
        params.push(clerk.id);
      }

      // Apply certificate_type filters if provided
      if (certificateTypeFilter.length > 0) {
        whereClauses.push(`sr.certificate_type IN (${certificateTypeFilter.map(() => '?').join(',')})`);
        params.push(...certificateTypeFilter);
      }

      // Apply status filters if provided (must be subset of approved/rejected)
      if (statusFilter.length > 0) {
        whereClauses.push(`sr.status IN (${statusFilter.map(() => '?').join(',')})`);
        params.push(...statusFilter);
      }

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
        sr.created_at,
        sr.completed_at,
        sr.updated_at,
        sr.reject_reason,
        sr.action_by_clerk_id,
        sr.action_by_role
      FROM student_requests sr
      JOIN students s ON sr.student_id = s.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY sr.completed_at DESC, sr.updated_at DESC`;

      // Execute main rows
      const rows = await query(sql, params);

      // Compute counts (ignore pagination)
      // Build base count clauses used for both counts (respecting filters except scope)
      const baseCountClauses = [];
      const baseCountParams = [];
      baseCountClauses.push(`sr.certificate_type IN (${typesParam.map(() => '?').join(',')})`);
      baseCountParams.push(...typesParam);
      baseCountClauses.push("sr.status IN ('APPROVED','REJECTED')");

      if (certificateTypeFilter.length > 0) {
        baseCountClauses.push(`sr.certificate_type IN (${certificateTypeFilter.map(() => '?').join(',')})`);
        baseCountParams.push(...certificateTypeFilter);
      }
      if (statusFilter.length > 0) {
        baseCountClauses.push(`sr.status IN (${statusFilter.map(() => '?').join(',')})`);
        baseCountParams.push(...statusFilter);
      }

      // All history count
      const allCountSql = `SELECT COUNT(*) AS cnt FROM student_requests sr WHERE ${baseCountClauses.join(' AND ')}`;
      const allCountRows = await query(allCountSql, baseCountParams);
      const allHistoryCount = allCountRows?.[0]?.cnt ?? 0;

      // My history count
      const myCountSql = `SELECT COUNT(*) AS cnt FROM student_requests sr WHERE ${baseCountClauses.join(' AND ')} AND sr.action_by_clerk_id = ?`;
      const myCountRows = await query(myCountSql, [...baseCountParams, clerk.id]);
      const myHistoryCount = myCountRows?.[0]?.cnt ?? 0;

      return NextResponse.json({ records: rows, myHistoryCount, allHistoryCount });
    } else {
      // Active mode: pending only (no grouping, unaffected by scope)
      whereClauses.push("sr.status = 'PENDING'");

      // Optional filters for active mode
      if (certificateTypeFilter.length > 0) {
        whereClauses.push(`sr.certificate_type IN (${certificateTypeFilter.map(() => '?').join(',')})`);
        params.push(...certificateTypeFilter);
      }
      if (statusFilter.length > 0) {
        // allow filtering pending by status if explicitly provided
        whereClauses.push(`sr.status IN (${statusFilter.map(() => '?').join(',')})`);
        params.push(...statusFilter);
      }

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

      const rows = await query(sql, params);
      return NextResponse.json({ records: rows });
    }
  } catch (error) {
    console.error('Error fetching clerk requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
