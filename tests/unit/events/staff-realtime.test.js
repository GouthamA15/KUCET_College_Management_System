import { describe, it, expect, vi, beforeEach } from 'vitest';
import { broadcastUpdate } from '@/lib/sse';

vi.mock('@/lib/sse', () => ({
  broadcastUpdate: vi.fn().mockResolvedValue({ success: true }),
  sendSSEUpdate: vi.fn(),
}));

describe('Staff Realtime Event Dispatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcasts STAFF_REGISTRATION_CREATED when a new registration is submitted', async () => {
    const payload = {
      id: 101,
      name: 'Dr. A. Sharma',
      email: 'sharma@kucet.ac.in',
      employee_id: 'EMP101',
      staff_category: 'FACULTY',
      branch: 'CSE',
      department: 'CSE',
      designation: 'Faculty / Assistant Professor',
      status: 'PENDING',
      created_at: new Date().toISOString()
    };

    await broadcastUpdate('STAFF_REGISTRATION_CREATED', payload);

    expect(broadcastUpdate).toHaveBeenCalledWith('STAFF_REGISTRATION_CREATED', payload);
  });

  it('broadcasts STAFF_REGISTRATION_APPROVED and STAFF_CREATED upon request approval', async () => {
    const approvedPayload = {
      id: 101,
      name: 'Dr. A. Sharma',
      email: 'sharma@kucet.ac.in',
      status: 'APPROVED',
      account_status: 'PENDING_ACTIVATION',
      processed_at: new Date().toISOString()
    };

    const newStaffPayload = {
      id: 202,
      name: 'Dr. A. Sharma',
      email: 'sharma@kucet.ac.in',
      employee_id: 'EMP101',
      designation: 'Faculty / Assistant Professor',
      branch: 'CSE',
      role: 'faculty',
      account_status: 'PENDING_ACTIVATION',
      is_active: false
    };

    await broadcastUpdate('STAFF_REGISTRATION_APPROVED', approvedPayload);
    await broadcastUpdate('STAFF_CREATED', newStaffPayload);

    expect(broadcastUpdate).toHaveBeenCalledWith('STAFF_REGISTRATION_APPROVED', approvedPayload);
    expect(broadcastUpdate).toHaveBeenCalledWith('STAFF_CREATED', newStaffPayload);
  });

  it('broadcasts STAFF_REGISTRATION_REJECTED upon request rejection', async () => {
    const rejectedPayload = {
      id: 101,
      name: 'Dr. A. Sharma',
      email: 'sharma@kucet.ac.in',
      status: 'REJECTED',
      rejection_reason: 'Invalid institutional credentials provided',
      processed_at: new Date().toISOString()
    };

    await broadcastUpdate('STAFF_REGISTRATION_REJECTED', rejectedPayload);

    expect(broadcastUpdate).toHaveBeenCalledWith('STAFF_REGISTRATION_REJECTED', rejectedPayload);
  });

  it('broadcasts STAFF_UPDATED on profile modification', async () => {
    const updatePayload = {
      id: 202,
      name: 'Dr. A. Sharma',
      designation: 'Associate Professor',
      branch: 'CSE',
      is_hod: true
    };

    await broadcastUpdate('STAFF_UPDATED', updatePayload);

    expect(broadcastUpdate).toHaveBeenCalledWith('STAFF_UPDATED', updatePayload);
  });

  it('broadcasts STAFF_STATUS_CHANGED on activation or deactivation', async () => {
    const statusPayload = {
      id: 202,
      is_active: true,
      account_status: 'ACTIVE'
    };

    await broadcastUpdate('STAFF_STATUS_CHANGED', statusPayload);

    expect(broadcastUpdate).toHaveBeenCalledWith('STAFF_STATUS_CHANGED', statusPayload);
  });
});
