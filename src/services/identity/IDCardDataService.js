import crypto from 'crypto';
import QRCode from 'qrcode';
import logger from '@/lib/logger';
import { getAssetUrl } from '@/lib/assets';
import { getStorageProvider } from '@/lib/providers/storage/factory';
import { db } from '@/db';
import { studentAdmissionDrafts, studentImages, students as studentsTable, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import reconciledDataset from '@/lib/data/reconciled-students-2026.json';

// In-memory runtime override store for dynamically uploaded / rectified photos
const runtimePhotoOverrides = new Map();

export class IDCardDataService {
  /**
   * Retrieves all reconciled student records, applying runtime overrides.
   */
  static getAllRecords() {
    return reconciledDataset.map((student) => {
      const cleanRoll = String(student.rollNo || '').toUpperCase().trim();
      if (runtimePhotoOverrides.has(cleanRoll)) {
        const overrideKey = runtimePhotoOverrides.get(cleanRoll);
        return {
          ...student,
          photoKey: overrideKey,
          photoStatus: overrideKey ? 'AVAILABLE' : 'MISSING',
        };
      }
      return student;
    });
  }

  /**
   * Query student records with pagination, filtering, search, and stats calculation.
   */
  static async getStudentRecords({
    branch = 'ALL',
    search = '',
    photoStatus = 'ALL',
    addressStatus = 'ALL',
    phoneStatus = 'ALL',
    page = 1,
    limit = 20,
    allowedBranches = null,
  } = {}) {
    let records = await this.getAllRecords();

    // 1. Departmental scoping (HOD / Faculty restricted branches)
    if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
      const allowedSet = new Set(allowedBranches.map((b) => String(b).toUpperCase().trim()));
      records = records.filter((r) => allowedSet.has(String(r.branch).toUpperCase().trim()));
    }

    // 2. Global statistics across the authorized scope
    const totalInScope = records.length;
    let photosAvailable = 0;
    let photosMissing = 0;
    let addressesAvailable = 0;
    let addressesNeedsReview = 0;
    let addressesMissing = 0;
    let phonesAvailable = 0;
    let phonesMissing = 0;
    const branchCounts = {};

    for (const r of records) {
      const b = r.branch || 'OTHER';
      branchCounts[b] = (branchCounts[b] || 0) + 1;

      if (r.photoStatus === 'AVAILABLE') photosAvailable++;
      else photosMissing++;

      if (r.addressStatus === 'AVAILABLE') addressesAvailable++;
      else if (r.addressStatus === 'NEEDS_REVIEW' || r.addressStatus === 'PARTIAL') addressesNeedsReview++;
      else addressesMissing++;

      if (r.phoneStatus === 'AVAILABLE') phonesAvailable++;
      else phonesMissing++;
    }

    // 3. User Filter: Branch
    if (branch && branch !== 'ALL') {
      const normBranch = String(branch).toUpperCase().trim();
      records = records.filter((r) => String(r.branch).toUpperCase().trim() === normBranch);
    }

    // 4. User Filter: Photo Status
    if (photoStatus && photoStatus !== 'ALL') {
      const normPhoto = String(photoStatus).toUpperCase().trim();
      records = records.filter((r) => String(r.photoStatus).toUpperCase().trim() === normPhoto);
    }

    // 5. User Filter: Address Status
    if (addressStatus && addressStatus !== 'ALL') {
      const normAddr = String(addressStatus).toUpperCase().trim();
      records = records.filter((r) => String(r.addressStatus).toUpperCase().trim() === normAddr);
    }

    // 6. User Filter: Phone Status
    if (phoneStatus && phoneStatus !== 'ALL') {
      const normPhone = String(phoneStatus).toUpperCase().trim();
      records = records.filter((r) => String(r.phoneStatus).toUpperCase().trim() === normPhone);
    }

    // 7. Search filter (Roll No, Student Name, Admission Name, Father Name, Phone)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter((r) => {
        return (
          (r.rollNo && r.rollNo.toLowerCase().includes(q)) ||
          (r.studentName && r.studentName.toLowerCase().includes(q)) ||
          (r.admissionFormName && r.admissionFormName.toLowerCase().includes(q)) ||
          (r.fatherName && r.fatherName.toLowerCase().includes(q)) ||
          (r.studentPhone && r.studentPhone.includes(q))
        );
      });
    }

    const filteredTotal = records.length;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const totalPages = Math.ceil(filteredTotal / safeLimit) || 1;
    const offset = (safePage - 1) * safeLimit;

    const paginated = records.slice(offset, offset + safeLimit).map((item) => {
      return {
        ...item,
        photoUrl: item.photoKey ? getAssetUrl(item.photoKey) : null,
      };
    });

    return {
      students: paginated,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: filteredTotal,
        totalPages,
      },
      stats: {
        totalInScope,
        photosAvailable,
        photosMissing,
        addressesAvailable,
        addressesNeedsReview,
        addressesMissing,
        phonesAvailable,
        phonesMissing,
        branchCounts,
      },
    };
  }

  /**
   * Retrieves single student details for ID card preview or generation
   */
  static async getStudentRecordByRollNo(rollNo) {
    if (!rollNo) return null;
    const cleanRoll = String(rollNo).toUpperCase().trim();
    const records = await this.getAllRecords();
    const student = records.find((r) => String(r.rollNo).toUpperCase().trim() === cleanRoll);

    if (!student) return null;

    // Generate Verification QR Code
    let qrUrl = null;
    try {
      const qrPayload = JSON.stringify({
        roll: student.rollNo,
        name: student.studentName,
        branch: student.branch,
        batch: student.academicYear,
      });
      qrUrl = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 120,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (err) {
      logger.warn({ roll: student.rollNo, err: err.message }, 'Failed to generate QR code for ID card');
    }

    const photoUrl = student.photoKey ? getAssetUrl(student.photoKey) : null;

    return {
      ...student,
      photoUrl,
      qrUrl,
    };
  }

  /**
   * Retrieves bulk student records for batch PDF generation
   */
  static async getStudentsForBulk(rollNos, allowedBranches = null) {
    if (!Array.isArray(rollNos) || rollNos.length === 0) return [];

    const rollSet = new Set(rollNos.map((r) => String(r).toUpperCase().trim()));
    const records = await this.getAllRecords();

    let matches = records.filter((r) => rollSet.has(String(r.rollNo).toUpperCase().trim()));

    // Apply branch scope if needed
    if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
      const allowedSet = new Set(allowedBranches.map((b) => String(b).toUpperCase().trim()));
      matches = matches.filter((r) => allowedSet.has(String(r.branch).toUpperCase().trim()));
    }

    // Format each record with QR code and resolved photo URL
    const enriched = await Promise.all(
      matches.map(async (student) => {
        let qrUrl = null;
        try {
          const qrPayload = JSON.stringify({
            roll: student.rollNo,
            name: student.studentName,
            branch: student.branch,
            batch: student.academicYear,
          });
          qrUrl = await QRCode.toDataURL(qrPayload, {
            margin: 1,
            width: 120,
            color: { dark: '#000000', light: '#ffffff' },
          });
        } catch (err) {
          logger.debug({ roll: student.rollNo, err: err.message }, 'Bulk QR generation skipped');
        }

        const photoUrl = student.photoKey ? getAssetUrl(student.photoKey) : null;

        return {
          studentName: student.studentName,
          fatherName: student.fatherName,
          admissionNo: student.rollNo,
          course: student.branch,
          batch: student.academicYear,
          address: student.studentAddress,
          mobile: student.studentPhone,
          pfpUrl: photoUrl,
          qrUrl,
          photoStatus: student.photoStatus,
        };
      })
    );

    return enriched;
  }

  /**
   * Uploads and rectifies a student photo.
   * Updates DB storage, logs an audit trail, and caches the runtime override.
   */
  static async updateStudentPhoto({
    rollNo,
    fileBuffer,
    mimeType = 'image/webp',
    extension = 'webp',
    updatedByStaffId = null,
    ip = '127.0.0.1',
    userAgent = 'System',
  }) {
    if (!rollNo || !fileBuffer) {
      throw new Error('Roll number and image file buffer are required');
    }

    const cleanRoll = String(rollNo).toUpperCase().trim();
    const student = await this.getStudentRecordByRollNo(cleanRoll);
    if (!student) {
      throw new Error(`Student with roll number ${cleanRoll} not found`);
    }

    const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const relativeKey = `kucet/students/pfp/${uuid}.${extension}`;

    // 1. Upload to storage provider
    const storage = getStorageProvider();
    await storage.uploadFile(fileBuffer, relativeKey, mimeType);

    // 2. Store in runtime override
    runtimePhotoOverrides.set(cleanRoll, relativeKey);

    // 3. Attempt database persistence
    try {
      if (student.admissionStatus === 'FINALIZED') {
        // Finalized: locate student in studentsTable
        const sRows = await db
          .select({ id: studentsTable.id })
          .from(studentsTable)
          .where(eq(studentsTable.roll_no, cleanRoll))
          .limit(1);

        if (sRows.length > 0) {
          const studentId = sRows[0].id;
          const imgRows = await db
            .select({ student_id: studentImages.student_id })
            .from(studentImages)
            .where(eq(studentImages.student_id, studentId))
            .limit(1);

          if (imgRows.length > 0) {
            await db
              .update(studentImages)
              .set({ pfp: relativeKey })
              .where(eq(studentImages.student_id, studentId));
          } else {
            await db.insert(studentImages).values({
              student_id: studentId,
              pfp: relativeKey,
            });
          }
        }
      } else if (student.admissionId) {
        // Draft: update studentAdmissionDrafts
        await db
          .update(studentAdmissionDrafts)
          .set({
            pfp: relativeKey,
            updated_at: new Date(),
          })
          .where(eq(studentAdmissionDrafts.id, student.admissionId));
      }
    } catch (dbErr) {
      logger.warn({ roll: cleanRoll, err: dbErr.message }, 'Failed to persist photo update to database directly; runtime override active');
    }

    // 4. Audit Log
    try {
      await db.insert(auditLogs).values({
        user_id: updatedByStaffId || null,
        user_type: 'staff',
        action: 'ID_CARD_PHOTO_UPLOAD',
        target_id: cleanRoll,
        target_type: 'student_photo',
        payload_before: student.photoKey ? JSON.stringify({ pfp: student.photoKey }) : null,
        payload_after: JSON.stringify({ pfp: relativeKey, updated_at: new Date().toISOString() }),
        ip_address: ip,
        user_agent: userAgent,
      });
    } catch (auditErr) {
      logger.warn({ roll: cleanRoll, err: auditErr.message }, 'Failed to record audit log for ID card photo upload');
    }

    return {
      success: true,
      rollNo: cleanRoll,
      photoKey: relativeKey,
      photoUrl: getAssetUrl(relativeKey),
    };
  }
}
