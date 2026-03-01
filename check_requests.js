const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
  });

  try {
    const [rows] = await pool.query("SELECT id, new_pfp, new_signature FROM student_profile_requests");
    console.log('Results for student_profile_requests:');
    rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`  PFP: ${typeof row.new_pfp === 'string' ? row.new_pfp.substring(0, 50) + '...' : 'Binary/Null'}`);
      console.log(`  Signature: ${typeof row.new_signature === 'string' ? row.new_signature.substring(0, 50) + '...' : 'Binary/Null'}`);
    });
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}

check();
