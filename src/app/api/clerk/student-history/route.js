import logger from '@/lib/logger';
import { db } from '@/db';
import { students, studentImportLogs, clerks } from '@/db/schema';
import { eq, and, ne, sql, inArray, isNotNull } from 'drizzle-orm';
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

    // Build date filter conditions
    const getDateCondition = (timeField) => {
      if (dateRange === '7') {
        return sql`${timeField} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
      } else if (dateRange === '30') {
        return sql`${timeField} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
      }
      return undefined;
    };

    // Helper to build conditions array that filters out undefined
    const buildConditions = (arr) => arr.filter(c => c !== undefined);
    
    // Helper to apply where clause safely
    const applyWhere = (query, conditions) => {
      const filtered = buildConditions(conditions);
      if (filtered.length === 0) return query;
      return filtered.length === 1 ? query.where(filtered[0]) : query.where(and(...filtered));
    };

    // Fetch all three activity types
    const [addedRecords, updatedRecords, importedRecords] = await Promise.all([
      // Added records
      applyWhere(
        db.select({
          rollNo: students.roll_no,
          actionType: sql`'ADDED'`.as('actionType'),
          clerkId: students.added_by_clerk_id,
          actionTime: students.created_at,
          totalRecords: sql`null`.as('totalRecords')
        })
          .from(students),
        [
          isNotNull(students.added_by_clerk_id),
          getDateCondition(students.created_at),
          scope !== 'all' ? eq(students.added_by_clerk_id, currentClerkId) : undefined
        ]
      ),

      // Updated records
      applyWhere(
        db.select({
          rollNo: students.roll_no,
          actionType: sql`'UPDATED'`.as('actionType'),
          clerkId: students.updated_by_clerk_id,
          actionTime: students.updated_at,
          totalRecords: sql`null`.as('totalRecords')
        })
          .from(students),
        [
          isNotNull(students.updated_by_clerk_id),
          isNotNull(students.updated_at),
          ne(students.updated_at, students.created_at),
          getDateCondition(students.updated_at),
          scope !== 'all' ? eq(students.updated_by_clerk_id, currentClerkId) : undefined
        ]
      ),

      // Imported records
      applyWhere(
        db.select({
          rollNo: sql`null`.as('rollNo'),
          actionType: sql`'IMPORTED'`.as('actionType'),
          clerkId: studentImportLogs.clerk_id,
          actionTime: studentImportLogs.created_at,
          totalRecords: studentImportLogs.total_records
        })
          .from(studentImportLogs),
        [
          getDateCondition(studentImportLogs.created_at),
          scope !== 'all' ? eq(studentImportLogs.clerk_id, currentClerkId) : undefined
        ]
      )
    ]);

    // Combine all records
    let allRecords = [...addedRecords, ...updatedRecords, ...importedRecords];

    // Filter by action types if specified
    if (actionTypes.length > 0) {
      allRecords = allRecords.filter(r => actionTypes.includes(r.actionType));
    }

    // Sort by actionTime descending
    allRecords.sort((a, b) => {
      const timeA = new Date(a.actionTime).getTime();
      const timeB = new Date(b.actionTime).getTime();
      return timeB - timeA;
    });

    // Get unique clerk IDs and fetch clerk names
    const clerkIds = [...new Set(allRecords.map(r => r.clerkId).filter(Boolean))];
    let clerkMap = {};
    if (clerkIds.length > 0) {
      const clerkRows = await db.select({
        id: clerks.id,
        name: clerks.name
      })
        .from(clerks)
        .where(inArray(clerks.id, clerkIds));

      clerkMap = Object.fromEntries(clerkRows.map(c => [c.id, c.name]));
    }

    // Enrich records with clerk names
    const enrichedRecords = allRecords.map(r => ({
      ...r,
      clerkName: scope === 'my' ? null : (clerkMap[r.clerkId] || null)
    }));

    // Count totals
    const [allAddedCount, allUpdatedCount, allImportedCount] = await Promise.all([
      applyWhere(
        db.select({ count: sql`COUNT(*)`.as('count') }).from(students),
        [
          isNotNull(students.added_by_clerk_id),
          getDateCondition(students.created_at)
        ]
      ),
      applyWhere(
        db.select({ count: sql`COUNT(*)`.as('count') }).from(students),
        [
          isNotNull(students.updated_by_clerk_id),
          isNotNull(students.updated_at),
          ne(students.updated_at, students.created_at),
          getDateCondition(students.updated_at)
        ]
      ),
      applyWhere(
        db.select({ count: sql`COUNT(*)`.as('count') }).from(studentImportLogs),
        [
          getDateCondition(studentImportLogs.created_at)
        ]
      )
    ]);

    const [myAddedCount, myUpdatedCount, myImportedCount] = await Promise.all([
      applyWhere(
        db.select({ count: sql`COUNT(*)`.as('count') }).from(students),
        [
          eq(students.added_by_clerk_id, currentClerkId),
          getDateCondition(students.created_at)
        ]
      ),
      applyWhere(
        db.select({ count: sql`COUNT(*)`.as('count') }).from(students),
        [
          eq(students.updated_by_clerk_id, currentClerkId),
          isNotNull(students.updated_at),
          ne(students.updated_at, students.created_at),
          getDateCondition(students.updated_at)
        ]
      ),
      applyWhere(
        db.select({ count: sql`COUNT(*)`.as('count') }).from(studentImportLogs),
        [
          eq(studentImportLogs.clerk_id, currentClerkId),
          getDateCondition(studentImportLogs.created_at)
        ]
      )
    ]);

    const allCount = 
      Number(allAddedCount[0]?.count || 0) +
      Number(allUpdatedCount[0]?.count || 0) +
      Number(allImportedCount[0]?.count || 0);

    const myCount =
      Number(myAddedCount[0]?.count || 0) +
      Number(myUpdatedCount[0]?.count || 0) +
      Number(myImportedCount[0]?.count || 0);

    return apiResponse({ records: enrichedRecords, myCount, allCount });
  } catch (error) {
    const errorDetails = error instanceof Error ? error : new Error(String(error));
    logger.error({
      msg: 'Error in student-history GET',
      error: errorDetails,
      stack: errorDetails.stack,
      cause: error
    });
    return apiError('Internal Server Error', 500);
  }
}
