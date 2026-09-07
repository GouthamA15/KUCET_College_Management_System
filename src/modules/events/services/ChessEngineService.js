import { Chess } from 'chess.js';
import { eventDb, eventMatches, chessGames, chessMoves, initExperimentDb } from '../db';
import { eq, asc } from 'drizzle-orm';
import { MatchService } from './MatchService';
import { EventConfigService } from './EventConfigService';

/**
 * Helper to compute pieces captured by each player from current FEN.
 */
export function computeCapturedPieces(fen) {
  const initial = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
  };

  const [placement] = (fen || '').split(' ');
  const current = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
  };

  for (const char of placement) {
    if (char === '/' || (char >= '1' && char <= '8')) continue;
    const isWhite = char === char.toUpperCase();
    const piece = char.toLowerCase();
    const side = isWhite ? 'w' : 'b';
    if (current[side][piece] !== undefined) {
      current[side][piece]++;
    }
  }

  // Captured by White = Black pieces missing
  const capturedByWhite = [];
  for (const [p, count] of Object.entries(initial.b)) {
    const missing = count - current.b[p];
    for (let i = 0; i < missing; i++) capturedByWhite.push(p);
  }

  // Captured by Black = White pieces missing
  const capturedByBlack = [];
  for (const [p, count] of Object.entries(initial.w)) {
    const missing = count - current.w[p];
    for (let i = 0; i < missing; i++) capturedByBlack.push(p);
  }

  return {
    white: capturedByWhite, // pieces captured by White (black pieces)
    black: capturedByBlack  // pieces captured by Black (white pieces)
  };
}

export class ChessEngineService {
  /**
   * Retrieves current game state, board FEN, legal moves, and player turns.
   */
  static async getGameState(matchId) {
    await initExperimentDb();

    const match = await MatchService.getMatchById(matchId);
    if (!match) throw { status: 404, message: 'Match not found.' };

    let game = match.gameState;
    if (!game) {
      // Create game record if missing
      await eventDb.insert(chessGames).values({
        match_id: Number(matchId),
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        current_turn: 'w'
      });
      game = await eventDb.query.chessGames.findFirst({
        where: eq(chessGames.match_id, Number(matchId))
      });
    }

    const chess = new Chess(game.fen);
    const captured = computeCapturedPieces(game.fen);
    const legalMoves = chess.moves({ verbose: true });

    return {
      match,
      game: {
        ...game,
        captured_pieces: captured,
        is_check: chess.isCheck(),
        is_checkmate: chess.isCheckmate(),
        is_stalemate: chess.isStalemate(),
        is_draw: chess.isDraw()
      },
      legalMoves
    };
  }

  /**
   * Executes a legal move in a chess game.
   */
  static async makeMove(matchId, { userId, from, to, promotion = 'q' }) {
    await initExperimentDb();

    const config = await EventConfigService.getEventConfig('chess');
    if (!config.is_enabled) {
      throw { status: 403, message: 'Chess tournament event is currently disabled.' };
    }

    const match = await MatchService.getMatchById(matchId);
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      throw { status: 400, message: 'This match has already concluded.' };
    }

    if (match.status === 'SCHEDULED') {
      throw { status: 400, message: 'Match has not been published yet.' };
    }

    let game = match.gameState;
    if (!game) throw { status: 404, message: 'Chess game not found for this match.' };

    const chess = new Chess(game.fen);
    const activeTurn = chess.turn(); // 'w' or 'b'

    // Verify player identity
    const isWhitePlayer = String(match.player_white_user_id) === String(userId);
    const isBlackPlayer = String(match.player_black_user_id) === String(userId);

    if (!isWhitePlayer && !isBlackPlayer) {
      throw { status: 403, message: 'You are not a participant in this match.' };
    }

    if ((activeTurn === 'w' && !isWhitePlayer) || (activeTurn === 'b' && !isBlackPlayer)) {
      throw { status: 400, message: `It is ${activeTurn === 'w' ? 'White' : 'Black'}'s turn to move.` };
    }

    // Attempt the move in chess engine
    let moveResult;
    try {
      moveResult = chess.move({
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        promotion: promotion ? promotion.toLowerCase() : undefined
      });
    } catch (err) {
      throw { status: 400, message: `Illegal move: ${err.message || 'Move violates chess rules'}` };
    }

    if (!moveResult) {
      throw { status: 400, message: `Illegal move from ${from} to ${to}.` };
    }

    const newFen = chess.fen();
    const newPgn = chess.pgn();
    const captured = computeCapturedPieces(newFen);
    const isCheck = chess.isCheck();
    const isCheckmate = chess.isCheckmate();
    const isStalemate = chess.isStalemate();
    const isDraw = chess.isDraw();
    const newMoveCount = (game.move_count || 0) + 1;

    const now = new Date();

    // 1. Record move in chess_moves
    await eventDb.insert(chessMoves).values({
      game_id: game.id,
      match_id: match.id,
      move_number: newMoveCount,
      side: activeTurn,
      player_user_id: String(userId),
      san: moveResult.san,
      from_square: moveResult.from,
      to_square: moveResult.to,
      promotion: moveResult.promotion || null,
      fen_after: newFen,
      created_at: now
    });

    // 2. Update chess_games
    await eventDb.update(chessGames)
      .set({
        fen: newFen,
        pgn: newPgn,
        current_turn: chess.turn(),
        move_count: newMoveCount,
        is_check: isCheck,
        is_checkmate: isCheckmate,
        is_stalemate: isStalemate,
        is_draw: isDraw,
        draw_offer_side: null, // clear any pending draw offer upon move
        captured_pieces: captured,
        last_move_san: moveResult.san,
        last_move_from: moveResult.from,
        last_move_to: moveResult.to,
        updated_at: now
      })
      .where(eq(chessGames.id, game.id));

    // 3. If first move, update match status to IN_PROGRESS
    if (match.status === 'PUBLISHED') {
      await eventDb.update(eventMatches)
        .set({ status: 'IN_PROGRESS', started_at: now, updated_at: now })
        .where(eq(eventMatches.id, match.id));
    }

    // 4. Handle Terminal Game Conditions
    if (isCheckmate) {
      const winnerSide = activeTurn === 'w' ? 'white' : 'black';
      const winnerId = activeTurn === 'w' ? match.player_white_id : match.player_black_id;

      await MatchService.recordMatchResult(match.id, {
        winnerId,
        winnerSide,
        resultReason: 'checkmate',
        pgn: newPgn
      });
    } else if (isStalemate) {
      await MatchService.recordMatchResult(match.id, {
        winnerId: null,
        winnerSide: 'draw',
        resultReason: 'stalemate',
        pgn: newPgn
      });
    } else if (isDraw) {
      let drawReason = 'draw';
      if (chess.isThreefoldRepetition()) drawReason = 'threefold_repetition';
      else if (chess.isInsufficientMaterial()) drawReason = 'insufficient_material';

      await MatchService.recordMatchResult(match.id, {
        winnerId: null,
        winnerSide: 'draw',
        resultReason: drawReason,
        pgn: newPgn
      });
    }

    return await this.getGameState(matchId);
  }

  /**
   * Resignation: Player concedes the game.
   */
  static async resign(matchId, userId) {
    await initExperimentDb();

    const match = await MatchService.getMatchById(matchId);
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      throw { status: 400, message: 'Match has already completed.' };
    }

    const isWhite = String(match.player_white_user_id) === String(userId);
    const isBlack = String(match.player_black_user_id) === String(userId);

    if (!isWhite && !isBlack) {
      throw { status: 403, message: 'Only participants in this match can resign.' };
    }

    const winnerSide = isWhite ? 'black' : 'white';
    const winnerId = isWhite ? match.player_black_id : match.player_white_id;

    await MatchService.recordMatchResult(match.id, {
      winnerId,
      winnerSide,
      resultReason: 'resignation'
    });

    return await this.getGameState(matchId);
  }

  /**
   * Draw Offer: Player offers a mutual draw.
   */
  static async offerDraw(matchId, userId) {
    await initExperimentDb();

    const match = await MatchService.getMatchById(matchId);
    if (!match) throw { status: 404, message: 'Match not found.' };

    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      throw { status: 400, message: 'Match has already completed.' };
    }

    const isWhite = String(match.player_white_user_id) === String(userId);
    const isBlack = String(match.player_black_user_id) === String(userId);

    if (!isWhite && !isBlack) {
      throw { status: 403, message: 'Only participants in this match can offer a draw.' };
    }

    const side = isWhite ? 'w' : 'b';

    await eventDb.update(chessGames)
      .set({ draw_offer_side: side, updated_at: new Date() })
      .where(eq(chessGames.match_id, match.id));

    return await this.getGameState(matchId);
  }

  /**
   * Respond to Draw Offer: Accept or decline.
   */
  static async respondToDraw(matchId, userId, accept = true) {
    await initExperimentDb();

    const match = await MatchService.getMatchById(matchId);
    if (!match) throw { status: 404, message: 'Match not found.' };

    const game = match.gameState;
    if (!game || !game.draw_offer_side) {
      throw { status: 400, message: 'No active draw offer on the table.' };
    }

    const isWhite = String(match.player_white_user_id) === String(userId);
    const isBlack = String(match.player_black_user_id) === String(userId);

    if (!isWhite && !isBlack) {
      throw { status: 403, message: 'Only participants can respond to draw offers.' };
    }

    const responderSide = isWhite ? 'w' : 'b';
    if (responderSide === game.draw_offer_side) {
      throw { status: 400, message: 'You cannot accept your own draw offer.' };
    }

    if (accept) {
      await eventDb.update(chessGames)
        .set({ is_draw: true, draw_offer_side: null, updated_at: new Date() })
        .where(eq(chessGames.match_id, match.id));

      await MatchService.recordMatchResult(match.id, {
        winnerId: null,
        winnerSide: 'draw',
        resultReason: 'draw_agreement'
      });
    } else {
      await eventDb.update(chessGames)
        .set({ draw_offer_side: null, updated_at: new Date() })
        .where(eq(chessGames.match_id, match.id));
    }

    return await this.getGameState(matchId);
  }

  /**
   * Retrieves chronological move history.
   */
  static async getMovesHistory(matchId) {
    await initExperimentDb();

    return await eventDb.query.chessMoves.findMany({
      where: eq(chessMoves.match_id, Number(matchId)),
      orderBy: [asc(chessMoves.move_number)]
    });
  }
}

export default ChessEngineService;
