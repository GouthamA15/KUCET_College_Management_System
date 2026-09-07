import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getConfig, PUT as putConfig } from '@/app/api/events/config/route';
import { GET as getParticipants, POST as postParticipants } from '@/app/api/events/participants/route';
import { GET as getMatches, POST as postMatches } from '@/app/api/events/matches/route';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { MatchService } from '@/modules/events/services/MatchService';
import { verifyJwt } from '@/lib/auth';
import { cookies, headers } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyJwt: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((ctx, fn) => fn()),
  },
}));

const makeMockRequest = (url = 'http://localhost/api/events/config', method = 'GET', body = null) => {
  return {
    url,
    method,
    json: async () => body,
    headers: {
      get: () => null,
    },
  };
};

describe('Event System API Routes Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET & PUT /api/events/config', () => {
    it('should return event configuration on GET with event_key', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        event_name: 'KUCET Chess Championship',
        is_enabled: true
      });

      const req = makeMockRequest('http://localhost/api/events/config?event_key=chess');
      const res = await getConfig(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.is_enabled).toBe(true);
    });

    it('should return summary of active events when no event_key is provided', async () => {
      vi.spyOn(EventConfigService, 'getAllEventConfigs').mockResolvedValue([
        { event_key: 'chess', is_enabled: true },
        { event_key: 'quiz', is_enabled: false }
      ]);

      const req = makeMockRequest('http://localhost/api/events/config');
      const res = await getConfig(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.hasActiveEvents).toBe(true);
      expect(data.activeCount).toBe(1);
    });

    it('should report hasActiveEvents: false when all events are disabled by admin', async () => {
      vi.spyOn(EventConfigService, 'getAllEventConfigs').mockResolvedValue([
        { event_key: 'chess', is_enabled: false },
        { event_key: 'quiz', is_enabled: false }
      ]);

      const req = makeMockRequest('http://localhost/api/events/config');
      const res = await getConfig(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.hasActiveEvents).toBe(false);
      expect(data.activeCount).toBe(0);
    });

    it('should allow admin to update toggle on PUT', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'admin_auth') return { value: 'admin-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 1,
        email: 'admin@kucet.ac.in',
        role: 'admin'
      });

      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue({
        event_key: 'chess',
        is_enabled: true
      });

      const req = makeMockRequest('http://localhost/api/events/config', 'PUT', {
        event_key: 'chess',
        is_enabled: true
      });

      const res = await putConfig(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.is_enabled).toBe(true);
    });
  });

  describe('GET & POST /api/events/participants', () => {
    it('should list participants on GET', async () => {
      vi.spyOn(ParticipantService, 'getParticipants').mockResolvedValue({
        items: [{ id: 1, display_name: 'Alice', status: 'ACCEPTED' }],
        total: 1
      });

      const req = makeMockRequest('http://localhost/api/events/participants?event_key=chess');
      const res = await getParticipants(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.length).toBe(1);
    });

    it('should register participant on POST when authenticated', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'student_auth') return { value: 'student-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 10,
        roll_no: '2026-CSE-001',
        name: 'Alice',
        role: 'student'
      });

      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        is_enabled: true,
        registration_open: true
      });

      vi.spyOn(ParticipantService, 'registerParticipant').mockResolvedValue({
        id: 100,
        user_id: '2026-CSE-001',
        display_name: 'Alice',
        status: 'REGISTERED'
      });

      const req = makeMockRequest('http://localhost/api/events/participants', 'POST', {
        event_key: 'chess',
        display_name: 'Alice',
        department: 'CSE'
      });

      const res = await postParticipants(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe('REGISTERED');
    });
  });

  describe('GET & POST /api/events/matches', () => {
    it('should list matches on GET', async () => {
      vi.spyOn(MatchService, 'getMatches').mockResolvedValue({
        items: [{ id: 1, match_code: 'CHESS-001', round_name: 'Round 1' }],
        total: 1
      });

      const req = makeMockRequest('http://localhost/api/events/matches?event_key=chess');
      const res = await getMatches(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.length).toBe(1);
    });

    it('should allow admin to create match on POST', async () => {
      cookies.mockResolvedValue({
        get: vi.fn((name) => {
          if (name === 'admin_auth') return { value: 'admin-token' };
          return undefined;
        }),
      });
      headers.mockResolvedValue({
        get: vi.fn(() => null),
      });
      verifyJwt.mockResolvedValue({
        id: 1,
        email: 'admin@kucet.ac.in',
        role: 'admin'
      });

      vi.spyOn(MatchService, 'createMatch').mockResolvedValue({
        id: 50,
        match_code: 'CHESS-M-50',
        player_white_id: 1,
        player_black_id: 2,
        status: 'SCHEDULED'
      });

      const req = makeMockRequest('http://localhost/api/events/matches', 'POST', {
        event_key: 'chess',
        round_name: 'Quarterfinal',
        player_white_id: 1,
        player_black_id: 2
      });

      const res = await postMatches(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe('SCHEDULED');
    });
  });
});
