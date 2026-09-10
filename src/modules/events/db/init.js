import mysql from 'mysql2/promise';
import { getExperimentDbConfig, getExperimentDb } from './connection';
import logger from '../../../lib/logger';

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

    // 8. Table: quiz_questions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`quiz_questions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_key\` VARCHAR(64) NOT NULL DEFAULT 'quiz',
        \`question_text\` TEXT NOT NULL,
        \`options_json\` JSON NOT NULL,
        \`correct_option_index\` INT NOT NULL,
        \`explanation\` TEXT NULL,
        \`marks\` DECIMAL(5,2) NOT NULL DEFAULT 1.00,
        \`negative_marks\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        \`category\` VARCHAR(64) NOT NULL DEFAULT 'Computer Science',
        \`difficulty\` VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
        \`question_order\` INT NOT NULL DEFAULT 0,
        \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`quiz_questions_event_idx\` (\`event_key\`, \`is_active\`),
        INDEX \`quiz_questions_category_idx\` (\`category\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Table: quiz_sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`quiz_sessions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_key\` VARCHAR(64) NOT NULL DEFAULT 'quiz',
        \`session_code\` VARCHAR(64) NOT NULL UNIQUE,
        \`user_id\` VARCHAR(64) NOT NULL,
        \`user_type\` VARCHAR(32) NOT NULL DEFAULT 'student',
        \`display_name\` VARCHAR(128) NOT NULL,
        \`department\` VARCHAR(64) NULL,
        \`email\` VARCHAR(128) NULL,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
        \`total_questions\` INT NOT NULL DEFAULT 0,
        \`total_attempted\` INT NOT NULL DEFAULT 0,
        \`total_correct\` INT NOT NULL DEFAULT 0,
        \`total_incorrect\` INT NOT NULL DEFAULT 0,
        \`total_unanswered\` INT NOT NULL DEFAULT 0,
        \`score\` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
        \`max_possible_score\` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
        \`percentage\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        \`started_at\` DATETIME NOT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`submitted_at\` DATETIME NULL,
        \`time_taken_seconds\` INT NOT NULL DEFAULT 0,
        \`ip_address\` VARCHAR(64) NULL,
        \`user_agent\` TEXT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`quiz_session_user_idx\` (\`event_key\`, \`user_id\`),
        INDEX \`quiz_session_status_idx\` (\`event_key\`, \`status\`),
        INDEX \`quiz_leaderboard_idx\` (\`event_key\`, \`score\`, \`time_taken_seconds\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Table: quiz_answers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`quiz_answers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`session_id\` INT NOT NULL,
        \`question_id\` INT NOT NULL,
        \`selected_option_index\` INT NULL,
        \`is_marked_for_review\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`is_correct\` BOOLEAN NULL,
        \`marks_awarded\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        \`time_spent_seconds\` INT NOT NULL DEFAULT 0,
        \`answered_at\` DATETIME NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`quiz_session_question_idx\` (\`session_id\`, \`question_id\`),
        INDEX \`quiz_session_answers_idx\` (\`session_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Seed default Chess Event Config if not present
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

    // 12. Seed default Technical Quiz Event Config if not present
    await pool.query(`
      INSERT INTO \`event_configs\` (\`event_key\`, \`event_name\`, \`description\`, \`is_enabled\`, \`registration_open\`, \`rules_json\`)
      VALUES (
        'quiz',
        'KUCET Technical Symposium Quiz',
        'Test your core computer science, software engineering, algorithms, and system design expertise in this timed competitive quiz challenge.',
        FALSE,
        FALSE,
        JSON_OBJECT(
          'duration_minutes', 15,
          'total_questions', 15,
          'passing_percentage', 50,
          'marks_per_question', 2,
          'negative_marking', 0.5,
          'shuffle_questions', false,
          'allow_review', true,
          'show_instant_result', true,
          'max_attempts_per_user', 1,
          'category', 'Computer Science & Engineering'
        )
      )
      ON DUPLICATE KEY UPDATE \`event_name\` = VALUES(\`event_name\`);
    `);

    // 13. Seed default question bank if table is empty
    const [existingQuestions] = await pool.query('SELECT COUNT(*) as count FROM `quiz_questions` WHERE `event_key` = "quiz"');
    if (existingQuestions[0]?.count === 0) {
      const seedQuestions = [
        {
          text: 'What is the worst-case time complexity of QuickSort when using a naive pivot selection strategy?',
          options: ['O(N log N)', 'O(N)', 'O(N²)', 'O(log N)'],
          correct: 2,
          explanation: 'When the array is already sorted or reverse sorted and naive pivot (e.g. first or last element) is chosen, QuickSort degrades to O(N²).',
          marks: 2.0,
          negative: 0.5,
          category: 'Data Structures & Algorithms',
          difficulty: 'MEDIUM',
          order: 1
        },
        {
          text: 'Which of the following conditions is NOT one of Coffman\'s four necessary conditions for deadlock in an Operating System?',
          options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption Allowed', 'Circular Wait'],
          correct: 2,
          explanation: 'The Coffman condition is "No Preemption" (preemption is NOT allowed). If preemption is allowed, deadlock cannot occur.',
          marks: 2.0,
          negative: 0.5,
          category: 'Operating Systems',
          difficulty: 'MEDIUM',
          order: 2
        },
        {
          text: 'In the TCP 3-way handshake process for establishing a reliable connection, what are the sequential packet flags exchanged?',
          options: ['SYN → SYN-ACK → ACK', 'ACK → SYN → ACK', 'SYN → ACK → SYN-ACK', 'SYN → FIN → ACK'],
          correct: 0,
          explanation: 'Client sends SYN, server responds with SYN-ACK, and client acknowledges with ACK.',
          marks: 2.0,
          negative: 0.5,
          category: 'Computer Networks',
          difficulty: 'EASY',
          order: 3
        },
        {
          text: 'In relational databases, which ACID isolation level prevents Dirty Reads and Non-Repeatable Reads, but may still allow Phantom Reads?',
          options: ['Read Uncommitted', 'Read Committed', 'Repeatable Read', 'Serializable'],
          correct: 2,
          explanation: 'Repeatable Read prevents dirty reads and non-repeatable reads. In standard ANSI SQL, phantom reads are only eliminated in Serializable isolation.',
          marks: 2.0,
          negative: 0.5,
          category: 'Database Systems',
          difficulty: 'HARD',
          order: 4
        },
        {
          text: 'In HTTP/1.1 RESTful APIs, which of the following HTTP methods is defined as NON-idempotent by the RFC 7231 standard?',
          options: ['GET', 'PUT', 'DELETE', 'POST'],
          correct: 3,
          explanation: 'POST is non-idempotent because multiple identical POST requests generally result in multiple resources being created.',
          marks: 2.0,
          negative: 0.5,
          category: 'Web Technologies',
          difficulty: 'EASY',
          order: 5
        },
        {
          text: 'Which data structure is predominantly used for implementing efficient B-Tree/B+ Tree indexes in relational database storage engines like InnoDB?',
          options: ['Self-balancing multi-way search tree', 'Binary Max-Heap', 'Disjoint Set Union (DSU)', 'Trie (Prefix Tree)'],
          correct: 0,
          explanation: 'B+ Trees are self-balancing N-ary search trees optimized for disk page block reads and range scans.',
          marks: 2.0,
          negative: 0.5,
          category: 'Database Systems',
          difficulty: 'MEDIUM',
          order: 6
        },
        {
          text: 'What will be the output of `typeof NaN` in JavaScript?',
          options: ['"undefined"', '"nan"', '"number"', '"object"'],
          correct: 2,
          explanation: 'In JavaScript (ECMAScript), NaN represents Not-a-Number but its primitive numeric type is "number".',
          marks: 2.0,
          negative: 0.5,
          category: 'Web Technologies',
          difficulty: 'EASY',
          order: 7
        },
        {
          text: 'In distributed systems and CAP Theorem, which two guarantees are provided by a distributed database system during a network partition (P)?',
          options: ['Consistency and Availability cannot both be maintained simultaneously; system must choose either CP or AP', 'System automatically achieves CA by ignoring P', 'System guarantees 100% C, A, and P under all network topologies', 'System terminates all active transactions unconditionally'],
          correct: 0,
          explanation: 'When a network partition (P) occurs, a distributed system must trade off between Consistency (CP) and Availability (AP).',
          marks: 2.0,
          negative: 0.5,
          category: 'System Design',
          difficulty: 'MEDIUM',
          order: 8
        },
        {
          text: 'Which algorithm finds the single-source shortest paths in a directed graph with non-negative edge weights in O((V + E) log V) time with a min-heap?',
          options: ['Bellman-Ford Algorithm', 'Dijkstra\'s Algorithm', 'Floyd-Warshall Algorithm', 'Kruskal\'s Algorithm'],
          correct: 1,
          explanation: 'Dijkstra\'s algorithm using a priority queue (min-heap) achieves O((V + E) log V) time complexity for non-negative edge weights.',
          marks: 2.0,
          negative: 0.5,
          category: 'Data Structures & Algorithms',
          difficulty: 'MEDIUM',
          order: 9
        },
        {
          text: 'In modern Operating Systems, what is the primary purpose of the Translation Lookaside Buffer (TLB)?',
          options: ['To cache virtual-to-physical address translations for faster memory paging', 'To schedule CPU threads into high priority queues', 'To encrypt disk blocks during DMA transfers', 'To balance network socket packet queues'],
          correct: 0,
          explanation: 'The TLB is a high-speed hardware cache within the MMU storing recent virtual-to-physical address translations.',
          marks: 2.0,
          negative: 0.5,
          category: 'Operating Systems',
          difficulty: 'MEDIUM',
          order: 10
        }
      ];

      for (const q of seedQuestions) {
        await pool.query(`
          INSERT INTO \`quiz_questions\` 
          (\`event_key\`, \`question_text\`, \`options_json\`, \`correct_option_index\`, \`explanation\`, \`marks\`, \`negative_marks\`, \`category\`, \`difficulty\`, \`question_order\`, \`is_active\`)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
        `, [
          'quiz',
          q.text,
          JSON.stringify(q.options),
          q.correct,
          q.explanation,
          q.marks,
          q.negative,
          q.category,
          q.difficulty,
          q.order
        ]);
      }
    }

    isInitialized = true;
    logger.info('[EXPERIMENT_DB] Schema initialized successfully');
    return true;
  } catch (err) {
    logger.error(err, '[EXPERIMENT_DB_INIT_ERROR] Failed to initialize event tables');
    throw err;
  }
}
