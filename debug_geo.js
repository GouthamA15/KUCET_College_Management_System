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
    const [rows] = await pool.query("SELECT id, latitude, longitude, created_at FROM attendance_sessions ORDER BY created_at DESC LIMIT 1");
    if (rows.length > 0) {
      console.log('Most recent session coordinates:');
      console.log('ID:', rows[0].id);
      console.log('Lat:', rows[0].latitude);
      console.log('Lon:', rows[0].longitude);
      console.log('Created At:', rows[0].created_at);
    } else {
      console.log('No sessions found.');
    }
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}

check();
