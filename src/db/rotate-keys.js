import crypto from 'crypto';
import { db } from './index.js';
import { students as studentsTable, studentPersonalDetails } from './schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import logger from '../lib/logger.js';

/**
 * PRODUCTION HARDENING: Encryption Key Rotation Utility
 * 
 * Usage:
 * 1. Set OLD_ENCRYPTION_KEY in your .env
 * 2. Set new ENCRYPTION_KEY in your .env
 * 3. Run: npm run db:rotate-keys
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function decryptOld(text, key) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const authTag = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (_err) {
    return null; // Failed to decrypt with old key
  }
}

function encryptNew(text, key) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

async function rotateKeys() {
  const oldKey = process.env.OLD_ENCRYPTION_KEY;
  const newKey = process.env.ENCRYPTION_KEY;

  if (!oldKey || !newKey || oldKey === newKey) {
    console.error('❌ Error: Both OLD_ENCRYPTION_KEY and ENCRYPTION_KEY must be set and different.');
    process.exit(1);
  }

  console.info('--- STARTING ENCRYPTION KEY ROTATION ---');

  try {
    await db.transaction(async (tx) => {
      // 1. Rotate Student Mobile Numbers
      const students = await tx.select({ id: studentsTable.id, mobile: studentsTable.mobile })
        .from(studentsTable)
        .where(isNotNull(studentsTable.mobile));

      console.info(`📡 Processing ${students.length} student mobile numbers...`);
      for (const s of students) {
        const decrypted = decryptOld(s.mobile, oldKey);
        if (decrypted) {
          const reEncrypted = encryptNew(decrypted, newKey);
          await tx.update(studentsTable)
            .set({ mobile: reEncrypted })
            .where(eq(studentsTable.id, s.id));
        }
      }

      // 2. Rotate Personal Details (Aadhaar, Guardian Mobile)
      const details = await tx.select({ 
        id: studentPersonalDetails.id, 
        aadhaar_no: studentPersonalDetails.aadhaar_no,
        guardian_mobile: studentPersonalDetails.guardian_mobile
      })
      .from(studentPersonalDetails);

      console.info(`📡 Processing ${details.length} personal detail records...`);
      for (const d of details) {
        const updateObj = {};
        
        if (d.aadhaar_no) {
          const decryptedAadhaar = decryptOld(d.aadhaar_no, oldKey);
          if (decryptedAadhaar) updateObj.aadhaar_no = encryptNew(decryptedAadhaar, newKey);
        }

        if (d.guardian_mobile) {
          const decryptedGuardian = decryptOld(d.guardian_mobile, oldKey);
          if (decryptedGuardian) updateObj.guardian_mobile = encryptNew(decryptedGuardian, newKey);
        }

        if (Object.keys(updateObj).length > 0) {
          await tx.update(studentPersonalDetails)
            .set(updateObj)
            .where(eq(studentPersonalDetails.id, d.id));
        }
      }
    });

    console.info('✅ KEY ROTATION SUCCESSFUL');
    console.info('⚠️ Remember to remove OLD_ENCRYPTION_KEY from your environment variables.');
  } catch (error) {
    logger.error('[KEY_ROTATION_ERROR] Operation failed:', error.message);
    console.error('❌ Key rotation failed. Transaction rolled back.');
    process.exit(1);
  }
}

rotateKeys()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
