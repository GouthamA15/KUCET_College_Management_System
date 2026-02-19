const { query } = require('./src/lib/db');

async function update() {
  try {
    const sql = `ALTER TABLE student_admission_drafts MODIFY COLUMN status ENUM('DRAFT', 'PROCESSED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT'`;
    await query(sql);
    console.log('Enum updated successfully to include FINALIZED status.');
  } catch (e) {
    console.error('Failed to update enum:', e);
  } finally {
    process.exit();
  }
}

update();
