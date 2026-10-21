import { describe, it, expect, vi } from 'vitest';
import EventBus, { DOMAIN_EVENTS } from '@/lib/events/EventBus';

describe('Domain Event Bus', () => {
  it('should publish events asynchronously and trigger subscribers', async () => {
    const mockHandler = vi.fn();
    const unsubscribe = EventBus.subscribe(DOMAIN_EVENTS.ATTENDANCE_SUBMITTED, mockHandler);

    EventBus.publish(DOMAIN_EVENTS.ATTENDANCE_SUBMITTED, { student_id: 101, status: 'P' });

    // Wait for setImmediate queue
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        event: DOMAIN_EVENTS.ATTENDANCE_SUBMITTED,
        payload: { student_id: 101, status: 'P' }
      })
    );

    unsubscribe();
  });

  it('should support event analytics', async () => {
    EventBus.publish(DOMAIN_EVENTS.FEE_PAID, { roll_no: '218W1A0501', amount: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const analytics = EventBus.getAnalytics();
    expect(analytics[DOMAIN_EVENTS.FEE_PAID]).toBeGreaterThanOrEqual(1);
  });

  it('should publish and receive all 8 canonical domain events', async () => {
    const eventsToTest = [
      { name: DOMAIN_EVENTS.ATTENDANCE_SUBMITTED, payload: { student_id: 501 } },
      { name: DOMAIN_EVENTS.TOPIC_UPDATED, payload: { assignment_id: 42, topic_covered: 'B-Trees' } },
      { name: DOMAIN_EVENTS.MARKS_PUBLISHED, payload: { assignment_id: 42, record_count: 60 } },
      { name: DOMAIN_EVENTS.FEE_PAID, payload: { roll_no: '218W1A0501', amount: 25000 } },
      { name: DOMAIN_EVENTS.STUDENT_REGISTERED, payload: { student_id: 999, roll_no: '248W1A0599' } },
      { name: DOMAIN_EVENTS.ARCHIVE_COMPLETED, payload: { job_id: 'JOB-100', archive_type: 'SEMESTER' } },
      { name: DOMAIN_EVENTS.STUDENT_RESTORED, payload: { archive_student_id: 12, roll_no: '208W1A0512' } },
      { name: DOMAIN_EVENTS.CERTIFICATE_ISSUED, payload: { request_id: 88, certificate_type: 'Bonafide Certificate' } },
    ];

    for (const item of eventsToTest) {
      const handler = vi.fn();
      const unsub = EventBus.subscribe(item.name, handler);

      EventBus.publish(item.name, item.payload);
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: item.name,
          payload: item.payload,
        })
      );
      unsub();
    }
  });

  it('should clean up subscriptions when unsubscribe function is invoked', async () => {
    const handler = vi.fn();
    const unsub = EventBus.subscribe(DOMAIN_EVENTS.TOPIC_UPDATED, handler);

    EventBus.publish(DOMAIN_EVENTS.TOPIC_UPDATED, { assignment_id: 1, topic_covered: 'Graph Algorithms' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe and publish again
    unsub();
    EventBus.publish(DOMAIN_EVENTS.TOPIC_UPDATED, { assignment_id: 1, topic_covered: 'Shortest Path' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(handler).toHaveBeenCalledTimes(1); // not incremented
  });

  it('should capture all events in the wildcard audit subscriber without throwing', async () => {
    const wildcardHandler = vi.fn();
    const unsub = EventBus.subscribe('*', wildcardHandler);

    EventBus.publish(DOMAIN_EVENTS.STUDENT_RESTORED, { roll_no: '208W1A0588' });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(wildcardHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        event: DOMAIN_EVENTS.STUDENT_RESTORED,
        payload: { roll_no: '208W1A0588' },
      })
    );
    unsub();
  });
});
