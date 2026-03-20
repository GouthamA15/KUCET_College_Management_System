import { db } from './index.js';
import { students, studentPersonalDetails, studentAdmissionDrafts } from './schema.js';
import { encrypt, hashForIndex } from '../lib/encryption.js';
import { eq, isNull, or, isNotNull } from 'drizzle-orm';
import logger from '../lib/logger.js';

async function migrate() {
  console.log('🚀 Starting Data Encryption Migration...');

  try {
    // 1. Migrate Students Table (Mobile)
    const studentsToFix = await db.select().from(students).where(isNull(students.mobile_hash));
    console.log(`Found ${studentsToFix.length} students to encrypt.`);
    
    for (const student of studentsToFix) {
      if (student.mobile && !student.mobile.includes(':')) {
        await db.update(students)
          .set({
            mobile: encrypt(student.mobile),
            mobile_hash: hashForIndex(student.mobile)
          })
          .where(eq(students.id, student.id));
      }
    }

    // 2. Migrate Personal Details (Aadhaar & Guardian Mobile)
    const detailsToFix = await db.select().from(studentPersonalDetails).where(isNull(studentPersonalDetails.aadhaar_hash));
    console.log(`Found ${detailsToFix.length} personal records to encrypt.`);

    for (const detail of detailsToFix) {
      const updates = {};
      if (detail.aadhaar_no && !detail.aadhaar_no.includes(':')) {
        updates.aadhaar_no = encrypt(detail.aadhaar_no);
        updates.aadhaar_hash = hashForIndex(detail.aadhaar_no);
      }
      if (detail.guardian_mobile && !detail.guardian_mobile.includes(':')) {
        updates.guardian_mobile = encrypt(detail.guardian_mobile);
      }

      if (Object.keys(updates).length > 0) {
        await db.update(studentPersonalDetails)
          .set(updates)
          .where(eq(studentPersonalDetails.id, detail.id));
      }
    }

    // 3. Migrate Admission Drafts
    const draftsToFix = await db.select().from(studentAdmissionDrafts).where(isNull(studentAdmissionDrafts.mobile_hash));
    console.log(`Found ${draftsToFix.length} drafts to encrypt.`);

    for (const draft of draftsToFix) {
      const updates = {};
      if (draft.student_mobile && !draft.student_mobile.includes(':')) {
        updates.student_mobile = encrypt(draft.student_mobile);
        updates.mobile_hash = hashForIndex(draft.student_mobile);
      }
      if (draft.guardian_mobile && !draft.guardian_mobile.includes(':')) {
        updates.guardian_mobile = encrypt(draft.guardian_mobile);
      }
      if (draft.aadhaar_no && !draft.aadhaar_no.includes(':')) {
        updates.aadhaar_no = encrypt(draft.aadhaar_no);
        updates.aadhaar_hash = hashForIndex(draft.aadhaar_no);
      }

      if (Object.keys(updates).length > 0) {
        await db.update(studentAdmissionDrafts)
          .set(updates)
          .where(eq(studentAdmissionDrafts.id, draft.id));
      }
    }

    console.log('✅ Migration Complete! All sensitive data is now encrypted and hashed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  }
}

migrate();
