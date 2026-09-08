import { eventDb, eventMatches, eventParticipants, chessGames, eventAuditLogs, initExperimentDb } from '../db';
import { eq, and, sql, desc, asc, or } from 'drizzle-orm';
import crypto from 'crypto';
import { EventConfigService } from './EventConfigService';

export function isFinalRoundName(roundName) {
  if (!roundName) return false;
  const lower = roundName.toLowerCase();
  if (lower.includes('semi') || lower.includes('quarter') || lower.includes('1/8') || lower.includes('1/4') || lower.includes('1/2')) {
    return false;
  }
  return lower.includes('final');
}

let fixtureGenerationPromise = null;

export class MatchService {
  /**
   * Creates a new tournament match and initializes game state.
   * Protects against duplicate active fixtures between the same two participants.
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

    if (Number(playerWhiteId) === Number(playerBlackId)) {
      throw { status: 400, message: 'A player cannot play against themselves.' };
    }

    // 1. Guard against creating matches in completed tournament
    const config = await EventConfigService.getEventConfig(eventKey);
    const rules = typeof config.rules_json === 'string' ? JSON.parse(config.rules_json || '{}') : (config.rules_json || {});
    if (rules.tournament_status === 'COMPLETED') {
      throw { status: 400, message: 'Tournament has already concluded and is marked as COMPLETED.' };
    }

    // 2. Fetch players and verify they exist and are accepted
    const [whitePlayer, blackPlayer] = await Promise.all([
      eventDb.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, Number(playerWhiteId)) }),
      eventDb.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, Number(playerBlackId)) })
    ]);

    if (!whitePlayer || !blackPlayer) {
      throw { status: 404, message: 'One or both selected participants do not exist.' };
    }

    if (whitePlayer.status !== 'ACCEPTED' || blackPlayer.status !== 'ACCEPTED') {
      throw { status: 400, message: 'Only ACCEPTED participants can be paired into match fixtures.' };
    }

    // 3. Concurrency & Duplication guard: Check if an active/scheduled match already exists between these same two players
    const existingActiveMatch = await eventDb.query.eventMatches.findFirst({
      where: and(
        eq(eventMatches.event_key, eventKey),
        or(
          and(
            eq(eventMatches.player_white_id, whitePlayer.id),
            eq(eventMatches.player_black_id, blackPlayer.id)
          ),
          and(
            eq(eventMatches.player_white_id, blackPlayer.id),
            eq(eventMatches.player_black_id, whitePlayer.id)
          )
        ),
        or(
          eq(eventMatches.status, 'SCHEDULED'),
          eq(eventMatches.status, 'READY'),
          eq(eventMatches.status, 'PUBLISHED'),
          eq(eventMatches.status, 'STARTED'),
          eq(eventMatches.status, 'IN_PROGRESS')
        )
      )
    });

    if (existingActiveMatch) {
      // Idempotently return existing match
      return await this.getMatchById(existingActiveMatch.id);
    }

    // 4. Check if either player is already competing in another active match in this tournament
    const playerConflictMatch = await eventDb.query.eventMatches.findFirst({
      where: and(
        eq(eventMatches.event_key, eventKey),
        or(
          eq(eventMatches.player_white_id, whitePlayer.id),
          eq(eventMatches.player_black_id, whitePlayer.id),
          eq(eventMatches.player_white_id, blackPlayer.id),
          eq(eventMatches.player_black_id, blackPlayer.id)
        ),
        or(
          eq(eventMatches.status, 'SCHEDULED'),
          eq(eventMatches.status, 'READY'),
          eq(eventMatches.status, 'PUBLISHED'),
          eq(eventMatches.status, 'STARTED'),
          eq(eventMatches.status, 'IN_PROGRESS')
        )
      )
    });

    if (playerConflictMatch) {
      const conflictName = (playerConflictMatch.player_white_id === whitePlayer.id || playerConflictMatch.player_black_id === whitePlayer.id)
        ? whitePlayer.display_name
        : blackPlayer.display_name;
      throw {
        status: 400,
        message: `Contender ${conflictName} is already assigned to an active match (${playerConflictMatch.match_code}).`
      };
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

    // Ensure tournament status is marked IN_PROGRESS and registration closed
    if (rules.tournament_status !== 'IN_PROGRESS') {
      await EventConfigService.updateEventConfig(eventKey, {
        rules_json: {
          ...rules,
          tournament_status: 'IN_PROGRESS',
          current_round: roundName
        },
        registration_open: false
      }, createdBy);
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
   * Generates tournament fixtures for accepted participants.
   * For 2 players: Generates exactly ONE fixture (Final).
   * For 4/8/16 players: Generates corresponding knockout bracket rounds.
   * Concurrency-safe and idempotent: Returns existing fixtures if already generated.
   */
  static async generateTournamentFixtures(eventKey = 'chess', options = {}, createdBy = 'ADMIN') {
    if (fixtureGenerationPromise) {
      return await fixtureGenerationPromise;
    }
    fixtureGenerationPromise = (async () => {
      try {
        return await this._doGenerateTournamentFixtures(eventKey, options, createdBy);
      } finally {
        fixtureGenerationPromise = null;
      }
    })();
    return await fixtureGenerationPromise;
  }

  /**
   * Internal implementation of fixture generation.
   */
  static async _doGenerateTournamentFixtures(eventKey = 'chess', options = {}, createdBy = 'ADMIN') {
    await initExperimentDb();

    // 1. Fetch event config and verify tournament is not already completed
    const config = await EventConfigService.getEventConfig(eventKey);
    const rules = typeof config.rules_json === 'string' ? JSON.parse(config.rules_json || '{}') : (config.rules_json || {});
    
    if (rules.tournament_status === 'COMPLETED') {
      throw { status: 400, message: 'Tournament has already concluded and is marked as COMPLETED.' };
    }

    // 2. Check if active fixtures already exist to prevent duplicate creation
    const existingActiveMatches = await eventDb.query.eventMatches.findMany({
      where: and(
        eq(eventMatches.event_key, eventKey),
        or(
          eq(eventMatches.status, 'SCHEDULED'),
          eq(eventMatches.status, 'READY'),
          eq(eventMatches.status, 'PUBLISHED'),
          eq(eventMatches.status, 'STARTED'),
          eq(eventMatches.status, 'IN_PROGRESS')
        )
      ),
      orderBy: [asc(eventMatches.id)]
    });

    if (existingActiveMatches.length > 0) {
      return {
        created: false,
        message: 'Active fixtures already exist for this tournament.',
        items: existingActiveMatches,
        total: existingActiveMatches.length
      };
    }

    // 3. Check for previous completed rounds to support Next Round generation
    const allMatches = await eventDb.query.eventMatches.findMany({
      where: eq(eventMatches.event_key, eventKey),
      orderBy: [desc(eventMatches.id)]
    });

    let participantsToPair = [];
    let roundName = options.roundName;

    if (allMatches.length > 0) {
      // Check if all previous matches are completed and verified
      const unverified = allMatches.filter(m => !m.is_verified);
      if (unverified.length > 0) {
        throw {
          status: 400,
          message: `All matches in the previous round must be verified before generating the next round. (${unverified.length} pending audit).`
        };
      }

      // Collect winners from the most recent round
      const latestRound = allMatches[0].round_name;
      if (isFinalRoundName(latestRound)) {
        throw { status: 400, message: 'Final round has already concluded.' };
      }

      const latestRoundMatches = allMatches.filter(m => m.round_name === latestRound);
      const winnerIds = latestRoundMatches.map(m => m.winner_id).filter(Boolean);

      if (winnerIds.length < 2) {
        throw { status: 400, message: `At least 2 winners are required from the previous round to advance. Current winners: ${winnerIds.length}.` };
      }

      const winners = await eventDb.query.eventParticipants.findMany({
        where: and(
          eq(eventParticipants.event_key, eventKey),
          eq(eventParticipants.status, 'ACCEPTED')
        ),
        orderBy: [asc(eventParticipants.seed_number), asc(eventParticipants.registered_at)]
      });

      participantsToPair = winners.filter(w => winnerIds.includes(w.id));
      if (!roundName) {
        if (participantsToPair.length === 2) roundName = 'Final';
        else if (participantsToPair.length <= 4) roundName = 'Semifinals';
        else roundName = 'Next Round';
      }
    } else {
      // First round: fetch all ACCEPTED participants
      const acceptedParticipants = await eventDb.query.eventParticipants.findMany({
        where: and(
          eq(eventParticipants.event_key, eventKey),
          eq(eventParticipants.status, 'ACCEPTED')
        ),
        orderBy: [asc(eventParticipants.seed_number), asc(eventParticipants.registered_at)]
      });

      if (acceptedParticipants.length < 2) {
        throw {
          status: 400,
          message: `At least 2 accepted participants are required to generate fixtures. Current accepted: ${acceptedParticipants.length}.`
        };
      }

      participantsToPair = acceptedParticipants;
      if (!roundName) {
        if (participantsToPair.length === 2) roundName = 'Final';
        else if (participantsToPair.length <= 4) roundName = 'Semifinals';
        else if (participantsToPair.length <= 8) roundName = 'Quarterfinals';
        else roundName = 'Round 1';
      }
    }

    // 4. Generate pairings
    const createdMatches = [];
    const count = participantsToPair.length;

    if (count === 2) {
      // Exactly 2 players -> 1 Final match
      const p1 = participantsToPair[0];
      const p2 = participantsToPair[1];
      const match = await this.createMatch(eventKey, {
        roundName,
        playerWhiteId: p1.id,
        playerBlackId: p2.id,
        scheduledAt: options.scheduledAt || null
      }, createdBy);
      createdMatches.push(match);
    } else {
      // Multiple pairs: top seed vs bottom seed
      const numPairs = Math.floor(count / 2);
      for (let i = 0; i < numPairs; i++) {
        const p1 = participantsToPair[i];
        const p2 = participantsToPair[count - 1 - i];
        const match = await this.createMatch(eventKey, {
          roundName: `${roundName} - Match ${i + 1}`,
          playerWhiteId: p1.id,
          playerBlackId: p2.id,
          scheduledAt: options.scheduledAt || null
        }, createdBy);
        createdMatches.push(match);
      }
    }

    // 5. Update tournament status in config
    await EventConfigService.updateEventConfig(eventKey, {
      rules_json: {
        ...rules,
        tournament_status: 'IN_PROGRESS',
        current_round: roundName,
        total_fixtures: (rules.total_fixtures || 0) + createdMatches.length
      },
      registration_open: false // Close registration once tournament fixtures are generated
    }, createdBy);

    await eventDb.insert(eventAuditLogs).values({
      event_key: eventKey,
      action: 'START_TOURNAMENT',
      actor_id: String(createdBy),
      actor_type: 'ADMIN',
      target_id: eventKey,
      target_type: 'EVENT_CONFIG',
      details: {
        roundName,
        participantsCount: count,
        fixturesGenerated: createdMatches.length
      }
    });

    return {
      created: true,
      roundName,
      items: createdMatches,
      total: createdMatches.length
    };
  }

  /**
   * Starts/publishes a scheduled match, transitioning it to READY / STARTED.
   */
  static async startMatch(matchId, startedBy = 'ADMIN') {
    await initExperimentDb();

    const match = await eventDb.query.eventMatches.findFirst({
      where: eq(eventMatches.id, Number(matchId))
    });

    if (!match) throw { status: 404, message: 'Match not found.' };

    const now = new Date();
    await eventDb.update(eventMatches)
      .set({
        status: 'READY',
        started_at: match.started_at || now,
        updated_at: now
      })
      .where(eq(eventMatches.id, Number(matchId)));

    await eventDb.insert(eventAuditLogs).values({
      event_key: match.event_key,
      action: 'START_MATCH',
      actor_id: String(startedBy),
      actor_type: 'ADMIN',
      target_id: String(matchId),
      target_type: 'EVENT_MATCH',
      details: { matchCode: match.match_code, roundName: match.round_name }
    });

    return await this.getMatchById(matchId);
  }

  /**
   * Publishes a scheduled match (alias for startMatch).
   */
  static async publishMatch(matchId, publishedBy = 'ADMIN') {
    return await this.startMatch(matchId, publishedBy);
  }

  /**
   * Cancels a scheduled/active match.
   */
  static async cancelMatch(matchId, { reason = 'Cancelled by administration', cancelledBy = 'ADMIN' } = {}) {
    await initExperimentDb();

    const match = await eventDb.query.eventMatches.findFirst({
      where: eq(eventMatches.id, Number(matchId))
    });

    if (!match) throw { status: 404, message: 'Match not found.' };

    const now = new Date();
    await eventDb.update(eventMatches)
      .set({
        status: 'CANCELLED',
        result_reason: reason,
        ended_at: now,
        updated_at: now
      })
      .where(eq(eventMatches.id, Number(matchId)));

    await eventDb.insert(eventAuditLogs).values({
      event_key: match.event_key,
      action: 'CANCEL_MATCH',
      actor_id: String(cancelledBy),
      actor_type: 'ADMIN',
      target_id: String(matchId),
      target_type: 'EVENT_MATCH',
      details: { matchCode: match.match_code, reason }
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
   * Records match outcome (Checkmate, Resignation, Draw, Arbiter Decision).
   * Guards against casually overwriting verified or cancelled matches.
   */
  static async recordMatchResult(matchId, resultData, recordedBy = 'SYSTEM') {
    await initExperimentDb();

    const { winnerId = null, winnerSide = null, resultReason = 'normal', pgn = '' } = resultData;

    const match = await eventDb.query.eventMatches.findFirst({
      where: eq(eventMatches.id, Number(matchId))
    });

    if (!match) throw { status: 404, message: 'Match not found.' };

    if (match.status === 'COMPLETED' && match.is_verified) {
      throw { status: 400, message: 'Match result has already been verified and sealed. Cannot overwrite.' };
    }

    if (match.status === 'CANCELLED') {
      throw { status: 400, message: 'Match has been cancelled. Cannot record result.' };
    }

    // Determine winnerId if omitted but winnerSide is provided
    let finalWinnerId = winnerId ? Number(winnerId) : null;
    if (!finalWinnerId && winnerSide) {
      if (winnerSide === 'white') finalWinnerId = match.player_white_id;
      else if (winnerSide === 'black') finalWinnerId = match.player_black_id;
      else if (winnerSide === 'draw') finalWinnerId = null;
    }

    const endedAt = new Date();

    await eventDb.update(eventMatches)
      .set({
        status: 'COMPLETED',
        winner_id: finalWinnerId,
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
      actor_id: String(recordedBy),
      actor_type: recordedBy === 'SYSTEM' ? 'SYSTEM' : 'ADMIN',
      target_id: String(matchId),
      target_type: 'EVENT_MATCH',
      details: { winnerId: finalWinnerId, winnerSide, resultReason, recordedBy }
    });

    return await this.getMatchById(matchId);
  }

  /**
   * Admin/Organizer verifies and finalizes match result.
   * If this was the final fixture, determines tournament champion and marks tournament COMPLETED.
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

    // Check if this was a Final match or if all matches in the tournament are completed & verified
    const isFinalRound = isFinalRoundName(match.round_name);
    
    if (isFinalRound && match.winner_id) {
      const winnerParticipant = await eventDb.query.eventParticipants.findFirst({
        where: eq(eventParticipants.id, Number(match.winner_id))
      });

      if (winnerParticipant) {
        const config = await EventConfigService.getEventConfig(match.event_key);
        const rules = typeof config.rules_json === 'string' ? JSON.parse(config.rules_json || '{}') : (config.rules_json || {});

        const championInfo = {
          id: winnerParticipant.id,
          name: winnerParticipant.display_name,
          userId: winnerParticipant.user_id,
          department: winnerParticipant.department || '',
          winnerSide: match.winner_side,
          resultReason: match.result_reason,
          verifiedAt: verifiedAt.toISOString()
        };

        await EventConfigService.updateEventConfig(match.event_key, {
          rules_json: {
            ...rules,
            tournament_status: 'COMPLETED',
            champion: championInfo,
            completed_at: verifiedAt.toISOString()
          },
          registration_open: false
        }, verifiedBy);

        await eventDb.insert(eventAuditLogs).values({
          event_key: match.event_key,
          action: 'TOURNAMENT_COMPLETED',
          actor_id: String(verifiedBy),
          actor_type: 'ADMIN',
          target_id: match.event_key,
          target_type: 'EVENT_CONFIG',
          details: {
            champion: championInfo,
            finalMatchId: match.id,
            matchCode: match.match_code
          }
        });
      }
    }

    return await this.getMatchById(matchId);
  }
}

export default MatchService;
