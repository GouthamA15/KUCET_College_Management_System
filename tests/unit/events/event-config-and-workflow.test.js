import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { MatchService } from '@/modules/events/services/MatchService';
import { eventDb } from '@/modules/events/db';

vi.mock('@/modules/events/db', () => ({
  initExperimentDb: vi.fn().mockResolvedValue(true),
  eventDb: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 42 }])
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
      })
    })),
    query: {
      eventConfigs: { findFirst: vi.fn() },
      eventParticipants: { findFirst: vi.fn(), findMany: vi.fn() },
      eventMatches: { findFirst: vi.fn(), findMany: vi.fn() },
      chessGames: { findFirst: vi.fn() },
      chessMoves: { findMany: vi.fn() }
    },
    select: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 10 }])
      })
    }))
  },
  eventConfigs: {},
  eventParticipants: {},
  eventMatches: {},
  chessGames: {},
  chessMoves: {},
  eventAuditLogs: {}
}));

describe('College Event Workflow & Administration Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Admin Event Toggle', () => {
    it('should toggle Chess Event state from DISABLED to ENABLED with audit log', async () => {
      eventDb.query.eventConfigs.findFirst.mockResolvedValue({
        event_key: 'chess',
        is_enabled: true
      });

      const updated = await EventConfigService.toggleEvent('chess', true, 'admin@kucet.ac.in');

      expect(eventDb.update).toHaveBeenCalled();
      expect(eventDb.insert).toHaveBeenCalled(); // Audit log
      expect(updated.is_enabled).toBe(true);
    });

    it('should return false when event is disabled', async () => {
      eventDb.query.eventConfigs.findFirst.mockResolvedValueOnce({
        event_key: 'chess',
        is_enabled: false
      });

      const isEnabled = await EventConfigService.isEventEnabled('chess');
      expect(isEnabled).toBe(false);
    });
  });

  describe('2. Participant Registration & Approval', () => {
    it('should allow student registration when event is enabled and registration open', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        is_enabled: true,
        registration_open: true
      });

      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce(null) // No existing registration
        .mockResolvedValueOnce({
          id: 42,
          user_id: '2026-CSE-101',
          display_name: 'Carol Danvers',
          status: 'REGISTERED'
        });

      const participant = await ParticipantService.registerParticipant('chess', {
        userId: '2026-CSE-101',
        userType: 'student',
        displayName: 'Carol Danvers',
        department: 'CSE'
      });

      expect(participant.status).toBe('REGISTERED');
      expect(eventDb.insert).toHaveBeenCalled();
    });

    it('should reject registration when event is disabled', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        is_enabled: false,
        registration_open: true
      });

      await expect(
        ParticipantService.registerParticipant('chess', {
          userId: '2026-CSE-101',
          displayName: 'Carol Danvers'
        })
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('disabled')
      });
    });

    it('should allow admin to update participant status to ACCEPTED with seed', async () => {
      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce({ id: 42, event_key: 'chess', status: 'REGISTERED' })
        .mockResolvedValueOnce({ id: 42, event_key: 'chess', status: 'ACCEPTED', seed_number: 1 });

      const updated = await ParticipantService.updateParticipantStatus(
        42,
        'ACCEPTED',
        'admin@kucet.ac.in',
        'Verified rating',
        1
      );

      expect(updated.status).toBe('ACCEPTED');
      expect(eventDb.update).toHaveBeenCalled();
    });
  });

  describe('3. Match Fixture Creation & Result Verification', () => {
    it('should create match fixture and assign White and Black players', async () => {
      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce({ id: 10, display_name: 'Player One', user_id: '2026-001' })
        .mockResolvedValueOnce({ id: 20, display_name: 'Player Two', user_id: '2026-002' });

      vi.spyOn(MatchService, 'getMatchById').mockResolvedValueOnce({
        id: 42,
        event_key: 'chess',
        match_code: 'CHESS-M-001',
        player_white_id: 10,
        player_black_id: 20,
        status: 'SCHEDULED'
      });

      const match = await MatchService.createMatch('chess', {
        roundName: 'Quarterfinal',
        playerWhiteId: 10,
        playerBlackId: 20
      });

      expect(match.status).toBe('SCHEDULED');
      expect(eventDb.insert).toHaveBeenCalled();
    });

    it('should reject creating match where White and Black players are identical', async () => {
      await expect(
        MatchService.createMatch('chess', {
          roundName: 'Round 1',
          playerWhiteId: 10,
          playerBlackId: 10
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('play against themselves')
      });
    });

    it('should publish a scheduled match making it accessible to players', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValueOnce({
        id: 42,
        event_key: 'chess',
        status: 'SCHEDULED',
        match_code: 'CHESS-001'
      });

      vi.spyOn(MatchService, 'getMatchById').mockResolvedValueOnce({
        id: 42,
        status: 'PUBLISHED'
      });

      const published = await MatchService.publishMatch(42, 'admin@kucet.ac.in');
      expect(published.status).toBe('PUBLISHED');
      expect(eventDb.update).toHaveBeenCalled();
    });

    it('should allow admin to verify and finalize completed match result', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValueOnce({
        id: 42,
        event_key: 'chess',
        status: 'COMPLETED',
        match_code: 'CHESS-001'
      });

      vi.spyOn(MatchService, 'getMatchById').mockResolvedValueOnce({
        id: 42,
        status: 'COMPLETED',
        is_verified: true,
        verified_by: 'admin@kucet.ac.in'
      });

      const verified = await MatchService.verifyMatchResult(42, {
        verifiedBy: 'admin@kucet.ac.in',
        verificationNotes: 'Fair play confirmed'
      });

      expect(verified.is_verified).toBe(true);
      expect(eventDb.update).toHaveBeenCalled();
    });
  });
});
