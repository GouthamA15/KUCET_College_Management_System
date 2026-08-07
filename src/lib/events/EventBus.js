import { EventEmitter } from 'events';
import logger from '@/lib/logger';

export const DOMAIN_EVENTS = Object.freeze({
  ATTENDANCE_SUBMITTED: 'attendance.submitted',
  TOPIC_UPDATED: 'topic.updated',
  MARKS_PUBLISHED: 'marks.published',
  FEE_PAID: 'fee.paid',
  STUDENT_REGISTERED: 'student.registered',
  ARCHIVE_COMPLETED: 'archive.completed',
  STUDENT_RESTORED: 'student.restored',
  CERTIFICATE_ISSUED: 'certificate.issued',
});

class CentralDomainEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
    this.analytics = new Map();
    this.initDefaultSubscribers();
  }

  /**
   * Publishes a domain event asynchronously without blocking caller execution.
   * @param {string} eventName 
   * @param {Object} payload 
   */
  publish(eventName, payload = {}) {
    const eventData = {
      event: eventName,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Non-blocking fire-and-forget
    setImmediate(async () => {
      try {
        // Track analytics metrics
        const count = this.analytics.get(eventName) || 0;
        this.analytics.set(eventName, count + 1);

        this.emitter.emit(eventName, eventData);
        this.emitter.emit('*', eventData);
      } catch (err) {
        logger.error({ err, eventName }, '[EventBus] Error dispatching event');
      }
    });

    return true;
  }

  /**
   * Subscribes a handler to a specific domain event.
   * @param {string} eventName 
   * @param {Function} handler 
   */
  subscribe(eventName, handler) {
    const wrappedHandler = async (eventData) => {
      try {
        await handler(eventData);
      } catch (err) {
        logger.error({ err, eventName }, '[EventBus] Subscriber failed');
      }
    };

    this.emitter.on(eventName, wrappedHandler);

    return () => {
      this.emitter.off(eventName, wrappedHandler);
    };
  }

  /**
   * Returns analytics metrics for published events.
   */
  getAnalytics() {
    return Object.fromEntries(this.analytics.entries());
  }

  /**
   * Registers default internal subscribers for audit logging and cache invalidation.
   */
  initDefaultSubscribers() {
    // Wildcard subscriber for audit logging
    this.subscribe('*', (eventData) => {
      logger.info({ event: eventData.event, payload: eventData.payload }, '[AuditLog] Domain Event Captured');
    });

    // Cache Invalidation Subscriber
    this.subscribe(DOMAIN_EVENTS.ATTENDANCE_SUBMITTED, async (eventData) => {
      try {
        const { invalidateTag } = await import('@/lib/cache');
        if (eventData.payload?.student_id) {
          await invalidateTag(`attendance:${eventData.payload.student_id}`);
        }
      } catch (err) {
        logger.warn({ err }, '[EventBus] Failed cache invalidation on attendance');
      }
    });

    this.subscribe(DOMAIN_EVENTS.FEE_PAID, async (eventData) => {
      try {
        const { invalidateTag } = await import('@/lib/cache');
        if (eventData.payload?.roll_no) {
          await invalidateTag(`finance:${eventData.payload.roll_no}`);
        }
      } catch (err) {
        logger.warn({ err }, '[EventBus] Failed cache invalidation on fee payment');
      }
    });
  }
}

// Global Singleton
const globalForEventBus = globalThis;
if (!globalForEventBus._domainEventBus) {
  globalForEventBus._domainEventBus = new CentralDomainEventBus();
}

export const EventBus = globalForEventBus._domainEventBus;
export default EventBus;
