const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com'))) ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    } : undefined,
  });

  try {
    const [rows] = await connection.query('SELECT DISTINCT academic_year FROM branch_timetable LIMIT 10;');
    console.log('branch_timetable academic_years:');
    console.log(rows);
    
    const [rows2] = await connection.query('SELECT DISTINCT academic_year FROM faculty_subject_assignments LIMIT 10;');
    console.log('faculty_subject_assignments academic_years:');
    console.log(rows2);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

checkData();
