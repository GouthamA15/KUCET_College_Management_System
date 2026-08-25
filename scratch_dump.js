const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2sLsWv1ueUCHrf3.root',
    password: 'KT0MHKWMiUsQst69',
    database: 'college_db',
    ssl: { minVersion: 'TLSv1.2' }
  });

  const tables = [
    'faculty_hod_assignments',
    'faculty_hod_requests',
    'staff_account_roles',
    'staff_registration_requests',
    'principal'
  ];

  for (const table of tables) {
    try {
      const [rows] = await connection.query(`SHOW CREATE TABLE ${table}`);
      console.log(`\n--- ${table} ---`);
      console.log(rows[0]['Create Table']);
    } catch (e) {
      console.log(`\n--- ${table} --- (ERROR)`);
      console.log(e.message);
    }
  }

  await connection.end();
}

main();
