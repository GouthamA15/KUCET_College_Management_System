#!/usr/bin/env node
/**
 * ============================================================
 * LEGACY MEDIA PROMOTION MIGRATION SCRIPT
 * ============================================================
 * Promotes all temporary/staged media assets (in requests/ or admission_drafts/)
 * belonging to active/finalized records into permanent institutional storage keys:
 *   - kucet/requests/pfp/abc.jpg       → kucet/students/pfp/abc.jpg
 *   - kucet/requests/signatures/abc.png → kucet/students/signatures/abc.png
 *   - kucet/admission_drafts/pfp/x.jpg  → kucet/students/pfp/x.jpg
 *   - kucet/admission_drafts/sig/y.png  → kucet/students/signatures/y.png
 *
 * IDEMPOTENT: Running twice produces the same result (skips already permanent keys).
 * SAFE: Uses StorageProvider.moveFile() so files are physically moved without duplication.
 * ============================================================
 */

import 'dotenv/config';
import { createConnection } from 'mysql2/promise';
import { getStorageProvider } from '../src/lib/providers/storage/factory.js';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

const TEMP_PFP_PATTERNS = [/requests\/pfp\//, /admission_drafts\/pfp\//];
const TEMP_SIG_PATTERNS = [/requests\/signatures\//, /admission_drafts\/signatures\//];

function isTemporaryPfp(val) {
  if (!val || typeof val !== 'string') return false;
  return TEMP_PFP_PATTERNS.some(p => p.test(val));
}

function isTemporarySig(val) {
  if (!val || typeof val !== 'string') return false;
  return TEMP_SIG_PATTERNS.some(p => p.test(val));
}

async function main() {
  console.info('='.repeat(60));
  console.info('KUCET Media Promotion Lifecycle Migration');
  console.info('='.repeat(60));
  console.info('Promoting temporary staging assets to permanent student paths...');
  console.info('IDEMPOTENT & RESUMABLE — Safe to execute multiple times.\n');

  let conn;
  try {
    conn = await createConnection(DB_CONFIG);
    const storage = getStorageProvider();
    console.info('✓ Connected to database\n');

    let totalChecked = 0;
    let totalPromoted = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // 1. Promote student_images (PFP)
    process.stdout.write('1. Checking student_images (PFP)... ');
    const [pfpRows] = await conn.execute('SELECT student_id, pfp FROM student_images WHERE pfp IS NOT NULL');
    let pfpPromoted = 0;

    for (const row of pfpRows) {
      totalChecked++;
      const currentKey = row.pfp;
      if (isTemporaryPfp(currentKey)) {
        const hasKucetPrefix = currentKey.startsWith('kucet/');
        const targetFolder = hasKucetPrefix ? 'kucet/students/pfp' : 'students/pfp';

        try {
          const moveResult = await storage.moveFile(currentKey, targetFolder);
          const newKey = moveResult.newPath || currentKey;

          await conn.execute('UPDATE student_images SET pfp = ? WHERE student_id = ?', [newKey, row.student_id]);
          pfpPromoted++;
          totalPromoted++;
          console.info(`\n  [PROMOTED PFP] student_id=${row.student_id}: "${currentKey}" → "${newKey}"`);
        } catch (err) {
          totalFailed++;
          console.error(`\n  [PROMOTION FAILED] student_id=${row.student_id}: ${err.message}`);
        }
      } else {
        totalSkipped++;
      }
    }
    console.info(`done (${pfpRows.length} checked, ${pfpPromoted} promoted)`);

    // 2. Promote student_signatures
    process.stdout.write('2. Checking student_signatures... ');
    const [sigRows] = await conn.execute('SELECT student_id, signature FROM student_signatures WHERE signature IS NOT NULL');
    let sigPromoted = 0;

    for (const row of sigRows) {
      totalChecked++;
      const currentKey = row.signature;
      if (isTemporarySig(currentKey)) {
        const hasKucetPrefix = currentKey.startsWith('kucet/');
        const targetFolder = hasKucetPrefix ? 'kucet/students/signatures' : 'students/signatures';

        try {
          const moveResult = await storage.moveFile(currentKey, targetFolder);
          const newKey = moveResult.newPath || currentKey;

          await conn.execute('UPDATE student_signatures SET signature = ? WHERE student_id = ?', [newKey, row.student_id]);
          sigPromoted++;
          totalPromoted++;
          console.info(`\n  [PROMOTED SIG] student_id=${row.student_id}: "${currentKey}" → "${newKey}"`);
        } catch (err) {
          totalFailed++;
          console.error(`\n  [PROMOTION FAILED] student_id=${row.student_id}: ${err.message}`);
        }
      } else {
        totalSkipped++;
      }
    }
    console.info(`done (${sigRows.length} checked, ${sigPromoted} promoted)`);

    // 3. Clean up finalized student_admission_drafts temporary references
    process.stdout.write('3. Cleaning finalized admission drafts... ');
    const [draftResult] = await conn.execute(
      `UPDATE student_admission_drafts SET pfp = NULL, signature = NULL WHERE status = 'FINALIZED' AND (pfp IS NOT NULL OR signature IS NOT NULL)`
    );
    console.info(`done (${draftResult.affectedRows} finalized drafts cleaned)`);

    console.info('\n' + '='.repeat(60));
    console.info('MEDIA PROMOTION MIGRATION COMPLETE');
    console.info(`Total Records Checked:  ${totalChecked}`);
    console.info(`Total Assets Promoted:  ${totalPromoted}`);
    console.info(`Total Already Permanent: ${totalSkipped}`);
    console.info(`Total Failures:         ${totalFailed}`);
    console.info('='.repeat(60));

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
