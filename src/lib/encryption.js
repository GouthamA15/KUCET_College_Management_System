import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Recommended for GCM

/**
 * Encrypts plain text using AES-256-GCM.
 */
export function encrypt(text) {
  if (!text) return null;
  
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }

  const key = Buffer.from(encryptionKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string encrypted by the encrypt function above.
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  const parts = String(encryptedText).split(':');
  if (parts.length !== 3) return encryptedText;

  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY missing');

    const [ivHex, tagHex, contentHex] = parts;
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    return encryptedText;
  }
}

/**
 * Generates a one-way deterministic hash for indexing/searching encrypted data.
 * Uses a separate key (or same key with salt) to prevent correlation.
 */
export function hashForIndex(text) {
  if (!text) return null;
  
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY missing');

  // Use HMAC with the encryption key as the secret to ensure the hash is unforgeable 
  // and deterministic for the same input.
  return crypto
    .createHmac('sha256', encryptionKey)
    .update(String(text).trim())
    .digest('hex');
}
