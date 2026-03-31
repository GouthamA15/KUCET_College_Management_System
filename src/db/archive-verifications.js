const { db } = require('./index');
const { certificateVerifications, certificateVerificationsArchive } = require('./schema');
const { lt, sql } = require('drizzle-orm');

async function archiveVerifications() {
  console.log('--- STARTING VERIFICATION ARCHIVING ---');
  
  try {
    // 1. Calculate date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    console.log(`Archiving records older than: ${sixMonthsAgo.toISOString()}`);

    // 2. Fetch records to archive
    const recordsToArchive = await db.select()
      .from(certificateVerifications)
      .where(lt(certificateVerifications.verification_date, sixMonthsAgo));

    if (recordsToArchive.length === 0) {
      console.log('No records found to archive. Skipping.');
      return;
    }

    console.log(`Moving ${recordsToArchive.length} records to archive table...`);

    // 3. Batch insert into archive and delete from main (using a transaction)
    await db.transaction(async (tx) => {
      // Insert in chunks to avoid large payload issues
      const chunkSize = 100;
      for (let i = 0; i < recordsToArchive.length; i += chunkSize) {
        const chunk = recordsToArchive.slice(i, i + chunkSize);
        await tx.insert(certificateVerificationsArchive).values(chunk);
      }

      // Delete the archived records from the main table
      await tx.delete(certificateVerifications)
        .where(lt(certificateVerifications.verification_date, sixMonthsAgo));
    });

    console.log('✅ Archiving complete. Database performance preserved.');

  } catch (error) {
    console.error('❌ Archiving Failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  archiveVerifications();
}

module.exports = archiveVerifications;
