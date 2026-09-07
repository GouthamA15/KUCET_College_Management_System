import { eventDb, eventMatches, eventParticipants, chessGames, eventAuditLogs, initExperimentDb } from '../db';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import crypto from 'crypto';

export class MatchService {
  /**
   * Creates a new tournament match and initializes game state.
   */
  static async createMatch(eventKey = 'chess', matchData, createdBy = 'ADMIN') {
    await initExperimentDb();

    const {
      roundName = 'Round 1',
      playerWhiteId,
      playerBlackId,
      scheduledAt = null,
      customMatchCode = null
    } = matchData;

    if (!playerWhiteId || !playerBlackId) {
      throw { status: 400, message: 'Both White and Black players must be specified.' };
    }

    if (playerWhiteId === playerBlackId) {
      throw { status: 400, message: 'A player cannot play against themselves.' };
    }

    // Fetch players
    const [whitePlayer, blackPlayer] = await Promise.all([
      eventDb.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, Number(playerWhiteId)) }),
      eventDb.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, Number(playerBlackId)) })
    ]);

    if (!whitePlayer || !blackPlayer) {
      throw { status: 404, message: 'One or both selected participants do not exist.' };
    }

    // Generate match code
    const matchCode = customMatchCode || `CHESS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const [insertResult] = await eventDb.insert(eventMatches).values({
      event_key: eventKey,
      match_code: matchCode,
      round_name: roundName,
      player_white_id: whitePlayer.id,
      player_white_name: whitePlayer.display_name,
      player_white_user_id: whitePlayer.user_id,
      player_black_id: blackPlayer.id,
      player_black_name: blackPlayer.display_name,
      player_black_user_id: blackPlayer.user_id,
      status: 'SCHEDULED',
      scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
      is_verified: false
    });

    const matchId = insertResult.insertId;

    // Initialize chess game record
    if (eventKey === 'chess') {
      await eventDb.insert(chessGames).values({
        match_id: matchId,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        current_turn: 'w',
        move_count: 0,
        halfmove_clock: 0,
        is_check: false,
        is_checkmate: false,
        is_stalemate: false,
        is_draw: false,
        captured_pieces: { white: [], black: [] }
      });
    }

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'CREATE_MATCH',
      actor_id: String(createdBy),
      actor_type: 'ADMIN',
      target_id: String(matchId),
      target_type: 'EVENT_MATCH',
      details: {
        matchCode,
        roundName,
        white: whitePlayer.display_name,
        black: blackPlayer.display_name
      }
    });

    return await this.getMatchById(matchId);
  }

  /**
   * Publishes a scheduled match, making it active for participants.
   */
  static async publishMatch(matchId, publishedBy = 'ADMIN') {
    await initExperimentDb();

    const match = await eventDb.query.eventMatches.findFirst({
      where: eq(eventMatches.id, Number(matchId))
    });

    if (!match) throw { status: 404, message: 'Match not found.' };

    await eventDb.update(eventMatches)
      .set({
        status: 'PUBLISHED',
        updated_at: new Date()
      })
      .where(eq(eventMatches.id, Number(matchId)));

    await eventDb.insert(eventAuditLogs).values({
      event_key: match.event_key,
      action: 'PUBLISH_MATCH',
      actor_id: String(publishedBy),
      actor_type: 'ADMIN',
      target_id: String(matchId),
      target_type: 'EVENT_MATCH',
      details: { matchCode: match.match_code }
    });

    return await this.getMatchById(matchId);
  }

  /**
   * Retrieves matches list.
   */
  static async getMatches(eventKey = 'chess', options = {}) {
    await initExperimentDb();

    const { status, roundName, userId, limit = 50, offset = 0 } = options;
    const conditions = [eq(eventMatches.event_key, eventKey)];

    if (status && status !== 'ALL') {
      conditions.push(eq(eventMatches.status, status));
    }

    if (roundName) {
      conditions.push(eq(eventMatches.round_name, roundName));
    }

    if (userId) {
      conditions.push(
        or(
          eq(eventMatches.player_white_user_id, String(userId)),
          eq(eventMatches.player_black_user_id, String(userId))
        )
      );
    }

    const whereClause = and(...conditions);

    const items = await eventDb.query.eventMatches.findMany({
      where: whereClause,
      limit: Math.min(Number(limit), 100),
      offset: Number(offset),
      orderBy: [desc(eventMatches.created_at)]
    });

    const [countResult] = await eventDb.select({ count: sql`COUNT(*)` })
      .from(eventMatches)
      .where(whereClause);

    return {
      items,
      total: Number(countResult?.count || 0)
    };
  }

  /**
   * Retrieves match details including associated game state.
   */
  static async getMatchById(matchId) {
    await initExperimentDb();

    const match = await eventDb.query.eventMatches.findFirst({
      where: eq(eventMatches.id, Number(matchId))
    });

    if (!match) return null;

    let gameState = null;
    if (match.event_key === 'chess') {
      gameState = await eventDb.query.chessGames.findFirst({
        where: eq(chessGames.match_id, Number(matchId))
      });
    }

    return {
      ...match,
      gameState
    };
  }

  /**
   * Records match outcome (Checkmate, Resignation, Draw).
   */
  static async recordMatchResult(matchId, resultData) {
    await initExperimentDb();

    const { winnerId = null, winnerSide = null, resultReason = 'normal', pgn = '' } = resultData;

    const match = await eventDb.query.eventMatches.findFirst({
      where: eq(eventMatches.id, Number(matchId))
    });

    if (!match) throw { status: 404, message: 'Match not found.' };

    const endedAt = new Date();

    await eventDb.update(eventMatches)
      .set({
        status: 'COMPLETED',
        winner_id: winnerId ? Number(winnerId) : null,
        winner_side: winnerSide,
        result_reason: resultReason,
        ended_at: endedAt,
        updated_at: endedAt
      })
      .where(eq(eventMatches.id, Number(matchId)));

    if (pgn && match.event_key === 'chess') {
      await eventDb.update(chessGames)
        .set({ pgn, updated_at: endedAt })
        .where(eq(chessGames.match_id, Number(matchId)));
    }

    await eventDb.insert(eventAuditLogs).values({
      event_key: match.event_key,
      action: 'RECORD_MATCH_RESULT',
      actor_id: 'SYSTEM',
      actor_type: 'SYSTEM',
      target_id: String(matchId),
      target_type: 'EVENT_MATCH',
      details: { winnerId, winnerSide, resultReason }
    });

    return await this.getMatchById(matchId);
  }

  /**
   * Admin/Organizer verifies and finalizes match result.
   */
  static async verifyMatchResult(matchId, verificationData) {
    await initExperimentDb();

    const { verifiedBy = 'ADMIN', verificationNotes = '' } = verificationData;

    const match = await eventDb.query.eventMatches.findFirst({
      where: eq(eventMatches.id, Number(matchId))
    });

    if (!match) throw { status: 404, message: 'Match not found.' };
    if (match.status !== 'COMPLETED') {
      throw { status: 400, message: 'Only completed matches can be verified.' };
    }

    const verifiedAt = new Date();

    await eventDb.update(eventMatches)
      .set({
        is_verified: true,
        verified_by: String(verifiedBy),
        verified_at: verifiedAt,
        verification_notes: verificationNotes || null,
        updated_at: verifiedAt
      })
      .where(eq(eventMatches.id, Number(matchId)));

    await eventDb.insert(eventAuditLogs).values({
      event_key: match.event_key,
      action: 'VERIFY_MATCH_RESULT',
      actor_id: String(verifiedBy),
      actor_type: 'ADMIN',
      target_id: String(matchId),
      target_type: 'EVENT_MATCH',
      details: { matchCode: match.match_code, notes: verificationNotes }
    });

    return await this.getMatchById(matchId);
  }
}

export default MatchService;
