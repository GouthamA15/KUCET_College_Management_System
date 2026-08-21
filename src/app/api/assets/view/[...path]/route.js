import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/api-utils';
import { isStaticPublicAsset, isUserActive, canUserAccessAsset, normalizeAssetPath } from '@/lib/asset-auth';
import { resolveInstitutionalFilename } from '@/lib/institution-assets';

// In-memory cache for fast delivery of static/branding assets (< 2MB)
const assetCache = new Map();
const MAX_CACHE_ENTRIES = 100;
const MAX_CACHE_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Resolves candidate file paths on disk using multi-path checks and institutional asset mappings.
 */
export function resolveLocalFilePath(filename) {
  const base = getLocalStorageBasePath();
  const repoPublic = path.join(process.cwd(), 'public');
  
  let cleanFilename = filename || '';
  if (cleanFilename.includes('/api/assets/view/')) {
    cleanFilename = cleanFilename.split('/api/assets/view/')[1];
  }
  cleanFilename = cleanFilename.replace(/^[/\\]+/, '').replace(/\\/g, '/');

  const candidatePaths = [];

  // Check institutional canonical filename mapping
  const instFilename = resolveInstitutionalFilename(cleanFilename);
  if (instFilename) {
    candidatePaths.push(path.resolve(repoPublic, 'assets', instFilename));
    candidatePaths.push(path.resolve(base, 'institution', instFilename));
    candidatePaths.push(path.resolve(base, 'assets', instFilename));
    candidatePaths.push(path.resolve(base, 'certificates', instFilename));
    candidatePaths.push(path.resolve(base, 'kucet', 'certificates', instFilename));
    candidatePaths.push(path.resolve(base, 'kucet', instFilename));
    candidatePaths.push(path.resolve(base, instFilename));
  }

  // 1. Direct path in local storage
  candidatePaths.push(path.resolve(base, cleanFilename));

  // 2. Storage with 'kucet/' prefix
  candidatePaths.push(path.resolve(base, 'kucet', cleanFilename));

  // 3. Storage without 'assets/', 'kucet/', or 'uploads/' prefix if present
  if (cleanFilename.startsWith('assets/')) {
    candidatePaths.push(path.resolve(base, cleanFilename.replace(/^assets\//, '')));
    candidatePaths.push(path.resolve(base, 'kucet', cleanFilename.replace(/^assets\//, '')));
  } else if (cleanFilename.startsWith('kucet/')) {
    candidatePaths.push(path.resolve(base, cleanFilename.replace(/^kucet\//, '')));
  } else if (cleanFilename.startsWith('uploads/')) {
    candidatePaths.push(path.resolve(base, cleanFilename.replace(/^uploads\//, '')));
    candidatePaths.push(path.resolve(base, 'kucet', cleanFilename.replace(/^uploads\//, '')));
  } else {
    candidatePaths.push(path.resolve(base, 'assets', cleanFilename));
  }

  // 4. Repository public folder fallbacks
  candidatePaths.push(path.resolve(repoPublic, cleanFilename));
  if (cleanFilename.startsWith('assets/')) {
    candidatePaths.push(path.resolve(repoPublic, cleanFilename));
  } else {
    candidatePaths.push(path.resolve(repoPublic, 'assets', cleanFilename));
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
 * SECURE PRIVATE ASSET PROXY
 * Authorizes every request before serving sensitive images.
 * Implements role-based access control, ownership verification, ETag support, and optional Nginx X-Accel-Redirect.
 */
export async function GET(request, { params }) {
  const { path: pathSegments } = await params;
  const rawFilename = pathSegments.join('/');
  let filename = rawFilename;
  if (filename.includes('api/assets/view/')) {
    filename = filename.split('api/assets/view/')[1];
  }
  filename = filename.replace(/^[/\\]+/, '');

  // 1. Static Public Asset Check
  const isStatic = isStaticPublicAsset(filename);

  if (!isStatic) {
    // 2. Authentication Check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    // 3. Active User Check
    const active = await isUserActive(user);
    if (!active) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    // 4. Role & Ownership Verification
    const authorized = await canUserAccessAsset(user, filename);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }
  }

  // 5. File Resolution & Security Verification
  const { base, filePath, stat: existingStat } = resolveLocalFilePath(filename);
  const repoPublic = path.join(process.cwd(), 'public');

  // Prevent Directory Traversal
  if (!filePath.startsWith(base) && !filePath.startsWith(repoPublic)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }

  const storageType = (
    process.env.STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_STORAGE_TYPE ||
    process.env.STORAGE_TYPE ||
    'local'
  ).toLowerCase();

  // If STORAGE_TYPE=cloudinary and file is not present on local disk, redirect to Cloudinary CDN URL
  if (storageType === 'cloudinary' && !existingStat) {
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      'djs0ry74r';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    let resourceType = 'image';
    if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov', 'm4a'].includes(extension)) {
      resourceType = 'video';
    } else if (['pdf', 'docx', 'xlsx', 'csv'].includes(extension)) {
      resourceType = 'raw';
    }
    const cleanCloudinaryKey = (filename.startsWith('kucet/') || filename.startsWith('archive/'))
      ? filename
      : `kucet/${filename}`;
    const cdnUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/f_auto,q_auto/${cleanCloudinaryKey}`;
    return NextResponse.redirect(cdnUrl, 307);
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
      '.heic': 'image/heic',
      '.heif': 'image/heif',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm'
    };
    const contentType = mimeTypes[extension] || 'application/octet-stream';
    const cacheControlHeader = isStatic 
      ? 'public, max-age=86400, must-revalidate' 
      : 'private, max-age=3600, must-revalidate';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': cacheControlHeader,
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

    // High-performance Nginx X-Accel-Redirect mode
    if (process.env.USE_NGINX_X_ACCEL === 'true' || request.headers.get('x-nginx-accel') === 'true') {
      const cleanRel = normalizeAssetPath(filename);
      headers['X-Accel-Redirect'] = `/internal_uploads/${cleanRel}`;
      return new NextResponse(null, { headers });
    }

    // Memory cache for small assets (<2MB)
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
