import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { InstitutionAssetService } from '@/services/institution/InstitutionAssetService';
import { pdf } from '@react-pdf/renderer';
import { BulkIDCardPDF } from '@/pdf/templates/IDCardPDF';
import logger from '@/lib/logger';
import { z } from 'zod';

const bulkSchema = z.object({
  rollNos: z.array(z.string().min(1)).min(1, 'At least one roll number is required').max(200, 'Maximum 200 cards per bulk batch'),
});

async function resolveImageDataUrl(photoUrlOrKey) {
  if (!photoUrlOrKey) return null;
  if (photoUrlOrKey.startsWith('data:')) return photoUrlOrKey;

  try {
    const cleanKey = photoUrlOrKey.replace(/^\/+/, '');
    const localCandidates = [
      path.join('/var/www/kucet-storage', cleanKey),
      path.join('/app/storage', cleanKey),
      path.join('/tmp/kucet_photos_cache', cleanKey.replace(/^kucet\//, '')),
      path.join('/tmp/kucet_thumbs', `${path.basename(cleanKey, path.extname(cleanKey))}.png`),
    ];

    for (const cand of localCandidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ cand) && fs.statSync(/*turbopackIgnore: true*/ cand).isFile()) {
        const buf = fs.readFileSync(/*turbopackIgnore: true*/ cand);
        const ext = path.extname(cand).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/webp';
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    }
  } catch (_e) {}

  return photoUrlOrKey;
}

export const POST = wrapHandler({
  auth: ['staff', 'admin'],
  schema: bulkSchema,
  handler: async (req, { data, user }) => {
    // 1. RBAC Check
    if (!IDCardAuthorizationService.canBulkGenerate(user)) {
      return apiError('Forbidden: You do not have permission to batch generate ID cards', 403);
    }

    const { rollNos } = data;

    // 2. Departmental Scoping
    const allowedBranches = IDCardAuthorizationService.getAllowedBranches(user);

    // 3. Fetch Authorized Students
    const students = await IDCardDataService.getStudentsForBulk(rollNos, allowedBranches);
    if (!students || students.length === 0) {
      return apiError('No matching student records found for the provided roll numbers within your authorized scope', 404);
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
      } catch (_e) {}

      // 5. Pre-resolve photos in parallel
      const enrichedStudents = await Promise.all(
        students.map(async (st) => {
          const resolvedPhoto = await resolveImageDataUrl(st.pfpUrl);
          return {
            ...st,
            pfpUrl: resolvedPhoto,
          };
        })
      );

      // 6. Render Multi-Page PDF
      const pdfElement = (
        <BulkIDCardPDF
          students={enrichedStudents}
          logoUrl={logoUrl}
          signatureUrl={signatureUrl}
        />
      );

      const pdfBuffer = await pdf(pdfElement).toBuffer();

      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `attachment; filename="kucet_bulk_id_cards_${Date.now()}.pdf"`);
      headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');

      return new NextResponse(pdfBuffer, { status: 200, headers });
    } catch (err) {
      logger.error({ count: rollNos.length, err: err.message, stack: err.stack }, '[BULK_ID_CARD_PDF_GENERATION_FAILED]');
      return apiError('Failed to generate bulk student ID cards PDF', 500);
    }
  },
});
