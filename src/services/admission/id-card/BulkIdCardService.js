import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import React from 'react';
import archiver from 'archiver';
import { pdf } from '@react-pdf/renderer';
import IDCardPDF from '@/pdf/templates/IDCardPDF';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { IDCardDataService, CANONICAL_BRANCHES } from '@/services/identity/IDCardDataService';
import { InstitutionAssetService } from '@/services/institution/InstitutionAssetService';
import { getAssetUrl } from '@/lib/assets';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import sharp from 'sharp';
import { getCurrentCalendarSession, getCollegeAcademicYear } from '@/lib/academic-utils';
import logger from '@/lib/logger';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

// Directory for temporary bulk ZIP storage
const TEMP_ZIP_DIR = path.join(os.tmpdir(), 'kucet_bulk_id_cards');

// In-memory active job registry: jobId -> JobMetadata
const activeJobs = new Map();

// Job time-to-live: 20 minutes
const JOB_TTL_MS = 20 * 60 * 1000;

/**
 * Ensures temporary directory exists with secure permissions
 */
function ensureTempDir() {
  if (!fs.existsSync(TEMP_ZIP_DIR)) {
    fs.mkdirSync(TEMP_ZIP_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Periodically purge expired jobs and their temporary files
 */
function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [jobId, job] of activeJobs.entries()) {
    if (now > job.expiresAt) {
      try {
        if (job.filePath && fs.existsSync(job.filePath)) {
          fs.unlinkSync(job.filePath);
        }
      } catch (err) {
        logger.warn({ jobId, err: err.message }, 'Failed to delete expired bulk zip file');
      }
      activeJobs.delete(jobId);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(cleanupExpiredJobs, 5 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

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
      const jpegBuf = await sharp(buf).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
    }
  } catch (err) {
    logger.warn({ photoUrlOrKey, err: err.message }, '[RESOLVE_PDF_PHOTO_WARN]');
  }

  return null;
}

/**
 * Sanitizes student names for safe archive filenames without path traversal.
 */
export function sanitizeForFilename(str) {
  if (!str) return 'STUDENT';
  const clean = String(str)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return clean || 'STUDENT';
}

export class BulkIdCardService {
  /**
   * Resolves the user's authorized scope and validates requested parameters.
   */
  static resolveUserScope(user, { requestedBranch = 'ALL', requestedLevel = 'FIRST_YEAR' } = {}) {
    if (!user || !user.role) {
      const err = new Error('Unauthorized: User authentication required');
      err.statusCode = 401;
      throw err;
    }

    // 1. RBAC Check
    if (!IDCardAuthorizationService.canBulkGenerate(user) && !IDCardAuthorizationService.canView(user)) {
      const err = new Error('Forbidden: You do not have permission to generate bulk ID cards');
      err.statusCode = 403;
      throw err;
    }

    const isFirstYearRestricted = IDCardAuthorizationService.isFirstYearOnly(user);
    const allowedBranches = IDCardAuthorizationService.getAllowedBranches(user);

    // 2. Academic Level Scoping
    // First-Year Coordinator is strictly restricted to First Year
    let effectiveLevel = requestedLevel ? String(requestedLevel).toUpperCase().trim() : 'FIRST_YEAR';
    if (isFirstYearRestricted) {
      if (effectiveLevel !== 'FIRST_YEAR' && effectiveLevel !== '1' && effectiveLevel !== 'YEAR_1') {
        const err = new Error('Forbidden: First Year Coordinator access is strictly restricted to First-Year students');
        err.statusCode = 403;
        throw err;
      }
      effectiveLevel = 'FIRST_YEAR';
    }

    // 3. Branch Scoping
    const normBranch = requestedBranch ? String(requestedBranch).toUpperCase().trim() : 'ALL';
    if (normBranch !== 'ALL') {
      if (!IDCardAuthorizationService.isBranchAllowed(user, normBranch)) {
        const err = new Error(`Forbidden: You do not have permission for branch ${normBranch}`);
        err.statusCode = 403;
        throw err;
      }
    } else if (allowedBranches !== null && allowedBranches.length > 0) {
      // User is scoped to specific branch(es) and selected ALL -> must be authorized
    }

    return {
      user,
      isFirstYearRestricted,
      allowedBranches,
      effectiveBranch: normBranch,
      effectiveLevel,
    };
  }

  /**
   * Retrieves summary statistics and counts for bulk ID card generation preview.
   */
  static async getBulkPreview({ user, branch = 'ALL', academicLevel = 'FIRST_YEAR', academicYear = null }) {
    const scope = this.resolveUserScope(user, { requestedBranch: branch, requestedLevel: academicLevel });

    const session = await getCurrentCalendarSession().catch(() => null);
    const activeAcademicYear = academicYear || session?.academicYear || await getCollegeAcademicYear();

    const isFirstYear = scope.effectiveLevel === 'FIRST_YEAR';

    // Query authoritative database records
    const baseQuery = IDCardDataService.getAuthoritativeBaseQuery();
    const rows = await baseQuery.orderBy(IDCardDataService.studentsTable?.roll_no || 'id');

    const allowedSet = Array.isArray(scope.allowedBranches) && scope.allowedBranches.length > 0
      ? new Set(scope.allowedBranches.map((b) => String(b).toUpperCase().trim()))
      : null;

    const branchStatsMap = {};
    for (const b of CANONICAL_BRANCHES) {
      branchStatsMap[b.name] = {
        branch: b.name,
        branchCode: b.code,
        branchFullName: b.fullName,
        totalEligible: 0,
        photosAvailable: 0,
        photosMissing: 0,
        isAllowed: allowedSet ? allowedSet.has(b.name) : true,
      };
    }

    let globalTotal = 0;
    let globalPhotosAvailable = 0;
    let globalPhotosMissing = 0;
    let incompleteRecordsCount = 0;
    const seenRolls = new Set();

    for (const r of rows) {
      if (seenRolls.has(r.roll_no)) continue;

      const student = IDCardDataService.mapAuthoritativeStudent(r);
      if (!student) continue;

      // Filter by allowed branches
      if (allowedSet && !allowedSet.has(student.branch)) continue;

      // Filter by requested branch
      if (scope.effectiveBranch !== 'ALL' && student.branch !== scope.effectiveBranch) continue;

      // Filter by academic level
      if (isFirstYear && !(await IDCardDataService.isStudentFirstYear(student.rollNo, session))) {
        continue;
      }

      seenRolls.add(student.rollNo);

      const hasPhoto = student.photoKey && String(student.photoKey).trim() !== '';
      const hasMissingRequired = !student.studentName || student.studentName === 'N/A' ||
        !student.fatherName || student.fatherName === 'N/A' ||
        !student.studentAddress || student.studentAddress === 'N/A';

      if (hasMissingRequired) {
        incompleteRecordsCount++;
      }

      if (branchStatsMap[student.branch]) {
        branchStatsMap[student.branch].totalEligible++;
        if (hasPhoto) {
          branchStatsMap[student.branch].photosAvailable++;
        } else {
          branchStatsMap[student.branch].photosMissing++;
        }
      }

      globalTotal++;
      if (hasPhoto) {
        globalPhotosAvailable++;
      } else {
        globalPhotosMissing++;
      }
    }

    return {
      academicYear: activeAcademicYear,
      academicLevel: scope.effectiveLevel,
      selectedBranch: scope.effectiveBranch,
      totalEligible: globalTotal,
      photosAvailable: globalPhotosAvailable,
      photosMissing: globalPhotosMissing,
      incompleteRecords: incompleteRecordsCount,
      expectedPdfs: globalTotal,
      branches: Object.values(branchStatsMap),
      isFirstYearOnly: scope.isFirstYearRestricted,
    };
  }

  /**
   * Generates individual student ID card PDFs and packages them into a structured ZIP archive.
   */
  static async generateBulkZip({
    user,
    branch = 'ALL',
    academicLevel = 'FIRST_YEAR',
    academicYear = null,
    ip = '127.0.0.1',
    userAgent = 'System',
    onProgress = null,
  }) {
    ensureTempDir();
    cleanupExpiredJobs();

    const scope = this.resolveUserScope(user, { requestedBranch: branch, requestedLevel: academicLevel });

    if (onProgress) onProgress({ phase: 'FETCHING_STUDENTS', message: 'Fetching eligible finalized students...' });

    const session = await getCurrentCalendarSession().catch(() => null);
    const activeAcademicYear = academicYear || session?.academicYear || await getCollegeAcademicYear();
    const isFirstYear = scope.effectiveLevel === 'FIRST_YEAR';

    // 1. Fetch eligible students from authoritative base query
    const baseQuery = IDCardDataService.getAuthoritativeBaseQuery();
    const rows = await baseQuery.orderBy(IDCardDataService.studentsTable?.roll_no || 'id');

    const allowedSet = Array.isArray(scope.allowedBranches) && scope.allowedBranches.length > 0
      ? new Set(scope.allowedBranches.map((b) => String(b).toUpperCase().trim()))
      : null;

    const eligibleStudents = [];
    const seenRolls = new Set();

    for (const r of rows) {
      if (seenRolls.has(r.roll_no)) continue;

      const student = IDCardDataService.mapAuthoritativeStudent(r);
      if (!student) continue;

      if (allowedSet && !allowedSet.has(student.branch)) continue;
      if (scope.effectiveBranch !== 'ALL' && student.branch !== scope.effectiveBranch) continue;
      if (isFirstYear && !(await IDCardDataService.isStudentFirstYear(student.rollNo, session))) continue;

      seenRolls.add(student.rollNo);
      eligibleStudents.push(student);
    }

    if (eligibleStudents.length === 0) {
      const err = new Error(
        `No eligible finalized students found for branch ${scope.effectiveBranch} and level ${scope.effectiveLevel}`
      );
      err.statusCode = 404;
      throw err;
    }

    if (onProgress) onProgress({ phase: 'RESOLVING_ASSETS', message: 'Loading institutional branding and credentials...' });

    // 2. Pre-fetch and cache institutional branding assets ONCE for the entire batch
    let logoUrl = null;
    try {
      logoUrl = await InstitutionAssetService.getAssetDataUrl('institution/college-logo');
    } catch (_e) {
      // Fallback to local logo path
    }

    if (!logoUrl) {
      const localLogoPath = path.join(process.cwd(), 'public/assets/ku-college-logo.png');
      if (fs.existsSync(localLogoPath)) {
        const logoBuf = fs.readFileSync(localLogoPath);
        logoUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
      }
    }

    let signatureUrl = null;
    try {
      signatureUrl = await InstitutionAssetService.getAssetDataUrl('principal/signature');
    } catch (err) {
      logger.warn({ err: err.message }, 'Principal digital signature lookup warning for bulk ID card generation');
    }

    // 3. Prepare ZIP archive and temporary file
    const jobId = crypto.randomUUID();
    const cleanBranchLabel = scope.effectiveBranch === 'ALL' ? 'All_Branches' : scope.effectiveBranch;
    const cleanLevelLabel = scope.effectiveLevel === 'FIRST_YEAR' ? 'First_Year' : scope.effectiveLevel;
    const cleanYearLabel = String(activeAcademicYear).replace(/[^a-zA-Z0-9-]/g, '_');
    const zipFilename = `KUCET_ID_Cards_${cleanBranchLabel}_${cleanLevelLabel}_${cleanYearLabel}.zip`;
    const tempFilePath = path.join(TEMP_ZIP_DIR, `kucet_bulk_${jobId}.zip`);

    const outputStream = fs.createWriteStream(tempFilePath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    const archivePromise = new Promise((resolve, reject) => {
      outputStream.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      outputStream.on('error', (err) => reject(err));
    });

    archive.pipe(outputStream);

    // 4. Batch PDF Generation with Concurrency Control
    const BATCH_SIZE = 6;
    let generatedCount = 0;
    const exclusions = [];
    const usedFilenamesInZip = new Set();

    if (onProgress) onProgress({ phase: 'GENERATING_PDFS', message: `Generating ID cards for ${eligibleStudents.length} students...`, total: eligibleStudents.length });

    for (let i = 0; i < eligibleStudents.length; i += BATCH_SIZE) {
      const chunk = eligibleStudents.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (st) => {
          try {
            // Validation: Ensure mandatory fields exist
            if (!st.rollNo) {
              exclusions.push({ rollNo: 'UNKNOWN', name: st.studentName || 'N/A', reason: 'Missing official roll number' });
              return;
            }

            // Pre-resolve QR Code
            let qrUrl = null;
            try {
              qrUrl = await IDCardDataService.generateStudentQRDataUrl(st);
            } catch (qrErr) {
              logger.warn({ roll: st.rollNo, err: qrErr.message }, 'Failed to generate verification QR for student card');
            }

            // Pre-resolve Photograph with standard JPEG transcoding
            let resolvedPhoto = null;
            if (st.photoKey || st.photoUrl) {
              try {
                resolvedPhoto = await resolvePdfImageDataUrl(st.photoKey || st.photoUrl);
              } catch (photoErr) {
                logger.warn({ roll: st.rollNo, err: photoErr.message }, 'Failed to resolve photo for student card');
              }
            }

            if (!resolvedPhoto) {
              exclusions.push({
                rollNo: st.rollNo,
                name: st.studentName,
                branch: st.branch,
                reason: 'Student photograph not found or unreadable in storage (card generated with NO PHOTO marker)',
              });
            }

            // Generate Individual Student PDF using React.createElement for service-layer compatibility
            const pdfElement = React.createElement(IDCardPDF, {
              studentName: st.studentName,
              fatherName: st.fatherName,
              admissionNo: st.rollNo,
              course: st.branch,
              batch: st.batch || activeAcademicYear,
              address: st.studentAddress,
              mobile: st.studentPhone,
              pfpUrl: resolvedPhoto,
              logoUrl: logoUrl,
              signatureUrl: signatureUrl,
              qrUrl: qrUrl,
            });

            const pdfBuffer = await pdf(pdfElement).toBuffer();

            // Construct Archive Filename
            const cleanName = sanitizeForFilename(st.studentName);
            let individualFilename = `${st.rollNo}_${cleanName}_ID_CARD.pdf`;

            // Deduplicate if name collisions occur
            if (usedFilenamesInZip.has(individualFilename)) {
              individualFilename = `${st.rollNo}_${cleanName}_${crypto.randomUUID().slice(0, 4)}_ID_CARD.pdf`;
            }
            usedFilenamesInZip.add(individualFilename);

            // Structure by Branch folder
            const archivePath = scope.effectiveBranch === 'ALL'
              ? `${st.branch.toUpperCase()}/${individualFilename}`
              : `${individualFilename}`;

            archive.append(pdfBuffer, { name: archivePath });
            generatedCount++;
          } catch (studentErr) {
            logger.error({ roll: st.rollNo, err: studentErr.message }, 'Failed to render student ID card PDF');
            exclusions.push({
              rollNo: st.rollNo,
              name: st.studentName || 'N/A',
              branch: st.branch || 'N/A',
              reason: `PDF rendering failure: ${studentErr.message}`,
            });
          }
        })
      );

      if (onProgress) {
        onProgress({
          phase: 'GENERATING_PDFS',
          message: `Generated ${generatedCount} of ${eligibleStudents.length} ID cards...`,
          generated: generatedCount,
          total: eligibleStudents.length,
        });
      }
    }

    // 5. Append README.txt
    const generationDateStr = new Date().toISOString();
    const readmeLines = [
      '=========================================================================',
      '  KU COLLEGE OF ENGINEERING & TECHNOLOGY (KUCET)',
      '  BULK STUDENT IDENTITY CARD ARCHIVE',
      '=========================================================================',
      '',
      `Academic Year          : ${activeAcademicYear}`,
      `Scope                  : ${scope.effectiveBranch === 'ALL' ? 'All Authorized Academic Branches' : scope.effectiveBranch}`,
      `Academic Level         : ${scope.effectiveLevel}`,
      `Generated On           : ${generationDateStr}`,
      `Generated By           : Staff ID ${user.id || user.staffId || 'System'} (${user.role || 'Staff'})`,
      '',
      '-------------------------------------------------------------------------',
      'GENERATION METRICS',
      '-------------------------------------------------------------------------',
      `Total Finalized Eligible Students : ${eligibleStudents.length}`,
      `Total Individual PDFs Generated   : ${generatedCount}`,
      `Total Excluded / Flagged Records  : ${exclusions.length}`,
      '',
      '-------------------------------------------------------------------------',
      'ARCHIVE STRUCTURE',
      '-------------------------------------------------------------------------',
      scope.effectiveBranch === 'ALL'
        ? 'Organized into individual branch folders (CSE, IT, CSD, ECE, EEE, CIVIL, MECH).'
        : `Contains ID cards for ${scope.effectiveBranch} branch.`,
      'Filename Convention: ROLLNUMBER_STUDENTNAME_ID_CARD.pdf',
      '',
    ];

    if (exclusions.length > 0) {
      readmeLines.push(
        '-------------------------------------------------------------------------',
        'RECORD AUDIT & EXCLUSION LOG',
        '-------------------------------------------------------------------------'
      );
      exclusions.forEach((ex, idx) => {
        readmeLines.push(
          `${idx + 1}. Roll: ${ex.rollNo} | Branch: ${ex.branch || '—'} | Name: ${ex.name} | Notice: ${ex.reason}`
        );
      });
      readmeLines.push('');
    }

    readmeLines.push(
      '-------------------------------------------------------------------------',
      'INDEPENDENT VERIFICATION NOTICE',
      '-------------------------------------------------------------------------',
      'Each identity card contains an encrypted tamper-evident QR code scannable',
      'by authorized institutional terminals and the KUCET Mobile Attendance app.',
      '========================================================================='
    );

    archive.append(readmeLines.join('\n'), { name: 'README.txt' });

    // Finalize ZIP archive
    await archive.finalize();
    await archivePromise;

    const fileStats = fs.statSync(tempFilePath);

    // 6. Register Job in Memory with Ownership & Expiry
    const jobInfo = {
      jobId,
      userId: user.id || user.staffId || 0,
      userRole: user.role || 'staff',
      zipFilename,
      filePath: tempFilePath,
      fileSize: fileStats.size,
      totalEligible: eligibleStudents.length,
      generatedCount,
      excludedCount: exclusions.length,
      exclusions,
      branch: scope.effectiveBranch,
      academicLevel: scope.effectiveLevel,
      academicYear: activeAcademicYear,
      createdAt: Date.now(),
      expiresAt: Date.now() + JOB_TTL_MS,
    };

    activeJobs.set(jobId, jobInfo);

    // 7. Insert Audit Trail Log
    try {
      await db.insert(auditLogs).values({
        user_type: 'staff',
        user_id: user.id || user.staffId || 0,
        action: 'GENERATE_BULK_STUDENT_ID_CARDS_ZIP',
        entity_name: 'student_id_cards',
        entity_id: jobId,
        old_data: null,
        new_data: JSON.stringify({
          branch: scope.effectiveBranch,
          academicLevel: scope.effectiveLevel,
          academicYear: activeAcademicYear,
          totalEligible: eligibleStudents.length,
          generatedCount,
          excludedCount: exclusions.length,
          zipFilename,
          fileSize: fileStats.size,
        }),
        ip_address: ip,
        user_agent: userAgent,
        created_at: new Date(),
      });
    } catch (auditErr) {
      logger.warn({ err: auditErr.message, jobId }, 'Failed to insert audit log for bulk ID card generation');
    }

    logger.info(
      { jobId, branch: scope.effectiveBranch, level: scope.effectiveLevel, generatedCount, totalEligible: eligibleStudents.length },
      'Bulk Student ID card ZIP generated successfully'
    );

    return {
      success: true,
      jobId,
      zipFilename,
      totalEligible: eligibleStudents.length,
      generatedCount,
      excludedCount: exclusions.length,
      fileSize: fileStats.size,
      downloadUrl: `/api/staff/admission/id-cards/bulk/download/${jobId}`,
      exclusions,
    };
  }

  /**
   * Retrieves an active job's metadata and verifies user ownership.
   */
  static getJob(jobId, user) {
    if (!jobId || !activeJobs.has(jobId)) {
      return null;
    }

    const job = activeJobs.get(jobId);

    // Check expiry
    if (Date.now() > job.expiresAt) {
      try {
        if (job.filePath && fs.existsSync(job.filePath)) {
          fs.unlinkSync(job.filePath);
        }
      } catch (_e) {
        // Silently ignore unlink errors during expiry cleanup
      }
      activeJobs.delete(jobId);
      return null;
    }

    // Ownership check: must be owner or super_admin/admin
    const currentUserId = user.id || user.staffId;
    const isAdmin = ['super_admin', 'admin'].includes(String(user.role).toLowerCase());

    if (!isAdmin && job.userId !== currentUserId) {
      const err = new Error('Forbidden: You are not authorized to download this generated package');
      err.statusCode = 403;
      throw err;
    }

    return job;
  }

  /**
   * Cleans up a job and its temporary file after successful download.
   */
  static cleanupJob(jobId) {
    if (!jobId || !activeJobs.has(jobId)) return;
    const job = activeJobs.get(jobId);
    try {
      if (job.filePath && fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
    } catch (_e) {
      // Silently ignore unlink errors during job cleanup
    }
    activeJobs.delete(jobId);
  }
}
