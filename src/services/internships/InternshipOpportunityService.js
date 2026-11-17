import { db } from '@/db';
import { 
  internshipOpportunities, 
  internshipCompanies, 
  studentInternships, 
  internshipAuditLogs 
} from '@/db/schema';
import { eq, and, or, like, desc, sql, count, gte } from 'drizzle-orm';
import { validateRollNo } from '@/lib/rollNumber';
import logger from '@/lib/logger';

export class InternshipOpportunityService {
  /**
   * Helper to check student eligibility against an opportunity.
   */
  static evaluateEligibility(opp, student, alreadyAppliedRecord = null) {
    const reasons = [];

    // Derive branch and academic batch from roll number if not directly present
    let studentBranch = String(student.branch || '').toUpperCase();
    let studentYear = String(student.academic_year || '').trim();

    if ((!studentBranch || !studentYear) && student.roll_no) {
      const rollInfo = validateRollNo(student.roll_no);
      if (rollInfo.isValid) {
        if (!studentBranch) studentBranch = String(rollInfo.branch || '').toUpperCase();
        if (!studentYear) {
          const entryYearNum = Number(rollInfo.entryYear);
          studentYear = `${entryYearNum}-${(entryYearNum + 1).toString().slice(-2)}`;
        }
      }
    }

    // 1. Branch match
    const branches = Array.isArray(opp.eligible_branches) 
      ? opp.eligible_branches.map(b => String(b).toUpperCase()) 
      : [];
    const isBranchEligible = branches.includes('ALL') || branches.includes(studentBranch);
    if (!isBranchEligible) {
      reasons.push(`Restricted to branches: ${branches.join(', ')} (Your branch: ${studentBranch || 'N/A'})`);
    }

    // 2. Academic Year / Batch match
    const years = Array.isArray(opp.eligible_academic_years)
      ? opp.eligible_academic_years.map(y => String(y).trim())
      : [];
    const isYearEligible = years.includes('ALL') || years.includes(studentYear);
    if (!isYearEligible) {
      reasons.push(`Restricted to academic batches: ${years.join(', ')} (Your batch: ${studentYear || 'N/A'})`);
    }

    // 3. Minimum CGPA match
    if (opp.min_cgpa !== null && opp.min_cgpa !== undefined) {
      const minCgpaNum = Number(opp.min_cgpa);
      const studentCgpaNum = Number(student.cgpa || 0);
      if (studentCgpaNum < minCgpaNum) {
        reasons.push(`Minimum CGPA required is ${minCgpaNum.toFixed(2)} (Your CGPA: ${studentCgpaNum.toFixed(2)})`);
      }
    }

    // 4. Deadline check
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const deadlineStr = opp.deadline instanceof Date 
      ? opp.deadline.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : String(opp.deadline || '').split('T')[0];

    const isPastDeadline = deadlineStr && todayStr > deadlineStr;
    if (isPastDeadline) {
      reasons.push(`Application deadline expired on ${deadlineStr}`);
    }

    const isEligible = reasons.length === 0;

    return {
      is_eligible: isEligible,
      ineligibility_reasons: reasons,
      already_applied: Boolean(alreadyAppliedRecord),
      student_application_id: alreadyAppliedRecord?.id || null,
      student_application_status: alreadyAppliedRecord?.application_status || null,
    };
  }

  /**
   * Retrieves opportunities for students with dynamic live eligibility tagging.
   */
  static async getStudentOpportunities(student, {
    search = '',
    category = null,
    mode = null,
    eligibilityFilter = 'ALL', // 'ALL' | 'ELIGIBLE_ONLY'
  } = {}) {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const conditions = [
      eq(internshipOpportunities.status, 'PUBLISHED'),
      gte(internshipOpportunities.deadline, todayStr),
    ];

    if (category && category !== 'ALL') {
      conditions.push(eq(internshipOpportunities.category, category));
    }
    if (mode && mode !== 'ALL') {
      conditions.push(eq(internshipOpportunities.mode, mode));
    }
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      conditions.push(
        or(
          like(internshipOpportunities.title, `%${cleanSearch}%`),
          like(internshipOpportunities.description, `%${cleanSearch}%`),
          like(internshipOpportunities.required_skills, `%${cleanSearch}%`),
          like(internshipCompanies.company_name, `%${cleanSearch}%`)
        )
      );
    }

    const opps = await db
      .select({
        id: internshipOpportunities.id,
        company_id: internshipOpportunities.company_id,
        title: internshipOpportunities.title,
        description: internshipOpportunities.description,
        category: internshipOpportunities.category,
        required_skills: internshipOpportunities.required_skills,
        required_qualifications: internshipOpportunities.required_qualifications,
        eligible_branches: internshipOpportunities.eligible_branches,
        eligible_academic_years: internshipOpportunities.eligible_academic_years,
        min_cgpa: internshipOpportunities.min_cgpa,
        start_date: internshipOpportunities.start_date,
        end_date: internshipOpportunities.end_date,
        duration: internshipOpportunities.duration,
        mode: internshipOpportunities.mode,
        location: internshipOpportunities.location,
        stipend: internshipOpportunities.stipend,
        openings_count: internshipOpportunities.openings_count,
        deadline: internshipOpportunities.deadline,
        additional_requirements: internshipOpportunities.additional_requirements,
        status: internshipOpportunities.status,
        published_at: internshipOpportunities.published_at,
        company_name: internshipCompanies.company_name,
        company_website: internshipCompanies.website,
        company_location: internshipCompanies.location,
        company_verification_status: internshipCompanies.verification_status,
      })
      .from(internshipOpportunities)
      .innerJoin(internshipCompanies, eq(internshipOpportunities.company_id, internshipCompanies.id))
      .where(and(...conditions))
      .orderBy(internshipOpportunities.deadline, desc(internshipOpportunities.published_at));

    // Get this student's existing applications
    const oppIds = opps.map(o => o.id);
    let appliedMap = new Map();
    if (oppIds.length > 0 && student?.id) {
      const applications = await db
        .select({
          id: studentInternships.id,
          opportunity_id: studentInternships.opportunity_id,
          application_status: studentInternships.application_status,
        })
        .from(studentInternships)
        .where(
          and(
            eq(studentInternships.student_id, student.id),
            sql`${studentInternships.opportunity_id} IN (${sql.join(oppIds, sql`, `)})`
          )
        );

      applications.forEach(app => appliedMap.set(app.opportunity_id, app));
    }

    const enriched = opps.map(opp => {
      const appliedRecord = appliedMap.get(opp.id);
      const evalResult = this.evaluateEligibility(opp, student, appliedRecord);
      return {
        ...opp,
        ...evalResult,
      };
    });

    if (eligibilityFilter === 'ELIGIBLE_ONLY') {
      return enriched.filter(o => o.is_eligible);
    }

    return enriched;
  }

  /**
   * Retrieves paginated opportunities for the coordinator.
   */
  static async getOpportunities({
    page = 1,
    limit = 20,
    status = null,
    _branch = null,
    _academicYear = null,
    search = '',
    companyId = null,
  } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status && status !== 'ALL') {
      conditions.push(eq(internshipOpportunities.status, status));
    }
    if (companyId) {
      conditions.push(eq(internshipOpportunities.company_id, Number(companyId)));
    }
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      conditions.push(
        or(
          like(internshipOpportunities.title, `%${cleanSearch}%`),
          like(internshipOpportunities.description, `%${cleanSearch}%`),
          like(internshipOpportunities.category, `%${cleanSearch}%`),
          like(internshipCompanies.company_name, `%${cleanSearch}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ total: count() })
      .from(internshipOpportunities)
      .innerJoin(internshipCompanies, eq(internshipOpportunities.company_id, internshipCompanies.id))
      .where(whereClause);

    const total = totalRes?.total || 0;

    const opps = await db
      .select({
        id: internshipOpportunities.id,
        company_id: internshipOpportunities.company_id,
        title: internshipOpportunities.title,
        description: internshipOpportunities.description,
        category: internshipOpportunities.category,
        required_skills: internshipOpportunities.required_skills,
        required_qualifications: internshipOpportunities.required_qualifications,
        eligible_branches: internshipOpportunities.eligible_branches,
        eligible_academic_years: internshipOpportunities.eligible_academic_years,
        min_cgpa: internshipOpportunities.min_cgpa,
        start_date: internshipOpportunities.start_date,
        end_date: internshipOpportunities.end_date,
        duration: internshipOpportunities.duration,
        mode: internshipOpportunities.mode,
        location: internshipOpportunities.location,
        stipend: internshipOpportunities.stipend,
        openings_count: internshipOpportunities.openings_count,
        opening_date: internshipOpportunities.opening_date,
        deadline: internshipOpportunities.deadline,
        status: internshipOpportunities.status,
        published_at: internshipOpportunities.published_at,
        created_at: internshipOpportunities.created_at,
        company_name: internshipCompanies.company_name,
        company_website: internshipCompanies.website,
        company_location: internshipCompanies.location,
      })
      .from(internshipOpportunities)
      .innerJoin(internshipCompanies, eq(internshipOpportunities.company_id, internshipCompanies.id))
      .where(whereClause)
      .orderBy(desc(internshipOpportunities.created_at))
      .limit(limitNum)
      .offset(offset);

    // Attach applications counts
    const oppIds = opps.map(o => o.id);
    let appCountMap = new Map();
    let approvedCountMap = new Map();

    if (oppIds.length > 0) {
      const appCounts = await db
        .select({
          opportunity_id: studentInternships.opportunity_id,
          total: count(),
        })
        .from(studentInternships)
        .where(sql`${studentInternships.opportunity_id} IN (${sql.join(oppIds, sql`, `)})`)
        .groupBy(studentInternships.opportunity_id);

      appCounts.forEach(r => appCountMap.set(r.opportunity_id, Number(r.total)));

      const approvedCounts = await db
        .select({
          opportunity_id: studentInternships.opportunity_id,
          total: count(),
        })
        .from(studentInternships)
        .where(
          and(
            sql`${studentInternships.opportunity_id} IN (${sql.join(oppIds, sql`, `)})`,
            eq(studentInternships.application_status, 'APPROVED')
          )
        )
        .groupBy(studentInternships.opportunity_id);

      approvedCounts.forEach(r => approvedCountMap.set(r.opportunity_id, Number(r.total)));
    }

    const items = opps.map(opp => ({
      ...opp,
      applications_count: appCountMap.get(opp.id) || 0,
      approved_count: approvedCountMap.get(opp.id) || 0,
    }));

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Retrieves single opportunity detail by ID.
   */
  static async getOpportunityById(id) {
    const idNum = Number(id);
    if (!idNum) return null;

    const [opp] = await db
      .select({
        id: internshipOpportunities.id,
        company_id: internshipOpportunities.company_id,
        title: internshipOpportunities.title,
        description: internshipOpportunities.description,
        category: internshipOpportunities.category,
        required_skills: internshipOpportunities.required_skills,
        required_qualifications: internshipOpportunities.required_qualifications,
        eligible_branches: internshipOpportunities.eligible_branches,
        eligible_academic_years: internshipOpportunities.eligible_academic_years,
        min_cgpa: internshipOpportunities.min_cgpa,
        start_date: internshipOpportunities.start_date,
        end_date: internshipOpportunities.end_date,
        duration: internshipOpportunities.duration,
        mode: internshipOpportunities.mode,
        location: internshipOpportunities.location,
        stipend: internshipOpportunities.stipend,
        openings_count: internshipOpportunities.openings_count,
        opening_date: internshipOpportunities.opening_date,
        deadline: internshipOpportunities.deadline,
        additional_requirements: internshipOpportunities.additional_requirements,
        status: internshipOpportunities.status,
        published_at: internshipOpportunities.published_at,
        created_at: internshipOpportunities.created_at,
        created_by_staff_id: internshipOpportunities.created_by_staff_id,
        company_name: internshipCompanies.company_name,
        company_website: internshipCompanies.website,
        company_industry: internshipCompanies.industry,
        company_location: internshipCompanies.location,
        company_address: internshipCompanies.address,
        company_verification_status: internshipCompanies.verification_status,
      })
      .from(internshipOpportunities)
      .innerJoin(internshipCompanies, eq(internshipOpportunities.company_id, internshipCompanies.id))
      .where(eq(internshipOpportunities.id, idNum))
      .limit(1);

    return opp || null;
  }

  /**
   * Creates an internship opportunity.
   */
  static async createOpportunity(data, staffId, { ip = null, userAgent = null } = {}) {
    if (!data.companyId) {
      const err = new Error('Company is required');
      err.status = 400;
      throw err;
    }
    if (!data.title || !data.title.trim()) {
      const err = new Error('Opportunity title is required');
      err.status = 400;
      throw err;
    }
    if (!data.description || !data.description.trim()) {
      const err = new Error('Description is required');
      err.status = 400;
      throw err;
    }
    if (!data.deadline) {
      const err = new Error('Application deadline is required');
      err.status = 400;
      throw err;
    }

    const eligibleBranches = Array.isArray(data.eligibleBranches) && data.eligibleBranches.length > 0
      ? data.eligibleBranches
      : ['ALL'];
    const eligibleYears = Array.isArray(data.eligibleAcademicYears) && data.eligibleAcademicYears.length > 0
      ? data.eligibleAcademicYears
      : ['ALL'];

    const status = data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? new Date() : null;

    const insertResult = await db.insert(internshipOpportunities).values({
      company_id: Number(data.companyId),
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category?.trim() || 'General Engineering',
      required_skills: data.requiredSkills?.trim() || null,
      required_qualifications: data.requiredQualifications?.trim() || null,
      eligible_branches: eligibleBranches,
      eligible_academic_years: eligibleYears,
      min_cgpa: data.minCgpa !== undefined && data.minCgpa !== '' ? String(data.minCgpa) : null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      duration: data.duration?.trim() || null,
      mode: data.mode || 'HYBRID',
      location: data.location?.trim() || null,
      stipend: data.stipend?.trim() || null,
      openings_count: Number(data.openingsCount) || 1,
      opening_date: data.openingDate || null,
      deadline: data.deadline,
      additional_requirements: data.additionalRequirements?.trim() || null,
      status,
      published_at: publishedAt,
      created_by_staff_id: staffId,
    });

    const header = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    const newId = header?.insertId ? Number(header.insertId) : null;

    if (!newId) {
      throw new Error('Failed to create internship opportunity');
    }

    await db.insert(internshipAuditLogs).values({
      opportunity_id: newId,
      company_id: Number(data.companyId),
      actor_type: 'STAFF',
      actor_id: staffId,
      action: 'OPPORTUNITY_CREATED',
      details: {
        title: data.title,
        status,
        eligible_branches: eligibleBranches,
        eligible_academic_years: eligibleYears,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    logger.info({ opportunityId: newId, staffId, status }, '[OPPORTUNITY_CREATED]');
    return await this.getOpportunityById(newId);
  }

  /**
   * Updates an opportunity.
   */
  static async updateOpportunity(id, data, staffId, { ip = null, userAgent = null } = {}) {
    const idNum = Number(id);
    if (!idNum) {
      const err = new Error('Valid opportunity ID is required');
      err.status = 400;
      throw err;
    }

    const opp = await this.getOpportunityById(idNum);
    if (!opp) {
      const err = new Error('Opportunity not found');
      err.status = 404;
      throw err;
    }

    const updateFields = {};
    if (data.companyId !== undefined) updateFields.company_id = Number(data.companyId);
    if (data.title !== undefined) updateFields.title = data.title.trim();
    if (data.description !== undefined) updateFields.description = data.description.trim();
    if (data.category !== undefined) updateFields.category = data.category.trim();
    if (data.requiredSkills !== undefined) updateFields.required_skills = data.requiredSkills?.trim() || null;
    if (data.requiredQualifications !== undefined) updateFields.required_qualifications = data.requiredQualifications?.trim() || null;
    if (data.eligibleBranches !== undefined) updateFields.eligible_branches = data.eligibleBranches;
    if (data.eligibleAcademicYears !== undefined) updateFields.eligible_academic_years = data.eligibleAcademicYears;
    if (data.minCgpa !== undefined) updateFields.min_cgpa = data.minCgpa ? String(data.minCgpa) : null;
    if (data.startDate !== undefined) updateFields.start_date = data.startDate || null;
    if (data.endDate !== undefined) updateFields.end_date = data.endDate || null;
    if (data.duration !== undefined) updateFields.duration = data.duration?.trim() || null;
    if (data.mode !== undefined) updateFields.mode = data.mode;
    if (data.location !== undefined) updateFields.location = data.location?.trim() || null;
    if (data.stipend !== undefined) updateFields.stipend = data.stipend?.trim() || null;
    if (data.openingsCount !== undefined) updateFields.openings_count = Number(data.openingsCount) || 1;
    if (data.openingDate !== undefined) updateFields.opening_date = data.openingDate || null;
    if (data.deadline !== undefined) updateFields.deadline = data.deadline;
    if (data.additionalRequirements !== undefined) updateFields.additional_requirements = data.additionalRequirements?.trim() || null;
    if (data.status !== undefined) {
      updateFields.status = data.status;
      if (data.status === 'PUBLISHED' && opp.status !== 'PUBLISHED') {
        updateFields.published_at = new Date();
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(internshipOpportunities)
        .set(updateFields)
        .where(eq(internshipOpportunities.id, idNum));

      await db.insert(internshipAuditLogs).values({
        opportunity_id: idNum,
        actor_type: 'STAFF',
        actor_id: staffId,
        action: 'OPPORTUNITY_UPDATED',
        details: updateFields,
        ip_address: ip,
        user_agent: userAgent,
      });
    }

    return await this.getOpportunityById(idNum);
  }

  /**
   * Publishes, unpublishes, closes, or archives an opportunity.
   */
  static async setOpportunityStatus(id, newStatus, staffId, { ip = null, userAgent = null } = {}) {
    const idNum = Number(id);
    if (!idNum) {
      const err = new Error('Valid opportunity ID is required');
      err.status = 400;
      throw err;
    }

    const opp = await this.getOpportunityById(idNum);
    if (!opp) {
      const err = new Error('Opportunity not found');
      err.status = 404;
      throw err;
    }

    const validStatuses = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED', 'ARCHIVED'];
    if (!validStatuses.includes(newStatus)) {
      const err = new Error(`Invalid status: ${newStatus}`);
      err.status = 400;
      throw err;
    }

    const updateData = { status: newStatus };
    if (newStatus === 'PUBLISHED') {
      updateData.published_at = new Date();
    }

    await db
      .update(internshipOpportunities)
      .set(updateData)
      .where(eq(internshipOpportunities.id, idNum));

    await db.insert(internshipAuditLogs).values({
      opportunity_id: idNum,
      company_id: opp.company_id,
      actor_type: 'STAFF',
      actor_id: staffId,
      action: `OPPORTUNITY_${newStatus}`,
      details: { previous_status: opp.status, new_status: newStatus },
      ip_address: ip,
      user_agent: userAgent,
    });

    return await this.getOpportunityById(idNum);
  }
}
