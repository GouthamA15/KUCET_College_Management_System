import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchService } from '@/modules/events/services/MatchService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { ParticipantService } from '@/modules/events/services/ParticipantService';
import { eventDb } from '@/modules/events/db';

// ──────────────────────────────────────────────────────────────────────────────
// Module-level mock for the experiment DB
// ──────────────────────────────────────────────────────────────────────────────
vi.mock('@/modules/events/db', () => ({
  initExperimentDb: vi.fn().mockResolvedValue(true),
  eventDb: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 99 }])
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
      })
    })),
    query: {
      eventConfigs:      { findFirst: vi.fn(), findMany: vi.fn() },
      eventParticipants: { findFirst: vi.fn(), findMany: vi.fn() },
      eventMatches:      { findFirst: vi.fn(), findMany: vi.fn() },
      chessGames:        { findFirst: vi.fn() },
      chessMoves:        { findMany: vi.fn() }
    },
    select: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }])
      })
    }))
  },
  eventConfigs:      {},
  eventParticipants: {},
  eventMatches:      {},
  chessGames:        {},
  chessMoves:        {},
  eventAuditLogs:    {}
}));

// ──────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ──────────────────────────────────────────────────────────────────────────────
const ACCEPTED_WHITE = {
  id: 1,
  event_key: 'chess',
  user_id: '2026-CSE-001',
  display_name: 'Student A',
  department: 'CSE',
  status: 'ACCEPTED',
  seed_number: 1,
  registered_at: new Date()
};

const ACCEPTED_BLACK = {
  id: 2,
  event_key: 'chess',
  user_id: '2026-CSE-002',
  display_name: 'Student B',
  department: 'CSE',
  status: 'ACCEPTED',
  seed_number: 2,
  registered_at: new Date()
};

const SCHEDULED_MATCH = {
  id: 99,
  event_key: 'chess',
  match_code: 'CHESS-FINAL-001',
  round_name: 'Final',
  player_white_id: 1,
  player_white_name: 'Student A',
  player_white_user_id: '2026-CSE-001',
  player_black_id: 2,
  player_black_name: 'Student B',
  player_black_user_id: '2026-CSE-002',
  status: 'SCHEDULED',
  is_verified: false,
  winner_id: null,
  winner_side: null,
  result_reason: null,
  gameState: {
    id: 1,
    match_id: 99,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    current_turn: 'w'
  }
};

const COMPLETED_MATCH = {
  ...SCHEDULED_MATCH,
  status: 'COMPLETED',
  winner_id: 1,
  winner_side: 'white',
  result_reason: 'checkmate'
};

// ──────────────────────────────────────────────────────────────────────────────

describe('MatchService — Tournament Workflow Tests', () => {
  beforeEach(() => {
    // clearAllMocks: resets vi.fn() call histories
    // restoreAllMocks: resets vi.spyOn() implementations
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Reset all DB query mocks to safe default values
    eventDb.query.eventMatches.findFirst.mockResolvedValue(undefined);
    eventDb.query.eventMatches.findMany.mockResolvedValue([]);
    eventDb.query.eventParticipants.findFirst.mockResolvedValue(undefined);
    eventDb.query.eventParticipants.findMany.mockResolvedValue([]);
    eventDb.query.chessGames.findFirst.mockResolvedValue(undefined);
    // Restore chained mocks for insert/update
    eventDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue([{ insertId: 99 }]) });
    eventDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
      })
    });
  });

  // ============================================================================
  // Suite 1: generateTournamentFixtures
  // Note: We mock createMatch directly to avoid testing its internals here.
  // createMatch internals are thoroughly tested in Suite 2.
  // ============================================================================
  describe('1. generateTournamentFixtures — Bracket Generation', () => {
    it('generates exactly 1 Final fixture for 2 accepted players', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        rules_json: {}
      });
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);

      // No existing active matches
      eventDb.query.eventMatches.findMany.mockResolvedValue([]);
      // 2 accepted participants
      eventDb.query.eventParticipants.findMany.mockResolvedValue([ACCEPTED_WHITE, ACCEPTED_BLACK]);

      // Mock createMatch so we don't depend on its internal DB calls
      vi.spyOn(MatchService, 'createMatch').mockResolvedValue(SCHEDULED_MATCH);

      const result = await MatchService.generateTournamentFixtures('chess', {}, 'admin');

      expect(result.created).toBe(true);
      expect(result.roundName).toBe('Final');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(MatchService.createMatch).toHaveBeenCalledWith(
        'chess',
        expect.objectContaining({ roundName: 'Final', playerWhiteId: 1, playerBlackId: 2 }),
        'admin'
      );
      expect(EventConfigService.updateEventConfig).toHaveBeenCalledWith(
        'chess',
        expect.objectContaining({
          rules_json: expect.objectContaining({ tournament_status: 'IN_PROGRESS' })
        }),
        'admin'
      );
    });

    it('generates Quarterfinals pairings for 8 accepted players (4 matches)', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        rules_json: {}
      });
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);

      // No existing active matches
      eventDb.query.eventMatches.findMany.mockResolvedValue([]);

      // 8 accepted participants
      const eightPlayers = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        event_key: 'chess',
        user_id: `2026-CSE-00${i + 1}`,
        display_name: `Player ${i + 1}`,
        status: 'ACCEPTED',
        seed_number: i + 1
      }));
      eventDb.query.eventParticipants.findMany.mockResolvedValue(eightPlayers);

      // Mock createMatch to return a fixture for each pair
      let callCount = 0;
      vi.spyOn(MatchService, 'createMatch').mockImplementation(async (_, data) => ({
        ...SCHEDULED_MATCH,
        id: 100 + callCount++,
        round_name: data.roundName
      }));

      const result = await MatchService.generateTournamentFixtures('chess', {}, 'admin');

      expect(result.created).toBe(true);
      expect(result.roundName).toBe('Quarterfinals');
      expect(result.items).toHaveLength(4);
      expect(result.total).toBe(4);
    });

    it('returns existing matches idempotently when active fixtures already exist', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        rules_json: {}
      });
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);

      // Active fixtures already exist — triggers early return
      eventDb.query.eventMatches.findMany.mockResolvedValue([SCHEDULED_MATCH]);
      // Participants are also set (queried before active match check in the code)
      eventDb.query.eventParticipants.findMany.mockResolvedValue([ACCEPTED_WHITE, ACCEPTED_BLACK]);

      const result = await MatchService.generateTournamentFixtures('chess', {}, 'admin');

      expect(result.created).toBe(false);
      expect(result.message).toMatch(/already exist/i);
      expect(result.items).toHaveLength(1);
      // No new fixtures created → no config update
      expect(EventConfigService.updateEventConfig).not.toHaveBeenCalled();
    });

    it('throws 400 if tournament is already COMPLETED', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        rules_json: { tournament_status: 'COMPLETED' }
      });

      await expect(
        MatchService.generateTournamentFixtures('chess', {}, 'admin')
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('COMPLETED')
      });
    });

    it('throws 400 if fewer than 2 participants are accepted', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        rules_json: {}
      });

      eventDb.query.eventMatches.findMany.mockResolvedValue([]);
      eventDb.query.eventParticipants.findMany.mockResolvedValue([ACCEPTED_WHITE]); // only 1

      await expect(
        MatchService.generateTournamentFixtures('chess', {}, 'admin')
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('At least 2 accepted')
      });
    });
  });

  // ============================================================================
  // Suite 2: createMatch — Duplicate & Authorization Guards
  // ============================================================================
  describe('2. createMatch — Duplication & ACCEPTED Status Guards', () => {
    it('throws 400 when a player is not ACCEPTED status', async () => {
      // White is REGISTERED, not ACCEPTED
      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce({ ...ACCEPTED_WHITE, status: 'REGISTERED' })
        .mockResolvedValueOnce(ACCEPTED_BLACK);

      await expect(
        MatchService.createMatch('chess', {
          roundName: 'Final',
          playerWhiteId: 1,
          playerBlackId: 2
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('ACCEPTED')
      });
    });

    it('throws 400 when both player IDs are identical', async () => {
      await expect(
        MatchService.createMatch('chess', {
          roundName: 'Final',
          playerWhiteId: 5,
          playerBlackId: 5
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('play against themselves')
      });
    });

    it('returns existing match idempotently when a duplicate active fixture exists', async () => {
      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce(ACCEPTED_WHITE)
        .mockResolvedValueOnce(ACCEPTED_BLACK);

      // Duplicate active fixture found
      eventDb.query.eventMatches.findFirst.mockResolvedValue(SCHEDULED_MATCH);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue(SCHEDULED_MATCH);

      const result = await MatchService.createMatch('chess', {
        roundName: 'Final',
        playerWhiteId: 1,
        playerBlackId: 2
      });

      // Must NOT insert a new row
      expect(eventDb.insert).not.toHaveBeenCalled();
      expect(result.id).toBe(99);
      expect(result.status).toBe('SCHEDULED');
    });

    it('creates new match when no existing active fixture exists', async () => {
      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce(ACCEPTED_WHITE)
        .mockResolvedValueOnce(ACCEPTED_BLACK);

      eventDb.query.eventMatches.findFirst.mockResolvedValue(null);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue(SCHEDULED_MATCH);

      const result = await MatchService.createMatch('chess', {
        roundName: 'Final',
        playerWhiteId: 1,
        playerBlackId: 2
      });

      expect(eventDb.insert).toHaveBeenCalled();
      expect(result.status).toBe('SCHEDULED');
    });

    it('throws 404 when a player participant does not exist', async () => {
      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce(null)         // white not found
        .mockResolvedValueOnce(ACCEPTED_BLACK);

      await expect(
        MatchService.createMatch('chess', {
          roundName: 'Final',
          playerWhiteId: 999,
          playerBlackId: 2
        })
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ============================================================================
  // Suite 3: startMatch — Lifecycle Transition
  // ============================================================================
  describe('3. startMatch — SCHEDULED → READY Transition', () => {
    it('transitions match from SCHEDULED to READY status', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue(SCHEDULED_MATCH);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue({
        ...SCHEDULED_MATCH,
        status: 'READY'
      });

      const result = await MatchService.startMatch(99, 'admin');

      expect(eventDb.update).toHaveBeenCalled();
      expect(result.status).toBe('READY');
    });

    it('throws 404 if match does not exist', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue(null);

      await expect(
        MatchService.startMatch(9999, 'admin')
      ).rejects.toMatchObject({ status: 404 });
    });

    it('publishMatch is an alias for startMatch', async () => {
      const spy = vi.spyOn(MatchService, 'startMatch').mockResolvedValue({
        id: 99,
        status: 'READY'
      });

      await MatchService.publishMatch(99, 'admin');

      expect(spy).toHaveBeenCalledWith(99, 'admin');
    });
  });

  // ============================================================================
  // Suite 4: cancelMatch
  // ============================================================================
  describe('4. cancelMatch — Match Cancellation', () => {
    it('cancels a scheduled match with a provided reason', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue(SCHEDULED_MATCH);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue({
        ...SCHEDULED_MATCH,
        status: 'CANCELLED',
        result_reason: 'Venue unavailable'
      });

      const result = await MatchService.cancelMatch(99, {
        reason: 'Venue unavailable',
        cancelledBy: 'admin'
      });

      expect(eventDb.update).toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });

    it('throws 404 when cancelling a non-existent match', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue(null);

      await expect(
        MatchService.cancelMatch(9999)
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ============================================================================
  // Suite 5: verifyMatchResult — Champion Detection & Tournament Completion
  // ============================================================================
  describe('5. verifyMatchResult — Champion & Tournament Completion', () => {
    it('verifies a completed non-final match without marking tournament complete', async () => {
      const quarterfinalMatch = {
        ...COMPLETED_MATCH,
        round_name: 'Quarterfinals - Match 1'
      };

      eventDb.query.eventMatches.findFirst.mockResolvedValue(quarterfinalMatch);
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue({
        ...quarterfinalMatch,
        is_verified: true
      });

      const result = await MatchService.verifyMatchResult(99, {
        verifiedBy: 'admin',
        verificationNotes: 'QF confirmed'
      });

      expect(result.is_verified).toBe(true);
      // Not a Final round → no tournament completion update
      expect(EventConfigService.updateEventConfig).not.toHaveBeenCalled();
    });

    it('throws 400 when verifying a match that is not yet COMPLETED', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue({
        ...SCHEDULED_MATCH,
        status: 'SCHEDULED'
      });

      await expect(
        MatchService.verifyMatchResult(99, { verifiedBy: 'admin' })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('completed')
      });
    });

    it('declares champion and marks tournament COMPLETED when Final match is verified', async () => {
      const finalMatch = {
        ...COMPLETED_MATCH,
        round_name: 'Final',
        winner_id: 1,
        winner_side: 'white',
        result_reason: 'checkmate'
      };

      eventDb.query.eventMatches.findFirst.mockResolvedValue(finalMatch);
      eventDb.query.eventParticipants.findFirst.mockResolvedValue(ACCEPTED_WHITE);

      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        rules_json: { tournament_status: 'IN_PROGRESS' }
      });
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue({
        ...finalMatch,
        is_verified: true
      });

      const result = await MatchService.verifyMatchResult(99, {
        verifiedBy: 'admin',
        verificationNotes: 'Checkmate confirmed'
      });

      expect(result.is_verified).toBe(true);
      expect(EventConfigService.updateEventConfig).toHaveBeenCalledWith(
        'chess',
        expect.objectContaining({
          rules_json: expect.objectContaining({
            tournament_status: 'COMPLETED',
            champion: expect.objectContaining({
              name: 'Student A',
              winnerSide: 'white'
            })
          })
        }),
        'admin'
      );
      expect(eventDb.insert).toHaveBeenCalled(); // Audit log
    });

    it('does not declare champion when Final match ends in a draw (no winner_id)', async () => {
      const drawFinalMatch = {
        ...COMPLETED_MATCH,
        round_name: 'Final',
        winner_id: null,
        winner_side: 'draw',
        result_reason: 'stalemate'
      };

      eventDb.query.eventMatches.findFirst.mockResolvedValue(drawFinalMatch);
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue({
        ...drawFinalMatch,
        is_verified: true
      });

      const result = await MatchService.verifyMatchResult(99, { verifiedBy: 'admin' });

      expect(result.is_verified).toBe(true);
      // No winner_id → no champion → no config update
      expect(EventConfigService.updateEventConfig).not.toHaveBeenCalled();
    });

    it('throws 404 when match does not exist', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue(null);

      await expect(
        MatchService.verifyMatchResult(9999, { verifiedBy: 'admin' })
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // ============================================================================
  // Suite 6: Full End-to-End Tournament Lifecycle (2-player)
  // Steps: generate fixtures → start match → record result → verify → champion
  // ============================================================================
  describe('6. End-to-End: 2-Player Tournament Lifecycle', () => {
    it('completes full lifecycle: fixtures → start → record result → verify → champion declared', async () => {
      // Config for generateTournamentFixtures + verifyMatchResult champion path
      vi.spyOn(EventConfigService, 'getEventConfig')
        .mockResolvedValueOnce({ event_key: 'chess', rules_json: {} })
        .mockResolvedValueOnce({ event_key: 'chess', rules_json: { tournament_status: 'IN_PROGRESS' } });
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);

      // Mock createMatch directly (avoiding its internal findFirst calls)
      vi.spyOn(MatchService, 'createMatch').mockResolvedValue(SCHEDULED_MATCH);

      // Participants for generateTournamentFixtures
      eventDb.query.eventMatches.findMany.mockResolvedValue([]);
      eventDb.query.eventParticipants.findMany.mockResolvedValue([ACCEPTED_WHITE, ACCEPTED_BLACK]);

      // eventMatches.findFirst: startMatch → recordMatchResult → verifyMatchResult
      eventDb.query.eventMatches.findFirst
        .mockResolvedValueOnce(SCHEDULED_MATCH)                               // startMatch
        .mockResolvedValueOnce({ ...SCHEDULED_MATCH, status: 'IN_PROGRESS' }) // recordMatchResult
        .mockResolvedValueOnce(COMPLETED_MATCH);                              // verifyMatchResult

      // Winner participant lookup in verifyMatchResult
      eventDb.query.eventParticipants.findFirst.mockResolvedValue(ACCEPTED_WHITE);

      // getMatchById: generateTournamentFixtures(via createMatch spy=bypass), startMatch, recordMatchResult, verifyMatchResult
      vi.spyOn(MatchService, 'getMatchById')
        .mockResolvedValueOnce({ ...SCHEDULED_MATCH, status: 'READY' })       // startMatch
        .mockResolvedValueOnce(COMPLETED_MATCH)                               // recordMatchResult
        .mockResolvedValueOnce({ ...COMPLETED_MATCH, is_verified: true });    // verifyMatchResult

      // ── Step 1: Generate fixtures ──
      const fixtures = await MatchService.generateTournamentFixtures('chess', {}, 'admin');
      expect(fixtures.created).toBe(true);
      expect(fixtures.items[0].round_name).toBe('Final');

      // ── Step 2: Start match ──
      const started = await MatchService.startMatch(99, 'admin');
      expect(started.status).toBe('READY');

      // ── Step 3: Record result (auto-triggered by ChessEngineService after checkmate) ──
      const recorded = await MatchService.recordMatchResult(99, {
        winnerId: 1,
        winnerSide: 'white',
        resultReason: 'checkmate'
      });
      expect(recorded.status).toBe('COMPLETED');

      // ── Step 4: Admin verifies → champion declared + tournament COMPLETED ──
      const verified = await MatchService.verifyMatchResult(99, {
        verifiedBy: 'admin',
        verificationNotes: 'Final — Student A wins by checkmate'
      });
      expect(verified.is_verified).toBe(true);
      expect(EventConfigService.updateEventConfig).toHaveBeenCalledWith(
        'chess',
        expect.objectContaining({
          rules_json: expect.objectContaining({
            tournament_status: 'COMPLETED',
            champion: expect.objectContaining({ name: 'Student A' })
          })
        }),
        'admin'
      );
    });
  });

  // ============================================================================
  // Suite 7: Registration Blocked After Tournament COMPLETED
  // ============================================================================
  describe('7. Registration blocked after tournament COMPLETED', () => {
    it('throws 400 when student tries to register after tournament is COMPLETED', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        is_enabled: true,
        registration_open: true,
        rules_json: { tournament_status: 'COMPLETED' }
      });

      await expect(
        ParticipantService.registerParticipant('chess', {
          userId: '2026-CSE-999',
          displayName: 'Late Student',
          userType: 'student'
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('concluded')
      });
    });
  });

  // ============================================================================
  // Suite 8: recordMatchResult Guards and Auto-Derivation
  // ============================================================================
  describe('8. recordMatchResult Guards & Auto-Derivation', () => {
    it('automatically derives winner_id from winner_side when winner_id is omitted', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue(SCHEDULED_MATCH);
      vi.spyOn(MatchService, 'getMatchById').mockResolvedValue({
        ...SCHEDULED_MATCH,
        status: 'COMPLETED',
        winner_id: SCHEDULED_MATCH.player_white_id,
        winner_side: 'white'
      });

      const result = await MatchService.recordMatchResult(99, {
        winnerSide: 'white',
        resultReason: 'checkmate'
      });

      expect(eventDb.update).toHaveBeenCalled();
      expect(result.winner_side).toBe('white');
      expect(result.winner_id).toBe(1);
    });

    it('rejects with 400 when attempting to overwrite a verified and sealed match', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue({
        ...COMPLETED_MATCH,
        is_verified: true
      });

      await expect(
        MatchService.recordMatchResult(99, {
          winnerSide: 'black',
          resultReason: 'resignation'
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('verified and sealed')
      });
    });

    it('rejects with 400 when attempting to record result on a cancelled match', async () => {
      eventDb.query.eventMatches.findFirst.mockResolvedValue({
        ...SCHEDULED_MATCH,
        status: 'CANCELLED'
      });

      await expect(
        MatchService.recordMatchResult(99, {
          winnerSide: 'white',
          resultReason: 'checkmate'
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('cancelled')
      });
    });
  });

  // ============================================================================
  // Suite 9: Conflict Guards & Next Round Progression
  // ============================================================================
  describe('9. Conflict Guards & Next Round Progression', () => {
    it('rejects match creation if either participant is already in another active match', async () => {
      eventDb.query.eventParticipants.findFirst
        .mockResolvedValueOnce(ACCEPTED_WHITE)
        .mockResolvedValueOnce(ACCEPTED_BLACK);

      // Conflict: Player 1 is already in an active match with Player 3
      eventDb.query.eventMatches.findFirst
        .mockResolvedValueOnce(null) // no match between 1 and 2
        .mockResolvedValueOnce({     // conflict match found for Player 1
          id: 55,
          match_code: 'CHESS-M-CONFLICT',
          player_white_id: 1,
          player_black_id: 3,
          status: 'IN_PROGRESS'
        });

      await expect(
        MatchService.createMatch('chess', {
          roundName: 'Round 1',
          playerWhiteId: 1,
          playerBlackId: 2
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('already assigned to an active match')
      });
    });

    it('advances previous round winners to Final round when previous round is verified', async () => {
      vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({
        event_key: 'chess',
        rules_json: { tournament_status: 'IN_PROGRESS', total_fixtures: 2 }
      });
      vi.spyOn(EventConfigService, 'updateEventConfig').mockResolvedValue(true);

      // Previous round: Semifinals (2 matches, both verified)
      const semi1 = {
        id: 101,
        match_code: 'CHESS-SEMI-1',
        round_name: 'Semifinals',
        player_white_id: 1,
        player_black_id: 2,
        winner_id: 1,
        status: 'COMPLETED',
        is_verified: true
      };
      const semi2 = {
        id: 102,
        match_code: 'CHESS-SEMI-2',
        round_name: 'Semifinals',
        player_white_id: 3,
        player_black_id: 4,
        winner_id: 4,
        status: 'COMPLETED',
        is_verified: true
      };

      // No active matches
      eventDb.query.eventMatches.findMany
        .mockResolvedValueOnce([]) // active matches check -> none
        .mockResolvedValueOnce([semi1, semi2]); // all matches check -> 2 verified semis

      const advancingContenders = [
        { id: 1, display_name: 'Winner 1', user_id: 'W1', status: 'ACCEPTED', seed_number: 1 },
        { id: 4, display_name: 'Winner 2', user_id: 'W2', status: 'ACCEPTED', seed_number: 2 }
      ];

      eventDb.query.eventParticipants.findMany.mockResolvedValue(advancingContenders);

      vi.spyOn(MatchService, 'createMatch').mockResolvedValue({
        id: 200,
        round_name: 'Final',
        player_white_id: 1,
        player_black_id: 4,
        status: 'SCHEDULED'
      });

      const result = await MatchService.generateTournamentFixtures('chess', {}, 'admin');

      expect(result.created).toBe(true);
      expect(result.roundName).toBe('Final');
      expect(result.items).toHaveLength(1);
      expect(MatchService.createMatch).toHaveBeenCalledWith(
        'chess',
        expect.objectContaining({
          roundName: 'Final',
          playerWhiteId: 1,
          playerBlackId: 4
        }),
        'admin'
      );
    });
  });
});
