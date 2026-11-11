import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, students, studentRequestImages } from '@/db/schema';
import { eq, and, inArray, sql, desc, or } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getBranchFromRoll, validateRollNo } from '@/lib/rollNumber';
import { parsePurpose, formatPurpose } from '@/lib/certificate-utils';

export async function GET(request) {
  const staff = await getAuthUser('staff');
  if (!staff) return apiError('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const staffType = searchParams.get('staffType') || searchParams.get('type') || searchParams.get('role');
  const workspace = searchParams.get('workspace');
  const scope = (searchParams.get('scope') || 'my').toString();
  const statusFilterRaw = searchParams.getAll('status');
  const certificateTypeFilterRaw = searchParams.getAll('certificateType') || searchParams.getAll('certificate_type');

  const isHodUser = Boolean(staff.is_hod || staff.is_principal || staff.role === 'hod');
  const isPermitted = (staffType === 'hod' && isHodUser) || 
                      (staff.role === staffType) || 
                      (staff.role === 'admin');
  if (!staffType || !isPermitted) return apiError('Forbidden', 403);
  if (!staff.id) return apiError('Staff identity missing in token', 401);

  try {
    const roleToTypes = {
      hod: ['No Objection Certificate', 'Bonafide Certificate', 'Internship Certificate'],
      admission: [
        'Bonafide Certificate', 'No Objection Certificate', 'Course Completion Certificate',
        'Transfer Certificate (TC)', 'Migration Certificate', 'Study Conduct Certificate',
      ],
      scholarship: ['Income Tax (IT) Certificate', 'Custodian Certificate'],
    };

    const certTypes = roleToTypes[staffType];
    if (!certTypes || certTypes.length === 0) return apiError('No certificate types configured for this staff role', 400);

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

    // PHASE 5: HOD Request Scoping
    if (staffType === 'hod' && staff.role !== 'admin') {
      const branchCodeMap = {
        'CSE': '09', 'CSD': '30', 'ECE': '15', 'EEE': '12',
        'CIVIL': '00', 'IT': '18', 'MECH': '03'
      };
      const authorizedBranches = staff.authorized_branches || (staff.branch ? [staff.branch] : []);
      const codes = authorizedBranches.map(b => branchCodeMap[b]).filter(Boolean);
      if (codes.length > 0) {
        const branchClauses = codes.map(code =>
          sql`(${students.roll_no} LIKE ${'%567T' + code + '%'} OR ${students.roll_no} LIKE ${'%567' + code + '%L'})`
        );
        baseConditions.push(sql`(${sql.join(branchClauses, sql` OR `)})`);
      } else {
        baseConditions.push(sql`1 = 0`); // Fail-safe if branch is invalid
      }
    }

    if (workspace === 'history') {
      const historyConditions = [...baseConditions, inArray(studentRequests.status, ['APPROVED', 'REJECTED'])];
      if (scope === 'my') {
        if (staffType === 'hod') {
          historyConditions.push(or(
            eq(studentRequests.action_by_staff_id, staff.id),
            eq(studentRequests.hod_staff_id, staff.id)
          ));
        } else {
          historyConditions.push(eq(studentRequests.action_by_staff_id, staff.id));
        }
      }
      if (certificateTypeFilter.length > 0) historyConditions.push(inArray(studentRequests.certificate_type, certificateTypeFilter));
      if (statusFilter.length > 0) historyConditions.push(inArray(studentRequests.status, statusFilter));

      const rows = await db.select({
        request_id: studentRequests.request_id,
        roll_number: students.roll_no,
        student_name: students.name,
        certificate_type: studentRequests.certificate_type,
        status: studentRequests.status,
        hod_approval_status: studentRequests.hod_approval_status,
        hod_staff_id: studentRequests.hod_staff_id,
        hod_approved_at: studentRequests.hod_approved_at,
        hod_rejection_reason: studentRequests.hod_rejection_reason,
        payment_amount: studentRequests.payment_amount,
        transaction_id: studentRequests.transaction_id,
        payment_screenshot: studentRequestImages.payment_screenshot,
        purpose: studentRequests.purpose,
        academic_year: studentRequests.academic_year,
        created_at: studentRequests.created_at,
        completed_at: studentRequests.completed_at,
        updated_at: studentRequests.updated_at,
        reject_reason: studentRequests.reject_reason,
        action_by_staff_id: studentRequests.action_by_staff_id,
        action_by_role: studentRequests.action_by_role,
        is_flagged: studentRequests.is_flagged,
        flag_details: studentRequests.flag_details,
        payment_hash: studentRequests.payment_hash,
        admission_type: studentRequests.admission_type,
        study_year: studentRequests.study_year,
        study_semester: studentRequests.study_semester,
        years_at_kucet: studentRequests.years_at_kucet,
        certificate_format: studentRequests.certificate_format,
        generated_attendance: studentRequests.generated_attendance
      })
      .from(studentRequests)
      .innerJoin(students, eq(studentRequests.student_id, students.id))
      .leftJoin(studentRequestImages, eq(studentRequests.request_id, studentRequestImages.request_id))
      .where(and(...historyConditions))
      .orderBy(desc(studentRequests.completed_at), desc(studentRequests.updated_at));

      let mappedRows = rows.map(r => {
        const parsed = parsePurpose(r.purpose);
        const branch = getBranchFromRoll(r.roll_number);
        const rollValidation = validateRollNo(r.roll_number);
        const admissionType = r.admission_type || rollValidation?.admissionType || 'Regular';
        return {
          ...r,
          branch,
          admission_type: admissionType,
          study_year: r.study_year || (admissionType === 'Lateral' ? 2 : 1),
          study_semester: r.study_semester || (admissionType === 'Lateral' ? 3 : 1),
          years_at_kucet: r.years_at_kucet || 1,
          purpose_type: parsed.purpose_type,
          purpose_custom: parsed.purpose_custom,
          purpose: (parsed.purpose_type === 'Other' && parsed.purpose_custom)
            ? `Other — ${parsed.purpose_custom}`
            : (formatPurpose(r.purpose) || r.purpose)
        };
      });

      // Scope HOD history to authorized branches
      if (staffType === 'hod' && staff.role !== 'admin') {
        const authorizedBranches = staff.authorized_branches || (staff.branch ? [staff.branch] : []);
        if (authorizedBranches.length > 0) {
          mappedRows = mappedRows.filter(r => authorizedBranches.includes(getBranchFromRoll(r.roll_number)));
        } else {
          mappedRows = [];
        }
      }

      return apiResponse({ 
        records: mappedRows, 
        myHistoryCount: mappedRows.filter(r => r.action_by_staff_id === staff.id || r.hod_staff_id === staff.id).length, 
        allHistoryCount: mappedRows.length 
      });
    } else {
      const activeConditions = [...baseConditions, eq(studentRequests.status, 'PENDING')];
      
      // Workflow stage filtering
      if (staffType === 'admission') {
        // Admission staff only sees Bonafide and NOC after HOD approves or if HOD approval is not required / unavailable
        activeConditions.push(
          or(
            sql`${studentRequests.certificate_type} NOT IN ('Bonafide Certificate', 'No Objection Certificate')`,
            sql`${studentRequests.hod_approval_status} IN ('APPROVED', 'NOT_REQUIRED')`
          )
        );
      } else if (staffType === 'hod') {
        // HOD sees NOC and Bonafide where hod_approval_status is PENDING
        activeConditions.push(
          and(
            inArray(studentRequests.certificate_type, ['Bonafide Certificate', 'No Objection Certificate', 'Internship Certificate']),
            eq(studentRequests.hod_approval_status, 'PENDING')
          )
        );
      }

      if (certificateTypeFilter.length > 0) activeConditions.push(inArray(studentRequests.certificate_type, certificateTypeFilter));
      if (statusFilter.length > 0) activeConditions.push(inArray(studentRequests.status, statusFilter));

      const rows = await db.select({
        request_id: studentRequests.request_id,
        roll_number: students.roll_no,
        student_name: students.name,
        certificate_type: studentRequests.certificate_type,
        status: studentRequests.status,
        hod_approval_status: studentRequests.hod_approval_status,
        hod_staff_id: studentRequests.hod_staff_id,
        hod_approved_at: studentRequests.hod_approved_at,
        hod_rejection_reason: studentRequests.hod_rejection_reason,
        payment_amount: studentRequests.payment_amount,
        transaction_id: studentRequests.transaction_id,
        payment_screenshot: studentRequestImages.payment_screenshot,
        purpose: studentRequests.purpose,
        academic_year: studentRequests.academic_year,
        created_at: studentRequests.created_at,
        is_flagged: studentRequests.is_flagged,
        flag_details: studentRequests.flag_details,
        payment_hash: studentRequests.payment_hash,
        admission_type: studentRequests.admission_type,
        study_year: studentRequests.study_year,
        study_semester: studentRequests.study_semester,
        years_at_kucet: studentRequests.years_at_kucet,
        certificate_format: studentRequests.certificate_format,
        generated_attendance: studentRequests.generated_attendance
      })
      .from(studentRequests)
      .innerJoin(students, eq(studentRequests.student_id, students.id))
      .leftJoin(studentRequestImages, eq(studentRequests.request_id, studentRequestImages.request_id))
      .where(and(...activeConditions))
      .orderBy(desc(studentRequests.created_at));

      let mappedRows = rows.map(r => {
        const parsed = parsePurpose(r.purpose);
        const branch = getBranchFromRoll(r.roll_number);
        const rollValidation = validateRollNo(r.roll_number);
        const admissionType = r.admission_type || rollValidation?.admissionType || 'Regular';
        return {
          ...r,
          branch,
          admission_type: admissionType,
          study_year: r.study_year || (admissionType === 'Lateral' ? 2 : 1),
          study_semester: r.study_semester || (admissionType === 'Lateral' ? 3 : 1),
          years_at_kucet: r.years_at_kucet || 1,
          purpose_type: parsed.purpose_type,
          purpose_custom: parsed.purpose_custom,
          purpose: (parsed.purpose_type === 'Other' && parsed.purpose_custom)
            ? `Other — ${parsed.purpose_custom}`
            : (formatPurpose(r.purpose) || r.purpose)
        };
      });

      // Scope HOD queue to authorized branches
      if (staffType === 'hod' && staff.role !== 'admin') {
        const authorizedBranches = staff.authorized_branches || (staff.branch ? [staff.branch] : []);
        if (authorizedBranches.length > 0) {
          mappedRows = mappedRows.filter(r => authorizedBranches.includes(getBranchFromRoll(r.roll_number)));
        } else {
          mappedRows = [];
        }
      }

      return apiResponse({ records: mappedRows });
    }
  } catch (error) {
    logger.error('Error fetching staff requests:', error);
    return apiError('Failed to fetch requests', 500);
  }
}

