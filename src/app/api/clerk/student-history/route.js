import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentImportLogs, clerks } from '@/db/schema';
import { eq, and, ne, sql, desc, inArray, isNotNull } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/mysql-core';
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

    // 1. Define subqueries for unionAll
    const addedSub = db.select({
      rollNo: students.roll_no,
      actionType: sql`'ADDED'`.as('actionType'),
      clerkId: students.added_by_clerk_id,
      actionTime: students.created_at,
      totalRecords: sql`NULL`.as('totalRecords')
    })
    .from(students)
    .where(isNotNull(students.added_by_clerk_id));

    const updatedSub = db.select({
      rollNo: students.roll_no,
      actionType: sql`'UPDATED'`.as('actionType'),
      clerkId: students.updated_by_clerk_id,
      actionTime: students.updated_at,
      totalRecords: sql`NULL`.as('totalRecords')
    })
    .from(students)
    .where(and(
      isNotNull(students.updated_by_clerk_id),
      isNotNull(students.updated_at),
      ne(students.updated_at, students.created_at)
    ));

    const importedSub = db.select({
      rollNo: sql`NULL`.as('rollNo'),
      actionType: sql`'IMPORTED'`.as('actionType'),
      clerkId: studentImportLogs.clerk_id,
      actionTime: studentImportLogs.created_at,
      totalRecords: studentImportLogs.total_records
    })
    .from(studentImportLogs);

    // 2. Combine with Union (Drizzle unionAll)
    const activityUnion = unionAll(addedSub, updatedSub, importedSub).as('activity');   

    // 3. Main Query with Filters (DB-level sorting and combined filtering)
    let conditions = [];
    if (actionTypes.length > 0) {
      conditions.push(inArray(activityUnion.actionType, actionTypes));
    }

    if (dateRange === '7') {
      conditions.push(sql`${activityUnion.actionTime} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    } else if (dateRange === '30') {
      conditions.push(sql`${activityUnion.actionTime} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);        
    }

    if (scope !== 'all') {
      conditions.push(eq(activityUnion.clerkId, currentClerkId));
    }

    // Use a CTE or subquery for joining clerks to ensure high performance
    let query;
    if (scope === 'my') {
      query = db.select({
        rollNo: activityUnion.rollNo,
        actionType: activityUnion.actionType,
        actionTime: activityUnion.actionTime,
        totalRecords: activityUnion.totalRecords,
        clerkId: activityUnion.clerkId,
        clerkName: sql`NULL`.as('clerkName')
      })
      .from(activityUnion);
    } else {
      query = db.select({
        rollNo: activityUnion.rollNo,
        actionType: activityUnion.actionType,
        actionTime: activityUnion.actionTime,
        totalRecords: activityUnion.totalRecords,
        clerkId: activityUnion.clerkId,
        clerkName: clerks.name
      })
      .from(activityUnion)
      .leftJoin(clerks, eq(activityUnion.clerkId, clerks.id));
    }

    const records = await query
      .where(and(...conditions))
      .orderBy(desc(activityUnion.actionTime))
      .limit(100); 

    // 4. Counts (Calculated on base tables for maximum performance and index utilization)
    let addedConds = [isNotNull(students.added_by_clerk_id)];
    let updatedConds = [
      isNotNull(students.updated_by_clerk_id),
      isNotNull(students.updated_at),
      ne(students.updated_at, students.created_at)
    ];
    let importedConds = [];

    if (dateRange === '7') {
      addedConds.push(sql`${students.created_at} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
      updatedConds.push(sql`${students.updated_at} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
      importedConds.push(sql`${studentImportLogs.created_at} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    } else if (dateRange === '30') {
      addedConds.push(sql`${students.created_at} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);
      updatedConds.push(sql`${students.updated_at} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);
      importedConds.push(sql`${studentImportLogs.created_at} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);
    }

    const [
      addedCountRows,
      updatedCountRows,
      importedCountRows,
      myAddedCountRows,
      myUpdatedCountRows,
      myImportedCountRows
    ] = await Promise.all([
      db.select({ count: sql`COUNT(*)` }).from(students).where(and(...addedConds)),
      db.select({ count: sql`COUNT(*)` }).from(students).where(and(...updatedConds)),
      db.select({ count: sql`COUNT(*)` }).from(studentImportLogs).where(and(...importedConds)),
      db.select({ count: sql`COUNT(*)` }).from(students).where(and(...addedConds, eq(students.added_by_clerk_id, currentClerkId))),
      db.select({ count: sql`COUNT(*)` }).from(students).where(and(...updatedConds, eq(students.updated_by_clerk_id, currentClerkId))),
      db.select({ count: sql`COUNT(*)` }).from(studentImportLogs).where(and(...importedConds, eq(studentImportLogs.clerk_id, currentClerkId)))
    ]);

    const allCount = Number(addedCountRows[0]?.count || 0) + Number(updatedCountRows[0]?.count || 0) + Number(importedCountRows[0]?.count || 0);
    const myCount = Number(myAddedCountRows[0]?.count || 0) + Number(myUpdatedCountRows[0]?.count || 0) + Number(myImportedCountRows[0]?.count || 0);

    return apiResponse({ records, myCount, allCount });
  } catch (error) {
    logger.error(error, 'Error in student-history GET');
    return apiError('Internal Server Error', 500);
  }
}
