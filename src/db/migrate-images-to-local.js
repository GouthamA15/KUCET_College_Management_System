 
/**
 * IMAGE MIGRATION SCRIPT (DB -> LOCAL STORAGE)
 * 
 * This script identifies all images stored as base64 or BLOB in the database
 * and migrates them to the local filesystem storage volume.
 * 
 * Usage: 
 * 1. Ensure LOCAL_STORAGE_PATH is set in .env (defaults to /app/public/uploads)
 * 2. Run: tsx src/db/migrate-images-to-local.js
 */

/* eslint-disable no-console */
import { db } from './index.js';
import { studentImages, studentSignatures, students, studentAdmissionDrafts } from './schema.js';
import { eq, isNotNull, and } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/app/public/uploads';

async function migrateBase64ToLocal(data, folder, filename) {
  if (!data) return null;

  let buffer;
  let extension = '.jpg';

  // Case 1: Buffer (BLOB)
  if (Buffer.isBuffer(data)) {
    buffer = data;
    // Simple magic byte detection
    if (buffer[0] === 0x89 && buffer[1] === 0x50) extension = '.png';
    else if (buffer[0] === 0xFF && buffer[1] === 0xD8) extension = '.jpg';
  } 
  // Case 2: String Handling (Data URI or Base64)
  else if (typeof data === 'string') {
    if (data.startsWith('data:')) {
        const parts = data.split(';base64,');
        if (parts.length < 2) return null;
        const mime = parts[0].split(':')[1] || '';
        const subtype = mime.split('/')[1] || 'jpg';
        extension = `.${subtype}`;
        buffer = Buffer.from(parts[1], 'base64');
    } else if (data.length > 100 && (data.startsWith('iVBORw') || data.startsWith('/9j/4'))) {
        extension = data.startsWith('iVBORw') ? '.png' : '.jpg';
        buffer = Buffer.from(data, 'base64');
    } else if (data.includes('/') && data.length < 500) {
        return null; // Already migrated
    } else {
        return null;
    }
  }
  else {
    return null; // Not an image we recognize
  }

  const relativePath = path.join('kucet', folder, `${filename}${extension}`).replace(/\\/g, '/');
  const absolutePath = path.join(STORAGE_PATH, relativePath);
  const directory = path.dirname(absolutePath);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return relativePath;
}

async function run() {
  console.log('🚀 Starting Image Migration...');
  console.log(`📂 Target Storage: ${STORAGE_PATH}`);

  // 1. Migrate Student PFP
  console.log('\n--- Migrating Student Photos ---');
  const studentPhotos = await db.select({ 
    id: students.id, 
    roll: students.roll_no, 
    pfp: studentImages.pfp 
  })
  .from(studentImages)
  .innerJoin(students, eq(studentImages.student_id, students.id))
  .where(isNotNull(studentImages.pfp));

  for (const row of studentPhotos) {
    try {
      const newPath = await migrateBase64ToLocal(row.pfp, 'students/pfp', row.roll);
      if (newPath) {
        await db.update(studentImages).set({ pfp: newPath }).where(eq(studentImages.student_id, row.id));
        console.log(`✅ Migrated PFP for ${row.roll}`);
      }
    } catch (e) {
      console.error(`❌ Failed to migrate PFP for ${row.roll}:`, e.message);
    }
  }

  // 2. Migrate Signatures
  console.log('\n--- Migrating Student Signatures ---');
  const studentSigs = await db.select({ 
    id: students.id, 
    roll: students.roll_no, 
    sig: studentSignatures.signature 
  })
  .from(studentSignatures)
  .innerJoin(students, eq(studentSignatures.student_id, students.id))
  .where(isNotNull(studentSignatures.signature));

  for (const row of studentSigs) {
    try {
      const newPath = await migrateBase64ToLocal(row.sig, 'students/signatures', `${row.roll}-sig`);
      if (newPath) {
        await db.update(studentSignatures).set({ signature: newPath }).where(eq(studentSignatures.student_id, row.id));
        console.log(`✅ Migrated Signature for ${row.roll}`);
      }
    } catch (e) {
      console.error(`❌ Failed to migrate Signature for ${row.roll}:`, e.message);
    }
  }

  // 3. Migrate Admission Drafts
  console.log('\n--- Migrating Admission Drafts ---');
  const drafts = await db.query.studentAdmissionDrafts.findMany({
    where: and(
        eq(studentAdmissionDrafts.status, 'DRAFT'),
        isNotNull(studentAdmissionDrafts.pfp)
    )
  });

  for (const draft of drafts) {
    try {
        let updated = false;
        const updateData = {};

        if (draft.pfp) {
            const newPfp = await migrateBase64ToLocal(draft.pfp, 'admission_drafts/pfp', `draft-${draft.id}`);
            if (newPfp) {
                updateData.pfp = newPfp;
                updated = true;
            }
        }
        if (draft.signature) {
            const newSig = await migrateBase64ToLocal(draft.signature, 'admission_drafts/signatures', `draft-${draft.id}-sig`);
            if (newSig) {
                updateData.signature = newSig;
                updated = true;
            }
        }

        if (updated) {
            await db.update(studentAdmissionDrafts).set(updateData).where(eq(studentAdmissionDrafts.id, draft.id));
            console.log(`✅ Migrated Draft #${draft.id}`);
        }
    } catch (e) {
        console.error(`❌ Failed to migrate Draft #${draft.id}:`, e.message);
    }
  }

  console.log('\n✨ Migration Complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
