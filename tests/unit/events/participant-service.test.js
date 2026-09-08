import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { db } from '@/db';
import { eventDb } from '@/modules/events/db';

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      students: {
        findFirst: vi.fn(),
      },
      staffAccounts: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('@/modules/events/db', () => ({
  initExperimentDb: vi.fn().mockResolvedValue(true),
  eventDb: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 88 }]),
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 10 }]),
      }),
    })),
    query: {
      eventParticipants: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
  eventParticipants: {
    id: 'id',
    event_key: 'event_key',
    user_id: 'user_id',
    status: 'status',
  },
  eventAuditLogs: {
    id: 'id',
  },
}));

describe('ParticipantService — Zero Student Data Entry & Identity Resolution Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveAuthoritativeUser', () => {
    it('should authoritatively query students table in primary DB for student auth', async () => {
      db.query.students.findFirst.mockResolvedValue({
        id: 101,
        name: 'Goutham Reddy',
        roll_no: '24567T0901',
        email: 'goutham@kucet.ac.in',
        student_status: 'ACTIVE',
        academic_status: 'REGULAR',
      });

      const authUser = {
        id: 101,
        roll_no: '24567T0901',
        role: 'student',
        email: 'goutham@kucet.ac.in',
      };

      const resolved = await ParticipantService.resolveAuthoritativeUser(authUser);

      expect(resolved.userId).toBe('24567T0901');
      expect(resolved.displayName).toBe('Goutham Reddy');
      expect(resolved.department).toBe('CSE'); // Derived from validateRollNo('24567T0901')
      expect(resolved.userType).toBe('student');
      expect(resolved.email).toBe('goutham@kucet.ac.in');
    });

    it('should reject student registration if student status is DISCONTINUED', async () => {
      db.query.students.findFirst.mockResolvedValue({
        id: 102,
        name: 'Inactive Candidate',
        roll_no: '24567T0902',
        email: 'inactive@kucet.ac.in',
        student_status: 'DISCONTINUED',
      });

      const authUser = {
        id: 102,
        roll_no: '24567T0902',
        role: 'student',
      };

      await expect(ParticipantService.resolveAuthoritativeUser(authUser)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('should reject student registration if academic status is SUSPENDED', async () => {
      db.query.students.findFirst.mockResolvedValue({
        id: 103,
        name: 'Suspended Candidate',
        roll_no: '24567T0903',
        email: 'suspended@kucet.ac.in',
        student_status: 'ACTIVE',
        academic_status: 'SUSPENDED',
      });

      const authUser = {
        id: 103,
        roll_no: '24567T0903',
        role: 'student',
      };

      await expect(ParticipantService.resolveAuthoritativeUser(authUser)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('should resolve staff credentials from primary database staff tables', async () => {
      const authUser = {
        id: 5,
        staffId: 5,
        name: 'Dr. Srinivas Rao',
        role: 'faculty',
        branch: 'ECE',
        email: 'srinivas@kucet.ac.in',
      };

      const resolved = await ParticipantService.resolveAuthoritativeUser(authUser);

      expect(resolved.userId).toBe('srinivas@kucet.ac.in');
      expect(resolved.displayName).toBe('Dr. Srinivas Rao');
      expect(resolved.department).toBe('ECE');
      expect(resolved.userType).toBe('staff');
    });
  });

  describe('registerParticipant (Idempotent 1-Click Registration)', () => {
    it('should return existing registration if participant is already registered (idempotency)', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        is_enabled: true,
        registration_open: true,
        rules_json: {
          allow_students: true,
          allow_staff: true,
          max_participants: 64,
        },
      });

      const existingRecord = {
        id: 42,
        event_key: 'chess',
        user_id: '24567T0901',
        display_name: 'Goutham Reddy',
        status: 'ACCEPTED',
      };

      eventDb.query.eventParticipants.findFirst.mockResolvedValue(existingRecord);

      const user = {
        userId: '24567T0901',
        displayName: 'Goutham Reddy',
        department: 'CSE',
        userType: 'student',
      };

      const result = await ParticipantService.registerParticipant('chess', user);

      expect(result.id).toBe(42);
      expect(result.alreadyRegistered).toBe(true);
    });

    it('should insert new registration into experiment_college_db when registering for first time', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        is_enabled: true,
        registration_open: true,
        rules_json: {
          allow_students: true,
          allow_staff: true,
          max_participants: 64,
        },
      });

      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce(null) // first check: not existing
        .mockResolvedValueOnce({
          id: 88,
          event_key: 'chess',
          user_id: '24567T0901',
          display_name: 'Goutham Reddy',
          status: 'ACCEPTED',
        }); // second check: returning created record

      eventDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      eventDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{ insertId: 88 }]),
      });

      const user = {
        userId: '24567T0901',
        displayName: 'Goutham Reddy',
        department: 'CSE',
        userType: 'student',
        email: 'goutham@kucet.ac.in',
      };

      const result = await ParticipantService.registerParticipant('chess', user, { notes: 'Intermediate player' });

      expect(result.id).toBe(88);
      expect(result.user_id).toBe('24567T0901');
      expect(result.status).toBe('ACCEPTED');
    });

    it('should throw error when max participants limit is reached', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        is_enabled: true,
        registration_open: true,
        rules_json: {
          allow_students: true,
          allow_staff: true,
          max_participants: 16,
        },
      });

      eventDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 16 }]),
        }),
      });

      const user = {
        userId: '24567T0999',
        displayName: 'Late Contender',
        department: 'CSE',
        userType: 'student',
      };

      await expect(ParticipantService.registerParticipant('chess', user)).rejects.toMatchObject({
        status: 400,
      });
    });
  });
});
