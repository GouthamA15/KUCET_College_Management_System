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

  try {
    // Drop existing bad FKs that point to staff_accounts
    await connection.query('ALTER TABLE faculty_hod_assignments DROP FOREIGN KEY fk_hod_assigned_by');
    console.log('Dropped fk_hod_assigned_by');
    
    await connection.query('ALTER TABLE faculty_hod_requests DROP FOREIGN KEY fk_fhr_reviewer');
    console.log('Dropped fk_fhr_reviewer');

    // For staff_account_roles, there is no FK currently, but we should add one to principal if we want strict referential integrity.
    // Wait, let me check if `staff_account_roles` had an FK in the previous script.
    // In the dump, there was NO fk for assigned_by on staff_account_roles.

    // Let's add the correct FKs pointing to principal table
    await connection.query('ALTER TABLE faculty_hod_assignments ADD CONSTRAINT fk_hod_assigned_principal FOREIGN KEY (assigned_by) REFERENCES principal(id) ON DELETE SET NULL ON UPDATE CASCADE');
    console.log('Added fk_hod_assigned_principal');

    await connection.query('ALTER TABLE faculty_hod_requests ADD CONSTRAINT fk_fhr_reviewer_principal FOREIGN KEY (reviewed_by) REFERENCES principal(id) ON DELETE SET NULL ON UPDATE CASCADE');
    console.log('Added fk_fhr_reviewer_principal');
    
    await connection.query('ALTER TABLE staff_account_roles ADD CONSTRAINT fk_staff_roles_assigned_principal FOREIGN KEY (assigned_by) REFERENCES principal(id) ON DELETE SET NULL ON UPDATE CASCADE');
    console.log('Added fk_staff_roles_assigned_principal');

  } catch (e) {
    console.log('ERROR:', e.message);
  }

  await connection.end();
}

main();
