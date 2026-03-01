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
    const [pfpRows] = await pool.query("SELECT student_id, pfp FROM student_images LIMIT 5");
    console.log('Results for student_images:');
    pfpRows.forEach(row => {
      console.log(`ID: ${row.student_id} | PFP: ${typeof row.pfp === 'string' ? row.pfp.substring(0, 50) + '...' : 'Binary/Null'}`);
    });

    const [sigRows] = await pool.query("SELECT student_id, signature FROM student_signatures LIMIT 5");
    console.log('\nResults for student_signatures:');
    sigRows.forEach(row => {
      console.log(`ID: ${row.student_id} | Sig: ${typeof row.signature === 'string' ? row.signature.substring(0, 50) + '...' : 'Binary/Null'}`);
    });
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}

check();
