/**
 * Canonical Logical Asset Names for Institutional Media.
 * Use these constants across the application instead of hardcoded filenames.
 */
export const INSTITUTION_ASSET_KEYS = {
  PRINCIPAL_SIGNATURE: 'principal/signature',
  PRINCIPAL_SIGNATURE_STAMP: 'principal/signature-stamp',
  PRINCIPAL_SIGNATURE_BLACK: 'principal/signature-black',
  PRINCIPAL_SIGNATURE_V3: 'principal/signature-v3',
  PRINCIPAL_SIGNATURE_V4: 'principal/signature-v4',
  PRINCIPAL_QR: 'principal/qr',
  INSTITUTION_SEAL: 'institution/seal',
  INSTITUTION_LOGO: 'institution/logo',
  INSTITUTION_COLLEGE_LOGO: 'institution/college-logo',
  INSTITUTION_KALATHORANAM: 'institution/kalathoranam',
  INSTITUTION_NAAC_BADGE: 'institution/naac-badge',
};

/**
 * Institutional Asset Metadata Registry (Client & Browser Safe)
 */
export const INSTITUTIONAL_ASSETS_MAP = {
  [INSTITUTION_ASSET_KEYS.PRINCIPAL_SIGNATURE]: {
    filename: 'principal-sign.png',
    mimeType: 'image/png',
    description: 'Primary digital signature of Principal',
    legacyAliases: ['principal-sign.png', '/assets/principal-sign.png', 'assets/principal-sign.png']
  },
  [INSTITUTION_ASSET_KEYS.PRINCIPAL_SIGNATURE_STAMP]: {
    filename: 'principal-signStamp.png',
    mimeType: 'image/png',
    description: 'Principal digital signature with official seal/stamp',
    legacyAliases: ['principal-signStamp.png', 'principal-sign-stamp.png', '/assets/principal-signStamp.png', '/assets/principal-sign-stamp.png']
  },
  [INSTITUTION_ASSET_KEYS.PRINCIPAL_SIGNATURE_BLACK]: {
    filename: 'principal-sign-black.png',
    mimeType: 'image/png',
    description: 'Monochrome digital signature of Principal',
    legacyAliases: ['principal-sign-black.png', '/assets/principal-sign-black.png']
  },
  [INSTITUTION_ASSET_KEYS.PRINCIPAL_SIGNATURE_V3]: {
    filename: 'principal-sign3.png',
    mimeType: 'image/png',
    description: 'Alternative signature variant 3',
    legacyAliases: ['principal-sign3.png', '/assets/principal-sign3.png']
  },
  [INSTITUTION_ASSET_KEYS.PRINCIPAL_SIGNATURE_V4]: {
    filename: 'principal-sign4.png',
    mimeType: 'image/png',
    description: 'Alternative signature variant 4',
    legacyAliases: ['principal-sign4.png', '/assets/principal-sign4.png']
  },
  [INSTITUTION_ASSET_KEYS.PRINCIPAL_QR]: {
    filename: 'principal_ku_qr.png',
    mimeType: 'image/png',
    description: 'Principal / KU official payment and verification QR code',
    legacyAliases: ['principal_ku_qr.png', '/assets/principal_ku_qr.png', 'principal-qr']
  },
  [INSTITUTION_ASSET_KEYS.INSTITUTION_SEAL]: {
    filename: 'ku-college-seal.png',
    mimeType: 'image/png',
    description: 'Official Kakatiya University College Seal',
    legacyAliases: ['ku-college-seal.png', '/assets/ku-college-seal.png', 'college-seal']
  },
  [INSTITUTION_ASSET_KEYS.INSTITUTION_LOGO]: {
    filename: 'ku-logo.png',
    mimeType: 'image/png',
    description: 'Official Kakatiya University Logo',
    legacyAliases: ['ku-logo.png', '/assets/ku-logo.png', 'university-logo']
  },
  [INSTITUTION_ASSET_KEYS.INSTITUTION_COLLEGE_LOGO]: {
    filename: 'ku-college-logo.png',
    mimeType: 'image/png',
    description: 'Kakatiya University College of Engineering Logo',
    legacyAliases: ['ku-college-logo.png', '/assets/ku-college-logo.png']
  },
  [INSTITUTION_ASSET_KEYS.INSTITUTION_KALATHORANAM]: {
    filename: 'kakatiya-kala-thoranam.png',
    mimeType: 'image/png',
    description: 'Kakatiya Kala Thoranam emblem',
    legacyAliases: ['kakatiya-kala-thoranam.png', '/assets/kakatiya-kala-thoranam.png']
  },
  [INSTITUTION_ASSET_KEYS.INSTITUTION_NAAC_BADGE]: {
    filename: 'Naac_A+.png',
    mimeType: 'image/png',
    description: 'NAAC A+ Accreditation Grade Badge',
    legacyAliases: ['Naac_A+.png', '/assets/Naac_A+.png']
  }
};

/**
 * Resolves any logical asset key, legacy path, or filename into its canonical filename.
 * @param {string} keyOrPath 
 * @returns {string|null}
 */
export function resolveInstitutionalFilename(keyOrPath) {
  if (!keyOrPath || typeof keyOrPath !== 'string') return null;

  const normalized = keyOrPath.trim().replace(/^[/\\]+/, '');
  const basename = normalized.split(/[/\\]/).pop();

  if (INSTITUTIONAL_ASSETS_MAP[normalized]) {
    return INSTITUTIONAL_ASSETS_MAP[normalized].filename;
  }

  for (const asset of Object.values(INSTITUTIONAL_ASSETS_MAP)) {
    if (
      asset.filename === basename ||
      asset.legacyAliases.includes(keyOrPath) ||
      asset.legacyAliases.includes(normalized) ||
      asset.legacyAliases.includes(basename)
    ) {
      return asset.filename;
    }
  }

  return null;
}

/**
 * Returns true if the target path or folder represents a protected institutional asset.
 * @param {string} pathOrFolder 
 * @returns {boolean}
 */
export function isInstitutionalAssetPath(pathOrFolder) {
  if (!pathOrFolder || typeof pathOrFolder !== 'string') return false;
  const clean = pathOrFolder.toLowerCase().trim().replace(/^[/\\]+/, '');
  if (
    clean.startsWith('assets') ||
    clean.startsWith('institution') ||
    clean.includes('institution/') ||
    clean.includes('principal-sign') ||
    clean.includes('ku-college-seal') ||
    clean.includes('principal_ku_qr')
  ) {
    return true;
  }
  return resolveInstitutionalFilename(pathOrFolder) !== null;
}
