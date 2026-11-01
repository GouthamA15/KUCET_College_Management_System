import fs from 'fs';
import path from 'path';
import React from 'react';
import { db } from '@/db';
import {
  facultySubjectAssignments,
  studentMarks,
  students as studentsTable,
  staffAccounts,
  syllabusSubjects,
  facultySubstitutions
} from '@/db/schema';
import { eq, and, asc, sql, or, like } from 'drizzle-orm';
import { branchCodes } from '@/lib/rollNumber';
import { formatDateTime } from '@/lib/date';
import { Clock } from '@/lib/clock';
import {
  resolveCanonicalSubjectType,
  normalizeEvaluationView,
  getEvaluationPdfFilename,
  getEvaluationReportTitle
} from '@/lib/academic-utils';
import { getTheoryPattern } from '@/lib/evaluation-utils';
import { pdf } from '@react-pdf/renderer';
import EvaluationReportPDF from '@/pdf/templates/EvaluationReportPDF';
import logger from '@/lib/logger';

export class EvaluationReportService {
  /**
   * Authoritative data retrieval and marks aggregation for PDF report export.
   */
  static async getReportData({ assignmentId, view = 'overview', user, request }) {
    if (!user) {
      const err = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }

    const aid = Number(assignmentId);
    if (!aid || !Number.isInteger(aid) || aid <= 0) {
      const err = new Error('Invalid assignment ID');
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch assignment details with canonical syllabus subject type and faculty info
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      staff_account_id: facultySubjectAssignments.staff_account_id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_term: facultySubjectAssignments.academic_term,
      academic_year: facultySubjectAssignments.academic_year,
      mid_max: facultySubjectAssignments.mid_max,
      faculty_name: staffAccounts.name,
      faculty_email: staffAccounts.email,
      canonical_subject_type: syllabusSubjects.subject_type
    })
    .from(facultySubjectAssignments)
    .leftJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .leftJoin(syllabusSubjects, eq(facultySubjectAssignments.subject_code, syllabusSubjects.subject_code))
    .where(eq(facultySubjectAssignments.id, aid))
    .limit(1);

    if (assignments.length === 0) {
      const err = new Error('Assignment not found');
      err.statusCode = 404;
      throw err;
    }

    const assignment = assignments[0];
    const { branch, course_semester, academic_year, subject_name, subject_code, canonical_subject_type } = assignment;

    // 2. Authorization check
    let isAuthorized = false;
    if (user.role === 'admin' || assignment.staff_account_id === user.id) {
      isAuthorized = true;
    } else if (user.is_principal) {
      isAuthorized = true;
    } else if (user.is_hod) {
      const authorizedBranches = (user.authorized_branches || (user.branch ? [user.branch] : [])).map(b => String(b).toUpperCase());
      const asgnBranch = String(branch || '').toUpperCase();
      if (authorizedBranches.includes(asgnBranch) || !branch) {
        isAuthorized = true;
      }
    } else if (user.is_first_year_coordinator && (course_semester === 1 || course_semester === 2)) {
      isAuthorized = true;
    } else {
      // Check for substitute allocation
      const sub = await db.select({ id: facultySubstitutions.id })
        .from(facultySubstitutions)
        .where(and(
          eq(facultySubstitutions.original_assignment_id, aid),
          eq(facultySubstitutions.substitute_faculty_id, user.id)
        ))
        .limit(1);
      if (sub.length > 0) isAuthorized = true;
    }

    if (!isAuthorized) {
      const err = new Error('Forbidden: You do not have permission to export evaluation for this assignment');
      err.statusCode = 403;
      throw err;
    }

    // 3. Resolve canonical subject classification
    const classification = resolveCanonicalSubjectType({
      subject_code,
      subject_name,
      canonical_subject_type
    });

    if (classification.status === 'UNRESOLVED' || !classification.subject_type) {
      logger.error({ assignmentId: aid, subject_code, subject_name }, '[EVAL_EXPORT_REJECTED] Unresolved subject type in syllabus catalogue');
      const err = new Error('Cannot export evaluation report: Subject classification is unresolved in syllabus catalogue. Please contact administration.');
      err.statusCode = 422;
      throw err;
    }

    const isLab = classification.is_lab;
    const normalizedView = normalizeEvaluationView(view, isLab);
    const midMax = assignment.mid_max || 20;
    const pattern = !isLab ? getTheoryPattern(midMax) : null;

    if (!isLab && midMax === 30 && normalizedView === 'assignment') {
      const err = new Error('Assignment assessment report is not applicable for Pattern 3 (30 for Mids).');
      err.statusCode = 400;
      throw err;
    }

    // 4. Resolve canonical assignment ID for shared classes
    const canonicalRows = await db.select({ id: facultySubjectAssignments.id })
      .from(facultySubjectAssignments)
      .where(and(
        eq(facultySubjectAssignments.subject_code, subject_code),
        eq(facultySubjectAssignments.branch, branch),
        eq(facultySubjectAssignments.course_semester, course_semester),
        eq(facultySubjectAssignments.academic_year, academic_year)
      ))
      .orderBy(asc(facultySubjectAssignments.created_at))
      .limit(1);

    const canonicalId = canonicalRows[0]?.id || aid;

    // 5. Semester-aware roll number filtering
    const startYear = parseInt(academic_year.split('-')[0], 10);
    const studyingYear = Math.ceil(course_semester / 2);

    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) {
      const err = new Error('Invalid branch in assignment');
      err.statusCode = 400;
      throw err;
    }

    const studentConditions = [
      like(studentsTable.roll_no, `%567T${branchCode}%`),
      like(studentsTable.roll_no, `%567${branchCode}%L`)
    ];

    const dynamicYearCondition = sql`CASE
        WHEN ${studentsTable.roll_no} LIKE '%T%' THEN
          (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 1) - ${studentsTable.academic_offset_years}
        WHEN ${studentsTable.roll_no} LIKE '%L' THEN
          (${startYear} - CAST(CONCAT('20', SUBSTRING(${studentsTable.roll_no}, 1, 2)) AS SIGNED) + 2) - ${studentsTable.academic_offset_years}
        ELSE 0
      END = ${studyingYear}`;

    const studentRows = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      is_published: studentMarks.is_published,
      _marks_row_id: studentMarks.id,
      _marks_created_at: studentMarks.created_at,
      _marks_updated_at: studentMarks.updated_at,
      _marks_version: studentMarks.version,
      mid1_marks: studentMarks.mid1_marks,
      mid2_marks: studentMarks.mid2_marks,
      assignment_marks: studentMarks.assignment_marks,
      lab_theory_marks: studentMarks.lab_theory_marks,
      lab_execution_marks: studentMarks.lab_execution_marks,
      lab_record_marks: studentMarks.lab_record_marks
    })
    .from(studentsTable)
    .leftJoin(studentMarks, and(
      eq(studentsTable.id, studentMarks.student_id),
      eq(studentMarks.assignment_id, canonicalId)
    ))
    .where(and(
      eq(studentsTable.student_status, 'ACTIVE'),
      or(...studentConditions),
      dynamicYearCondition
    ))
    .orderBy(asc(studentsTable.roll_no));

    // Deduplicate by student id, keeping newest marks row
    const pickNewest = (a, b) => {
      const aTime = a._marks_updated_at || a._marks_created_at || null;
      const bTime = b._marks_updated_at || b._marks_created_at || null;
      const aMs = aTime ? new Date(aTime).getTime() : 0;
      const bMs = bTime ? new Date(bTime).getTime() : 0;
      if (aMs !== bMs) return bMs > aMs ? b : a;
      return (b._marks_row_id || 0) > (a._marks_row_id || 0) ? b : a;
    };

    const dedupedMap = new Map();
    for (const row of studentRows) {
      const existing = dedupedMap.get(row.id);
      dedupedMap.set(row.id, existing ? pickNewest(existing, row) : row);
    }

    const toNumberOrNull = (val) => {
      if (val === null || val === undefined || val === '') return null;
      const n = typeof val === 'number' ? val : parseFloat(String(val));
      return Number.isFinite(n) ? n : null;
    };

    // 6. Map and aggregate student marks according to canonical rules
    const formattedStudents = Array.from(dedupedMap.values()).map(s => {
      // Raw components
      const c1Raw = isLab ? s.lab_execution_marks : s.mid1_marks;
      const c2Raw = isLab ? s.lab_theory_marks : s.mid2_marks;
      const c3Raw = isLab ? s.lab_record_marks : s.assignment_marks;

      const c1 = toNumberOrNull(c1Raw);
      const c2 = toNumberOrNull(c2Raw);
      const c3 = toNumberOrNull(c3Raw);

      // Compute total matching MarksEntrySheet logic
      const hasAny = c1 !== null || c2 !== null || (!isLab && midMax === 30 ? false : c3 !== null);
      let total = null;
      if (hasAny) {
        if (isLab) {
          total = (c1 ?? 0) + (c2 ?? 0) + (c3 ?? 0);
        } else if (midMax === 30) {
          total = Math.max(c1 ?? 0, c2 ?? 0);
        } else {
          total = Math.max(c1 ?? 0, c2 ?? 0) + (c3 ?? 0);
        }
        total = Math.round(total * 100) / 100;
      }

      // Single component mark selection
      let singleMark = null;
      if (normalizedView === 'mid1' || normalizedView === 'execution') singleMark = c1;
      else if (normalizedView === 'mid2' || normalizedView === 'writing') singleMark = c2;
      else if (normalizedView === 'assignment' || normalizedView === 'record') singleMark = c3;

      return {
        id: s.id,
        roll_no: s.roll_no,
        name: s.name,
        is_published: Boolean(s.is_published),
        c1_marks: c1,
        c2_marks: c2,
        c3_marks: c3,
        total_marks: total,
        mark: singleMark
      };
    });

    // 7. Calculate Statistical Metrics
    const totalStudents = formattedStudents.length;
    let recordedCount = 0;
    let publishedCount = 0;
    const valuesForStats = [];

    for (const st of formattedStudents) {
      if (st.is_published) publishedCount += 1;

      if (normalizedView === 'overview') {
        if (st.total_marks !== null) {
          recordedCount += 1;
          valuesForStats.push(st.total_marks);
        }
      } else {
        if (st.mark !== null) {
          recordedCount += 1;
          valuesForStats.push(st.mark);
        }
      }
    }

    const missingCount = totalStudents - recordedCount;
    const completionRate = totalStudents > 0 ? Math.round((recordedCount / totalStudents) * 100) : 0;
    const isPublished = totalStudents > 0 && publishedCount === totalStudents;

    let average = null;
    let highest = null;
    let lowest = null;

    if (valuesForStats.length > 0) {
      const sum = valuesForStats.reduce((acc, val) => acc + val, 0);
      average = Math.round((sum / valuesForStats.length) * 100) / 100;
      highest = Math.max(...valuesForStats);
      lowest = Math.min(...valuesForStats);
    }

    const stats = {
      totalStudents,
      recordedCount,
      missingCount,
      publishedCount,
      completionRate,
      average,
      highest,
      lowest
    };

    // 8. Institutional Logo loading
    let logoDataUrl = null;
    const candidateLogoPaths = [
      path.join(process.cwd(), 'public/assets/ku-college-logo.png'),
      path.join(process.cwd(), 'public/assets/ku-logo.png')
    ];
    for (const logoPath of candidateLogoPaths) {
      if (fs.existsSync(/*turbopackIgnore: true*/ logoPath)) {
        const logoBuf = fs.readFileSync(/*turbopackIgnore: true*/ logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
        break;
      }
    }

    const generationTimestamp = formatDateTime(Clock.now(request));
    const reportTitle = getEvaluationReportTitle({
      subjectName: subject_name,
      subjectCode: subject_code,
      view: normalizedView,
      isLab
    });

    const filename = getEvaluationPdfFilename({
      branch,
      subjectCode: subject_code,
      view: normalizedView,
      academicYear: academic_year,
      isLab
    });

    return {
      logoUrl: logoDataUrl,
      collegeName: 'KU College of Engineering & Technology',
      universityName: 'Kakatiya University Campus, Warangal – 506009, Telangana, India',
      branch,
      semester: course_semester,
      academicYear: academic_year,
      subjectCode: subject_code,
      subjectName: assignment.subject_name,
      subjectType: classification.subject_type,
      view: normalizedView,
      reportTitle,
      facultyName: assignment.faculty_name || user.full_name || user.name || 'Course Faculty',
      generationTimestamp,
      isPublished,
      midMax,
      pattern,
      patternName: pattern ? pattern.name : (isLab ? 'Practical / Laboratory' : 'Pattern 1 — 20 + 10'),
      patternSummary: pattern ? pattern.summary : '',
      students: formattedStudents,
      stats,
      filename
    };
  }

  /**
   * Generates a binary PDF buffer from report data.
   */
  static async generatePdfBuffer(reportData) {
    const stream = await pdf(
      React.createElement(EvaluationReportPDF, reportData)
    ).toBuffer();

    if (Buffer.isBuffer(stream)) {
      return stream;
    }

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }
}
