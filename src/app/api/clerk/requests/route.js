import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, students } from '@/db/schema';
import { eq, and, inArray, sql, desc, asc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
  const clerk = await getAuthUser('clerk');
  if (!clerk) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const clerkType = searchParams.get('clerkType');
  const workspace = searchParams.get('workspace');
  const scope = (searchParams.get('scope') || 'my').toString();
  const statusFilterRaw = searchParams.getAll('status');
  const certificateTypeFilterRaw = searchParams.getAll('certificateType') || searchParams.getAll('certificate_type');

  if (!clerkType || clerk.role !== clerkType) return apiError('Forbidden', 403);
  if (!clerk.id) return apiError('Clerk identity missing in token', 401);

  try {
    const clerkToTypes = {
      admission: [
        'Bonafide Certificate', 'No Objection Certificate', 'Course Completion Certificate',
        'Transfer Certificate (TC)', 'Migration Certificate', 'Study Conduct Certificate',
      ],
      scholarship: ['Income Tax (IT) Certificate', 'Custodian Certificate'],
    };

    const certTypes = clerkToTypes[clerkType];
    if (!certTypes || certTypes.length === 0) return apiError('No certificate types configured for this clerk', 400);

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

    const baseConditions = [inArray(studentRequests.certificate_type, certTypes)];

    if (workspace === 'history') {
      const historyConditions = [...baseConditions, inArray(studentRequests.status, ['APPROVED', 'REJECTED'])];
      if (scope === 'my') historyConditions.push(eq(studentRequests.action_by_clerk_id, clerk.id));
      if (certificateTypeFilter.length > 0) historyConditions.push(inArray(studentRequests.certificate_type, certificateTypeFilter));
      if (statusFilter.length > 0) historyConditions.push(inArray(studentRequests.status, statusFilter));

      const rows = await db.select({
        request_id: studentRequests.request_id,
        roll_number: students.roll_no,
        student_name: students.name,
        certificate_type: studentRequests.certificate_type,
        status: studentRequests.status,
        payment_amount: studentRequests.payment_amount,
        transaction_id: studentRequests.transaction_id,
        purpose: studentRequests.purpose,
        academic_year: studentRequests.academic_year,
        created_at: studentRequests.created_at,
        completed_at: studentRequests.completed_at,
        updated_at: studentRequests.updated_at,
        reject_reason: studentRequests.reject_reason,
        action_by_clerk_id: studentRequests.action_by_clerk_id,
        action_by_role: studentRequests.action_by_role
      })
      .from(studentRequests)
      .innerJoin(students, eq(studentRequests.student_id, students.id))
      .where(and(...historyConditions))
      .orderBy(desc(studentRequests.completed_at), desc(studentRequests.updated_at));

      // Counts
      const countBase = (conds) => db.select({ count: sql`COUNT(*)` }).from(studentRequests).where(and(...conds));
      
      const baseHistoryConds = [inArray(studentRequests.certificate_type, certTypes), inArray(studentRequests.status, ['APPROVED', 'REJECTED'])];
      if (certificateTypeFilter.length > 0) baseHistoryConds.push(inArray(studentRequests.certificate_type, certificateTypeFilter));
      if (statusFilter.length > 0) baseHistoryConds.push(inArray(studentRequests.status, statusFilter));

      const allCountRows = await countBase(baseHistoryConds);
      const myCountRows = await countBase([...baseHistoryConds, eq(studentRequests.action_by_clerk_id, clerk.id)]);

      return apiResponse({ 
        records: rows, 
        myHistoryCount: Number(myCountRows[0]?.count || 0), 
        allHistoryCount: Number(allCountRows[0]?.count || 0) 
      });
    } else {
      const activeConditions = [...baseConditions, eq(studentRequests.status, 'PENDING')];
      if (certificateTypeFilter.length > 0) activeConditions.push(inArray(studentRequests.certificate_type, certificateTypeFilter));
      if (statusFilter.length > 0) activeConditions.push(inArray(studentRequests.status, statusFilter));

      const rows = await db.select({
        request_id: studentRequests.request_id,
        roll_number: students.roll_no,
        student_name: students.name,
        certificate_type: studentRequests.certificate_type,
        status: studentRequests.status,
        payment_amount: studentRequests.payment_amount,
        transaction_id: studentRequests.transaction_id,
        purpose: studentRequests.purpose,
        academic_year: studentRequests.academic_year,
        created_at: studentRequests.created_at
      })
      .from(studentRequests)
      .innerJoin(students, eq(studentRequests.student_id, students.id))
      .where(and(...activeConditions))
      .orderBy(asc(studentRequests.created_at));

      return apiResponse({ records: rows });
    }
  } catch (error) {
    logger.error('Error fetching clerk requests:', error);
    return apiError('Failed to fetch requests', 500);
  }
}
