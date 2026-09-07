import { eventDb, eventParticipants, eventAuditLogs, initExperimentDb } from '../db';
import { eq, and, sql, desc, like, or } from 'drizzle-orm';
import { EventConfigService } from './EventConfigService';
import { db } from '@/db';
import { students } from '@/db/schema';
import { validateRollNo } from '@/lib/rollNumber';
import logger from '@/lib/logger';

export class ParticipantService {
  /**
   * Resolves authoritative user profile from primary database.
   */
  static async resolveAuthoritativeUser(authUser) {
    if (!authUser) {
      throw { status: 401, message: 'Authentication required for event registration.' };
    }

    const isStudent = authUser.role === 'student' || Boolean(authUser.roll_no);

    if (isStudent) {
      const rollNo = authUser.roll_no || authUser.id;
      if (!rollNo) {
        throw { status: 400, message: 'Invalid student session. Roll number missing.' };
      }

      // Query primary college database
      const student = await db.query.students.findFirst({
        where: eq(students.roll_no, String(rollNo))
      });

      if (!student) {
        throw { status: 404, message: 'Student record not found in primary college database.' };
      }

      // Eligibility checks from primary record
      if (student.student_status === 'DISCONTINUED') {
        throw { status: 403, message: 'Discontinued students are not eligible for campus tournament registration.' };
      }
      if (['SUSPENDED', 'DROPPED'].includes(student.academic_status)) {
        throw { status: 403, message: `Registration rejected: Academic status is ${student.academic_status}.` };
      }

      const rollParsed = validateRollNo(student.roll_no);
      const department = rollParsed.isValid ? rollParsed.branch : 'CSE';

      return {
        userId: student.roll_no,
        userType: 'student',
        displayName: student.name || authUser.name || student.roll_no,
        email: student.email || authUser.email || null,
        department,
        primaryId: student.id,
      };
    }

    // Staff / Admin registration
    const staffId = String(authUser.email || authUser.id || authUser.staffId);
    return {
      userId: staffId,
      userType: 'staff',
      displayName: authUser.name || authUser.email || staffId,
      email: authUser.email || null,
      department: authUser.department || authUser.branch || 'FACULTY',
      primaryId: authUser.id || null,
    };
  }

  /**
   * One-Click Event Registration:
   * 1. Resolves identity from authenticated session + primary DB.
   * 2. Verifies event enablement and rules.
   * 3. Idempotently creates or returns participant record in experiment_college_db.
   */
  static async registerParticipant(eventKey = 'chess', authUserOrData, _options = {}) {
    await initExperimentDb();

    const config = await EventConfigService.getEventConfig(eventKey);
    if (!config.is_enabled) {
      throw { status: 403, message: 'This tournament event is currently disabled by administration.' };
    }
    if (!config.registration_open) {
      throw { status: 400, message: 'Registration for this event is currently closed.' };
    }

    // Determine if input is authUser or legacy data object
    let participantData;
    if (authUserOrData?.role || authUserOrData?.roll_no) {
      participantData = await this.resolveAuthoritativeUser(authUserOrData);
    } else if (authUserOrData?.userId && authUserOrData?.displayName) {
      participantData = authUserOrData;
    } else {
      throw { status: 400, message: 'Valid authenticated user or candidate data is required.' };
    }

    const { userId, userType = 'student', displayName, email, department, notes } = participantData;

    // Rules validation
    const rules = config.rules_json || {};
    if (userType === 'student' && rules.allow_students === false) {
      throw { status: 403, message: 'This event is restricted from student participation.' };
    }
    if (userType === 'staff' && rules.allow_staff === false) {
      throw { status: 403, message: 'This event is restricted from staff participation.' };
    }

    // Check capacity if max_participants is configured
    if (rules.max_participants && Number(rules.max_participants) > 0) {
      const [countRes] = await eventDb.select({ count: sql`COUNT(*)` })
        .from(eventParticipants)
        .where(and(
          eq(eventParticipants.event_key, eventKey),
          or(eq(eventParticipants.status, 'REGISTERED'), eq(eventParticipants.status, 'ACCEPTED'))
        ));
      
      const currentCount = Number(countRes?.count || 0);
      if (currentCount >= Number(rules.max_participants)) {
        throw { status: 400, message: 'Tournament capacity reached. Registration is full.' };
      }
    }

    // Check existing registration
    const existing = await eventDb.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.event_key, eventKey),
        eq(eventParticipants.user_id, String(userId))
      )
    });

    if (existing) {
      if (existing.status === 'ACCEPTED' || existing.status === 'REGISTERED') {
        return {
          ...existing,
          alreadyRegistered: true,
          message: 'Already registered for this event.'
        };
      }

      if (existing.status === 'REJECTED' || existing.status === 'WITHDRAWN') {
        // Re-apply
        await eventDb.update(eventParticipants)
          .set({
            status: 'ACCEPTED',
            display_name: displayName,
            email: email || existing.email,
            department: department || existing.department,
            notes: notes || existing.notes,
            registered_at: new Date(),
            reviewed_at: null,
            reviewed_by: null
          })
          .where(eq(eventParticipants.id, existing.id));

        return await eventDb.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, existing.id) });
      }
    }

    const [insertResult] = await eventDb.insert(eventParticipants).values({
      event_key: eventKey,
      user_id: String(userId),
      user_type: userType,
      display_name: displayName,
      email: email || null,
      department: department || null,
      status: 'ACCEPTED',
      notes: notes || null
    });

    const newId = insertResult.insertId;

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'REGISTER_PARTICIPANT',
      actor_id: String(userId),
      actor_type: userType.toUpperCase(),
      target_id: String(newId),
      target_type: 'EVENT_PARTICIPANT',
      details: { displayName, department, userType, automatic: true }
    });

    return await eventDb.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, newId) });
  }

  /**
   * Retrieves participants with filtering and pagination.
   */
  static async getParticipants(eventKey = 'chess', options = {}) {
    await initExperimentDb();

    const { status, search, limit = 50, offset = 0 } = options;

    const conditions = [eq(eventParticipants.event_key, eventKey)];

    if (status && status !== 'ALL') {
      conditions.push(eq(eventParticipants.status, status));
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          like(eventParticipants.display_name, term),
          like(eventParticipants.user_id, term),
          like(eventParticipants.department, term)
        )
      );
    }

    const whereClause = and(...conditions);

    const items = await eventDb.query.eventParticipants.findMany({
      where: whereClause,
      limit: Math.min(Number(limit), 100),
      offset: Number(offset),
      orderBy: [desc(eventParticipants.registered_at)]
    });

    const [countResult] = await eventDb.select({ count: sql`COUNT(*)` })
      .from(eventParticipants)
      .where(whereClause);

    return {
      items,
      total: Number(countResult?.count || 0)
    };
  }

  /**
   * Admin approves or rejects a participant.
   */
  static async updateParticipantStatus(participantId, status, reviewedBy = 'ADMIN', notes = null, seedNumber = null) {
    await initExperimentDb();

    const validStatuses = ['ACCEPTED', 'REJECTED', 'REGISTERED', 'WITHDRAWN'];
    if (!validStatuses.includes(status)) {
      throw { status: 400, message: `Invalid participant status: ${status}` };
    }

    const participant = await eventDb.query.eventParticipants.findFirst({
      where: eq(eventParticipants.id, Number(participantId))
    });

    if (!participant) {
      throw { status: 404, message: 'Participant not found.' };
    }

    const updateData = {
      status,
      reviewed_at: new Date(),
      reviewed_by: String(reviewedBy)
    };
    if (notes !== null && notes !== undefined) updateData.notes = notes;
    if (seedNumber !== null && seedNumber !== undefined) updateData.seed_number = Number(seedNumber);

    await eventDb.update(eventParticipants)
      .set(updateData)
      .where(eq(eventParticipants.id, Number(participantId)));

    await eventDb.insert(eventAuditLogs).values({
      event_key: participant.event_key,
      action: `PARTICIPANT_${status}`,
      actor_id: String(reviewedBy),
      actor_type: 'ADMIN',
      target_id: String(participantId),
      target_type: 'EVENT_PARTICIPANT',
      details: { previousStatus: participant.status, newStatus: status, notes, seedNumber }
    });

    return await eventDb.query.eventParticipants.findFirst({
      where: eq(eventParticipants.id, Number(participantId))
    });
  }

  /**
   * Retrieves participant record by user ID.
   */
  static async getParticipantByUser(eventKey = 'chess', userId) {
    await initExperimentDb();

    return await eventDb.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.event_key, eventKey),
        eq(eventParticipants.user_id, String(userId))
      )
    });
  }
}

export default ParticipantService;
