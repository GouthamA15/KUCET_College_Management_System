import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// In-memory cache for fast delivery of static/branding assets (< 2MB)
const assetCache = new Map();
const MAX_CACHE_ENTRIES = 100;
const MAX_CACHE_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Signature & Stamp filename fallback aliases
const SIGNATURE_ALIASES = [
  'principal-sign.png',
  'principal-signStamp.png',
  'principal-sign-stamp.png',
  'principal-sign-black.png',
  'principal-sign3.png',
  'principal-sign4.png',
  'principal_ku_qr.png',
  'ku-college-seal.png'
];

/**
 * Resolves candidate file paths on disk using multi-path checks and aliases.
 */
export function resolveLocalFilePath(filename) {
  const base = getLocalStorageBasePath();
  const repoPublic = path.join(process.cwd(), 'public');
  
  const cleanFilename = filename.replace(/^[\/\\]+/, '');
  const candidatePaths = [];

  // 1. Direct path in local storage
  candidatePaths.push(path.resolve(base, cleanFilename));

  // 2. Storage without 'assets/' prefix if present
  if (cleanFilename.startsWith('assets/')) {
    candidatePaths.push(path.resolve(base, cleanFilename.replace(/^assets\//, '')));
  } else {
    candidatePaths.push(path.resolve(base, 'assets', cleanFilename));
  }

  // 3. Repository public folder fallbacks
  candidatePaths.push(path.resolve(repoPublic, cleanFilename));
  if (cleanFilename.startsWith('assets/')) {
    candidatePaths.push(path.resolve(repoPublic, cleanFilename));
  } else {
    candidatePaths.push(path.resolve(repoPublic, 'assets', cleanFilename));
  }

  // 4. Check signature & stamp alias fallbacks if requesting signature assets
  const lowerName = path.basename(cleanFilename).toLowerCase();
  if (lowerName.includes('principal') || lowerName.includes('sign') || lowerName.includes('seal') || lowerName.includes('stamp')) {
    for (const alias of SIGNATURE_ALIASES) {
      candidatePaths.push(path.resolve(base, alias));
      candidatePaths.push(path.resolve(base, 'assets', alias));
      candidatePaths.push(path.resolve(repoPublic, 'assets', alias));
    }
  }

  // Pick the first existing path that stays within valid root directories
  for (const candidate of candidatePaths) {
    if ((candidate.startsWith(base) || candidate.startsWith(repoPublic)) && fs.existsSync(candidate)) {
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          return { base, filePath: candidate, stat };
        }
      } catch (_e) {
        // continue
      }
    }
  }

  // Fallback default resolved path
  const defaultPath = path.resolve(base, cleanFilename);
  return { base, filePath: defaultPath, stat: null };
}

/**
 * SECURE ASSET PROXY
 * Serves files from VPS storage folders with memory caching and ETag support.
 */
export async function GET(request, { params }) {
  const { path: pathSegments } = await params;
  const filename = pathSegments.join('/');

  const { base, filePath, stat: existingStat } = resolveLocalFilePath(filename);
  const repoPublic = path.join(process.cwd(), 'public');

  // Security: Prevent Directory Traversal
  if (!filePath.startsWith(base) && !filePath.startsWith(repoPublic)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stat = existingStat || await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const etag = `W/"${stat.size}-${stat.mtimeMs.toString(36)}"`;
    const clientEtag = request.headers.get('if-none-match');

    const extension = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4'
    };
    const contentType = mimeTypes[extension] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, must-revalidate',
      'ETag': etag,
      'Last-Modified': stat.mtime.toUTCString(),
    };

    if (['.svg', '.pdf'].includes(extension)) {
      const sanitizedFilename = path.basename(filePath).replace(/[\r\n"'\\/]/g, '');
      headers['Content-Disposition'] = `attachment; filename="${sanitizedFilename}"`;
    } else {
      headers['Content-Disposition'] = 'inline';
    }

    // 304 Not Modified check
    if (clientEtag && clientEtag === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    // Check memory cache
    const cacheKey = `${filePath}:${stat.mtimeMs}`;
    let fileBuffer = assetCache.get(cacheKey);

    if (!fileBuffer) {
      fileBuffer = await fs.promises.readFile(filePath);
      if (stat.size <= MAX_CACHE_FILE_SIZE) {
        if (assetCache.size >= MAX_CACHE_ENTRIES) {
          const firstKey = assetCache.keys().next().value;
          assetCache.delete(firstKey);
        }
        assetCache.set(cacheKey, fileBuffer);
      }
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    logger.error({ err: error, tag: 'STORAGE_PROXY_ERROR', filename }, 'Storage proxy error');
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
