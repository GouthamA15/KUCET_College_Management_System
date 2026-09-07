import mysql from 'mysql2/promise';
import { getExperimentDbConfig, getExperimentDb } from './connection';
import logger from '@/lib/logger';

let isInitialized = false;

/**
 * Initializes the experiment_college_db and creates all event/chess tables idempotently.
 */
export async function initExperimentDb() {
  if (isInitialized) return true;

  const config = getExperimentDbConfig();

  try {
    // 1. Attempt to connect to the server (without database selected if needed) to ensure database exists
    const adminConfig = { ...config };
    delete adminConfig.database;

    try {
      const tempConn = await mysql.createConnection(adminConfig);
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await tempConn.end();
    } catch (dbErr) {
      // In cloud environments like TiDB Cloud or shared hosts where CREATE DATABASE is restricted,
      // the database already exists or is pre-allocated.
      logger.info({ err: dbErr.message }, '[EXPERIMENT_DB_INIT] Database creation check bypassed or pre-allocated');
    }

    const pool = getExperimentDb();

    // 2. Table: event_configs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`event_configs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_key\` VARCHAR(64) NOT NULL UNIQUE,
        \`event_name\` VARCHAR(128) NOT NULL,
        \`description\` TEXT NULL,
        \`is_enabled\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`registration_open\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`rules_json\` JSON NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Table: event_participants
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`event_participants\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_key\` VARCHAR(64) NOT NULL DEFAULT 'chess',
        \`user_id\` VARCHAR(64) NOT NULL,
        \`user_type\` VARCHAR(32) NOT NULL DEFAULT 'student',
        \`display_name\` VARCHAR(128) NOT NULL,
        \`email\` VARCHAR(128) NULL,
        \`department\` VARCHAR(64) NULL,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'REGISTERED',
        \`seed_number\` INT NULL,
        \`notes\` TEXT NULL,
        \`registered_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`reviewed_at\` DATETIME NULL,
        \`reviewed_by\` VARCHAR(128) NULL,
        UNIQUE KEY \`event_user_unique_idx\` (\`event_key\`, \`user_id\`),
        INDEX \`event_status_idx\` (\`event_key\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Table: event_matches
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`event_matches\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_key\` VARCHAR(64) NOT NULL DEFAULT 'chess',
        \`match_code\` VARCHAR(32) NOT NULL UNIQUE,
        \`round_name\` VARCHAR(64) NOT NULL DEFAULT 'Round 1',
        \`player_white_id\` INT NULL,
        \`player_white_name\` VARCHAR(128) NOT NULL,
        \`player_white_user_id\` VARCHAR(64) NOT NULL,
        \`player_black_id\` INT NULL,
        \`player_black_name\` VARCHAR(128) NOT NULL,
        \`player_black_user_id\` VARCHAR(64) NOT NULL,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        \`scheduled_at\` DATETIME NULL,
        \`started_at\` DATETIME NULL,
        \`ended_at\` DATETIME NULL,
        \`winner_id\` INT NULL,
        \`winner_side\` VARCHAR(16) NULL,
        \`result_reason\` VARCHAR(64) NULL,
        \`is_verified\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`verified_by\` VARCHAR(128) NULL,
        \`verified_at\` DATETIME NULL,
        \`verification_notes\` TEXT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`match_status_idx\` (\`event_key\`, \`status\`),
        INDEX \`white_player_idx\` (\`player_white_user_id\`),
        INDEX \`black_player_idx\` (\`player_black_user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Table: chess_games
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`chess_games\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`match_id\` INT NOT NULL UNIQUE,
        \`fen\` VARCHAR(255) NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        \`pgn\` TEXT NULL,
        \`current_turn\` VARCHAR(8) NOT NULL DEFAULT 'w',
        \`move_count\` INT NOT NULL DEFAULT 0,
        \`halfmove_clock\` INT NOT NULL DEFAULT 0,
        \`is_check\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`is_checkmate\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`is_stalemate\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`is_draw\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`draw_offer_side\` VARCHAR(8) NULL,
        \`captured_pieces\` JSON NULL,
        \`last_move_san\` VARCHAR(16) NULL,
        \`last_move_from\` VARCHAR(8) NULL,
        \`last_move_to\` VARCHAR(8) NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Table: chess_moves
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`chess_moves\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`game_id\` INT NOT NULL,
        \`match_id\` INT NOT NULL,
        \`move_number\` INT NOT NULL,
        \`side\` VARCHAR(4) NOT NULL,
        \`player_user_id\` VARCHAR(64) NOT NULL,
        \`san\` VARCHAR(16) NOT NULL,
        \`from_square\` VARCHAR(4) NOT NULL,
        \`to_square\` VARCHAR(4) NOT NULL,
        \`promotion\` VARCHAR(4) NULL,
        \`fen_after\` VARCHAR(255) NOT NULL,
        \`time_spent_ms\` INT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`chess_game_move_idx\` (\`game_id\`, \`move_number\`),
        INDEX \`chess_match_moves_idx\` (\`match_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Table: event_audit_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`event_audit_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_key\` VARCHAR(64) NOT NULL DEFAULT 'chess',
        \`action\` VARCHAR(64) NOT NULL,
        \`actor_id\` VARCHAR(64) NOT NULL,
        \`actor_type\` VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
        \`target_id\` VARCHAR(64) NULL,
        \`target_type\` VARCHAR(64) NULL,
        \`details\` JSON NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`event_audit_key_idx\` (\`event_key\`, \`action\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Seed default Chess Event Config if not present
    await pool.query(`
      INSERT INTO \`event_configs\` (\`event_key\`, \`event_name\`, \`description\`, \`is_enabled\`, \`registration_open\`, \`rules_json\`)
      VALUES (
        'chess',
        'KUCET Annual Chess Championship',
        'The official collegiate rapid chess championship of Kakatiya University College of Engineering and Technology. Open to all students and staff.',
        FALSE,
        FALSE,
        JSON_OBJECT(
          'time_control_minutes', 15,
          'increment_seconds', 10,
          'max_participants', 64,
          'allow_staff', TRUE,
          'allow_students', TRUE,
          'elimination_type', 'Single Elimination'
        )
      )
      ON DUPLICATE KEY UPDATE \`event_name\` = VALUES(\`event_name\`);
    `);

    isInitialized = true;
    logger.info('[EXPERIMENT_DB] Schema initialized successfully');
    return true;
  } catch (err) {
    logger.error(err, '[EXPERIMENT_DB_INIT_ERROR] Failed to initialize event tables');
    throw err;
  }
}
