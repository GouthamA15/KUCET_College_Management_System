import { safeJsonParse } from '@/lib/json-utils';
import crypto from 'crypto';

export function parsePurpose(purposeStr) {
  if (!purposeStr) {
    return { purpose_type: null, purpose_custom: null };
  }
  const parsed = safeJsonParse(purposeStr, null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('purpose_type' in parsed || 'purpose_custom' in parsed)) {
    return {
      purpose_type: parsed.purpose_type || null,
      purpose_custom: parsed.purpose_custom || null
    };
  }
  return { purpose_type: purposeStr, purpose_custom: null };
}

export function formatPurpose(purposeStr) {
  const { purpose_type, purpose_custom } = parsePurpose(purposeStr);
  if (!purpose_type) return '';
  if (purpose_type === 'Other' && purpose_custom) {
    return purpose_custom;
  }
  return purpose_type;
}

export function normalizePurposeKey(purposeInput, customInput = null) {
  if (!purposeInput && !customInput) return 'general';
  let purposeType = null;
  let purposeCustom = null;

  if (purposeInput && typeof purposeInput === 'object') {
    purposeType = purposeInput.purpose_type || purposeInput.purpose || null;
    purposeCustom = purposeInput.purpose_custom || null;
  } else if (typeof purposeInput === 'string') {
    const trimmed = purposeInput.trim();
    if (!trimmed) {
      purposeType = null;
    } else {
      const parsed = parsePurpose(purposeInput);
      purposeType = parsed.purpose_type;
      purposeCustom = parsed.purpose_custom;
    }
  }

  // Explicit customInput takes precedence over purposeCustom extracted from purposeInput
  if (customInput !== null && customInput !== undefined) {
    if (typeof customInput === 'string') {
      const trimmedCustom = customInput.trim();
      if (trimmedCustom) {
        purposeCustom = trimmedCustom;
      }
    } else if (typeof customInput === 'object' && customInput !== null && customInput.purpose_custom) {
      const trimmedCustom = String(customInput.purpose_custom).trim();
      if (trimmedCustom) {
        purposeCustom = trimmedCustom;
      }
    }
  }

  const rawTypeStr = (purposeType !== null && purposeType !== undefined) ? String(purposeType).trim() : '';
  const cleanType = rawTypeStr
    ? rawTypeStr.toLowerCase().replace(/\s+/g, ' ')
    : 'general';

  if (cleanType === 'other') {
    const rawCustomStr = (purposeCustom !== null && purposeCustom !== undefined) ? String(purposeCustom).trim() : '';
    const cleanCustom = rawCustomStr
      ? rawCustomStr.toLowerCase().replace(/\s+/g, ' ')
      : '';
    if (cleanCustom) {
      return `other:${cleanCustom}`;
    }
    return 'other';
  }

  return cleanType;
}

export function formatCertificateName(certificateType, purposeStr) {
  if (certificateType === 'Bonafide Certificate') {
    const { purpose_type, purpose_custom } = parsePurpose(purposeStr);
    let purposeDisplay = 'General';
    if (purpose_type) {
      if (purpose_type === 'Other' && purpose_custom) {
        purposeDisplay = `Other — ${purpose_custom}`;
      } else {
        purposeDisplay = purpose_type;
      }
    }
    return `Bonafide Certificate (${purposeDisplay})`;
  }
  return certificateType;
}

/**
 * Generates a deterministic, fixed-length advisory lock identifier for payment proofs.
 * 
 * Invariants:
 * 1. Bounded: Generated lock name is strictly <= 64 characters (TiDB maximum limit).
 * 2. Deterministic: Identical normalized input values always produce identical lock names.
 * 3. Namespace-isolated: 'utr' and 'hash' produce distinct, non-overlapping lock names.
 * 4. Collision-resistant: Uses a 192-bit truncated SHA-256 digest providing extremely strong
 *    collision resistance (2^96 birthday bound), not mathematically guaranteed uniqueness.
 * 
 * @param {'utr'|'hash'} type - The namespace of the payment proof ('utr' or 'hash' only)
 * @param {string} value - The raw identifier (UTR string or 64-character screenshot hex hash)
 * @returns {string|null} Fixed-length bounded lock name (length 58 or 59 chars), or null if input is invalid
 */
export function generatePaymentLockName(type, value) {
  if (!type || typeof type !== 'string') return null;
  const cleanType = type.trim().toLowerCase();
  if (cleanType !== 'utr' && cleanType !== 'hash') return null;

  if (!value || typeof value !== 'string') return null;
  const cleanVal = value.trim();
  if (!cleanVal) return null;

  if (cleanType === 'hash') {
    // Screenshot fingerprint must be a 64-character hex string (SHA-256)
    if (!/^[a-fA-F0-9]{64}$/.test(cleanVal)) {
      return null;
    }
  }

  // Normalization semantics:
  // - 'hash' is normalized to lowercase for consistency across hex encodings
  // - 'utr' is trimmed
  const normalizedVal = cleanType === 'hash' ? cleanVal.toLowerCase() : cleanVal;

  const digest = crypto.createHash('sha256').update(normalizedVal).digest('hex').slice(0, 48);
  return `kucet:${cleanType}:${digest}`;
}
