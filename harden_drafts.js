const { query } = require('./src/lib/db');

async function harden() {
  try {
    console.log('Adding unique constraints to student_admission_drafts...');
    
    // Add unique indexes. We use separate commands to avoid failure if one field has duplicates already
    try { await query('ALTER TABLE student_admission_drafts ADD UNIQUE INDEX idx_unique_email (email)'); } catch(e) { console.warn('Email uniqueness index skip (might already exist or have duplicates)'); }
    try { await query('ALTER TABLE student_admission_drafts ADD UNIQUE INDEX idx_unique_mobile (student_mobile)'); } catch(e) { console.warn('Mobile uniqueness index skip'); }
    try { await query('ALTER TABLE student_admission_drafts ADD UNIQUE INDEX idx_unique_aadhaar (aadhaar_no)'); } catch(e) { console.warn('Aadhaar uniqueness index skip'); }
    
    console.log('Database hardening complete.');
  } catch (e) {
    console.error('Hardening failed:', e);
  } finally {
    process.exit();
  }
}

harden();
