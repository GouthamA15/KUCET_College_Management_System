import { db } from '@/db';
import { students, studentImportLogs, clerks } from '@/db/schema';
import { eq, and, ne, sql, desc, or, inArray, isNotNull } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req) {
  const user = await getAuthUser('clerk');
  if (!user) return apiError('Unauthorized', 401);

  const currentClerkId = user?.clerkId || user.id || null;
  if (!currentClerkId) return apiError('Unauthorized: clerk id missing in token', 401);

  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const scope = (params.get('scope') || 'my').toLowerCase();
    const actionTypesRaw = params.getAll('actionType') || [];
    const actionTypes = actionTypesRaw.map((v) => String(v || '').toUpperCase()).filter((v) => ['ADDED', 'UPDATED', 'IMPORTED'].includes(v));
    const dateRange = (params.get('dateRange') || 'all').toLowerCase();

    // 1. Define subqueries
    const addedSub = db.select({
      rollNo: students.roll_no,
      actionType: sql`'ADDED'`,
      clerkId: students.added_by_clerk_id,
      actionTime: students.created_at,
      totalRecords: sql`NULL`
    }).from(students);

    const updatedSub = db.select({
      rollNo: students.roll_no,
      actionType: sql`'UPDATED'`,
      clerkId: students.updated_by_clerk_id,
      actionTime: students.updated_at,
      totalRecords: sql`NULL`
    })
    .from(students)
    .where(and(
      isNotNull(students.updated_at),
      ne(students.updated_at, students.created_at)
    ));

    const importedSub = db.select({
      rollNo: sql`NULL`,
      actionType: sql`'IMPORTED'`,
      clerkId: studentImportLogs.clerk_id,
      actionTime: studentImportLogs.created_at,
      totalRecords: studentImportLogs.total_records
    }).from(studentImportLogs);

    // 2. Combine with Union (Drizzle unionAll)
    const activityUnion = db.unionAll(addedSub, updatedSub, importedSub).as('activity');

    // 3. Main Query with Filters
    let conditions = [];
    if (actionTypes.length > 0) {
      conditions.push(inArray(activityUnion.actionType, actionTypes));
    }

    if (dateRange === '7') {
      conditions.push(sql`${activityUnion.actionTime} >= NOW() - INTERVAL 7 DAY`);
    } else if (dateRange === '30') {
      conditions.push(sql`${activityUnion.actionTime} >= NOW() - INTERVAL 30 DAY`);
    }

    if (scope !== 'all') {
      conditions.push(eq(activityUnion.clerkId, currentClerkId));
    }

    const records = await db.select({
      rollNo: activityUnion.rollNo,
      actionType: activityUnion.actionType,
      actionTime: activityUnion.actionTime,
      totalRecords: activityUnion.totalRecords,
      clerkId: activityUnion.clerkId,
      clerkName: sql`CASE WHEN ${scope} = 'my' THEN NULL ELSE ${clerks.name} END`
    })
    .from(activityUnion)
    .leftJoin(clerks, eq(activityUnion.clerkId, clerks.id))
    .where(and(...conditions))
    .orderBy(desc(activityUnion.actionTime));

    // 4. Counts
    const countBase = (conds) => db.select({ count: sql`COUNT(*)` }).from(activityUnion).where(and(...conds));
    
    let baseConds = [];
    if (dateRange === '7') baseConds.push(sql`${activityUnion.actionTime} >= NOW() - INTERVAL 7 DAY`);
    else if (dateRange === '30') baseConds.push(sql`${activityUnion.actionTime} >= NOW() - INTERVAL 30 DAY`);

    const allCountRows = await countBase(baseConds);
    const myCountRows = await countBase([...baseConds, eq(activityUnion.clerkId, currentClerkId)]);

    const allCount = Number(allCountRows[0]?.count || 0);
    const myCount = Number(myCountRows[0]?.count || 0);

    return apiResponse({ records, myCount, allCount });
  } catch (error) {
    console.error('Error in student-history GET:', error);
    return apiError('Internal Server Error', 500);
  }
}
