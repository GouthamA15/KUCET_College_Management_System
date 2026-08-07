import { safeJsonParse } from '@/lib/json-utils';

export function parsePurpose(purposeStr) {
  if (!purposeStr) {
    return { purpose_type: null, purpose_custom: null };
  }
  const parsed = safeJsonParse(purposeStr, null);
  if (parsed && typeof parsed === 'object' && ('purpose_type' in parsed || 'purpose_custom' in parsed)) {
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

export function formatCertificateName(certificateType, purposeStr) {
  if (certificateType === 'Bonafide Certificate') {
    const { purpose_type, purpose_custom } = parsePurpose(purposeStr);
    let purposeDisplay = 'General';
    if (purpose_type) {
      if (purpose_type === 'Other' && purpose_custom) {
        purposeDisplay = purpose_custom;
      } else {
        purposeDisplay = purpose_type;
      }
    }
    return `Bonafide Certificate (${purposeDisplay})`;
  }
  return certificateType;
}
