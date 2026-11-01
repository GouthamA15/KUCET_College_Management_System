/**
 * Authoritative Attendance Reconciliation & Archival Script for October 28, 2026 Records
 *
 * Target: Resolves duplicate attendance rows on assignment 450014 (Session 1)
 * Preserves all original data in archive_duplicate_student_attendance before deduplication.
 * Backfills session_id foreign keys and updates precomputed summary counters.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function runReconciliation() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_DATABASE || 'college_db';
  const port = Number(process.env.DB_PORT) || 4000;
  const isTiDB = host.includes('tidbcloud.com');

  const sanitizedHost = (host === '127.0.0.1' || host === 'localhost')
    ? host
    : host.replace(/(.{4}).*(.{4}\.[^.]+$)/, '$1***$2');

  console.log('============================================================');
  console.log('  KUCET CMS — Attendance Archival & Reconciliation');
  console.log('============================================================');
  console.log(`  Database Target : ${database} on ${sanitizedHost}:${port}`);
  console.log(`  Engine Type     : ${isTiDB ? 'TiDB Cloud (Serverless)' : 'MySQL'}`);
  console.log('============================================================\n');

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    ssl: (process.env.DB_SSL === 'true' || isTiDB) ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    } : undefined
  });

  try {
    // -------------------------------------------------------------
    // STEP 1: Preflight Assertions
    // -------------------------------------------------------------
    console.log('🔍 Step 1: Running Preflight Assertions...');
    const [totalRows] = await conn.query('SELECT COUNT(*) as count FROM student_attendance');
    const rowCount = Number(totalRows[0]?.count || 0);
    console.log(`   Current total student_attendance records: ${rowCount}`);

    if (rowCount !== 204 && rowCount !== 136) {
      throw new Error(`Preflight check failed: Expected 204 records (or 136 if already reconciled), found ${rowCount}`);
    }

    if (rowCount === 136) {
      console.log('ℹ️ Table student_attendance already contains 136 records. Checking session_id status...');
      const [colCheck] = await conn.query(
        'SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_attendance" AND column_name = "session_id"'
      );
      if (Number(colCheck[0]?.cnt || 0) > 0) {
        const [unmapped] = await conn.query('SELECT COUNT(*) as cnt FROM student_attendance WHERE session_id IS NULL');
        console.log(`   Unmapped records: ${unmapped[0]?.cnt}`);
        if (Number(unmapped[0]?.cnt || 0) === 0) {
          console.log('✅ Attendance data is already reconciled and backfilled cleanly.');
          return;
        }
      }
    }

    // Verify Sessions Exist
    const [sessRows] = await conn.query(
      "SELECT id, assignment_id, attendance_date, session_number, submitted_at FROM attendance_sessions WHERE attendance_date = '2026-10-28' AND assignment_id = 450014 ORDER BY session_number"
    );
    console.log(`   Found ${sessRows.length} attendance sessions for 2026-10-28.`);
    if (sessRows.length !== 2) {
      throw new Error(`Preflight check failed: Expected 2 sessions on 2026-10-28 for assignment 450014, found ${sessRows.length}`);
    }

    const s1 = sessRows.find(s => s.session_number === 1);
    const s2 = sessRows.find(s => s.session_number === 2);
    if (!s1 || !s2) {
      throw new Error('Preflight check failed: Missing session 1 or session 2 records in attendance_sessions');
    }
    console.log(`   Session 1 ID: ${s1.id} (Submitted: ${s1.submitted_at})`);
    console.log(`   Session 2 ID: ${s2.id} (Submitted: ${s2.submitted_at})`);

    // -------------------------------------------------------------
    // STEP 2: Row-by-Row Duplicate Verification
    // -------------------------------------------------------------
    console.log('\n🔍 Step 2: Comparing Duplicate Pairs Row by Row...');
    const [s1AllRows] = await conn.query(
      "SELECT id, student_id, assignment_id, date, session, status, submitted_at FROM student_attendance WHERE date = '2026-10-28' AND assignment_id = 450014 AND session = 1 ORDER BY student_id, id"
    );

    const s1ByStudent = new Map();
    for (const r of s1AllRows) {
      if (!s1ByStudent.has(r.student_id)) s1ByStudent.set(r.student_id, []);
      s1ByStudent.get(r.student_id).push(r);
    }

    if (s1ByStudent.size !== 68) {
      throw new Error(`Unexpected unique student count in session 1: Expected 68, found ${s1ByStudent.size}`);
    }

    const duplicatesToArchive = [];
    let mismatchCount = 0;

    for (const [studentId, pair] of s1ByStudent.entries()) {
      if (pair.length !== 2) {
        throw new Error(`Student ${studentId} does not have exactly 2 records in session 1 (found ${pair.length})`);
      }
      const [earlier, later] = pair[0].id < pair[1].id ? [pair[0], pair[1]] : [pair[1], pair[0]];

      if (earlier.status !== later.status) {
        console.error(`⚠️ Status mismatch for student ${studentId}: earlier=${earlier.status}, later=${later.status}`);
        mismatchCount++;
      }

      duplicatesToArchive.push({
        earlierId: earlier.id,
        laterId: later.id,
        student_id: studentId,
        assignment_id: earlier.assignment_id,
        date: earlier.date,
        session: earlier.session,
        status: earlier.status,
        submitted_at: earlier.submitted_at
      });
    }

    console.log(`   Total duplicate pairs evaluated: ${duplicatesToArchive.length}`);
    console.log(`   Pairs with matching statuses : ${duplicatesToArchive.length - mismatchCount} / ${duplicatesToArchive.length}`);
    console.log(`   Status conflicts             : ${mismatchCount}`);

    if (mismatchCount > 0) {
      throw new Error(`Reconciliation aborted: Found ${mismatchCount} status mismatches between duplicate pairs.`);
    }

    // -------------------------------------------------------------
    // STEP 3: Create Verifiable Archive Table
    // -------------------------------------------------------------
    console.log('\n📦 Step 3: Ensuring Archive Table Exists...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`archive_duplicate_student_attendance\` (
        \`archive_id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
        \`original_attendance_id\` int NOT NULL,
        \`superseding_attendance_id\` int NOT NULL,
        \`student_id\` int NOT NULL,
        \`assignment_id\` int NOT NULL,
        \`date\` date NOT NULL,
        \`session\` int NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`submitted_at\` timestamp NULL,
        \`archived_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`reason\` varchar(255) NOT NULL,
        KEY \`idx_archived_orig_id\` (\`original_attendance_id\`),
        KEY \`idx_archived_student\` (\`student_id\`, \`date\`)
      )
    `);
    console.log('   Archive table `archive_duplicate_student_attendance` is ready.');

    // -------------------------------------------------------------
    // STEP 4: Archive the 68 Superseded Duplicate Records
    // -------------------------------------------------------------
    console.log('\n📦 Step 4: Archiving 68 Superseded Duplicate Records (Batch A: IDs 1-68)...');
    let archivedCount = 0;
    for (const item of duplicatesToArchive) {
      await conn.query(`
        INSERT INTO \`archive_duplicate_student_attendance\`
          (original_attendance_id, superseding_attendance_id, student_id, assignment_id, date, session, status, submitted_at, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.earlierId,
        item.laterId,
        item.student_id,
        item.assignment_id,
        item.date,
        item.session,
        item.status,
        item.submitted_at,
        'Superseded duplicate session 1 record'
      ]);
      archivedCount++;
    }
    console.log(`   ✅ Successfully archived ${archivedCount} duplicate records.`);

    // -------------------------------------------------------------
    // STEP 5: Remove the 68 Superseded Records from student_attendance
    // -------------------------------------------------------------
    console.log('\n🗑️  Step 5: Removing the 68 Archived Duplicate Records from student_attendance...');
    const deleteIds = duplicatesToArchive.map(d => d.earlierId);
    const [delResult] = await conn.query(
      `DELETE FROM student_attendance WHERE id IN (${deleteIds.join(',')})`
    );
    console.log(`   Deleted rows: ${delResult.affectedRows}`);

    const [remainingCount] = await conn.query('SELECT COUNT(*) as count FROM student_attendance');
    const remaining = Number(remainingCount[0]?.count || 0);
    console.log(`   Remaining active student_attendance records: ${remaining}`);

    if (remaining !== 136) {
      throw new Error(`Deduplication assertion failed: Expected 136 remaining records, got ${remaining}`);
    }
    console.log('   ✅ Table student_attendance now contains exactly 136 deduplicated records.');

    // -------------------------------------------------------------
    // STEP 6: Ensure session_id Column & Backfill Foreign Keys
    // -------------------------------------------------------------
    console.log('\n🔗 Step 6: Ensuring session_id Column and Backfilling Relationships...');
    const [saCol] = await conn.query(
      'SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "student_attendance" AND column_name = "session_id"'
    );
    if (Number(saCol[0]?.cnt || 0) === 0) {
      console.log('   Adding session_id column to student_attendance...');
      await conn.query('ALTER TABLE `student_attendance` ADD COLUMN `session_id` int NULL');
    }

    // Backfill session_id mapping
    console.log('   Backfilling session_id based on (assignment_id, date, session_number)...');
    const [bf1] = await conn.query(`
      UPDATE student_attendance
      SET session_id = ${s1.id}
      WHERE assignment_id = ${s1.assignment_id} AND date = '2026-10-28' AND session = 1
    `);
    console.log(`   Mapped ${bf1.affectedRows} records to Session 1 (ID: ${s1.id})`);

    const [bf2] = await conn.query(`
      UPDATE student_attendance
      SET session_id = ${s2.id}
      WHERE assignment_id = ${s2.assignment_id} AND date = '2026-10-28' AND session = 2
    `);
    console.log(`   Mapped ${bf2.affectedRows} records to Session 2 (ID: ${s2.id})`);

    const [unmappedRows] = await conn.query(
      'SELECT COUNT(*) as cnt FROM student_attendance WHERE session_id IS NULL'
    );
    const unmappedCount = Number(unmappedRows[0]?.cnt || 0);
    console.log(`   Unmapped attendance records remaining: ${unmappedCount}`);
    if (unmappedCount !== 0) {
      throw new Error(`Backfill assertion failed: ${unmappedCount} records have NULL session_id`);
    }
    console.log('   ✅ All 136 attendance records are unambiguously mapped to their sessions.');

    // -------------------------------------------------------------
    // STEP 7: Compute & Update Summary Counters
    // -------------------------------------------------------------
    console.log('\n📊 Step 7: Computing & Updating Precomputed Summary Counters...');
    await conn.query(`
      UPDATE attendance_sessions s
      JOIN (
        SELECT
          session_id,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as pres,
          SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as abs
        FROM student_attendance
        WHERE session_id IS NOT NULL
        GROUP BY session_id
      ) counts ON s.id = counts.session_id
      SET
        s.total_students = counts.total,
        s.present_count = counts.pres,
        s.absent_count = counts.abs
    `);

    const [updatedSessions] = await conn.query(`
      SELECT id, session_number, total_students, present_count, absent_count
      FROM attendance_sessions
      WHERE id IN (${s1.id}, ${s2.id})
      ORDER BY session_number
    `);

    console.log('   Updated Session Counters:');
    console.table(updatedSessions);

    console.log('\n============================================================');
    console.log('🎉 Attendance reconciliation completed successfully!');
    console.log('   - 68 duplicate records archived and removed.');
    console.log('   - 136 records verified and backfilled with session_id.');
    console.log('   - Summary counters synchronized.');
    console.log('   - Database is now ready for Migration 0030 constraints.');
    console.log('============================================================');

  } finally {
    await conn.end();
  }
}

runReconciliation().catch(err => {
  console.error('\n❌ Reconciliation failed:', err);
  process.exit(1);
});
