import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { InstitutionAssetService } from '@/services/institution/InstitutionAssetService';
import { getAssetUrl } from '@/lib/assets';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF from '@/pdf/templates/IDCardPDF';
import logger from '@/lib/logger';
import sharp from 'sharp';

/**
 * Resolves a student photo key or URL into a print-ready JPEG/PNG base64 data URL.
 * Automatically transcodes WebP into standard printable JPEG for @react-pdf/renderer.
 */
export async function resolvePdfImageDataUrl(photoUrlOrKey) {
  if (!photoUrlOrKey || typeof photoUrlOrKey !== 'string') return null;
  const clean = photoUrlOrKey.trim();
  if (clean === '' || clean === 'N/A' || clean === 'None') return null;

  try {
    let buf = null;

    if (clean.startsWith('data:image/jpeg') || clean.startsWith('data:image/png')) {
      return clean;
    }

    if (clean.startsWith('data:')) {
      const parts = clean.split(',');
      if (parts[1]) {
        buf = Buffer.from(parts[1], 'base64');
      }
    } else {
      const cleanKey = clean
        .replace(/^\/api\/assets\/view\//, '')
        .replace(/^https?:\/\/[^/]+\/api\/assets\/view\//, '')
        .replace(/^kucet\//, '')
        .replace(/^\/+/, '');

      const basePath = getLocalStorageBasePath();
      const localCandidates = [
        path.join(basePath, 'kucet', cleanKey),
        path.join(basePath, cleanKey),
        path.join('/app/storage', 'kucet', cleanKey),
        path.join('/app/storage', cleanKey),
        path.join('/var/www/kucet-storage', 'kucet', cleanKey),
        path.join('/var/www/kucet-storage', cleanKey),
        path.join(process.cwd(), 'public', 'uploads', cleanKey),
        path.join(process.cwd(), 'public', 'assets', cleanKey),
        path.join('/tmp/kucet_photos_cache', cleanKey),
        path.join('/tmp/kucet_thumbs', `${path.basename(cleanKey, path.extname(cleanKey))}.png`),
      ];

      for (const cand of localCandidates) {
        if (cand && fs.existsSync(/*turbopackIgnore: true*/ cand)) {
          const stat = fs.statSync(/*turbopackIgnore: true*/ cand);
          if (stat.isFile() && stat.size > 0) {
            buf = fs.readFileSync(/*turbopackIgnore: true*/ cand);
            break;
          }
        }
      }

      // Fallback: Remote URL fetch if not found on local disk
      if (!buf) {
        const remoteUrl = getAssetUrl(clean);
        if (remoteUrl && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'))) {
          const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const arr = await res.arrayBuffer();
            buf = Buffer.from(arr);
          }
        }
      }
    }

    if (buf && buf.length >= 12) {
      // Use sharp to auto-orient based on EXIF and transcode to high-quality JPEG
      const jpegBuf = await sharp(buf).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
    }
  } catch (err) {
    logger.warn({ photoUrlOrKey, err: err.message }, '[RESOLVE_PDF_PHOTO_WARN]');
  }

  return null;
}

export const GET = wrapHandler({
  auth: ['staff', 'admin'],
  handler: async (req, { user, context }) => {
    // 1. RBAC Check
    if (!IDCardAuthorizationService.canGenerate(user)) {
      return apiError('Forbidden: You do not have permission to generate ID cards', 403);
    }

    const { rollno } = (await context?.params) || {};
    if (!rollno) {
      return apiError('Roll number is required', 400);
    }

    // 2. Fetch Student Data
    const student = await IDCardDataService.getStudentRecordByRollNo(rollno);
    if (!student) {
      return apiError(`Student with roll number ${rollno} not found`, 404);
    }

    // 3. Departmental Scoping Check
    if (!IDCardAuthorizationService.isBranchAllowed(user, student.branch)) {
      return apiError(`Forbidden: You do not have permission for branch ${student.branch}`, 403);
    }

    try {
      // 4. Resolve Institutional Assets
      let logoUrl = null;
      try {
        logoUrl = await InstitutionAssetService.getAssetDataUrl('institution/college-logo');
      } catch (_e) {}

      if (!logoUrl) {
        const localLogoPath = path.join(process.cwd(), 'public/assets/ku-college-logo.png');
        if (fs.existsSync(/*turbopackIgnore: true*/ localLogoPath)) {
          const logoBuf = fs.readFileSync(/*turbopackIgnore: true*/ localLogoPath);
          logoUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
        }
      }

      let signatureUrl = null;
      try {
        signatureUrl = await InstitutionAssetService.getAssetDataUrl('principal/signature');
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to resolve principal digital signature');
      }

      if (!signatureUrl) {
        logger.warn({ roll: student.rollNo }, 'Principal digital signature not found in private storage for ID card');
      }

      // 5. Resolve Student Photo with standard JPEG transcoding
      const resolvedPhoto = await resolvePdfImageDataUrl(student.photoKey || student.photoUrl);

      // 6. Render PDF Stream
      const pdfElement = (
        <IDCardPDF
          studentName={student.studentName}
          fatherName={student.fatherName}
          admissionNo={student.rollNo}
          course={student.branch}
          batch={student.batch}
          address={student.studentAddress}
          mobile={student.studentPhone}
          pfpUrl={resolvedPhoto}
          logoUrl={logoUrl}
          signatureUrl={signatureUrl}
          qrUrl={student.qrUrl}
        />
      );

      const pdfStream = await pdf(pdfElement).toBuffer();

      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `inline; filename="kucet_id_card_${student.rollNo}.pdf"`);
      headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');

      return new NextResponse(pdfStream, { status: 200, headers });
    } catch (err) {
      logger.error({ roll: student.rollNo, err: err.message, stack: err.stack }, '[ID_CARD_PDF_GENERATION_FAILED]');
      return apiError('Failed to generate student ID card PDF', 500);
    }
  },
});
