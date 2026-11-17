import { db } from '@/db';
import { 
  internshipDocuments, 
  studentInternships, 
  students, 
  internshipAuditLogs 
} from '@/db/schema';
import { eq, and, desc, sql, inArray, or, like } from 'drizzle-orm';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import { getLocalStorageBasePath } from '@/lib/providers/storage/LocalStorageProvider';
import { sqlStudentBranch, sqlAcademicYear } from './InternshipReportingService';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import logger from '@/lib/logger';

const branchCodes = {
  '09': 'CSE',
  '30': 'CSD',
  '15': 'ECE',
  '12': 'EEE',
  '00': 'CIVIL',
  '18': 'IT',
  '03': 'MECH',
};

export const ALLOWED_DOC_TYPES = [
  'OFFER_LETTER',
  'JOINING_LETTER',
  'COMPLETION_CERTIFICATE',
  'INTERNSHIP_REPORT',
  'RECOMMENDATION_LETTER',
  'OTHER_SUPPORTING_DOCUMENT'
];

export class InternshipDocumentService {
  /**
   * Sanitizes a string for safe use in file/folder path segments, preventing directory traversal.
   */
  static sanitizePathSegment(segment, fallback = 'UNKNOWN') {
    if (!segment || typeof segment !== 'string') return fallback;
    // Strip leading/trailing dots/slashes, replace unsafe characters with underscore
    const cleaned = segment
      .replace(/[/\\]/g, '')
      .replace(/\.\.+/g, '')
      .replace(/[^a-zA-Z0-9_\-.]/g, '_')
      .trim();
    return cleaned || fallback;
  }

  /**
   * Reads raw file buffer from storage key across local disk and fallback paths.
   */
  static async readFileBufferFromKey(storageKey) {
    if (!storageKey || typeof storageKey !== 'string') return null;
    const clean = storageKey.trim();

    try {
      if (clean.startsWith('data:')) {
        const parts = clean.split(',');
        if (parts[1]) return Buffer.from(parts[1], 'base64');
      }

      const cleanKey = clean
        .replace(/^\/api\/assets\/view\//, '')
        .replace(/^https?:\/\/[^/]+\/api\/assets\/view\//, '')
        .replace(/^kucet\//, '')
        .replace(/^\/+/, '');

      const basePath = getLocalStorageBasePath();
      const candidatePaths = [
        path.join(basePath, 'kucet', cleanKey),
        path.join(basePath, cleanKey),
        path.join(basePath, 'internships', cleanKey),
        path.join(basePath, 'kucet', 'internships', path.basename(cleanKey)),
        path.join('/app/storage', 'kucet', cleanKey),
        path.join('/app/storage', cleanKey),
        path.join('/var/www/kucet-storage', 'kucet', cleanKey),
        path.join('/var/www/kucet-storage', cleanKey),
        path.join(process.cwd(), 'public', 'uploads', cleanKey),
        path.join(process.cwd(), 'public', 'uploads', 'kucet', cleanKey),
      ];

      for (const cand of candidatePaths) {
        if (fs.existsSync(/*turbopackIgnore: true*/ cand)) {
          const stat = fs.statSync(/*turbopackIgnore: true*/ cand);
          if (stat.isFile() && stat.size > 0) {
            return fs.readFileSync(/*turbopackIgnore: true*/ cand);
          }
        }
      }

      return null;
    } catch (err) {
      logger.warn({ storageKey, err: err.message }, '[INTERNSHIP_DOC_READ_ERROR]');
      return null;
    }
  }

  /**
   * Uploads and associates a document with a student internship record.
   */
  static async uploadDocument({
    internshipId,
    studentId,
    documentType,
    file,
    originalFilename = null,
    uploadedByUserType = 'STUDENT',
    uploadedById = null,
    ip = null,
    userAgent = null,
  }) {
    const intId = Number(internshipId);
    const stId = Number(studentId);

    if (!intId || !stId) {
      const err = new Error('Valid internship ID and student ID are required');
      err.status = 400;
      throw err;
    }

    if (!ALLOWED_DOC_TYPES.includes(documentType)) {
      const err = new Error(`Invalid document type: ${documentType}`);
      err.status = 400;
      throw err;
    }

    if (!file) {
      const err = new Error('File is required for upload');
      err.status = 400;
      throw err;
    }

    // Verify internship exists and belongs to student
    const [internship] = await db
      .select({ id: studentInternships.id, student_id: studentInternships.student_id })
      .from(studentInternships)
      .where(eq(studentInternships.id, intId))
      .limit(1);

    if (!internship) {
      const err = new Error('Internship record not found');
      err.status = 404;
      throw err;
    }

    if (uploadedByUserType === 'STUDENT' && Number(internship.student_id) !== stId) {
      const err = new Error('Unauthorized to attach documents to this internship record');
      err.status = 403;
      throw err;
    }

    // Process file buffer
    let buffer;
    let mimeType = 'application/pdf';
    let rawFilename = originalFilename || 'document.pdf';

    if (file && typeof file.arrayBuffer === 'function') {
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
      mimeType = file.type || 'application/pdf';
      rawFilename = file.name || rawFilename;
    } else if (Buffer.isBuffer(file)) {
      buffer = file;
    } else if (typeof file === 'string' && file.startsWith('data:')) {
      const matches = file.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(file, 'base64');
      }
    } else {
      const err = new Error('Unsupported file upload format');
      err.status = 400;
      throw err;
    }

    // Max 10MB limit for internship documents
    if (buffer.length > 10 * 1024 * 1024) {
      const err = new Error(`File exceeds maximum allowed size of 10MB (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
      err.status = 400;
      throw err;
    }

    const storage = getStorageProvider();
    const uploadResult = await storage.upload(buffer, 'internships');

    if (!uploadResult || !uploadResult.path) {
      throw new Error('Storage provider failed to save document');
    }

    const relativeKey = uploadResult.path; // e.g. kucet/internships/<uuid>.<ext>

    // Check versioning: find existing documents of same type for this internship
    const existingDocs = await db
      .select({ id: internshipDocuments.id, version: internshipDocuments.version })
      .from(internshipDocuments)
      .where(
        and(
          eq(internshipDocuments.internship_id, intId),
          eq(internshipDocuments.document_type, documentType)
        )
      )
      .orderBy(desc(internshipDocuments.version));

    let nextVersion = 1;
    if (existingDocs.length > 0) {
      nextVersion = (existingDocs[0].version || 1) + 1;
      // Mark previous active documents of same type as SUPERSEDED
      await db
        .update(internshipDocuments)
        .set({ verification_status: 'SUPERSEDED' })
        .where(
          and(
            eq(internshipDocuments.internship_id, intId),
            eq(internshipDocuments.document_type, documentType),
            inArray(internshipDocuments.verification_status, ['PENDING', 'REJECTED'])
          )
        );
    }

    const insertResult = await db.insert(internshipDocuments).values({
      internship_id: intId,
      student_id: stId,
      document_type: documentType,
      original_filename: rawFilename,
      storage_key: relativeKey,
      mime_type: mimeType,
      file_size_bytes: buffer.length,
      verification_status: 'PENDING',
      version: nextVersion,
      uploaded_by_user_type: uploadedByUserType,
      uploaded_by_id: uploadedById || stId,
    });

    const header = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    const newDocId = header?.insertId ? Number(header.insertId) : null;

    // Audit log
    await db.insert(internshipAuditLogs).values({
      internship_id: intId,
      actor_type: uploadedByUserType,
      actor_id: uploadedById || stId,
      action: 'DOCUMENT_UPLOADED',
      details: {
        document_id: newDocId,
        document_type: documentType,
        original_filename: rawFilename,
        storage_key: relativeKey,
        version: nextVersion,
        size_bytes: buffer.length,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    logger.info({ documentId: newDocId, internshipId: intId, documentType, version: nextVersion }, '[INTERNSHIP_DOC_UPLOADED]');

    return {
      id: newDocId,
      internship_id: intId,
      student_id: stId,
      document_type: documentType,
      original_filename: rawFilename,
      storage_key: relativeKey,
      file_size_bytes: buffer.length,
      version: nextVersion,
      verification_status: 'PENDING',
    };
  }

  /**
   * Retrieves all documents associated with an internship.
   */
  static async getDocuments(internshipId) {
    const intId = Number(internshipId);
    if (!intId) return [];

    return await db
      .select()
      .from(internshipDocuments)
      .where(eq(internshipDocuments.internship_id, intId))
      .orderBy(desc(internshipDocuments.created_at));
  }

  /**
   * Deletes an internship document.
   */
  static async deleteDocument(documentId, { studentId = null, isCoordinator = false, ip = null, userAgent = null } = {}) {
    const docId = Number(documentId);
    if (!docId) {
      const err = new Error('Valid document ID is required');
      err.status = 400;
      throw err;
    }

    const [doc] = await db
      .select()
      .from(internshipDocuments)
      .where(eq(internshipDocuments.id, docId))
      .limit(1);

    if (!doc) {
      const err = new Error('Document not found');
      err.status = 404;
      throw err;
    }

    if (!isCoordinator) {
      if (Number(doc.student_id) !== Number(studentId)) {
        const err = new Error('Unauthorized to delete this document');
        err.status = 403;
        throw err;
      }
      if (doc.verification_status === 'VERIFIED') {
        const err = new Error('Cannot delete a document that has already been verified by the coordinator');
        err.status = 400;
        throw err;
      }
    }

    // Try deleting physical file from storage provider
    try {
      const storage = getStorageProvider();
      await storage.delete(doc.storage_key);
    } catch (storageErr) {
      logger.warn({ storageKey: doc.storage_key, err: storageErr.message }, '[DOC_DELETE_STORAGE_WARN]');
    }

    await db.delete(internshipDocuments).where(eq(internshipDocuments.id, docId));

    await db.insert(internshipAuditLogs).values({
      internship_id: doc.internship_id,
      actor_type: isCoordinator ? 'STAFF' : 'STUDENT',
      actor_id: isCoordinator ? (studentId || 0) : doc.student_id,
      action: 'DOCUMENT_DELETED',
      details: {
        document_id: docId,
        document_type: doc.document_type,
        original_filename: doc.original_filename,
        storage_key: doc.storage_key,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    return { success: true, message: 'Document deleted successfully' };
  }

  /**
   * Retrieves all active documents for a student across all their registered internships.
   */
  static async getStudentDocuments(studentId) {
    const sId = Number(studentId);
    if (!sId) return [];

    const rows = await db
      .select({
        id: internshipDocuments.id,
        internship_id: internshipDocuments.internship_id,
        document_type: internshipDocuments.document_type,
        original_filename: internshipDocuments.original_filename,
        storage_key: internshipDocuments.storage_key,
        mime_type: internshipDocuments.mime_type,
        file_size_bytes: internshipDocuments.file_size_bytes,
        verification_status: internshipDocuments.verification_status,
        rejection_reason: internshipDocuments.rejection_reason,
        version: internshipDocuments.version,
        created_at: internshipDocuments.created_at,
        company_name: studentInternships.company_name,
        role_title: studentInternships.role_title,
        application_status: studentInternships.application_status,
        completion_status: studentInternships.completion_status,
      })
      .from(internshipDocuments)
      .innerJoin(studentInternships, eq(internshipDocuments.internship_id, studentInternships.id))
      .where(
        and(
          eq(internshipDocuments.student_id, sId),
          sql`${internshipDocuments.verification_status} != 'SUPERSEDED'`
        )
      )
      .orderBy(desc(internshipDocuments.created_at));

    return rows;
  }

  /**
   * Generates a structured bulk ZIP export of internship documents for authorized coordinator.
   * Folder hierarchy adhering to Part K:
   * Internship_Documents_[YEAR]/[BRANCH]/[HT_NO]_[Student_Name]/[Document_Type].pdf
   */
  static async generateBulkDocumentZip({
    branch = 'ALL',
    academicYear = 'ALL',
    status = 'ALL',
    studentIds = [],
    internshipIds = [],
    coordinatorStaffId = 0,
    ip = null,
    userAgent = null,
  } = {}) {
    // 1. Query matching internships with student details
    const conditions = [];
    if (branch && branch !== 'ALL') {
      const branchCode = Object.keys(branchCodes).find(code => branchCodes[code].toUpperCase() === branch.toUpperCase());
      if (branchCode) {
        conditions.push(or(
          like(students.roll_no, `%567T${branchCode}%`),
          like(students.roll_no, `%567${branchCode}%L`)
        ));
      }
    }
    if (academicYear && academicYear !== 'ALL') {
      const yearPrefix = academicYear.slice(2, 4);
      if (yearPrefix) {
        conditions.push(like(students.roll_no, `${yearPrefix}%`));
      }
    }
    if (status && status !== 'ALL') {
      if (status === 'COMPLETED') {
        conditions.push(eq(studentInternships.completion_status, 'VERIFIED_COMPLETED'));
      } else if (status === 'APPROVED') {
        conditions.push(eq(studentInternships.application_status, 'APPROVED'));
      }
    }
    if (studentIds && studentIds.length > 0) {
      conditions.push(inArray(studentInternships.student_id, studentIds.map(Number)));
    }
    if (internshipIds && internshipIds.length > 0) {
      conditions.push(inArray(studentInternships.id, internshipIds.map(Number)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const internshipRecords = await db
      .select({
        internship_id: studentInternships.id,
        student_id: studentInternships.student_id,
        roll_no: students.roll_no,
        student_name: students.name,
        branch: sqlStudentBranch,
        academic_year: sqlAcademicYear,
        company_name: studentInternships.company_name,
        role_title: studentInternships.role_title,
        application_status: studentInternships.application_status,
        completion_status: studentInternships.completion_status,
      })
      .from(studentInternships)
      .innerJoin(students, eq(studentInternships.student_id, students.id))
      .where(whereClause);

    if (internshipRecords.length === 0) {
      const err = new Error('No internship records match the specified criteria for bulk export');
      err.status = 404;
      throw err;
    }

    const intIds = internshipRecords.map(r => r.internship_id);

    // Fetch active documents for these internships
    const docs = await db
      .select()
      .from(internshipDocuments)
      .where(
        and(
          sql`${internshipDocuments.internship_id} IN (${sql.join(intIds, sql`, `)})`,
          sql`${internshipDocuments.verification_status} != 'SUPERSEDED'`
        )
      );

    const docMap = new Map();
    docs.forEach(d => {
      if (!docMap.has(d.internship_id)) docMap.set(d.internship_id, []);
      docMap.get(d.internship_id).push(d);
    });

    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks = [];

    const zipPromise = new Promise((resolve, reject) => {
      archive.on('data', chunk => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', err => reject(err));
    });

    // Create MANIFEST.csv
    const manifestRows = [
      ['Branch', 'Academic Year', 'Roll Number', 'Student Name', 'Company', 'Role', 'Document Type', 'Version', 'Filename', 'File Path in ZIP'].map(v => `"${v}"`).join(',')
    ];

    let filesIncluded = 0;

    for (const record of internshipRecords) {
      const safeBranch = this.sanitizePathSegment(record.branch, 'GENERAL');
      const safeYear = this.sanitizePathSegment(record.academic_year, 'UNKNOWN_YEAR');
      const safeRoll = this.sanitizePathSegment(record.roll_no, `STU_${record.student_id}`);
      const safeName = this.sanitizePathSegment(record.student_name, 'STUDENT');
      const studentFolder = `${safeRoll}_${safeName}`;
      const rootFolder = `Internship_Documents_${safeYear.replace(/-/g, '_')}`;

      const recordDocs = docMap.get(record.internship_id) || [];

      for (const d of recordDocs) {
        const fileBuffer = await this.readFileBufferFromKey(d.storage_key);
        if (!fileBuffer || fileBuffer.length === 0) continue;

        const ext = path.extname(d.original_filename) || '.pdf';
        const safeDocType = this.sanitizePathSegment(d.document_type, 'DOC');
        const fileName = `${safeDocType}_v${d.version}${ext}`;

        // Structured folder hierarchy adhering to Part K:
        // Internship_Documents_[YEAR]/[BRANCH]/[HT_NO]_[Student_Name]/[Document_Type].pdf
        const zipRelativePath = path.posix.join(
          rootFolder,
          safeBranch,
          studentFolder,
          fileName
        );

        archive.append(fileBuffer, { name: zipRelativePath });
        filesIncluded++;

        manifestRows.push([
          safeBranch,
          safeYear,
          safeRoll,
          record.student_name,
          record.company_name,
          record.role_title,
          d.document_type,
          d.version,
          d.original_filename,
          zipRelativePath
        ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
      }
    }

    const firstYear = internshipRecords[0]?.academic_year ? this.sanitizePathSegment(internshipRecords[0].academic_year, 'ALL').replace(/-/g, '_') : 'ALL';
    const mainRootFolder = `Internship_Documents_${firstYear}`;

    // Append README and MANIFEST
    archive.append(manifestRows.join('\n'), { name: `${mainRootFolder}/MANIFEST.csv` });

    const readmeContent = [
      '=========================================================================',
      'KAKATIYA UNIVERSITY COLLEGE OF ENGINEERING & TECHNOLOGY (KUCET)',
      'OFFICIAL INTERNSHIP MANAGEMENT MODULE - BULK DOCUMENT REPOSITORY EXPORT',
      '=========================================================================',
      `Generated At: ${new Date().toISOString()}`,
      `Export Scope: Branch: ${branch} | Academic Year: ${academicYear} | Status: ${status}`,
      `Total Internships Processed: ${internshipRecords.length}`,
      `Total Verified Files Archived: ${filesIncluded}`,
      '',
      'FOLDER STRUCTURE CONVENTION:',
      '  Internship_Documents_[YEAR]/[BRANCH]/[HT_NO]_[Student_Name]/[DOC_TYPE_vN.ext]',
      '',
      'All student records and verified certificates are tamper-evident and digitally',
      'managed under the authority of the KUCET Designated Internship Coordinator.',
      '========================================================================='
    ].join('\n');

    archive.append(readmeContent, { name: `${mainRootFolder}/README.txt` });

    await archive.finalize();
    const finalBuffer = await zipPromise;

    // Audit log
    await db.insert(internshipAuditLogs).values({
      actor_type: 'STAFF',
      actor_id: coordinatorStaffId,
      action: 'BULK_DOCUMENTS_EXPORTED',
      details: {
        branch,
        academic_year: academicYear,
        status,
        internships_count: internshipRecords.length,
        files_count: filesIncluded,
        zip_size_bytes: finalBuffer.length,
      },
      ip_address: ip,
      user_agent: userAgent,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const downloadFilename = `KUCET_Internship_Documents_${branch}_${academicYear}_${timestamp}.zip`;

    return {
      buffer: finalBuffer,
      filename: downloadFilename,
      fileCount: filesIncluded,
      internshipCount: internshipRecords.length,
    };
  }
}
