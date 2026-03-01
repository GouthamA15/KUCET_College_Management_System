const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function applySql() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
  });

  console.log('🔄 Applying SQL Schema Changes...');

  const queries = [
    "ALTER TABLE `student_admission_drafts` MODIFY COLUMN `pfp` TEXT DEFAULT NULL",
    "ALTER TABLE `student_admission_drafts` MODIFY COLUMN `signature` TEXT DEFAULT NULL",
    "ALTER TABLE `student_images` MODIFY COLUMN `pfp` TEXT DEFAULT NULL",
    "ALTER TABLE `student_signatures` MODIFY COLUMN `signature` TEXT DEFAULT NULL",
    "ALTER TABLE `student_profile_requests` MODIFY COLUMN `new_pfp` TEXT DEFAULT NULL",
    "ALTER TABLE `student_profile_requests` MODIFY COLUMN `new_signature` TEXT DEFAULT NULL",
    "ALTER TABLE `student_requests` MODIFY COLUMN `payment_screenshot` TEXT DEFAULT NULL",
    "ALTER TABLE `student_request_images` MODIFY COLUMN `payment_screenshot` TEXT DEFAULT NULL"
  ];

  try {
    for (const sql of queries) {
      console.log(`Executing: ${sql.substring(0, 50)}...`);
      await pool.query(sql);
    }
    console.log('✅ Schema updated successfully!');
  } catch (err) {
    console.error('❌ SQL Error:', err.message);
  } finally {
    await pool.end();
  }
}

applySql();
