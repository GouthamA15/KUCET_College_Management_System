import { eventDb, eventConfigs, eventAuditLogs, initExperimentDb } from '../db';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';

export class EventConfigService {
  /**
   * Retrieves the configuration and enabled state for a specific event key.
   */
  static async getEventConfig(eventKey = 'chess') {
    await initExperimentDb();
    
    const config = await eventDb.query.eventConfigs.findFirst({
      where: eq(eventConfigs.event_key, eventKey)
    });

    if (!config) {
      return {
        event_key: eventKey,
        event_name: eventKey === 'chess' ? 'KUCET Chess Championship' : eventKey,
        description: '',
        is_enabled: false,
        registration_open: false,
        rules_json: {
          time_control_minutes: 15,
          increment_seconds: 10,
          max_participants: 64,
          allow_staff: true,
          allow_students: true,
          elimination_type: 'Single Elimination'
        }
      };
    }

    return config;
  }

  /**
   * Checks if an event is currently enabled.
   */
  static async isEventEnabled(eventKey = 'chess') {
    try {
      const config = await this.getEventConfig(eventKey);
      return Boolean(config?.is_enabled);
    } catch (err) {
      logger.error(err, `[EVENT_CONFIG_ERROR] Failed to check status for ${eventKey}`);
      return false;
    }
  }

  /**
   * Retrieves all registered event configurations from the experiment database.
   */
  static async getAllEventConfigs() {
    try {
      await initExperimentDb();
      const configs = await eventDb.query.eventConfigs.findMany();
      return configs || [];
    } catch (err) {
      logger.error(err, '[EVENT_CONFIG_ERROR] Failed to fetch all event configurations');
      return [];
    }
  }

  /**
   * Checks if at least one tournament/event is currently enabled by administration.
   */
  static async hasAnyActiveEvents() {
    try {
      const allConfigs = await this.getAllEventConfigs();
      return allConfigs.some(c => Boolean(c.is_enabled));
    } catch (err) {
      logger.error(err, '[EVENT_CONFIG_ERROR] Failed to verify active events status');
      return false;
    }
  }

  /**
   * Admin Toggle: Enables or disables the specified event.
   */
  static async toggleEvent(eventKey = 'chess', isEnabled, updatedBy = 'ADMIN') {
    await initExperimentDb();

    const existing = await this.getEventConfig(eventKey);

    await eventDb.update(eventConfigs)
      .set({
        is_enabled: Boolean(isEnabled),
        updated_at: new Date()
      })
      .where(eq(eventConfigs.event_key, eventKey));

    // Audit log
    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: isEnabled ? 'ENABLE_EVENT' : 'DISABLE_EVENT',
      actor_id: String(updatedBy),
      actor_type: 'ADMIN',
      target_id: eventKey,
      target_type: 'EVENT_CONFIG',
      details: { before: existing?.is_enabled, after: Boolean(isEnabled) }
    });

    logger.info({ eventKey, isEnabled, updatedBy }, '[EVENT_TOGGLE_UPDATED]');
    return await this.getEventConfig(eventKey);
  }

  /**
   * Updates general event settings (name, description, registration_open, rules_json).
   */
  static async updateEventConfig(eventKey = 'chess', configData, updatedBy = 'ADMIN') {
    await initExperimentDb();

    const existing = await this.getEventConfig(eventKey);

    const updatePayload = {};
    if (configData.event_name !== undefined) updatePayload.event_name = configData.event_name;
    if (configData.description !== undefined) updatePayload.description = configData.description;
    if (configData.registration_open !== undefined) updatePayload.registration_open = Boolean(configData.registration_open);
    if (configData.rules_json !== undefined) updatePayload.rules_json = configData.rules_json;
    if (configData.is_enabled !== undefined) updatePayload.is_enabled = Boolean(configData.is_enabled);
    updatePayload.updated_at = new Date();

    await eventDb.update(eventConfigs)
      .set(updatePayload)
      .where(eq(eventConfigs.event_key, eventKey));

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'UPDATE_EVENT_CONFIG',
      actor_id: String(updatedBy),
      actor_type: 'ADMIN',
      target_id: eventKey,
      target_type: 'EVENT_CONFIG',
      details: { before: existing, after: updatePayload }
    });

    return await this.getEventConfig(eventKey);
  }
}

export default EventConfigService;
