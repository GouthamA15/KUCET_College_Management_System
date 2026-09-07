import { eventDb, eventParticipants, eventAuditLogs, initExperimentDb } from '../db';
import { eq, and, sql, desc, like, or } from 'drizzle-orm';
import { EventConfigService } from './EventConfigService';

export class ParticipantService {
  /**
   * Registers a student or staff member for an event.
   */
  static async registerParticipant(eventKey = 'chess', participantData) {
    await initExperimentDb();

    const config = await EventConfigService.getEventConfig(eventKey);
    if (!config.is_enabled) {
      throw { status: 403, message: 'This tournament event is currently disabled by administration.' };
    }
    if (!config.registration_open) {
      throw { status: 400, message: 'Registration for this event is currently closed.' };
    }

    const { userId, userType = 'student', displayName, email, department, notes } = participantData;

    if (!userId || !displayName) {
      throw { status: 400, message: 'User ID and display name are required for registration.' };
    }

    // Check existing registration
    const existing = await eventDb.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.event_key, eventKey),
        eq(eventParticipants.user_id, String(userId))
      )
    });

    if (existing) {
      if (existing.status === 'REJECTED' || existing.status === 'WITHDRAWN') {
        // Re-apply
        await eventDb.update(eventParticipants)
          .set({
            status: 'REGISTERED',
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
      throw { status: 409, message: 'You have already registered for this event.' };
    }

    const [insertResult] = await eventDb.insert(eventParticipants).values({
      event_key: eventKey,
      user_id: String(userId),
      user_type: userType,
      display_name: displayName,
      email: email || null,
      department: department || null,
      status: 'REGISTERED',
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
      details: { displayName, department, userType }
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
