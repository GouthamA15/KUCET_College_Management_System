const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkIndexes() {
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
    const [rows1] = await connection.query('SHOW INDEX FROM branch_timetable;');
    console.log('branch_timetable indexes:');
    console.table(rows1.map(r => ({ Key_name: r.Key_name, Column_name: r.Column_name })));

    const [rows2] = await connection.query('SHOW INDEX FROM attendance_sessions;');
    console.log('attendance_sessions indexes:');
    console.table(rows2.map(r => ({ Key_name: r.Key_name, Column_name: r.Column_name })));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

checkIndexes();
