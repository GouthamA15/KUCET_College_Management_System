import { db } from '@/db';
import { internshipCompanies, internshipOpportunities, studentInternships, internshipAuditLogs } from '@/db/schema';
import { eq, and, or, like, desc, sql, count } from 'drizzle-orm';
import logger from '@/lib/logger';

export class InternshipCompanyService {
  /**
   * Generates a normalized company identifier for deduplication.
   * Strips all non-alphanumeric characters, converts to lowercase, trims whitespace.
   */
  static normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Search / Autocomplete companies.
   */
  static async searchCompanies({ query = '', limit = 20, verifiedOnly = false } = {}) {
    const cleanQuery = String(query || '').trim();
    const norm = this.normalizeName(cleanQuery);

    const conditions = [eq(internshipCompanies.is_active, true)];
    if (verifiedOnly) {
      conditions.push(eq(internshipCompanies.verification_status, 'VERIFIED'));
    }

    if (cleanQuery) {
      conditions.push(
        or(
          like(internshipCompanies.company_name, `%${cleanQuery}%`),
          like(internshipCompanies.normalized_name, `%${norm}%`),
          like(internshipCompanies.location, `%${cleanQuery}%`)
        )
      );
    }

    const rows = await db
      .select({
        id: internshipCompanies.id,
        company_name: internshipCompanies.company_name,
        normalized_name: internshipCompanies.normalized_name,
        website: internshipCompanies.website,
        industry: internshipCompanies.industry,
        location: internshipCompanies.location,
        verification_status: internshipCompanies.verification_status,
      })
      .from(internshipCompanies)
      .where(and(...conditions))
      .orderBy(desc(internshipCompanies.verification_status), internshipCompanies.company_name)
      .limit(Math.min(limit, 50));

    return rows;
  }

  /**
   * Get paginated list of companies for coordinator review.
   */
  static async getCompanies({ page = 1, limit = 20, status = null, search = '' } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status && status !== 'ALL') {
      conditions.push(eq(internshipCompanies.verification_status, status));
    }
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const norm = this.normalizeName(cleanSearch);
      conditions.push(
        or(
          like(internshipCompanies.company_name, `%${cleanSearch}%`),
          like(internshipCompanies.normalized_name, `%${norm}%`),
          like(internshipCompanies.location, `%${cleanSearch}%`),
          like(internshipCompanies.industry, `%${cleanSearch}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ total: count() })
      .from(internshipCompanies)
      .where(whereClause);

    const total = totalRes?.total || 0;

    const companies = await db
      .select()
      .from(internshipCompanies)
      .where(whereClause)
      .orderBy(desc(internshipCompanies.created_at))
      .limit(limitNum)
      .offset(offset);

    // Attach opportunity and internship counts
    const companyIds = companies.map(c => c.id);
    let oppCountMap = new Map();
    let internCountMap = new Map();

    if (companyIds.length > 0) {
      const oppCounts = await db
        .select({
          company_id: internshipOpportunities.company_id,
          count: count(),
        })
        .from(internshipOpportunities)
        .where(sql`${internshipOpportunities.company_id} IN (${sql.join(companyIds, sql`, `)})`)
        .groupBy(internshipOpportunities.company_id);

      oppCounts.forEach(r => oppCountMap.set(r.company_id, Number(r.count)));

      const internCounts = await db
        .select({
          company_id: studentInternships.company_id,
          count: count(),
        })
        .from(studentInternships)
        .where(sql`${studentInternships.company_id} IN (${sql.join(companyIds, sql`, `)})`)
        .groupBy(studentInternships.company_id);

      internCounts.forEach(r => internCountMap.set(r.company_id, Number(r.count)));
    }

    const items = companies.map(c => ({
      ...c,
      opportunities_count: oppCountMap.get(c.id) || 0,
      internships_count: internCountMap.get(c.id) || 0,
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
   * Get single company detail by ID.
   */
  static async getCompanyById(id) {
    const idNum = Number(id);
    if (!idNum) return null;

    const [company] = await db
      .select()
      .from(internshipCompanies)
      .where(eq(internshipCompanies.id, idNum))
      .limit(1);

    return company || null;
  }

  /**
   * Creates or resolves a company.
   * If a company with the identical normalized name already exists, returns the existing record
   * or updates it if needed, preventing duplicates.
   */
  static async createCompany({
    companyName,
    website = null,
    industry = null,
    address = null,
    location = null,
    contactPerson = null,
    contactEmail = null,
    contactPhone = null,
    createdByUserType = 'STAFF',
    createdById = null,
    autoVerify = false,
    ip = null,
    userAgent = null,
  }) {
    if (!companyName || !companyName.trim()) {
      const err = new Error('Company name is required');
      err.status = 400;
      throw err;
    }

    const cleanName = companyName.trim();
    const norm = this.normalizeName(cleanName);

    // 1. Check for duplicate normalized name
    const [existing] = await db
      .select()
      .from(internshipCompanies)
      .where(eq(internshipCompanies.normalized_name, norm))
      .limit(1);

    if (existing) {
      // If the existing company is already VERIFIED or PENDING, return it
      return {
        company: existing,
        isExisting: true,
      };
    }

    const status = autoVerify || createdByUserType === 'ADMIN' || createdByUserType === 'STAFF'
      ? 'VERIFIED'
      : 'PENDING_VERIFICATION';

    const insertResult = await db.insert(internshipCompanies).values({
      company_name: cleanName,
      normalized_name: norm,
      website: website ? website.trim() : null,
      industry: industry ? industry.trim() : null,
      address: address ? address.trim() : null,
      location: location ? location.trim() : null,
      contact_person: contactPerson ? contactPerson.trim() : null,
      contact_email: contactEmail ? contactEmail.trim() : null,
      contact_phone: contactPhone ? contactPhone.trim() : null,
      verification_status: status,
      verified_by: status === 'VERIFIED' ? createdById : null,
      verified_at: status === 'VERIFIED' ? new Date() : null,
      is_active: true,
      created_by_user_type: createdByUserType,
      created_by_id: createdById,
    });

    const header = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    const newId = header?.insertId ? Number(header.insertId) : null;

    if (!newId) {
      throw new Error('Failed to create company record in database');
    }

    // Write audit log
    await db.insert(internshipAuditLogs).values({
      company_id: newId,
      actor_type: createdByUserType,
      actor_id: createdById || 0,
      action: 'COMPANY_CREATED',
      details: {
        company_name: cleanName,
        status,
        autoVerify,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    const created = await this.getCompanyById(newId);
    return {
      company: created,
      isExisting: false,
    };
  }

  /**
   * Verifies, rejects, or deactivates a company (Coordinator action).
   */
  static async verifyCompany(id, {
    verifiedByStaffId,
    status = 'VERIFIED',
    rejectionReason = null,
    ip = null,
    userAgent = null,
  }) {
    const idNum = Number(id);
    if (!idNum) {
      const err = new Error('Valid company ID is required');
      err.status = 400;
      throw err;
    }

    const company = await this.getCompanyById(idNum);
    if (!company) {
      const err = new Error('Company not found');
      err.status = 404;
      throw err;
    }

    const validStatuses = ['VERIFIED', 'REJECTED', 'INACTIVE'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      err.status = 400;
      throw err;
    }

    await db
      .update(internshipCompanies)
      .set({
        verification_status: status,
        verified_by: verifiedByStaffId,
        verified_at: new Date(),
        rejection_reason: status === 'REJECTED' ? rejectionReason : null,
        is_active: status !== 'INACTIVE',
      })
      .where(eq(internshipCompanies.id, idNum));

    // Audit log
    await db.insert(internshipAuditLogs).values({
      company_id: idNum,
      actor_type: 'STAFF',
      actor_id: verifiedByStaffId,
      action: `COMPANY_${status}`,
      details: {
        previous_status: company.verification_status,
        new_status: status,
        rejection_reason: rejectionReason,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    logger.info({ companyId: idNum, status, verifiedBy: verifiedByStaffId }, '[COMPANY_VERIFIED]');
    return await this.getCompanyById(idNum);
  }

  /**
   * Updates company metadata.
   */
  static async updateCompany(id, data, { updatedBy, userType = 'STAFF', ip = null, userAgent = null } = {}) {
    const idNum = Number(id);
    if (!idNum) {
      const err = new Error('Valid company ID is required');
      err.status = 400;
      throw err;
    }

    const company = await this.getCompanyById(idNum);
    if (!company) {
      const err = new Error('Company not found');
      err.status = 404;
      throw err;
    }

    const updateFields = {};
    if (data.companyName !== undefined && data.companyName.trim()) {
      updateFields.company_name = data.companyName.trim();
      updateFields.normalized_name = this.normalizeName(data.companyName);
    }
    if (data.website !== undefined) updateFields.website = data.website?.trim() || null;
    if (data.industry !== undefined) updateFields.industry = data.industry?.trim() || null;
    if (data.address !== undefined) updateFields.address = data.address?.trim() || null;
    if (data.location !== undefined) updateFields.location = data.location?.trim() || null;
    if (data.contactPerson !== undefined) updateFields.contact_person = data.contactPerson?.trim() || null;
    if (data.contactEmail !== undefined) updateFields.contact_email = data.contactEmail?.trim() || null;
    if (data.contactPhone !== undefined) updateFields.contact_phone = data.contactPhone?.trim() || null;
    if (data.isActive !== undefined) updateFields.is_active = Boolean(data.isActive);

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(internshipCompanies)
        .set(updateFields)
        .where(eq(internshipCompanies.id, idNum));

      await db.insert(internshipAuditLogs).values({
        company_id: idNum,
        actor_type: userType,
        actor_id: updatedBy || 0,
        action: 'COMPANY_UPDATED',
        details: updateFields,
        ip_address: ip,
        user_agent: userAgent,
      });
    }

    return await this.getCompanyById(idNum);
  }
}
