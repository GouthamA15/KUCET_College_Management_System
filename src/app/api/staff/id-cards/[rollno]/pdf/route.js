import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { apiError, wrapHandler } from '@/lib/api-utils';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { InstitutionAssetService } from '@/services/institution/InstitutionAssetService';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF from '@/pdf/templates/IDCardPDF';
import logger from '@/lib/logger';

async function resolveImageDataUrl(photoUrlOrKey) {
  if (!photoUrlOrKey) return null;
  if (photoUrlOrKey.startsWith('data:')) return photoUrlOrKey;

  // If local VPS storage file path
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
      } catch (_e) {}

      // 5. Resolve Student Photo
      const resolvedPhoto = await resolveImageDataUrl(student.photoKey || student.photoUrl);

      // 6. Render PDF Stream to Buffer
      const pdfElement = (
        <IDCardPDF
          studentName={student.studentName}
          fatherName={student.fatherName}
          admissionNo={student.rollNo}
          course={student.branch}
          batch={student.academicYear}
          address={student.studentAddress}
          mobile={student.studentPhone}
          pfpUrl={resolvedPhoto}
          logoUrl={logoUrl}
          signatureUrl={signatureUrl}
          qrUrl={student.qrUrl}
        />
      );

      const pdfBuffer = await pdf(pdfElement).toBuffer();

      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `inline; filename="kucet_id_card_${student.rollNo}.pdf"`);
      headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');

      return new NextResponse(pdfBuffer, { status: 200, headers });
    } catch (err) {
      logger.error({ roll: student.rollNo, err: err.message, stack: err.stack }, '[ID_CARD_PDF_GENERATION_FAILED]');
      return apiError('Failed to generate student ID card PDF', 500);
    }
  },
});
