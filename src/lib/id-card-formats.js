/**
 * Canonical Definitions and Helpers for Student ID Card Generation Formats.
 * Supports the 6 official KUCET ID card formats:
 * - Formats 1-3: Classic synthetic vector layout with 3 QR code variations.
 * - Formats 4-6: New official 2026 PNG template with 3 QR code variations.
 */

export const ID_CARD_FORMAT_IDS = {
  FORMAT_1: 'classic_roll_number',
  FORMAT_2: 'classic_standard',
  FORMAT_3: 'classic_public_url',
  FORMAT_4: 'official_roll_number',
  FORMAT_5: 'official_standard',
  FORMAT_6: 'official_public_url',
};

export const ID_CARD_FORMATS = {
  [ID_CARD_FORMAT_IDS.FORMAT_1]: {
    id: ID_CARD_FORMAT_IDS.FORMAT_1,
    code: 1,
    number: 'Format 1',
    name: 'Classic — HT Number QR',
    group: 'classic',
    template: 'classic',
    qrMode: 'roll_number',
    badge: 'Module A',
    badgeColor: 'emerald',
    description: "Original classic vector card with QR code encoding strictly the student's hall-ticket number.",
    shortDesc: 'Roll Number only in QR',
  },
  [ID_CARD_FORMAT_IDS.FORMAT_2]: {
    id: ID_CARD_FORMAT_IDS.FORMAT_2,
    code: 2,
    number: 'Format 2',
    name: 'Classic — Complete Information QR',
    group: 'classic',
    template: 'classic',
    qrMode: 'standard',
    badge: '14 Fields',
    badgeColor: 'blue',
    description: 'Original classic vector card with comprehensive 14-line plain text student profile in QR.',
    shortDesc: '14-field comprehensive QR',
  },
  [ID_CARD_FORMAT_IDS.FORMAT_3]: {
    id: ID_CARD_FORMAT_IDS.FORMAT_3,
    code: 3,
    number: 'Format 3',
    name: 'Classic — Application QR',
    group: 'classic',
    template: 'classic',
    qrMode: 'public_url',
    badge: 'Module B',
    badgeColor: 'purple',
    description: 'Original classic vector card with QR linking directly to the live KUCET student identification page.',
    shortDesc: 'Public Verification URL in QR',
  },
  [ID_CARD_FORMAT_IDS.FORMAT_4]: {
    id: ID_CARD_FORMAT_IDS.FORMAT_4,
    code: 4,
    number: 'Format 4',
    name: 'Official Template — HT Number QR',
    group: 'official',
    template: 'official',
    qrMode: 'roll_number',
    badge: 'Official 2026',
    badgeColor: 'amber',
    description: "New official institutional PNG template with QR code encoding strictly the student's hall-ticket number.",
    shortDesc: 'Official PNG + Roll Number QR',
  },
  [ID_CARD_FORMAT_IDS.FORMAT_5]: {
    id: ID_CARD_FORMAT_IDS.FORMAT_5,
    code: 5,
    number: 'Format 5',
    name: 'Official Template — Complete Information QR',
    group: 'official',
    template: 'official',
    qrMode: 'standard',
    badge: 'Official 2026',
    badgeColor: 'amber',
    description: 'New official institutional PNG template with comprehensive 14-line plain text student profile in QR.',
    shortDesc: 'Official PNG + 14-field QR',
  },
  [ID_CARD_FORMAT_IDS.FORMAT_6]: {
    id: ID_CARD_FORMAT_IDS.FORMAT_6,
    code: 6,
    number: 'Format 6',
    name: 'Official Template — Application QR',
    group: 'official',
    template: 'official',
    qrMode: 'public_url',
    badge: 'Official 2026',
    badgeColor: 'amber',
    description: 'New official institutional PNG template with QR linking directly to the live KUCET student identification page.',
    shortDesc: 'Official PNG + Public URL QR',
  },
};

export const ALL_ID_CARD_FORMATS = Object.values(ID_CARD_FORMATS);
export const CLASSIC_ID_CARD_FORMATS = ALL_ID_CARD_FORMATS.filter(f => f.group === 'classic');
export const OFFICIAL_ID_CARD_FORMATS = ALL_ID_CARD_FORMATS.filter(f => f.group === 'official');

/**
 * Resolves format metadata from format ID, code, or template + qrMode combination.
 * Guaranteed backward compatibility with legacy calls passing only qrMode.
 *
 * @param {string|number} formatKeyOrQrMode - e.g. 'official_roll_number', 'classic_standard', 4, 'format_4', 'roll_number'
 * @param {string} [explicitTemplate=null] - 'classic' | 'official'
 * @returns {typeof ID_CARD_FORMATS[keyof typeof ID_CARD_FORMATS]}
 */
export function resolveIDCardFormat(formatKeyOrQrMode = 'classic_standard', explicitTemplate = null) {
  if (!formatKeyOrQrMode && !explicitTemplate) {
    return ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_2];
  }

  const raw = String(formatKeyOrQrMode || '').trim().toLowerCase();

  // 1. Direct ID match
  if (ID_CARD_FORMATS[raw]) {
    return ID_CARD_FORMATS[raw];
  }

  // 2. Numeric / format_X match
  if (raw === '1' || raw === 'format_1' || raw === 'format1') return ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_1];
  if (raw === '2' || raw === 'format_2' || raw === 'format2') return ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_2];
  if (raw === '3' || raw === 'format_3' || raw === 'format3') return ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_3];
  if (raw === '4' || raw === 'format_4' || raw === 'format4') return ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_4];
  if (raw === '5' || raw === 'format_5' || raw === 'format5') return ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_5];
  if (raw === '6' || raw === 'format_6' || raw === 'format6') return ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_6];

  // 3. Template + qrMode combination
  const targetTemplate = (explicitTemplate || (raw.includes('official') ? 'official' : 'classic')).toLowerCase();
  let targetQrMode = 'standard';
  if (raw.includes('roll_number') || raw.includes('rollnumber') || raw === 'roll_number') {
    targetQrMode = 'roll_number';
  } else if (raw.includes('public_url') || raw.includes('public') || raw === 'public_url') {
    targetQrMode = 'public_url';
  } else if (raw.includes('standard') || raw === 'standard') {
    targetQrMode = 'standard';
  }

  const match = ALL_ID_CARD_FORMATS.find(
    f => f.template === targetTemplate && f.qrMode === targetQrMode
  );

  return match || ID_CARD_FORMATS[ID_CARD_FORMAT_IDS.FORMAT_2];
}

/**
 * Validates whether blood group string is one of the valid medical categories.
 * Strict institutional invariant: returns empty string if invalid or missing.
 *
 * @param {string|null} bloodGroup
 * @returns {string} Clean valid blood group or ''
 */
export function sanitizeBloodGroup(bloodGroup) {
  if (!bloodGroup || typeof bloodGroup !== 'string') return '';
  const clean = bloodGroup.trim().toUpperCase();
  const valid = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (valid.includes(clean)) {
    return clean;
  }
  return '';
}
