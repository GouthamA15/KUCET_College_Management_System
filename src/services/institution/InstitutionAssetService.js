import path from 'path';
import fs from 'fs';
import logger from '@/lib/logger';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';

/**
 * Registry of Canonical Institutional Assets.
 * Maps stable logical keys to physical asset metadata, descriptions, and legacy aliases.
 */
export const INSTITUTION_ASSET_REGISTRY = {
  'principal/signature': {
    key: 'principal/signature',
    filename: 'principal-sign.png',
    category: 'principal',
    mimeType: 'image/png',
    description: 'Primary digital signature of Principal',
    aliases: [
      'principal-sign.png',
      '/assets/principal-sign.png',
      'assets/principal-sign.png',
      'principal-signature',
      'principal/signature'
    ]
  },
  'principal/signature-stamp': {
    key: 'principal/signature-stamp',
    filename: 'principal-signStamp.png',
    category: 'principal',
    mimeType: 'image/png',
    description: 'Principal digital signature with official seal/stamp',
    aliases: [
      'principal-signStamp.png',
      'principal-sign-stamp.png',
      '/assets/principal-signStamp.png',
      '/assets/principal-sign-stamp.png',
      'assets/principal-signStamp.png',
      'assets/principal-sign-stamp.png',
      'principal/signature-stamp'
    ]
  },
  'principal/signature-black': {
    key: 'principal/signature-black',
    filename: 'principal-sign-black.png',
    category: 'principal',
    mimeType: 'image/png',
    description: 'Monochrome digital signature of Principal',
    aliases: [
      'principal-sign-black.png',
      '/assets/principal-sign-black.png',
      'assets/principal-sign-black.png',
      'principal/signature-black'
    ]
  },
  'principal/signature-v3': {
    key: 'principal/signature-v3',
    filename: 'principal-sign3.png',
    category: 'principal',
    mimeType: 'image/png',
    description: 'Alternative signature variant 3',
    aliases: [
      'principal-sign3.png',
      '/assets/principal-sign3.png',
      'assets/principal-sign3.png',
      'principal/signature-v3'
    ]
  },
  'principal/signature-v4': {
    key: 'principal/signature-v4',
    filename: 'principal-sign4.png',
    category: 'principal',
    mimeType: 'image/png',
    description: 'Alternative signature variant 4',
    aliases: [
      'principal-sign4.png',
      '/assets/principal-sign4.png',
      'assets/principal-sign4.png',
      'principal/signature-v4'
    ]
  },
  'principal/qr': {
    key: 'principal/qr',
    filename: 'principal_ku_qr.png',
    category: 'principal',
    mimeType: 'image/png',
    description: 'Principal / KU official payment and verification QR code',
    aliases: [
      'principal_ku_qr.png',
      '/assets/principal_ku_qr.png',
      'assets/principal_ku_qr.png',
      'principal-qr',
      'principal/qr'
    ]
  },
  'institution/seal': {
    key: 'institution/seal',
    filename: 'ku-college-seal.png',
    category: 'branding',
    mimeType: 'image/png',
    description: 'Official Kakatiya University College Seal',
    aliases: [
      'ku-college-seal.png',
      '/assets/ku-college-seal.png',
      'assets/ku-college-seal.png',
      'college-seal',
      'institution/seal'
    ]
  },
  'institution/logo': {
    key: 'institution/logo',
    filename: 'ku-logo.png',
    category: 'branding',
    mimeType: 'image/png',
    description: 'Official Kakatiya University Logo',
    aliases: [
      'ku-logo.png',
      '/assets/ku-logo.png',
      'assets/ku-logo.png',
      'university-logo',
      'institution/logo'
    ]
  },
  'institution/college-logo': {
    key: 'institution/college-logo',
    filename: 'ku-college-logo.png',
    category: 'branding',
    mimeType: 'image/png',
    description: 'Kakatiya University College of Engineering Logo',
    aliases: [
      'ku-college-logo.png',
      '/assets/ku-college-logo.png',
      'assets/ku-college-logo.png',
      'institution/college-logo'
    ]
  },
  'institution/kalathoranam': {
    key: 'institution/kalathoranam',
    filename: 'kakatiya-kala-thoranam.png',
    category: 'branding',
    mimeType: 'image/png',
    description: 'Kakatiya Kala Thoranam emblem',
    aliases: [
      'kakatiya-kala-thoranam.png',
      '/assets/kakatiya-kala-thoranam.png',
      'assets/kakatiya-kala-thoranam.png',
      'institution/kalathoranam'
    ]
  },
  'institution/naac-badge': {
    key: 'institution/naac-badge',
    filename: 'Naac_A+.png',
    category: 'branding',
    mimeType: 'image/png',
    description: 'NAAC A+ Accreditation Grade Badge',
    aliases: [
      'Naac_A+.png',
      '/assets/Naac_A+.png',
      'assets/Naac_A+.png',
      'institution/naac-badge'
    ]
  }
};

// In-memory buffer cache (< 2MB entries) for server-side PDF generation & asset resolution
const assetBufferCache = new Map();
const MAX_CACHE_ENTRIES = 50;

/**
 * Institution Asset Service & Provider.
 * Centralizes institutional asset resolution, prevents public modification,
 * and decouples institutional media from user uploads.
 */
export class InstitutionAssetService {
  /**
   * Resolves a input string (logical key, legacy filename, or relative path)
   * to its corresponding institutional asset entry object.
   * @param {string} keyOrPath 
   * @returns {Object|null}
   */
  static resolveAsset(keyOrPath) {
    if (!keyOrPath || typeof keyOrPath !== 'string') return null;

    const normalized = keyOrPath.trim().replace(/^[/\\]+/, '');
    const cleanBasename = path.basename(normalized);

    // 1. Direct key match
    if (INSTITUTION_ASSET_REGISTRY[normalized]) {
      return INSTITUTION_ASSET_REGISTRY[normalized];
    }
    if (INSTITUTION_ASSET_REGISTRY[keyOrPath]) {
      return INSTITUTION_ASSET_REGISTRY[keyOrPath];
    }

    // 2. Alias or Filename search
    for (const asset of Object.values(INSTITUTION_ASSET_REGISTRY)) {
      if (
        asset.filename === cleanBasename ||
        asset.aliases.includes(keyOrPath) ||
        asset.aliases.includes(normalized) ||
        asset.aliases.includes(cleanBasename)
      ) {
        return asset;
      }
    }

    return null;
  }

  /**
   * Returns canonical logical key for a given input.
   * @param {string} keyOrPath 
   * @returns {string|null}
   */
  static getLogicalKey(keyOrPath) {
    const asset = this.resolveAsset(keyOrPath);
    return asset ? asset.key : null;
  }

  /**
   * Checks if an asset path or target folder is an institutional protected asset.
   * Prevents unauthorized public uploads or modifications.
   * @param {string} targetPath 
   * @returns {boolean}
   */
  static isProtectedPath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') return false;
    const clean = targetPath.toLowerCase().trim().replace(/^[/\\]+/, '');

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

    return this.resolveAsset(targetPath) !== null;
  }

  /**
   * Returns the asset URL for a given logical key or filename based on deployment storage settings.
   * @param {string} keyOrAlias 
   * @param {Object} options 
   * @returns {string}
   */
  static getAssetUrl(keyOrAlias, options = {}) {
    const asset = this.resolveAsset(keyOrAlias);
    const filename = asset ? asset.filename : (typeof keyOrAlias === 'string' ? path.basename(keyOrAlias) : '');
    if (!filename) return '';

    const storageType = (
      process.env.NEXT_PUBLIC_STORAGE_TYPE ||
      process.env.STORAGE_TYPE ||
      'local'
    ).toLowerCase();

    // 1. Local Storage Strategy (Served via repository /assets/ or asset view proxy)
    if (storageType === 'local') {
      return `/assets/${filename}`;
    }

    // 2. S3 / R2 Strategy
    if (storageType === 's3' || storageType === 'r2') {
      const s3Domain = process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN || process.env.S3_PUBLIC_DOMAIN;
      if (s3Domain) {
        return `${s3Domain.replace(/\/$/, '')}/institution/${filename}`;
      }
    }

    // 3. Cloudinary Strategy
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'djs0ry74r';
    const transformations = options.transformations || 'f_auto,q_auto';
    return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${filename}`;
  }

  /**
   * Reads asset as Buffer (server-side). Tries local repository files, VPS disk storage, or remote Cloudinary fetch.
   * Caches in memory for fast performance.
   * @param {string} keyOrAlias 
   * @returns {Promise<Buffer|null>}
   */
  static async getAssetBuffer(keyOrAlias) {
    const asset = this.resolveAsset(keyOrAlias);
    const filename = asset ? asset.filename : path.basename(keyOrAlias || '');
    if (!filename) return null;

    const cacheKey = `buffer:${filename}`;
    if (assetBufferCache.has(cacheKey)) {
      return assetBufferCache.get(cacheKey);
    }

    const cwd = process.cwd();
    const localBasePath = getLocalStorageBasePath();

    // Candidate Local File Paths (supporting standard Next.js & Render standalone .next/standalone layouts)
    const localCandidatePaths = [
      path.join(cwd, 'public', 'assets', filename),
      path.join(cwd, 'public', filename),
      path.resolve(cwd, '..', 'public', 'assets', filename),
      path.resolve(cwd, '..', 'public', filename),
      path.resolve(cwd, '..', '..', 'public', 'assets', filename),
      path.resolve(cwd, '..', '..', 'public', filename),
      path.join(localBasePath, filename),
      path.join(localBasePath, 'kucet', filename),
      path.join(localBasePath, 'assets', filename),
      path.join(localBasePath, 'institution', filename),
      path.join(localBasePath, 'certificates', filename),
      path.join(localBasePath, 'kucet', 'certificates', filename)
    ];

    for (const cand of localCandidatePaths) {
      if (cand && fs.existsSync(cand)) {
        try {
          const stat = fs.statSync(cand);
          if (stat.isFile()) {
            const buf = await fs.promises.readFile(cand);
            if (buf && buf.length > 0) {
              if (assetBufferCache.size < MAX_CACHE_ENTRIES) assetBufferCache.set(cacheKey, buf);
              return buf;
            }
          }
        } catch (_e) {
          // continue
        }
      }
    }

    // Candidate 3: Remote Cloudinary / S3 fallback
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'djs0ry74r';
    const remoteCandidates = [
      `https://res.cloudinary.com/${cloudName}/image/upload/${filename}`,
      `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${filename}`,
      `https://res.cloudinary.com/${cloudName}/image/upload/kucet/${filename}`,
      `https://res.cloudinary.com/${cloudName}/image/upload/kucet/institution/${filename}`,
      `https://res.cloudinary.com/${cloudName}/image/upload/kucet/public/${filename}`,
      `https://res.cloudinary.com/${cloudName}/image/upload/kucet/public/assets/${filename}`,
      `https://res.cloudinary.com/${cloudName}/image/upload/assets/${filename}`
    ];
    const remoteUrl = this.getAssetUrl(keyOrAlias);
    if (remoteUrl && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'))) {
      if (!remoteCandidates.includes(remoteUrl)) {
        remoteCandidates.unshift(remoteUrl);
      }
    }

    for (const url of remoteCandidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          if (buf && buf.length > 0) {
            if (assetBufferCache.size < MAX_CACHE_ENTRIES) assetBufferCache.set(cacheKey, buf);
            return buf;
          }
        }
      } catch (err) {
        logger.error({ err: err.message, keyOrAlias, remoteUrl: url }, '[INSTITUTION_ASSET_FETCH_ERROR]');
      }
    }

    return null;
  }

  /**
   * Returns asset as base64 Data URL (e.g. data:image/png;base64,...), suitable for PDF generation.
   * @param {string} keyOrAlias 
   * @returns {Promise<string|null>}
   */
  static async getAssetDataUrl(keyOrAlias) {
    const asset = this.resolveAsset(keyOrAlias);
    const buffer = await this.getAssetBuffer(keyOrAlias);
    if (!buffer || buffer.length < 4) return null;

    let mimeType = asset ? asset.mimeType : 'image/png';
    // Inspect magic numbers for precise MIME determination
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) mimeType = 'image/jpeg';
    else if (buffer[0] === 0x89 && buffer[1] === 0x50) mimeType = 'image/png';

    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Returns all registered institutional assets.
   * @returns {Array<Object>}
   */
  static getAllAssets() {
    return Object.values(INSTITUTION_ASSET_REGISTRY);
  }
}

export const InstitutionAssetProvider = InstitutionAssetService;
export default InstitutionAssetService;
