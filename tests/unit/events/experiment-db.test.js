import { describe, it, expect } from 'vitest';
import { getExperimentDbConfig } from '@/modules/events/db/connection';
import { computeCapturedPieces } from '@/modules/events/services/ChessEngineService';

describe('Experiment Database Configuration & Invariants', () => {
  it('should configure experiment_college_db as the target database by default', () => {
    const config = getExperimentDbConfig();
    expect(config.database).toBe('experiment_college_db');
  });

  it('should preserve standard MySQL connection options', () => {
    const config = getExperimentDbConfig();
    expect(config.dateStrings).toBe(true);
    expect(config.connectionLimit).toBe(3);
    expect(config.enableKeepAlive).toBe(true);
  });

  it('should accurately compute captured pieces from initial vs updated FEN', () => {
    // Initial standard position - 0 captured
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const initialCaptured = computeCapturedPieces(initialFen);
    expect(initialCaptured.white).toEqual([]);
    expect(initialCaptured.black).toEqual([]);

    // Position after White captures Black pawn on d5 (Black missing 1 pawn)
    const afterPawnCapture = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
    const captured = computeCapturedPieces(afterPawnCapture);
    expect(captured.white).toEqual(['p']); // White captured black pawn
    expect(captured.black).toEqual([]);
  });
});
