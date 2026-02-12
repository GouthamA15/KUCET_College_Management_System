import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { query } from '@/lib/db';

// Verify JWT (Edge compatible)
async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const clerkAuthCookie = cookieStore.get('clerk_auth');
    const token = clerkAuthCookie ? clerkAuthCookie.value : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyJwt(token, process.env.JWT_SECRET);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentClerkId = decoded?.clerkId || null;
    if (!currentClerkId) return NextResponse.json({ error: 'Unauthorized: clerk id missing in token' }, { status: 401 });

    const url = new URL(req.url);
    const params = url.searchParams;

    const scope = (params.get('scope') || 'my').toLowerCase();
    const actionTypesRaw = params.getAll('actionType') || [];
    const actionTypes = actionTypesRaw.map((v) => String(v || '').toUpperCase()).filter((v) => ['ADDED', 'UPDATED', 'IMPORTED'].includes(v));
    const dateRange = (params.get('dateRange') || 'all').toLowerCase();

    // Build the UNION subquery (no scope/actionType/date filters inside subqueries)
    const unionSql = `
      SELECT s.roll_no AS rollNo, 'ADDED' AS actionType, s.added_by_clerk_id AS clerkId, s.created_at AS actionTime, NULL AS totalRecords
      FROM students s

      UNION ALL

      SELECT s.roll_no AS rollNo, 'UPDATED' AS actionType, s.updated_by_clerk_id AS clerkId, s.updated_at AS actionTime, NULL AS totalRecords
      FROM students s
      WHERE s.updated_at IS NOT NULL
        AND s.updated_at != s.created_at

      UNION ALL

      SELECT NULL AS rollNo, 'IMPORTED' AS actionType, l.clerk_id AS clerkId, l.created_at AS actionTime, l.total_records AS totalRecords
      FROM student_import_logs l
    `;

    // Build outer WHERE clauses and parameter list in explicit order
    const whereParts = ['1=1'];
    const sqlParams = [];

    if (actionTypes.length > 0) {
      whereParts.push(`actionType IN (${actionTypes.map(() => '?').join(',')})`);
      actionTypes.forEach((t) => sqlParams.push(t));
    }

    if (dateRange === '7') {
      whereParts.push('actionTime >= NOW() - INTERVAL 7 DAY');
    } else if (dateRange === '30') {
      whereParts.push('actionTime >= NOW() - INTERVAL 30 DAY');
    }

    // Scope filter applied after wrapping union: either all or only current clerk
    whereParts.push(`(? = 'all' OR clerkId = ?)`);
    // params order for recordsSql: first param is used by CASE WHEN (clerkName), then params from WHERE in same sequence

    // Compose WHERE SQL
    const whereSql = `WHERE ${whereParts.join(' AND ')}`;

    // Build records SQL with clerk name (nullified when scope='my')
    const recordsSql = `SELECT activity.rollNo, activity.actionType, activity.actionTime, activity.totalRecords, activity.clerkId, CASE WHEN ? = 'my' THEN NULL ELSE c.name END AS clerkName FROM (${unionSql}) AS activity LEFT JOIN clerks c ON activity.clerkId = c.id ${whereSql} ORDER BY actionTime DESC`;

    // Prepare parameters: first for CASE WHEN, then params for actionTypes/dateRange/scope
    const recordsParams = [];
    recordsParams.push(scope); // for CASE WHEN
    // actionTypes params were already pushed in 'sqlParams' in order
    sqlParams.forEach(p => recordsParams.push(p));
    // append scope clause params: scope and currentClerkId
    recordsParams.push(scope, currentClerkId);

    console.log('Scope:', scope);
    console.log('Clerk ID:', currentClerkId);
    console.log('recordsSql params:', recordsParams);

    // Fetch records
    const records = await query(recordsSql, recordsParams);

    // Counts: must respect dateRange, ignore actionType filter
    const countWhereParts = [];
    if (dateRange === '7') countWhereParts.push('actionTime >= NOW() - INTERVAL 7 DAY');
    else if (dateRange === '30') countWhereParts.push('actionTime >= NOW() - INTERVAL 30 DAY');
    const countWhereSql = countWhereParts.length > 0 ? `WHERE ${countWhereParts.join(' AND ')}` : '';

    const allCountSql = `SELECT COUNT(*) as cnt FROM (${unionSql}) AS activity ${countWhereSql}`;
    const allCountRows = await query(allCountSql, []);
    const allCount = (allCountRows && allCountRows[0] && allCountRows[0].cnt) ? Number(allCountRows[0].cnt) : 0;

    const myCountSql = `SELECT COUNT(*) as cnt FROM (${unionSql}) AS activity ${countWhereSql} ${countWhereSql ? 'AND' : 'WHERE'} clerkId = ?`;
    // If countWhereSql is empty the above will add WHERE clerkId = ?; if non-empty it appends AND clerkId = ? as intended
    const myCountRows = await query(myCountSql, [currentClerkId]);
    const myCount = (myCountRows && myCountRows[0] && myCountRows[0].cnt) ? Number(myCountRows[0].cnt) : 0;

    return NextResponse.json({ records, myCount, allCount }, { status: 200 });
  } catch (error) {
    console.error('Error in student-history GET:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
