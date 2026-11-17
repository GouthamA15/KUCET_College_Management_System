import { db } from '@/db';
import { 
  studentInternships, 
  internshipCompanies, 
  internshipDocuments, 
  internshipAuditLogs, 
  students 
} from '@/db/schema';
import { eq, and, or, desc, sql, count, inArray, like } from 'drizzle-orm';
import { InternshipCompanyService } from './InternshipCompanyService';
import { InternshipOpportunityService } from './InternshipOpportunityService';
import { InternshipDocumentService } from './InternshipDocumentService';
import { InternshipNotificationService } from './InternshipNotificationService';
import { sqlStudentBranch, sqlAcademicYear } from './InternshipReportingService';
import { branchCodes } from '@/lib/rollNumber';
import logger from '@/lib/logger';

/**
 * Computes canonical unified status among the 11 institutional stages:
 * - Draft
 * - Submitted
 * - Under Review
 * - Correction Requested
 * - Approved
 * - Rejected
 * - Ongoing
 * - Completion Submitted
 * - Completed
 * - Withdrawal Requested
 * - Withdrawn
 */
export function computeCanonicalStatus(record) {
  if (record.application_status === 'WITHDRAWAL_REQUESTED') return 'WITHDRAWAL_REQUESTED';
  if (record.application_status === 'WITHDRAWN') return 'WITHDRAWN';
  if (record.completion_status === 'VERIFIED_COMPLETED') return 'COMPLETED';
  if (record.completion_status === 'SUBMITTED_FOR_VERIFICATION') return 'COMPLETION_SUBMITTED';
  if (
    record.completion_status === 'ADDITIONAL_DOCS_REQUESTED' || 
    record.application_status === 'ADDITIONAL_INFO_REQUIRED'
  ) {
    return 'CORRECTION_REQUESTED';
  }
  if (record.application_status === 'REJECTED' || record.completion_status === 'VERIFICATION_REJECTED') {
    return 'REJECTED';
  }
  if (record.application_status === 'APPROVED') {
    const today = new Date().toISOString().slice(0, 10);
    const start = record.start_date ? String(record.start_date) : '';
    const end = record.end_date ? String(record.end_date) : '';
    if (record.internship_status === 'ONGOING' || (start && end && start <= today && end >= today)) {
      return 'ONGOING';
    }
    return 'APPROVED';
  }
  if (record.application_status === 'UNDER_REVIEW') return 'UNDER_REVIEW';
  if (record.application_status === 'DRAFT') return 'DRAFT';
  return 'SUBMITTED';
}

export class StudentInternshipService {
  /**
   * Checks whether the given date range overlaps with any other registered/active internship of the student.
   * Overlapping dates are warnings, not rejection rules.
   */
  static async checkInternshipDateOverlaps({ studentId, startDate, endDate, excludeInternshipId = null }) {
    const sId = Number(studentId);
    if (!sId || !startDate || !endDate) return { hasOverlap: false, overlappingInternships: [] };

    const activeRows = await db
      .select({
        id: studentInternships.id,
        company_name: studentInternships.company_name,
        role_title: studentInternships.role_title,
        start_date: studentInternships.start_date,
        end_date: studentInternships.end_date,
        application_status: studentInternships.application_status,
      })
      .from(studentInternships)
      .where(
        and(
          eq(studentInternships.student_id, sId),
          sql`${studentInternships.application_status} NOT IN ('REJECTED', 'WITHDRAWN')`,
          excludeInternshipId ? sql`${studentInternships.id} != ${Number(excludeInternshipId)}` : sql`1=1`
        )
      );

    const overlapping = [];
    const newStart = String(startDate);
    const newEnd = String(endDate);

    for (const row of activeRows) {
      const existStart = String(row.start_date);
      const existEnd = String(row.end_date);

      // Overlap formula: (StartA <= EndB) and (EndA >= StartB)
      if (newStart <= existEnd && newEnd >= existStart) {
        const overlapStart = newStart > existStart ? newStart : existStart;
        const overlapEnd = newEnd < existEnd ? newEnd : existEnd;
        overlapping.push({
          id: row.id,
          company_name: row.company_name,
          role_title: row.role_title,
          start_date: existStart,
          end_date: existEnd,
          overlap_start: overlapStart,
          overlap_end: overlapEnd,
        });
      }
    }

    return {
      hasOverlap: overlapping.length > 0,
      overlappingInternships: overlapping,
    };
  }

  /**
   * Retrieves all internships for a student with computed canonical statuses and document counts.
   */
  static async getStudentInternships(studentId) {
    const stId = Number(studentId);
    if (!stId) return [];

    const rows = await db
      .select({
        id: studentInternships.id,
        student_id: studentInternships.student_id,
        registration_type: studentInternships.registration_type,
        opportunity_id: studentInternships.opportunity_id,
        company_id: studentInternships.company_id,
        company_name: studentInternships.company_name,
        company_website: studentInternships.company_website,
        company_location: studentInternships.company_location,
        role_title: studentInternships.role_title,
        mode: studentInternships.mode,
        stage: studentInternships.stage,
        start_date: studentInternships.start_date,
        end_date: studentInternships.end_date,
        duration: studentInternships.duration,
        stipend: studentInternships.stipend,
        application_status: studentInternships.application_status,
        internship_status: studentInternships.internship_status,
        completion_status: studentInternships.completion_status,
        has_overlap_warning: studentInternships.has_overlap_warning,
        overlap_details: studentInternships.overlap_details,
        is_unverified_company_exception: studentInternships.is_unverified_company_exception,
        unverified_company_exception_reason: studentInternships.unverified_company_exception_reason,
        withdrawal_reason: studentInternships.withdrawal_reason,
        withdrawal_remarks: studentInternships.withdrawal_remarks,
        reviewed_at: studentInternships.reviewed_at,
        rejection_reason: studentInternships.rejection_reason,
        coordinator_remarks: studentInternships.coordinator_remarks,
        additional_info_instructions: studentInternships.additional_info_instructions,
        actual_completion_date: studentInternships.actual_completion_date,
        verified_at: studentInternships.verified_at,
        verification_remarks: studentInternships.verification_remarks,
        created_at: studentInternships.created_at,
        company_verification_status: internshipCompanies.verification_status,
      })
      .from(studentInternships)
      .leftJoin(internshipCompanies, eq(studentInternships.company_id, internshipCompanies.id))
      .where(eq(studentInternships.student_id, stId))
      .orderBy(desc(studentInternships.created_at));

    const intIds = rows.map(r => r.id);
    let docCountMap = new Map();

    if (intIds.length > 0) {
      const docCounts = await db
        .select({
          internship_id: internshipDocuments.internship_id,
          count: count(),
        })
        .from(internshipDocuments)
        .where(
          and(
            sql`${internshipDocuments.internship_id} IN (${sql.join(intIds, sql`, `)})`,
            sql`${internshipDocuments.verification_status} != 'SUPERSEDED'`
          )
        )
        .groupBy(internshipDocuments.internship_id);

      docCounts.forEach(r => docCountMap.set(r.internship_id, Number(r.count)));
    }

    return rows.map(r => ({
      ...r,
      canonical_status: computeCanonicalStatus(r),
      documents_count: docCountMap.get(r.id) || 0,
    }));
  }

  /**
   * Retrieves single internship with all documents, company info, and timeline audit logs.
   */
  static async getInternshipById(id, { studentId = null, isCoordinator = false } = {}) {
    const idNum = Number(id);
    if (!idNum) return null;

    const [record] = await db
      .select({
        id: studentInternships.id,
        student_id: studentInternships.student_id,
        registration_type: studentInternships.registration_type,
        opportunity_id: studentInternships.opportunity_id,
        company_id: studentInternships.company_id,
        company_name: studentInternships.company_name,
        company_website: studentInternships.company_website,
        company_location: studentInternships.company_location,
        role_title: studentInternships.role_title,
        description: studentInternships.description,
        mode: studentInternships.mode,
        stage: studentInternships.stage,
        start_date: studentInternships.start_date,
        end_date: studentInternships.end_date,
        duration: studentInternships.duration,
        stipend: studentInternships.stipend,
        supervisor_name: studentInternships.supervisor_name,
        supervisor_email: studentInternships.supervisor_email,
        supervisor_phone: studentInternships.supervisor_phone,
        skills_acquired: studentInternships.skills_acquired,
        statement_of_interest: studentInternships.statement_of_interest,
        application_status: studentInternships.application_status,
        internship_status: studentInternships.internship_status,
        completion_status: studentInternships.completion_status,
        has_overlap_warning: studentInternships.has_overlap_warning,
        overlap_details: studentInternships.overlap_details,
        is_unverified_company_exception: studentInternships.is_unverified_company_exception,
        unverified_company_exception_reason: studentInternships.unverified_company_exception_reason,
        unverified_company_exception_at: studentInternships.unverified_company_exception_at,
        withdrawal_reason: studentInternships.withdrawal_reason,
        withdrawal_requested_at: studentInternships.withdrawal_requested_at,
        withdrawal_reviewed_at: studentInternships.withdrawal_reviewed_at,
        withdrawal_remarks: studentInternships.withdrawal_remarks,
        reviewed_by_staff_id: studentInternships.reviewed_by_staff_id,
        reviewed_at: studentInternships.reviewed_at,
        rejection_reason: studentInternships.rejection_reason,
        coordinator_remarks: studentInternships.coordinator_remarks,
        additional_info_instructions: studentInternships.additional_info_instructions,
        actual_completion_date: studentInternships.actual_completion_date,
        student_completion_remarks: studentInternships.student_completion_remarks,
        verified_by_staff_id: studentInternships.verified_by_staff_id,
        verified_at: studentInternships.verified_at,
        verification_remarks: studentInternships.verification_remarks,
        created_at: studentInternships.created_at,
        updated_at: studentInternships.updated_at,
        // Student details
        roll_no: students.roll_no,
        student_name: students.name,
        student_email: students.email,
        branch: sqlStudentBranch,
        academic_year: sqlAcademicYear,
        // Company details
        company_verification_status: internshipCompanies.verification_status,
        company_industry: internshipCompanies.industry,
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .leftJoin(internshipCompanies, eq(studentInternships.company_id, internshipCompanies.id))
      .where(eq(studentInternships.id, idNum))
      .limit(1);

    if (!record) return null;

    // Student IDOR check
    if (!isCoordinator && studentId && Number(record.student_id) !== Number(studentId)) {
      const err = new Error('Unauthorized to view this internship record');
      err.status = 403;
      throw err;
    }

    // Documents
    const docs = await db
      .select({
        id: internshipDocuments.id,
        document_type: internshipDocuments.document_type,
        original_filename: internshipDocuments.original_filename,
        storage_key: internshipDocuments.storage_key,
        mime_type: internshipDocuments.mime_type,
        file_size_bytes: internshipDocuments.file_size_bytes,
        verification_status: internshipDocuments.verification_status,
        rejection_reason: internshipDocuments.rejection_reason,
        version: internshipDocuments.version,
        uploaded_by_user_type: internshipDocuments.uploaded_by_user_type,
        created_at: internshipDocuments.created_at,
      })
      .from(internshipDocuments)
      .where(
        and(
          eq(internshipDocuments.internship_id, idNum),
          sql`${internshipDocuments.verification_status} != 'SUPERSEDED'`
        )
      )
      .orderBy(desc(internshipDocuments.created_at));

    // Audit logs
    const auditLogs = await db
      .select({
        id: internshipAuditLogs.id,
        actor_type: internshipAuditLogs.actor_type,
        actor_id: internshipAuditLogs.actor_id,
        action: internshipAuditLogs.action,
        details: internshipAuditLogs.details,
        ip_address: internshipAuditLogs.ip_address,
        created_at: internshipAuditLogs.created_at,
      })
      .from(internshipAuditLogs)
      .where(eq(internshipAuditLogs.internship_id, idNum))
      .orderBy(desc(internshipAuditLogs.created_at));

    return {
      ...record,
      canonical_status: computeCanonicalStatus(record),
      documents: docs,
      audit_timeline: auditLogs,
    };
  }

  /**
   * Applies to opportunity (object signature alias for applyForOpportunity).
   */
  static async applyToOpportunity({ studentId, opportunityId, statementOfInterest = null, resumeFile: _resumeFile = null, ip = null, userAgent = null }) {
    return this.applyForOpportunity(opportunityId, {
      studentId,
      statementOfInterest,
      ip,
      userAgent,
    });
  }

  /**
   * Applies for a college-published internship opportunity.
   */
  static async applyForOpportunity(oppIdRaw, {
    studentId,
    statementOfInterest = null,
    ip = null,
    userAgent = null,
  }) {
    const oppId = Number(oppIdRaw);
    const stId = Number(studentId);

    if (!oppId || !stId) {
      const err = new Error('Valid opportunity ID and student ID are required');
      err.status = 400;
      throw err;
    }

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, stId))
      .limit(1);

    if (!student) {
      const err = new Error('Student record not found');
      err.status = 404;
      throw err;
    }

    const opp = await InternshipOpportunityService.getOpportunityById(oppId);
    if (!opp) {
      const err = new Error('Opportunity not found');
      err.status = 404;
      throw err;
    }

    if (opp.status !== 'PUBLISHED') {
      const err = new Error('Opportunity is not open for applications');
      err.status = 400;
      throw err;
    }

    const eligibility = InternshipOpportunityService.evaluateEligibility(opp, student);
    if (!eligibility.is_eligible) {
      const err = new Error(`Ineligible for this opportunity: ${eligibility.ineligibility_reasons.join('; ')}`);
      err.status = 400;
      throw err;
    }

    const [existing] = await db
      .select({ id: studentInternships.id })
      .from(studentInternships)
      .where(
        and(
          eq(studentInternships.student_id, stId),
          eq(studentInternships.opportunity_id, oppId)
        )
      )
      .limit(1);

    if (existing) {
      const err = new Error('You have already applied for this opportunity');
      err.status = 409;
      throw err;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = opp.start_date ? String(opp.start_date).split('T')[0] : todayStr;
    const endDateStr = opp.end_date ? String(opp.end_date).split('T')[0] : todayStr;

    // Check date overlap
    const { hasOverlap, overlappingInternships } = await this.checkInternshipDateOverlaps({
      studentId: stId,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    const insertResult = await db.insert(studentInternships).values({
      student_id: stId,
      registration_type: 'INTERNAL_APPLICATION',
      opportunity_id: oppId,
      company_id: opp.company_id,
      company_name: opp.company_name,
      company_website: opp.company_website,
      company_location: opp.company_location,
      role_title: opp.title,
      description: opp.description,
      mode: opp.mode,
      start_date: startDateStr,
      end_date: endDateStr,
      duration: opp.duration,
      stipend: opp.stipend,
      statement_of_interest: statementOfInterest?.trim() || null,
      application_status: 'SUBMITTED',
      internship_status: 'NOT_STARTED',
      completion_status: 'NOT_SUBMITTED',
      has_overlap_warning: hasOverlap,
      overlap_details: hasOverlap ? JSON.stringify(overlappingInternships) : null,
    });

    const header = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    const newInternshipId = header?.insertId ? Number(header.insertId) : null;

    if (!newInternshipId) {
      throw new Error('Failed to create student internship application');
    }

    await db.insert(internshipAuditLogs).values({
      internship_id: newInternshipId,
      opportunity_id: oppId,
      company_id: opp.company_id,
      actor_type: 'STUDENT',
      actor_id: stId,
      action: 'APPLICATION_SUBMITTED',
      details: {
        opportunity_title: opp.title,
        company_name: opp.company_name,
        has_overlap: hasOverlap,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    // Notify coordinator
    await InternshipNotificationService.notifyCoordinator({
      title: 'New Internal Internship Application',
      message: `${student.name} (${student.roll_no}) applied for "${opp.title}" at ${opp.company_name}.${hasOverlap ? ' (⚠️ Overlapping dates detected)' : ''}`,
    });

    logger.info({ studentId: stId, oppId, internshipId: newInternshipId }, '[INTERNSHIP_APPLICATION_SUBMITTED]');
    return await this.getInternshipById(newInternshipId, { studentId: stId });
  }

  /**
   * Registers an independently obtained off-campus internship with mandatory offer letter.
   */
  static async registerExternalInternship({
    studentId,
    companyName,
    companyWebsite = null,
    companyLocation = null,
    industry = null,
    roleTitle,
    description = null,
    mode = 'HYBRID',
    stage = 'UPCOMING', // 'UPCOMING' | 'ONGOING' | 'COMPLETED'
    startDate,
    endDate,
    duration = null,
    stipend = null,
    supervisorName = null,
    supervisorEmail = null,
    supervisorPhone = null,
    skillsAcquired = null,
    offerLetterFile,
    offerLetterFilename = 'Offer_Letter.pdf',
    ip = null,
    userAgent = null,
  }) {
    const stId = Number(studentId);
    if (!stId) {
      const err = new Error('Valid student ID is required');
      err.status = 400;
      throw err;
    }

    if (!companyName || !companyName.trim()) {
      const err = new Error('Company name is required');
      err.status = 400;
      throw err;
    }
    if (!roleTitle || !roleTitle.trim()) {
      const err = new Error('Internship role title is required');
      err.status = 400;
      throw err;
    }
    if (!startDate || !endDate) {
      const err = new Error('Start date and end date are required');
      err.status = 400;
      throw err;
    }
    if (endDate < startDate) {
      const err = new Error('End date cannot be earlier than start date');
      err.status = 400;
      throw err;
    }
    if (!offerLetterFile) {
      const err = new Error('Offer letter document is mandatory for self-identified internships');
      err.status = 400;
      throw err;
    }

    // 1. Resolve or create company
    const { company } = await InternshipCompanyService.createCompany({
      companyName: companyName.trim(),
      website: companyWebsite,
      industry,
      location: companyLocation,
      contactPerson: supervisorName,
      contactEmail: supervisorEmail,
      contactPhone: supervisorPhone,
      createdByUserType: 'STUDENT',
      createdById: stId,
      autoVerify: false,
      ip,
      userAgent,
    });

    // 2. Check date overlap
    const { hasOverlap, overlappingInternships } = await this.checkInternshipDateOverlaps({
      studentId: stId,
      startDate,
      endDate,
    });

    // 3. Create student_internships record
    const insertResult = await db.insert(studentInternships).values({
      student_id: stId,
      registration_type: 'EXTERNAL_SELF_IDENTIFIED',
      opportunity_id: null,
      company_id: company.id,
      company_name: company.company_name,
      company_website: company.website,
      company_location: company.location,
      role_title: roleTitle.trim(),
      description: description?.trim() || null,
      mode: mode || 'HYBRID',
      stage: stage || 'UPCOMING',
      start_date: startDate,
      end_date: endDate,
      duration: duration?.trim() || null,
      stipend: stipend?.trim() || null,
      supervisor_name: supervisorName?.trim() || null,
      supervisor_email: supervisorEmail?.trim() || null,
      supervisor_phone: supervisorPhone?.trim() || null,
      skills_acquired: skillsAcquired?.trim() || null,
      application_status: 'SUBMITTED',
      internship_status: stage === 'ONGOING' ? 'ONGOING' : stage === 'COMPLETED' ? 'COMPLETED' : 'NOT_STARTED',
      completion_status: 'NOT_SUBMITTED',
      has_overlap_warning: hasOverlap,
      overlap_details: hasOverlap ? JSON.stringify(overlappingInternships) : null,
    });

    const header = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    const newInternshipId = header?.insertId ? Number(header.insertId) : null;

    if (!newInternshipId) {
      throw new Error('Failed to record external internship');
    }

    // 4. Upload mandatory offer letter
    await InternshipDocumentService.uploadDocument({
      internshipId: newInternshipId,
      studentId: stId,
      documentType: 'OFFER_LETTER',
      file: offerLetterFile,
      originalFilename: offerLetterFilename,
      uploadedByUserType: 'STUDENT',
      uploadedById: stId,
      ip,
      userAgent,
    });

    // 5. Audit log
    await db.insert(internshipAuditLogs).values({
      internship_id: newInternshipId,
      company_id: company.id,
      actor_type: 'STUDENT',
      actor_id: stId,
      action: 'EXTERNAL_REGISTRATION_SUBMITTED',
      details: {
        company_name: company.company_name,
        role_title: roleTitle.trim(),
        mode,
        stage,
        has_overlap: hasOverlap,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    // 6. Notify coordinator
    const [student] = await db.select({ name: students.name, roll_no: students.roll_no }).from(students).where(eq(students.id, stId)).limit(1);
    await InternshipNotificationService.notifyCoordinator({
      title: 'New Independent Internship Registered',
      message: `${student?.name || 'Student'} (${student?.roll_no || stId}) registered an independent internship for "${roleTitle}" at ${company.company_name}.${hasOverlap ? ' (⚠️ Overlapping dates detected)' : ''}`,
    });

    logger.info({ studentId: stId, internshipId: newInternshipId, companyId: company.id }, '[EXTERNAL_INTERNSHIP_REGISTERED]');
    return await this.getInternshipById(newInternshipId, { studentId: stId });
  }

  /**
   * Submits completion certificate and details for coordinator verification.
   */
  static async submitCompletion(internshipId, {
    studentId,
    actualCompletionDate,
    remarks = null,
    certificateFile,
    certificateFilename = 'Completion_Certificate.pdf',
    reportFile = null,
    reportFilename = 'Internship_Report.pdf',
    ip = null,
    userAgent = null,
  }) {
    const intId = Number(internshipId);
    const stId = Number(studentId);

    if (!intId || !stId) {
      const err = new Error('Valid internship ID and student ID are required');
      err.status = 400;
      throw err;
    }

    if (!actualCompletionDate) {
      const err = new Error('Actual completion date is required');
      err.status = 400;
      throw err;
    }

    if (!certificateFile) {
      const err = new Error('Completion certificate document is mandatory');
      err.status = 400;
      throw err;
    }

    const [internship] = await db
      .select()
      .from(studentInternships)
      .where(eq(studentInternships.id, intId))
      .limit(1);

    if (!internship) {
      const err = new Error('Internship not found');
      err.status = 404;
      throw err;
    }

    if (Number(internship.student_id) !== stId) {
      const err = new Error('Unauthorized');
      err.status = 403;
      throw err;
    }

    if (internship.application_status !== 'APPROVED') {
      const err = new Error('Cannot submit completion for an internship that has not been approved by the coordinator');
      err.status = 400;
      throw err;
    }

    const certDoc = await InternshipDocumentService.uploadDocument({
      internshipId: intId,
      studentId: stId,
      documentType: 'COMPLETION_CERTIFICATE',
      file: certificateFile,
      originalFilename: certificateFilename,
      uploadedByUserType: 'STUDENT',
      uploadedById: stId,
      ip,
      userAgent,
    });

    let reportDoc = null;
    if (reportFile) {
      reportDoc = await InternshipDocumentService.uploadDocument({
        internshipId: intId,
        studentId: stId,
        documentType: 'INTERNSHIP_REPORT',
        file: reportFile,
        originalFilename: reportFilename,
        uploadedByUserType: 'STUDENT',
        uploadedById: stId,
        ip,
        userAgent,
      });
    }

    await db
      .update(studentInternships)
      .set({
        completion_status: 'SUBMITTED_FOR_VERIFICATION',
        internship_status: 'COMPLETED',
        actual_completion_date: actualCompletionDate,
        student_completion_remarks: remarks?.trim() || null,
      })
      .where(eq(studentInternships.id, intId));

    await db.insert(internshipAuditLogs).values({
      internship_id: intId,
      actor_type: 'STUDENT',
      actor_id: stId,
      action: 'COMPLETION_SUBMITTED',
      details: {
        actual_completion_date: actualCompletionDate,
        certificate_doc_id: certDoc.id,
        report_doc_id: reportDoc?.id || null,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    const [student] = await db.select({ name: students.name, roll_no: students.roll_no }).from(students).where(eq(students.id, stId)).limit(1);
    await InternshipNotificationService.notifyCoordinator({
      title: 'Internship Completion Submitted',
      message: `${student?.name || 'Student'} (${student?.roll_no || stId}) submitted completion certificate for internship at ${internship.company_name}.`,
    });

    logger.info({ studentId: stId, internshipId: intId }, '[INTERNSHIP_COMPLETION_SUBMITTED]');
    return {
      success: true,
      message: 'Completion certificate submitted successfully for coordinator verification',
    };
  }

  /**
   * Resubmits information or replacement documents requested by the coordinator.
   */
  static async resubmitAdditionalInfo(internshipId, {
    studentId,
    remarks = null,
    newDocuments = [],
    ip = null,
    userAgent = null,
  }) {
    const intId = Number(internshipId);
    const stId = Number(studentId);

    const [internship] = await db
      .select()
      .from(studentInternships)
      .where(eq(studentInternships.id, intId))
      .limit(1);

    if (!internship) throw new Error('Internship not found');
    if (Number(internship.student_id) !== stId) throw new Error('Unauthorized');

    for (const doc of newDocuments) {
      if (doc.file && doc.documentType) {
        await InternshipDocumentService.uploadDocument({
          internshipId: intId,
          studentId: stId,
          documentType: doc.documentType,
          file: doc.file,
          originalFilename: doc.filename || 'Corrected_Document.pdf',
          uploadedByUserType: 'STUDENT',
          uploadedById: stId,
          ip,
          userAgent,
        });
      }
    }

    const updates = {};
    if (internship.application_status === 'ADDITIONAL_INFO_REQUIRED') {
      updates.application_status = 'UNDER_REVIEW';
    }
    if (internship.completion_status === 'ADDITIONAL_DOCS_REQUESTED') {
      updates.completion_status = 'SUBMITTED_FOR_VERIFICATION';
    }
    if (remarks) {
      updates.statement_of_interest = remarks.trim();
    }

    await db.update(studentInternships).set(updates).where(eq(studentInternships.id, intId));

    await db.insert(internshipAuditLogs).values({
      internship_id: intId,
      actor_type: 'STUDENT',
      actor_id: stId,
      action: 'ADDITIONAL_INFO_RESUBMITTED',
      details: { remarks, new_docs_count: newDocuments.length },
      ip_address: ip,
      user_agent: userAgent,
    });

    const [student] = await db.select({ name: students.name, roll_no: students.roll_no }).from(students).where(eq(students.id, stId)).limit(1);
    await InternshipNotificationService.notifyCoordinator({
      title: 'Internship Corrections Resubmitted',
      message: `${student?.name || 'Student'} (${student?.roll_no || stId}) uploaded corrected documents/information for internship at ${internship.company_name}.`,
    });

    return { success: true, message: 'Response submitted successfully to coordinator' };
  }

  /**
   * Student initiates withdrawal from an approved or submitted internship.
   * Does NOT directly withdraw — places into WITHDRAWAL_REQUESTED for coordinator review.
   */
  static async requestWithdrawal(internshipId, { studentId, reason, ip = null, userAgent = null }) {
    const intId = Number(internshipId);
    const stId = Number(studentId);

    if (!intId || !stId) throw new Error('Valid internship and student IDs are required');
    if (!reason || !reason.trim()) throw new Error('Withdrawal reason is required');

    const [internship] = await db
      .select()
      .from(studentInternships)
      .where(eq(studentInternships.id, intId))
      .limit(1);

    if (!internship) throw new Error('Internship not found');
    if (Number(internship.student_id) !== stId) throw new Error('Unauthorized');

    if (!['APPROVED', 'SUBMITTED', 'UNDER_REVIEW'].includes(internship.application_status)) {
      throw new Error('Withdrawal can only be requested for submitted, under review, or approved internships');
    }

    await db
      .update(studentInternships)
      .set({
        application_status: 'WITHDRAWAL_REQUESTED',
        withdrawal_reason: reason.trim(),
        withdrawal_requested_at: new Date(),
      })
      .where(eq(studentInternships.id, intId));

    await db.insert(internshipAuditLogs).values({
      internship_id: intId,
      actor_type: 'STUDENT',
      actor_id: stId,
      action: 'WITHDRAWAL_REQUESTED',
      details: { reason: reason.trim() },
      ip_address: ip,
      user_agent: userAgent,
    });

    const [student] = await db.select({ name: students.name, roll_no: students.roll_no }).from(students).where(eq(students.id, stId)).limit(1);
    await InternshipNotificationService.notifyCoordinator({
      title: 'Internship Withdrawal Requested',
      message: `${student?.name || 'Student'} (${student?.roll_no || stId}) requested withdrawal from internship at ${internship.company_name}: "${reason.trim()}".`,
    });

    logger.info({ studentId: stId, internshipId: intId }, '[INTERNSHIP_WITHDRAWAL_REQUESTED]');
    return { success: true, message: 'Withdrawal request submitted for coordinator review' };
  }

  /**
   * Coordinator Action: Approve or Reject a student's withdrawal request.
   */
  static async handleWithdrawalReview(internshipId, { action, remarks = null, staffId, ip = null, userAgent = null }) {
    const intId = Number(internshipId);
    if (!intId) throw new Error('Valid internship ID is required');

    const [internship] = await db
      .select()
      .from(studentInternships)
      .where(eq(studentInternships.id, intId))
      .limit(1);

    if (!internship) throw new Error('Internship not found');
    if (internship.application_status !== 'WITHDRAWAL_REQUESTED') {
      throw new Error('Internship is not currently pending a withdrawal request');
    }

    const updates = {
      withdrawal_reviewed_by: staffId,
      withdrawal_reviewed_at: new Date(),
      withdrawal_remarks: remarks?.trim() || null,
    };

    let auditAction = '';
    let studentMsg = '';

    if (action === 'APPROVE') {
      updates.application_status = 'WITHDRAWN';
      updates.internship_status = 'TERMINATED';
      auditAction = 'WITHDRAWAL_APPROVED';
      studentMsg = `Your withdrawal request for internship at ${internship.company_name} has been approved.${remarks ? ` Remarks: ${remarks}` : ''}`;
    } else if (action === 'REJECT') {
      updates.application_status = 'APPROVED';
      auditAction = 'WITHDRAWAL_REJECTED';
      studentMsg = `Your withdrawal request for internship at ${internship.company_name} was rejected.${remarks ? ` Remarks: ${remarks}` : ''}`;
    } else {
      throw new Error(`Invalid withdrawal review action: ${action}`);
    }

    await db.update(studentInternships).set(updates).where(eq(studentInternships.id, intId));

    await db.insert(internshipAuditLogs).values({
      internship_id: intId,
      actor_type: 'STAFF',
      actor_id: staffId,
      action: auditAction,
      details: { action, remarks },
      ip_address: ip,
      user_agent: userAgent,
    });

    await InternshipNotificationService.notifyStudent({
      studentId: internship.student_id,
      title: action === 'APPROVE' ? 'Withdrawal Request Approved' : 'Withdrawal Request Rejected',
      message: studentMsg,
      severity: action === 'APPROVE' ? 'INFO' : 'WARNING',
    });

    logger.info({ internshipId: intId, action: auditAction, staffId }, '[WITHDRAWAL_REVIEWED]');
    return await this.getInternshipById(intId, { isCoordinator: true });
  }

  /**
   * Coordinator Action: Review application/registration (Approve, Reject, or Request Info).
   * Includes unverified company exception handling.
   */
  static async reviewApplication(internshipId, {
    action, // 'APPROVE' | 'REJECT' | 'REQUEST_INFO'
    remarks = null,
    instructions = null,
    isUnverifiedCompanyException = false,
    exceptionReason = null,
    staffId,
    ip = null,
    userAgent = null,
  }) {
    const intId = Number(internshipId);
    if (!intId) throw new Error('Valid internship ID is required');

    const [internship] = await db
      .select()
      .from(studentInternships)
      .where(eq(studentInternships.id, intId))
      .limit(1);

    if (!internship) throw new Error('Internship not found');

    const updateFields = {
      reviewed_by_staff_id: staffId,
      reviewed_at: new Date(),
    };

    let auditAction = '';
    let studentMsg = '';

    if (action === 'APPROVE') {
      // Check company verification status
      if (internship.company_id) {
        const [comp] = await db
          .select({ verification_status: internshipCompanies.verification_status, company_name: internshipCompanies.company_name })
          .from(internshipCompanies)
          .where(eq(internshipCompanies.id, internship.company_id))
          .limit(1);

        if (comp && comp.verification_status !== 'VERIFIED') {
          if (!isUnverifiedCompanyException || !exceptionReason || !exceptionReason.trim()) {
            const err = new Error(`Company "${comp.company_name}" is unverified. An explicit confirmation action and exception reason are required to approve.`);
            err.status = 400;
            err.require_unverified_exception = true;
            throw err;
          }

          updateFields.is_unverified_company_exception = true;
          updateFields.unverified_company_exception_reason = exceptionReason.trim();
          updateFields.unverified_company_exception_by = staffId;
          updateFields.unverified_company_exception_at = new Date();
        }
      }

      updateFields.application_status = 'APPROVED';
      updateFields.internship_status = 'ONGOING';
      updateFields.coordinator_remarks = remarks?.trim() || null;
      auditAction = 'APPLICATION_APPROVED';
      studentMsg = `Your internship application for "${internship.role_title}" at ${internship.company_name} has been approved!`;
    } else if (action === 'REJECT') {
      if (!remarks || !remarks.trim()) {
        const err = new Error('Rejection reason is required');
        err.status = 400;
        throw err;
      }
      updateFields.application_status = 'REJECTED';
      updateFields.rejection_reason = remarks.trim();
      auditAction = 'APPLICATION_REJECTED';
      studentMsg = `Your internship application for "${internship.role_title}" at ${internship.company_name} was rejected: ${remarks.trim()}`;
    } else if (action === 'REQUEST_INFO') {
      if (!instructions || !instructions.trim()) {
        const err = new Error('Instructions for additional info are required');
        err.status = 400;
        throw err;
      }
      updateFields.application_status = 'ADDITIONAL_INFO_REQUIRED';
      updateFields.additional_info_instructions = instructions.trim();
      auditAction = 'ADDITIONAL_INFO_REQUESTED';
      studentMsg = `Corrections requested for your internship at ${internship.company_name}: ${instructions.trim()}`;
    } else {
      throw new Error(`Invalid review action: ${action}`);
    }

    await db.update(studentInternships).set(updateFields).where(eq(studentInternships.id, intId));

    await db.insert(internshipAuditLogs).values({
      internship_id: intId,
      actor_type: 'STAFF',
      actor_id: staffId,
      action: auditAction,
      details: {
        previous_status: internship.application_status,
        new_status: updateFields.application_status,
        remarks,
        instructions,
        is_unverified_company_exception: updateFields.is_unverified_company_exception || false,
        exception_reason: updateFields.unverified_company_exception_reason || null,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    await InternshipNotificationService.notifyStudent({
      studentId: internship.student_id,
      title: action === 'APPROVE' ? 'Internship Approved' : action === 'REJECT' ? 'Internship Rejected' : 'Corrections Requested',
      message: studentMsg,
      severity: action === 'APPROVE' ? 'INFO' : 'WARNING',
    });

    logger.info({ internshipId: intId, action: auditAction, staffId }, '[APPLICATION_REVIEWED]');
    return await this.getInternshipById(intId, { isCoordinator: true });
  }

  /**
   * Coordinator Action: Verify or reject completion certificate.
   * Allows requesting corrections even after completion has already been verified.
   */
  static async verifyCompletion(internshipId, {
    action, // 'VERIFY' | 'REJECT' | 'REQUEST_CORRECTION' | 'REQUEST_DOCS'
    remarks = null,
    staffId,
    ip = null,
    userAgent = null,
  }) {
    const intId = Number(internshipId);
    if (!intId) throw new Error('Valid internship ID is required');

    const [internship] = await db
      .select()
      .from(studentInternships)
      .where(eq(studentInternships.id, intId))
      .limit(1);

    if (!internship) throw new Error('Internship not found');

    const updateFields = {
      verified_by_staff_id: staffId,
      verified_at: new Date(),
      verification_remarks: remarks?.trim() || null,
    };

    let auditAction = '';
    let studentMsg = '';

    if (action === 'VERIFY') {
      updateFields.completion_status = 'VERIFIED_COMPLETED';
      updateFields.internship_status = 'COMPLETED';
      auditAction = 'COMPLETION_VERIFIED';
      studentMsg = `Your completion certificate for internship at ${internship.company_name} has been verified!`;

      await db
        .update(internshipDocuments)
        .set({
          verification_status: 'VERIFIED',
          verified_by_staff_id: staffId,
          verified_at: new Date(),
        })
        .where(
          and(
            eq(internshipDocuments.internship_id, intId),
            eq(internshipDocuments.document_type, 'COMPLETION_CERTIFICATE')
          )
        );
    } else if (action === 'REJECT') {
      updateFields.completion_status = 'VERIFICATION_REJECTED';
      auditAction = 'COMPLETION_REJECTED';
      studentMsg = `Your completion verification for internship at ${internship.company_name} was rejected: ${remarks?.trim() || 'Invalid certificate'}`;
    } else if (action === 'REQUEST_DOCS' || action === 'REQUEST_CORRECTION') {
      // Allows requesting corrections even AFTER completion was previously verified!
      updateFields.completion_status = 'ADDITIONAL_DOCS_REQUESTED';
      auditAction = 'COMPLETION_CORRECTION_REQUESTED';
      studentMsg = `Corrections requested on your completion submission for ${internship.company_name}: ${remarks?.trim() || 'Please upload updated document.'}`;
    } else {
      throw new Error(`Invalid verification action: ${action}`);
    }

    await db.update(studentInternships).set(updateFields).where(eq(studentInternships.id, intId));

    await db.insert(internshipAuditLogs).values({
      internship_id: intId,
      actor_type: 'STAFF',
      actor_id: staffId,
      action: auditAction,
      details: {
        previous_completion_status: internship.completion_status,
        new_completion_status: updateFields.completion_status,
        remarks,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    await InternshipNotificationService.notifyStudent({
      studentId: internship.student_id,
      title: action === 'VERIFY' ? 'Internship Completed' : 'Completion Verification Update',
      message: studentMsg,
      severity: action === 'VERIFY' ? 'INFO' : 'WARNING',
    });

    logger.info({ internshipId: intId, action: auditAction, staffId }, '[COMPLETION_VERIFIED_OR_REQUESTED]');
    return await this.getInternshipById(intId, { isCoordinator: true });
  }

  /**
   * Retrieves filtered queue of applications for the coordinator console.
   */
  static async getApplicationsQueue({
    queue = 'ALL',
    branch = 'ALL',
    academicYear = 'ALL',
    companyId = null,
    status = 'ALL',
    search = '',
    page = 1,
    limit = 20,
  } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (queue === 'INTERNAL_APPLICATIONS') {
      conditions.push(eq(studentInternships.registration_type, 'INTERNAL_APPLICATION'));
    } else if (queue === 'EXTERNAL_REGISTRATIONS') {
      conditions.push(eq(studentInternships.registration_type, 'EXTERNAL_SELF_IDENTIFIED'));
    } else if (queue === 'PENDING_APPROVALS') {
      conditions.push(inArray(studentInternships.application_status, ['SUBMITTED', 'UNDER_REVIEW']));
    } else if (queue === 'PENDING_COMPLETIONS') {
      conditions.push(eq(studentInternships.completion_status, 'SUBMITTED_FOR_VERIFICATION'));
    } else if (queue === 'WITHDRAWAL_REQUESTS') {
      conditions.push(eq(studentInternships.application_status, 'WITHDRAWAL_REQUESTED'));
    } else if (queue === 'ACTION_REQUIRED' || queue === 'CORRECTION_REQUESTS') {
      conditions.push(
        or(
          eq(studentInternships.application_status, 'ADDITIONAL_INFO_REQUIRED'),
          eq(studentInternships.completion_status, 'ADDITIONAL_DOCS_REQUESTED')
        )
      );
    } else if (queue === 'UNVERIFIED_COMPANY_EXCEPTIONS') {
      conditions.push(eq(studentInternships.is_unverified_company_exception, true));
    }

    if (branch && branch !== 'ALL') {
      const branchCode = Object.keys(branchCodes).find(code => branchCodes[code].toUpperCase() === branch.toUpperCase());
      if (branchCode) {
        conditions.push(or(
          like(students.roll_no, `%567T${branchCode}%`),
          like(students.roll_no, `%567${branchCode}%L`)
        ));
      }
    }
    if (academicYear && academicYear !== 'ALL') {
      const yearPrefix = academicYear.slice(2, 4);
      if (yearPrefix) {
        conditions.push(like(students.roll_no, `${yearPrefix}%`));
      }
    }
    if (companyId) {
      conditions.push(eq(studentInternships.company_id, Number(companyId)));
    }
    if (status && status !== 'ALL') {
      conditions.push(eq(studentInternships.application_status, status));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          like(students.name, q),
          like(students.roll_no, q),
          like(studentInternships.company_name, q),
          like(studentInternships.role_title, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ total: count() })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause);

    const total = totalRes?.total || 0;

    const items = await db
      .select({
        id: studentInternships.id,
        student_id: studentInternships.student_id,
        roll_no: students.roll_no,
        student_name: students.name,
        branch: sqlStudentBranch,
        academic_year: sqlAcademicYear,
        registration_type: studentInternships.registration_type,
        company_name: studentInternships.company_name,
        role_title: studentInternships.role_title,
        mode: studentInternships.mode,
        stage: studentInternships.stage,
        start_date: studentInternships.start_date,
        end_date: studentInternships.end_date,
        stipend: studentInternships.stipend,
        application_status: studentInternships.application_status,
        internship_status: studentInternships.internship_status,
        completion_status: studentInternships.completion_status,
        has_overlap_warning: studentInternships.has_overlap_warning,
        overlap_details: studentInternships.overlap_details,
        is_unverified_company_exception: studentInternships.is_unverified_company_exception,
        unverified_company_exception_reason: studentInternships.unverified_company_exception_reason,
        withdrawal_reason: studentInternships.withdrawal_reason,
        withdrawal_requested_at: studentInternships.withdrawal_requested_at,
        created_at: studentInternships.created_at,
        company_verification_status: internshipCompanies.verification_status,
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .leftJoin(internshipCompanies, eq(studentInternships.company_id, internshipCompanies.id))
      .where(whereClause)
      .orderBy(desc(studentInternships.created_at))
      .limit(limitNum)
      .offset(offset);

    return {
      items: items.map(i => ({
        ...i,
        canonical_status: computeCanonicalStatus(i),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }
}
