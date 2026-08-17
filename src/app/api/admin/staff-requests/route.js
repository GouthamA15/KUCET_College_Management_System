import { db } from '@/db';
import { staffRegistrationRequests } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { wrapHandler } from '@/lib/api-utils';

export const GET = wrapHandler({
  auth: 'admin',
  handler: async () => {
    const { staffAccounts } = await import('@/db/schema');
    const requests = await db
      .select({
        id: staffRegistrationRequests.id,
        name: staffRegistrationRequests.name,
        email: staffRegistrationRequests.email,
        employee_id: staffRegistrationRequests.employee_id,
        staff_category: staffRegistrationRequests.staff_category,
        requested_role: staffRegistrationRequests.requested_role,
        designation: staffRegistrationRequests.designation,
        academic_affiliations: staffRegistrationRequests.academic_affiliations,
        email_verified_at: staffRegistrationRequests.email_verified_at,
        status: staffRegistrationRequests.status,
        rejection_reason: staffRegistrationRequests.rejection_reason,
        processed_at: staffRegistrationRequests.processed_at,
        processed_by_admin_id: staffRegistrationRequests.processed_by_admin_id,
        created_at: staffRegistrationRequests.created_at,
        updated_at: staffRegistrationRequests.updated_at,
        account_status: staffAccounts.account_status
      })
      .from(staffRegistrationRequests)
      .leftJoin(staffAccounts, eq(staffRegistrationRequests.email, staffAccounts.email))
      .orderBy(desc(staffRegistrationRequests.created_at));

    const { academicDepartments, academicPrograms } = await import('@/db/schema');
    const depts = await db.select().from(academicDepartments);
    const progs = await db.select().from(academicPrograms);

    const deptMap = {};
    depts.forEach(d => { deptMap[d.department_code] = d.department_name; });
    
    const progMap = {};
    progs.forEach(p => { progMap[p.program_code] = p.program_name; });

    const processedRequests = requests.map(req => {
      let affils = req.academic_affiliations;
      if (typeof affils === 'string') {
        try { affils = JSON.parse(affils); } catch { affils = []; }
      }
      
      if (Array.isArray(affils)) {
        affils = affils.map(a => ({
          department_code: a.department_code,
          department_name: deptMap[a.department_code] || a.department_code,
          program_codes: a.program_codes || [],
          program_names: (a.program_codes || []).map(pc => progMap[pc] || pc)
        }));
      }

      return {
        ...req,
        academic_affiliations: affils
      };
    });

    return { success: true, requests: processedRequests };
  }
});
