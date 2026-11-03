import { db } from '@/db';
import {
  labBatchAllocations,
  labBatchStudents,
  labBatchAllocationAuditLogs,
  students as studentsTable,
  syllabusSubjects
} from '@/db/schema';
import { eq, and, sql, desc, asc, or, like } from 'drizzle-orm';
import { branchCodes } from '@/lib/rollNumber';

/**
 * Service for Lab-Wise Student Batch Allocation & Scheduling Engine.
 * Dual-database compatible (TiDB Serverless & Production MySQL 8.0).
 */
export class LabBatchAllocationService {
  /**
   * Helper to parse serial number and admission type from a roll number.
   * e.g., 23567T0915 -> serial 15, regular
   *       245670966L -> serial 66, lateral
   *       245670966l -> serial 66, lateral (case-insensitive)
   * Invalid or malformed roll numbers (e.g. 'ABC', '12345', null) return { serial: null, isLateral: false }
   */
  static extractSerial(rollNo) {
    if (!rollNo || typeof rollNo !== 'string') return { serial: null, isLateral: false };
    const clean = rollNo.trim().toUpperCase();
    if (clean.length < 8) return { serial: null, isLateral: false };

    const isLateral = clean.endsWith('L');

    // Lateral: YY567BBSSL or YY567TBBSSL (e.g. 245670966L, 24567T0966L)
    if (isLateral) {
      const latMatch = clean.match(/^(\d{2})567T?(\d{2})([A-Z0-9]{2})L$/);
      if (latMatch) {
        const serialStr = latMatch[3];
        const parsedNum = parseInt(serialStr, 10);
        return { serial: isNaN(parsedNum) ? serialStr : parsedNum, isLateral: true };
      }
      return { serial: null, isLateral: true };
    }

    // Regular: YY567TBBSS (e.g. 23567T0915, 24567T3001, 22567T1566)
    const regMatch = clean.match(/^(\d{2})567T(\d{2})([A-Z0-9]{2})$/);
    if (regMatch) {
      const serialStr = regMatch[3];
      const parsedNum = parseInt(serialStr, 10);
      return { serial: isNaN(parsedNum) ? serialStr : parsedNum, isLateral: false };
    }

    // Regular variant without T (YY567BBSS):
    const regNoTMatch = clean.match(/^(\d{2})567(\d{2})([A-Z0-9]{2})$/);
    if (regNoTMatch) {
      const serialStr = regNoTMatch[3];
      const parsedNum = parseInt(serialStr, 10);
      return { serial: isNaN(parsedNum) ? serialStr : parsedNum, isLateral: false };
    }

    return { serial: null, isLateral: false };
  }

  /**
   * Fetch all active students in a cohort, ordered by roll number ascending.
   */
  static async getCohortStudents({ academicYear, branch, semester }) {
    if (!academicYear || !branch || !semester) {
      throw new Error('academicYear, branch, and semester are required');
    }

    const startYear = parseInt(String(academicYear).split('-')[0], 10);
    const studyingYear = Math.ceil(Number(semester) / 2);

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) {
      throw new Error(`Invalid branch: ${branch}`);
    }

    const rawStudents = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      academic_offset_years: studentsTable.academic_offset_years,
      student_status: studentsTable.student_status
    })
    .from(studentsTable)
    .where(and(
      eq(studentsTable.student_status, 'ACTIVE'),
      or(
        like(studentsTable.roll_no, `%567T${branchCode}%`),
        like(studentsTable.roll_no, `%567${branchCode}%L`)
      ),
      sql`CASE
          WHEN ${studentsTable.roll_no} LIKE '%T%' THEN
            (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 1) - ${studentsTable.academic_offset_years}
          WHEN ${studentsTable.roll_no} LIKE '%L' THEN
            (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 2) - ${studentsTable.academic_offset_years}
          ELSE 0
        END = ${studyingYear}`
    ))
    .orderBy(asc(studentsTable.roll_no));

    return rawStudents.map((s) => {
      const { serial, isLateral } = this.extractSerial(s.roll_no);
      return {
        id: s.id,
        roll_no: s.roll_no,
        name: s.name,
        serial_number: serial,
        is_lateral: isLateral
      };
    });
  }

  /**
   * Parse range text into matched student IDs.
   * Supports:
   * - Serials: "1-30", "01-30", "31-66" (matches students with numeric serial in range)
   * - Prefixed regular ranges: "R1-R30" (matches only regular students in serial range)
   * - Prefixed lateral ranges: "L1-L10" (matches only lateral students in serial range)
   * - Single prefixed serials: "R5", "L2"
   * - Single numeric serials: "5", "15"
   * - Exact roll numbers: "23567T0915", "245670966L"
   * Mandate: Cohort array position is never used as a substitute for verified roll-number identity.
   */
  static parseRangeToStudentIds(rangeStr, cohortStudents) {
    if (!rangeStr || typeof rangeStr !== 'string' || !Array.isArray(cohortStudents)) return new Set();
    const cleanStr = rangeStr.trim();
    if (!cleanStr) return new Set();

    const matchedIds = new Set();
    const parts = cleanStr.split(',').map(p => p.trim()).filter(Boolean);

    for (const part of parts) {
      // Check for range pattern with optional prefix R/L, e.g., "1-30", "01-30", "R1-R30", "L1-L10"
      const rangeMatch = part.match(/^([RLrl])?(\d+)\s*-\s*([RLrl])?(\d+)$/);
      if (rangeMatch) {
        const prefix = (rangeMatch[1] || rangeMatch[3] || '').toUpperCase();
        const low = parseInt(rangeMatch[2], 10);
        const high = parseInt(rangeMatch[4], 10);

        if (!isNaN(low) && !isNaN(high) && low <= high) {
          for (const st of cohortStudents) {
            if (typeof st.serial_number !== 'number') continue;

            if (prefix === 'R' && st.is_lateral) continue;
            if (prefix === 'L' && !st.is_lateral) continue;

            if (st.serial_number >= low && st.serial_number <= high) {
              matchedIds.add(st.id);
            }
          }
        }
        continue;
      }

      // Check for single prefixed number, e.g. "R5", "L2"
      const singlePrefixedMatch = part.match(/^([RLrl])(\d+)$/);
      if (singlePrefixedMatch) {
        const prefix = singlePrefixedMatch[1].toUpperCase();
        const num = parseInt(singlePrefixedMatch[2], 10);
        for (const st of cohortStudents) {
          if (typeof st.serial_number !== 'number') continue;
          if (prefix === 'R' && st.is_lateral) continue;
          if (prefix === 'L' && !st.is_lateral) continue;
          if (st.serial_number === num) {
            matchedIds.add(st.id);
          }
        }
        continue;
      }

      // Check for single number without prefix, e.g. "5", "05"
      const singleNum = parseInt(part, 10);
      if (!isNaN(singleNum) && /^\d+$/.test(part)) {
        for (const st of cohortStudents) {
          if (typeof st.serial_number === 'number' && st.serial_number === singleNum) {
            matchedIds.add(st.id);
          }
        }
        continue;
      }

      // Exact roll number match (e.g. "23567T0915", "245670966L")
      const found = cohortStudents.find(st => st.roll_no && st.roll_no.toUpperCase() === part.toUpperCase());
      if (found) {
        matchedIds.add(found.id);
      }
    }

    return matchedIds;
  }

  /**
   * Preview batch allocation without persisting to database.
   * Validates disjointness and computes summary counts.
   */
  static async previewBatchAllocation({
    academicYear,
    branch,
    semester,
    batch1Range,
    batch2Range,
    manualOverrides = {} // { [studentId]: 1 | 2 | 0 }
  }) {
    const cohortStudents = await this.getCohortStudents({ academicYear, branch, semester });
    const b1FromRange = this.parseRangeToStudentIds(batch1Range, cohortStudents);
    const b2FromRange = this.parseRangeToStudentIds(batch2Range, cohortStudents);

    const b1StudentIds = new Set();
    const b2StudentIds = new Set();

    for (const st of cohortStudents) {
      const override = manualOverrides[st.id] !== undefined ? Number(manualOverrides[st.id]) : null;

      if (override === 1) {
        b1StudentIds.add(st.id);
      } else if (override === 2) {
        b2StudentIds.add(st.id);
      } else if (override === 0) {
        // Explicitly unallocated
        continue;
      } else {
        // Follow ranges
        const inB1 = b1FromRange.has(st.id);
        const inB2 = b2FromRange.has(st.id);

        if (inB1 && inB2) {
          throw new Error(`Student ${st.roll_no} (${st.name}) is matched in both Batch 1 and Batch 2 ranges. Please adjust ranges or use manual assignment.`);
        }

        if (inB1) b1StudentIds.add(st.id);
        else if (inB2) b2StudentIds.add(st.id);
      }
    }

    // Disjointness check
    for (const id of b1StudentIds) {
      if (b2StudentIds.has(id)) {
        const dupStudent = cohortStudents.find(s => s.id === id);
        throw new Error(`Disjointness violation: Student ${dupStudent?.roll_no || id} cannot belong to both Batch 1 and Batch 2.`);
      }
    }

    const batch1Students = cohortStudents.filter(s => b1StudentIds.has(s.id));
    const batch2Students = cohortStudents.filter(s => b2StudentIds.has(s.id));
    const unallocatedStudents = cohortStudents.filter(s => !b1StudentIds.has(s.id) && !b2StudentIds.has(s.id));

    return {
      total_cohort_students: cohortStudents.length,
      batch_1_count: batch1Students.length,
      batch_2_count: batch2Students.length,
      unallocated_count: unallocatedStudents.length,
      batch_1_students: batch1Students,
      batch_2_students: batch2Students,
      unallocated_students: unallocatedStudents
    };
  }

  /**
   * Save or update lab batch allocation.
   */
  static async saveAllocation({
    academicYear,
    branch,
    semester,
    subjectCode,
    batch1Name = 'Batch 1',
    batch2Name = 'Batch 2',
    batch1StudentIds = [],
    batch2StudentIds = [],
    staffId = null,
    changeReason = null,
    autoPublish = false
  }) {
    if (!academicYear || !branch || !semester || !subjectCode) {
      throw new Error('academicYear, branch, semester, and subjectCode are required');
    }

    // Verify disjointness
    const b1Set = new Set(batch1StudentIds.map(Number));
    const b2Set = new Set(batch2StudentIds.map(Number));

    for (const id of b1Set) {
      if (b2Set.has(id)) {
        throw new Error(`Conflict: Student ID ${id} is assigned to both Batch 1 and Batch 2.`);
      }
    }

    return await db.transaction(async (tx) => {
      // Find existing latest allocation
      const existing = await tx.select()
        .from(labBatchAllocations)
        .where(and(
          eq(labBatchAllocations.academic_year, academicYear),
          eq(labBatchAllocations.branch, branch),
          eq(labBatchAllocations.semester, Number(semester)),
          eq(labBatchAllocations.subject_code, subjectCode)
        ))
        .orderBy(desc(labBatchAllocations.version))
        .limit(1);

      let targetAllocationId;
      let newVersion = 1;
      let actionType = 'CREATED';

      const existingRecord = existing[0] || null;

      if (existingRecord) {
        if (existingRecord.status === 'DRAFT') {
          // Update draft in place
          targetAllocationId = existingRecord.id;
          newVersion = existingRecord.version;
          actionType = autoPublish ? 'PUBLISHED' : 'UPDATED';

          await tx.update(labBatchAllocations)
            .set({
              batch_1_name: batch1Name || 'Batch 1',
              batch_2_name: batch2Name || 'Batch 2',
              status: autoPublish ? 'PUBLISHED' : 'DRAFT',
              published_at: autoPublish ? sql`NOW()` : null,
              change_reason: changeReason || existingRecord.change_reason,
              created_by_staff_id: staffId || existingRecord.created_by_staff_id
            })
            .where(eq(labBatchAllocations.id, targetAllocationId));

          // Clean up old students
          await tx.delete(labBatchStudents)
            .where(eq(labBatchStudents.allocation_id, targetAllocationId));
        } else {
          // If existing was PUBLISHED or ARCHIVED, create next version
          newVersion = existingRecord.version + 1;
          actionType = autoPublish ? 'PUBLISHED' : 'UPDATED';

          // Archive old version if publishing new one
          if (autoPublish) {
            await tx.update(labBatchAllocations)
              .set({ status: 'ARCHIVED' })
              .where(eq(labBatchAllocations.id, existingRecord.id));
          }

          const [ins] = await tx.insert(labBatchAllocations).values({
            academic_year: academicYear,
            branch,
            semester: Number(semester),
            subject_code: subjectCode,
            batch_1_name: batch1Name || 'Batch 1',
            batch_2_name: batch2Name || 'Batch 2',
            status: autoPublish ? 'PUBLISHED' : 'DRAFT',
            version: newVersion,
            created_by_staff_id: staffId,
            published_at: autoPublish ? sql`NOW()` : null,
            change_reason: changeReason
          });
          targetAllocationId = ins.insertId;
        }
      } else {
        // Brand new allocation
        const [ins] = await tx.insert(labBatchAllocations).values({
          academic_year: academicYear,
          branch,
          semester: Number(semester),
          subject_code: subjectCode,
          batch_1_name: batch1Name || 'Batch 1',
          batch_2_name: batch2Name || 'Batch 2',
          status: autoPublish ? 'PUBLISHED' : 'DRAFT',
          version: 1,
          created_by_staff_id: staffId,
          published_at: autoPublish ? sql`NOW()` : null,
          change_reason: changeReason
        });
        targetAllocationId = ins.insertId;
        actionType = autoPublish ? 'PUBLISHED' : 'CREATED';
      }

      // Insert students
      const studentInserts = [];
      for (const id of b1Set) {
        studentInserts.push({
          allocation_id: targetAllocationId,
          student_id: id,
          batch_number: 1
        });
      }
      for (const id of b2Set) {
        studentInserts.push({
          allocation_id: targetAllocationId,
          student_id: id,
          batch_number: 2
        });
      }

      if (studentInserts.length > 0) {
        await tx.insert(labBatchStudents).values(studentInserts);
      }

      // Record Audit Log
      await tx.insert(labBatchAllocationAuditLogs).values({
        allocation_id: targetAllocationId,
        version: newVersion,
        action: actionType,
        performed_by_staff_id: staffId || 0,
        reason: changeReason,
        metadata: {
          batch_1_count: b1Set.size,
          batch_2_count: b2Set.size,
          total_allocated: b1Set.size + b2Set.size
        }
      });

      return {
        id: targetAllocationId,
        version: newVersion,
        status: autoPublish ? 'PUBLISHED' : 'DRAFT',
        batch_1_count: b1Set.size,
        batch_2_count: b2Set.size
      };
    });
  }

  /**
   * Publish an existing DRAFT allocation.
   */
  static async publishAllocation({ allocationId, staffId, reason = 'Published by HOD' }) {
    if (!allocationId) throw new Error('allocationId is required');

    return await db.transaction(async (tx) => {
      const [alloc] = await tx.select()
        .from(labBatchAllocations)
        .where(eq(labBatchAllocations.id, allocationId));

      if (!alloc) throw new Error('Allocation not found');

      // Archive any prior published version for this subject/cohort
      await tx.update(labBatchAllocations)
        .set({ status: 'ARCHIVED' })
        .where(and(
          eq(labBatchAllocations.academic_year, alloc.academic_year),
          eq(labBatchAllocations.branch, alloc.branch),
          eq(labBatchAllocations.semester, alloc.semester),
          eq(labBatchAllocations.subject_code, alloc.subject_code),
          eq(labBatchAllocations.status, 'PUBLISHED')
        ));

      // Publish target allocation
      await tx.update(labBatchAllocations)
        .set({
          status: 'PUBLISHED',
          published_at: sql`NOW()`
        })
        .where(eq(labBatchAllocations.id, allocationId));

      // Audit Log
      await tx.insert(labBatchAllocationAuditLogs).values({
        allocation_id: allocationId,
        version: alloc.version,
        action: 'PUBLISHED',
        performed_by_staff_id: staffId || 0,
        reason
      });

      return { success: true, message: 'Lab batch allocation published successfully' };
    });
  }

  /**
   * Get allocation details with student rosters for Batch 1 and Batch 2.
   */
  static async getAllocation({ academicYear, branch, semester, subjectCode, allocationId = null }) {
    let alloc = null;

    if (allocationId) {
      const rows = await db.select().from(labBatchAllocations).where(eq(labBatchAllocations.id, allocationId));
      alloc = rows[0] || null;
    } else {
      // Find active or latest
      const rows = await db.select()
        .from(labBatchAllocations)
        .where(and(
          eq(labBatchAllocations.academic_year, academicYear),
          eq(labBatchAllocations.branch, branch),
          eq(labBatchAllocations.semester, Number(semester)),
          eq(labBatchAllocations.subject_code, subjectCode)
        ))
        .orderBy(desc(labBatchAllocations.version))
        .limit(1);
      alloc = rows[0] || null;
    }

    if (!alloc) return null;

    // Fetch cohort students
    const cohortStudents = await this.getCohortStudents({
      academicYear: alloc.academic_year,
      branch: alloc.branch,
      semester: alloc.semester
    });

    // Fetch batch student records
    const batchStudentRows = await db.select({
      student_id: labBatchStudents.student_id,
      batch_number: labBatchStudents.batch_number
    })
    .from(labBatchStudents)
    .where(eq(labBatchStudents.allocation_id, alloc.id));

    const batchMap = new Map(batchStudentRows.map(r => [r.student_id, r.batch_number]));

    const batch1Students = [];
    const batch2Students = [];
    const unallocatedStudents = [];

    for (const st of cohortStudents) {
      const bNum = batchMap.get(st.id);
      if (bNum === 1) batch1Students.push(st);
      else if (bNum === 2) batch2Students.push(st);
      else unallocatedStudents.push(st);
    }

    return {
      allocation: alloc,
      batch_1_students: batch1Students,
      batch_2_students: batch2Students,
      unallocated_students: unallocatedStudents,
      counts: {
        total: cohortStudents.length,
        batch_1: batch1Students.length,
        batch_2: batch2Students.length,
        unallocated: unallocatedStudents.length
      }
    };
  }

  /**
   * Fast lookup of student's batch number for a specific lab subject.
   */
  static async getStudentBatch({ studentId, academicYear, branch, semester, subjectCode }) {
    if (!studentId || !academicYear || !branch || !semester || !subjectCode) {
      return null;
    }

    const rows = await db.select({
      batch_number: labBatchStudents.batch_number
    })
    .from(labBatchStudents)
    .innerJoin(labBatchAllocations, eq(labBatchStudents.allocation_id, labBatchAllocations.id))
    .where(and(
      eq(labBatchStudents.student_id, Number(studentId)),
      eq(labBatchAllocations.academic_year, academicYear),
      eq(labBatchAllocations.branch, branch),
      eq(labBatchAllocations.semester, Number(semester)),
      eq(labBatchAllocations.subject_code, subjectCode),
      eq(labBatchAllocations.status, 'PUBLISHED')
    ))
    .limit(1);

    return rows[0]?.batch_number || null;
  }

  /**
   * List all lab allocations for a cohort.
   */
  static async listCohortAllocations({ academicYear, branch, semester }) {
    return await db.select({
      id: labBatchAllocations.id,
      subject_code: labBatchAllocations.subject_code,
      batch_1_name: labBatchAllocations.batch_1_name,
      batch_2_name: labBatchAllocations.batch_2_name,
      status: labBatchAllocations.status,
      version: labBatchAllocations.version,
      published_at: labBatchAllocations.published_at,
      subject_name: syllabusSubjects.subject_name
    })
    .from(labBatchAllocations)
    .leftJoin(syllabusSubjects, eq(labBatchAllocations.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(labBatchAllocations.academic_year, academicYear),
      eq(labBatchAllocations.branch, branch),
      eq(labBatchAllocations.semester, Number(semester))
    ))
    .orderBy(desc(labBatchAllocations.version));
  }
}
