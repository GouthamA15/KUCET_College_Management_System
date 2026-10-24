import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { InstitutionAssetService } from '@/services/institution/InstitutionAssetService';
import { resolvePdfImageDataUrl } from '../[rollno]/pdf/route';
import { pdf } from '@react-pdf/renderer';
import { BulkIDCardPDF } from '@/pdf/templates/IDCardPDF';
import logger from '@/lib/logger';
import { z } from 'zod';

const bulkSchema = z.object({
  rollNos: z.array(z.string().min(1)).min(1, 'At least one roll number is required').max(200, 'Maximum 200 cards per bulk batch'),
});

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
    const firstYearOnly = IDCardAuthorizationService.isFirstYearOnly(user);

    // 3. Fetch Authorized Students
    const students = await IDCardDataService.getStudentsForBulk(rollNos, allowedBranches, { firstYearOnly });
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
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to resolve principal digital signature for bulk PDF');
      }

      if (!signatureUrl) {
        logger.warn('Principal digital signature not found in private storage for bulk ID card PDF');
      }

      // 5. Pre-resolve photos in parallel with JPEG transcoding
      const enrichedStudents = await Promise.all(
        students.map(async (st) => {
          const resolvedPhoto = await resolvePdfImageDataUrl(st.pfpUrl);
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

      const pdfStream = await pdf(pdfElement).toBuffer();

      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `inline; filename="kucet_id_cards_batch_${Date.now()}.pdf"`);
      headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');

      return new NextResponse(pdfStream, { status: 200, headers });
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, '[BULK_ID_CARD_PDF_GENERATION_FAILED]');
      return apiError('Failed to generate bulk ID cards PDF', 500);
    }
  },
});
