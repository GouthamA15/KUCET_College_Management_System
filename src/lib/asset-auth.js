import { db } from '@/db';
import { 
  students, 
  studentImages, 
  studentSignatures, 
  studentAdmissionDrafts, 
  studentProfileRequests, 
  studentRequests, 
  studentRequestImages,
  clerks,
  principal,
  bugReports 
} from '@/db/schema';
import { eq, or, inArray } from 'drizzle-orm';
import { STATIC_ASSETS } from '@/lib/assets';
import logger from '@/lib/logger';

/**
 * Normalizes an asset path into a clean relative storage key.
 * Removes leading slashes, domain, '/api/assets/view/', '/uploads/', and 'kucet/' namespace prefixes.
 */
export function normalizeAssetPath(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') return '';
  let clean = assetPath.trim();

  // Strip query strings
  clean = clean.split('?')[0];

  if (clean.includes('/api/assets/view/')) {
    clean = clean.split('/api/assets/view/')[1];
  }
  if (clean.includes('/uploads/')) {
    clean = clean.split('/uploads/')[1];
  }
  clean = clean.replace(/^https?:\/\/[^/]+/, '');
  clean = clean.replace(/^\/+/, '');
  clean = clean.replace(/^v\d+\//, '');
  clean = clean.replace(/^kucet\//, '');
  clean = clean.replace(/^\/+/, '');
  return clean;
}

/**
 * Determines whether a given path corresponds to a static public asset
 * (e.g. institutional logos, default avatars, favicons, campus photos in /public/assets).
 */
export function isStaticPublicAsset(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return false;
  
  const clean = rawPath.trim().replace(/^kucet\//, '');
  const normalized = clean.startsWith('/') ? clean : `/${clean}`;

  // Check STATIC_ASSETS set
  if (STATIC_ASSETS.has(normalized)) {
    return true;
  }

  // Check public folder assets pattern
  if (normalized.startsWith('/assets/') || normalized.startsWith('assets/')) {
    const filename = normalized.split('/').pop();
    const publicStaticFiles = [
      'ku-logo.png', 'ku-college-logo.png', 'Naac_A+.png',
      'kakatiya-kala-thoranam.png', 'rudramadevi_statue.jpg',
      'college-campus.jpg', 'default-avatar.svg', 'Picture1.png',
      'icon-192x192.png', 'icon-512x512.png', 'kucet-logo.png',
      'favicon.ico', 'manifest.json'
    ];
    if (publicStaticFiles.includes(filename)) return true;
    if (normalized.includes('/DevPics/') || normalized.includes('/Payment QR/')) return true;
  }

  return false;
}

/**
 * Validates that an authenticated user is currently active in the database.
 */
export async function isUserActive(user) {
  if (!user) return false;

  try {
    const role = user.role;

    if (role === 'admin') {
      const adminRecord = await db.query.principal.findFirst({
        where: eq(principal.id, user.id || 1),
        columns: { id: true }
      });
      return !!adminRecord;
    }

    if (['scholarship', 'admission', 'faculty', 'clerk'].includes(role) || user.is_hod || user.clerkId) {
      const clerkId = user.id || user.clerkId;
      if (!clerkId && !user.email) return false;

      const clerkRecord = await db.query.clerks.findFirst({
        where: clerkId ? eq(clerks.id, clerkId) : eq(clerks.email, user.email),
        columns: { id: true, is_active: true }
      });

      if (!clerkRecord) return false;
      return clerkRecord.is_active !== false && clerkRecord.is_active !== 0;
    }

    if (role === 'student' || user.student_id || user.roll_no) {
      const studentId = user.student_id || user.id;
      const rollNo = user.roll_no;
      if (!studentId && !rollNo) return false;

      const studentRecord = await db.query.students.findFirst({
        where: studentId ? eq(students.id, studentId) : eq(students.roll_no, rollNo),
        columns: { id: true, student_status: true, academic_status: true }
      });

      if (!studentRecord) return false;
      const isDiscontinued = studentRecord.student_status === 'DISCONTINUED';
      const isSuspended = ['SUSPENDED', 'DROPPED'].includes(studentRecord.academic_status);
      return !isDiscontinued && !isSuspended;
    }

    return false;
  } catch (err) {
    logger.error({ err, user }, '[ASSET_AUTH_IS_USER_ACTIVE_ERROR]');
    return false;
  }
}

/**
 * Core Permission & Ownership Verification Engine.
 * Verifies whether the authenticated user has authorization to access the target asset.
 */
export async function canUserAccessAsset(user, rawPath) {
  // Static public assets are accessible to everyone
  if (isStaticPublicAsset(rawPath)) {
    return true;
  }

  // Sensitive assets require an active authenticated user
  if (!user) {
    return false;
  }

  const cleanPath = normalizeAssetPath(rawPath);
  if (!cleanPath) return false;

  // Security: Prevent Directory Traversal
  if (cleanPath.includes('..') || cleanPath.startsWith('/') || cleanPath.startsWith('\\')) {
    return false;
  }

  const userRole = user.role || (user.student_id || user.roll_no ? 'student' : null);

  // 1. SUPER ADMIN ACCESS CONTROL
  if (userRole === 'admin') {
    return true;
  }

  // 2. BACKUP ACCESS CONTROL (Strictly Admin-Only)
  if (cleanPath.startsWith('backups/') || cleanPath.includes('backups/')) {
    return false;
  }

  // 3. CLERK / FACULTY / HOD STAFF ACCESS CONTROL
  if (['scholarship', 'admission', 'faculty', 'clerk'].includes(userRole) || user.is_hod || user.clerkId) {
    // Staff members are authorized for operational media (student photos, signatures, admission drafts, payment proofs, clerk photos/signatures, bug reports)
    return true;
  }

  // 4. STUDENT OWNERSHIP ACCESS CONTROL
  if (userRole === 'student' || user.student_id || user.roll_no) {
    const studentId = user.student_id || user.id;
    const rollNo = user.roll_no;
    const email = user.email;

    // Institutional assets (logos, principal seal/signature) accessible for letter/document rendering
    if (cleanPath.startsWith('institution/') || cleanPath.startsWith('principal/')) {
      return true;
    }

    const filename = cleanPath.split('/').pop();

    try {
      // a) Student Profile Photo & Signature check
      if (cleanPath.startsWith('students/pfp') || cleanPath.startsWith('students/signatures') || cleanPath.includes('students/')) {
        if (studentId) {
          const studentRecord = await db.query.students.findFirst({
            where: eq(students.id, studentId),
            columns: { pfp: true }
          });
          if (studentRecord && studentRecord.pfp) {
            const pfpClean = normalizeAssetPath(studentRecord.pfp);
            if (pfpClean === cleanPath || pfpClean.endsWith(filename)) return true;
          }

          const imgRecord = await db.query.studentImages.findFirst({
            where: eq(studentImages.student_id, studentId),
            columns: { pfp: true }
          });
          if (imgRecord && imgRecord.pfp) {
            const pfpClean = normalizeAssetPath(imgRecord.pfp);
            if (pfpClean === cleanPath || pfpClean.endsWith(filename)) return true;
          }

          const sigRecord = await db.query.studentSignatures.findFirst({
            where: eq(studentSignatures.student_id, studentId),
            columns: { signature: true }
          });
          if (sigRecord && sigRecord.signature) {
            const sigClean = normalizeAssetPath(sigRecord.signature);
            if (sigClean === cleanPath || sigClean.endsWith(filename)) return true;
          }
        }
      }

      // b) Admission Draft Photos & Signatures check
      if (cleanPath.startsWith('admission_drafts/')) {
        const draftConditions = [];
        if (email) draftConditions.push(eq(studentAdmissionDrafts.email, email));
        if (rollNo) draftConditions.push(eq(studentAdmissionDrafts.roll_no, rollNo));

        if (draftConditions.length > 0) {
          const draftRecords = await db.query.studentAdmissionDrafts.findMany({
            where: or(...draftConditions),
            columns: { pfp: true, signature: true }
          });

          for (const draft of draftRecords) {
            if (draft.pfp && (normalizeAssetPath(draft.pfp) === cleanPath || draft.pfp.endsWith(filename))) return true;
            if (draft.signature && (normalizeAssetPath(draft.signature) === cleanPath || draft.signature.endsWith(filename))) return true;
          }
        }
      }

      // c) Profile Change Requests & Proofs check
      if (cleanPath.startsWith('requests/pfp') || cleanPath.startsWith('requests/signatures') || cleanPath.startsWith('requests/proofs')) {
        if (studentId) {
          const profileReqs = await db.query.studentProfileRequests.findMany({
            where: eq(studentProfileRequests.student_id, studentId),
            columns: { new_pfp: true, new_signature: true, proof_url: true }
          });

          for (const req of profileReqs) {
            if (req.new_pfp && (normalizeAssetPath(req.new_pfp) === cleanPath || req.new_pfp.endsWith(filename))) return true;
            if (req.new_signature && (normalizeAssetPath(req.new_signature) === cleanPath || req.new_signature.endsWith(filename))) return true;
            if (req.proof_url && (normalizeAssetPath(req.proof_url) === cleanPath || req.proof_url.endsWith(filename))) return true;
          }
        }
      }

      // d) Certificate Request Payment Screenshots check
      if (cleanPath.startsWith('certificates/payments') || cleanPath.startsWith('requests/payment_screenshots') || cleanPath.includes('payment')) {
        if (studentId) {
          const studentReqs = await db.query.studentRequests.findMany({
            where: eq(studentRequests.student_id, studentId),
            columns: { request_id: true }
          });

          if (studentReqs.length > 0) {
            const reqIds = studentReqs.map(r => r.request_id);
            const reqImages = await db.query.studentRequestImages.findMany({
              where: inArray(studentRequestImages.request_id, reqIds),
              columns: { payment_screenshot: true }
            });

            for (const img of reqImages) {
              if (img.payment_screenshot && (normalizeAssetPath(img.payment_screenshot) === cleanPath || img.payment_screenshot.endsWith(filename))) {
                return true;
              }
            }
          }
        }
      }

      // e) Bug Reports check
      if (cleanPath.startsWith('bug_reports/')) {
        const bugConditions = [];
        if (rollNo) bugConditions.push(eq(bugReports.submitted_by, rollNo));
        if (email) bugConditions.push(eq(bugReports.submitted_by, email));

        if (bugConditions.length > 0) {
          const bugs = await db.query.bugReports.findMany({
            where: or(...bugConditions),
            columns: { screenshot_url: true }
          });

          for (const bug of bugs) {
            if (bug.screenshot_url && (normalizeAssetPath(bug.screenshot_url) === cleanPath || bug.screenshot_url.endsWith(filename))) {
              return true;
            }
          }
        }
      }

      // f) Faculty/Clerk signature check on verified documents/memos
      if (cleanPath.startsWith('clerks/signatures') || cleanPath.startsWith('clerks/pfp')) {
        return true;
      }

    } catch (err) {
      logger.error({ err, studentId, cleanPath }, '[ASSET_AUTH_STUDENT_OWNERSHIP_ERROR]');
      return false;
    }
  }

  // Default DENIED for un-owned or unrecognized paths
  return false;
}
