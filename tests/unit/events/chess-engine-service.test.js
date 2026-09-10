import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChessEngineService } from '@/modules/events/services/ChessEngineService';
import { MatchService } from '@/modules/events/services/MatchService';
import { EventConfigService } from '@/modules/events/services/EventConfigService';
import { eventDb } from '@/modules/events/db';
import { Chess } from 'chess.js';

vi.mock('@/modules/events/db', () => ({
  initExperimentDb: vi.fn().mockResolvedValue(true),
  eventDb: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }])
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
        where: vi.fn().mockResolvedValue([{ count: 1 }])
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

describe('ChessEngineService & Legal Rules Verification', () => {
  const mockMatch = {
    id: 1,
    event_key: 'chess',
    match_code: 'CHESS-TEST-001',
    round_name: 'Round 1',
    player_white_id: 10,
    player_white_name: 'Alice (White)',
    player_white_user_id: '2026-CSE-001',
    player_black_id: 20,
    player_black_name: 'Bob (Black)',
    player_black_user_id: '2026-ECE-002',
    status: 'IN_PROGRESS',
    gameState: {
      id: 100,
      match_id: 1,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      current_turn: 'w',
      move_count: 0,
      captured_pieces: { white: [], black: [] }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(EventConfigService, 'getEventConfig').mockResolvedValue({ is_enabled: true });
    vi.spyOn(MatchService, 'getMatchById').mockResolvedValue(mockMatch);
  });

  it('should initialize and return 20 legal starting moves for White', async () => {
    const gameState = await ChessEngineService.getGameState(1);
    expect(gameState.legalMoves.length).toBe(20);
    expect(gameState.game.current_turn).toBe('w');
    expect(gameState.game.is_check).toBe(false);
  });

  it('should execute a legal move (e2 to e4) by the White player', async () => {
    const result = await ChessEngineService.makeMove(1, {
      userId: '2026-CSE-001',
      from: 'e2',
      to: 'e4'
    });

    expect(result).toBeDefined();
    expect(eventDb.insert).toHaveBeenCalled();
    expect(eventDb.update).toHaveBeenCalled();
  });

  it('should reject a move made out of turn (Black trying to move first)', async () => {
    await expect(
      ChessEngineService.makeMove(1, {
        userId: '2026-ECE-002', // Bob (Black)
        from: 'e7',
        to: 'e5'
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("White's turn")
    });
  });

  it('should reject an illegal move geometry (e2 to e5)', async () => {
    await expect(
      ChessEngineService.makeMove(1, {
        userId: '2026-CSE-001',
        from: 'e2',
        to: 'e5'
      })
    ).rejects.toMatchObject({
      status: 400
    });
  });

  it('should reject non-participant attempting to play in a match', async () => {
    await expect(
      ChessEngineService.makeMove(1, {
        userId: '2026-MECH-999', // Impostor
        from: 'e2',
        to: 'e4'
      })
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('not a participant')
    });
  });

  it('should handle player resignation correctly awarding victory to opponent', async () => {
    const recordSpy = vi.spyOn(MatchService, 'recordMatchResult').mockResolvedValue(true);

    await ChessEngineService.resign(1, '2026-CSE-001'); // White resigns

    expect(recordSpy).toHaveBeenCalledWith(1, {
      winnerId: 20, // Black player ID
      winnerSide: 'black',
      resultReason: 'resignation'
    });
  });

  it('should handle mutual draw offers and acceptance', async () => {
    const recordSpy = vi.spyOn(MatchService, 'recordMatchResult').mockResolvedValue(true);

    // Mock active draw offer from White
    const matchWithDrawOffer = {
      ...mockMatch,
      gameState: {
        ...mockMatch.gameState,
        draw_offer_side: 'w'
      }
    };
    vi.spyOn(MatchService, 'getMatchById').mockResolvedValue(matchWithDrawOffer);

    // Black accepts
    await ChessEngineService.respondToDraw(1, '2026-ECE-002', true);

    expect(recordSpy).toHaveBeenCalledWith(1, {
      winnerId: null,
      winnerSide: 'draw',
      resultReason: 'draw_agreement'
    });
  });

  it('should recognize terminal checkmate on board', async () => {
    // Scholar's Mate position (White delivered checkmate Qh7#)
    const scholarsMateFen = 'r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    const chess = new Chess(scholarsMateFen);
    expect(chess.isCheckmate()).toBe(true);
    expect(chess.isCheck()).toBe(true);
  });
});
