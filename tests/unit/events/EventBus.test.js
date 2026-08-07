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
});
