import { db } from '@/db';
import {
  students as studentsTable,
  facultySubjectAssignments,
  studentAttendance,
  attendanceSessions,
  studentMarks,
  staffAccounts,
  syllabusSubjects,
  studentAttendanceDisputes
} from '@/db/schema';
import { eq, and, inArray, sql, asc, desc, like, or } from 'drizzle-orm';
import { branchCodes } from '@/lib/rollNumber';
import {
  getAuthorizedAcademicBranches,
  getAllowedAcademicSemesters,
  isAcademicScopeAllowed,
  getInstitutionalBranches,
  isAcademicYearLocked,
  isDesignatedAcademicSupervisor
} from '@/lib/academic-authorization';
import { getCollegeAcademicYear, deriveDefaultAcademicYear, resolveCanonicalSubjectType } from '@/lib/academic-utils';
import { getTheoryPattern } from '@/lib/evaluation-utils';

export class AcademicMonitoringService {
  /**
   * Resolves and verifies the academic scope for the calling user.
   */
  static async resolveScope(user, { branch, semester, academicYear }) {
    if (!user) {
      const err = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }

    const currentYear = await getCollegeAcademicYear();
    const resolvedYear = academicYear || currentYear || deriveDefaultAcademicYear();

    const institutionalBranches = await getInstitutionalBranches();
    const authorizedBranches = getAuthorizedAcademicBranches(user) || institutionalBranches;

    let targetBranch = branch ? String(branch).toUpperCase().trim() : null;
    if (!targetBranch) {
      targetBranch = authorizedBranches.length > 0 ? authorizedBranches[0] : 'CSE';
    }

    // Authoritatively verify designated academic supervisor status server-side
    let isSupervisor = false;
    if (user.role !== 'admin' && (user.id || user.staffId)) {
      isSupervisor = await isDesignatedAcademicSupervisor(user.id || user.staffId, user.email);
    }
    user.is_designated_supervisor = isSupervisor;

    const isGlobal = user.role === 'admin' || isSupervisor;
    const isCoord = !!user.is_first_year_coordinator;
    const isHod = !!user.is_hod;

    // Regular faculty and unassigned staff are strictly blocked from academic monitoring
    if (!isGlobal && !isCoord && !isHod) {
      const err = new Error('Forbidden: You do not have authorization to access the academic monitoring console.');
      err.statusCode = 403;
      throw err;
    }

    if (!isGlobal && !isCoord && !authorizedBranches.includes(targetBranch)) {
      const err = new Error(`Forbidden: You do not have authorization to monitor academic records for branch ${targetBranch}.`);
      err.statusCode = 403;
      throw err;
    }

    const allowedSemesters = getAllowedAcademicSemesters(user, targetBranch);
    let targetSemester = semester !== undefined && semester !== null && semester !== 'all' && semester !== ''
      ? Number(semester)
      : null;

    if (targetSemester !== null) {
      if (isNaN(targetSemester) || targetSemester < 1 || targetSemester > 8) {
        const err = new Error('Invalid semester. Must be an integer between 1 and 8.');
        err.statusCode = 400;
        throw err;
      }

      if (!isAcademicScopeAllowed(user, { branch: targetBranch, semester: targetSemester })) {
        const err = new Error(`Forbidden: You do not have authorization for ${targetBranch} Semester ${targetSemester}.`);
        err.statusCode = 403;
        throw err;
      }
    } else {
      // Default semester
      targetSemester = allowedSemesters.length > 0 ? allowedSemesters[0] : 1;
    }

    // Lock check for mutations (monitoring is read-only, but informs UI)
    const lockInfo = await isAcademicYearLocked({
      academic_year: resolvedYear,
      branch: targetBranch,
      semester: targetSemester
    });

    return {
      user,
      isGlobal,
      isCoord,
      isHod,
      academicYear: resolvedYear,
      branch: targetBranch,
      semester: targetSemester,
      allowedBranches: authorizedBranches,
      allowedSemesters,
      isLocked: lockInfo.isLocked,
      lockReason: lockInfo.reason || null
    };
  }

  /**
   * Resolves canonical active subject assignments for the specified cohort.
   * Deduplicates co-taught subjects by grouping by subject_code and selecting min(assignment_id).
   */
  static async getCanonicalAssignments({ branch, semester, academicYear }) {
    const assignments = await db.select({
      id: facultySubjectAssignments.id,
      subject_code: facultySubjectAssignments.subject_code,
      subject_name: facultySubjectAssignments.subject_name,
      branch: facultySubjectAssignments.branch,
      course_semester: facultySubjectAssignments.course_semester,
      academic_year: facultySubjectAssignments.academic_year,
      staff_account_id: facultySubjectAssignments.staff_account_id,
      mid_max: facultySubjectAssignments.mid_max,
      faculty_name: staffAccounts.name,
      faculty_email: staffAccounts.email,
      canonical_subject_type: syllabusSubjects.subject_type
    })
    .from(facultySubjectAssignments)
    .leftJoin(staffAccounts, eq(facultySubjectAssignments.staff_account_id, staffAccounts.id))
    .leftJoin(syllabusSubjects, eq(facultySubjectAssignments.subject_code, syllabusSubjects.subject_code))
    .where(and(
      eq(facultySubjectAssignments.branch, branch),
      eq(facultySubjectAssignments.course_semester, semester),
      eq(facultySubjectAssignments.academic_year, academicYear),
      eq(facultySubjectAssignments.is_active, true)
    ))
    .orderBy(asc(facultySubjectAssignments.subject_code), asc(facultySubjectAssignments.id));

    // Deduplicate by subject_code (handle co-teaching gracefully)
    const canonicalMap = new Map();
    for (const a of assignments) {
      if (!canonicalMap.has(a.subject_code)) {
        const classification = resolveCanonicalSubjectType({
          subject_code: a.subject_code,
          subject_name: a.subject_name,
          canonical_subject_type: a.canonical_subject_type
        });

        const isLab = classification.is_lab;
        const theoryPattern = !isLab ? getTheoryPattern(a.mid_max || 20) : null;

        canonicalMap.set(a.subject_code, {
          id: a.id,
          assignment_ids: [a.id],
          subject_code: a.subject_code,
          subject_name: a.subject_name,
          branch: a.branch,
          course_semester: a.course_semester,
          academic_year: a.academic_year,
          mid_max: a.mid_max || (theoryPattern ? theoryPattern.midMax : 20),
          is_lab: isLab,
          subject_type: isLab ? 'lab' : 'theory',
          pattern: theoryPattern,
          faculty_names: [a.faculty_name || 'Unassigned'],
          faculty_emails: [a.faculty_email].filter(Boolean)
        });
      } else {
        const existing = canonicalMap.get(a.subject_code);
        existing.assignment_ids.push(a.id);
        if (a.faculty_name && !existing.faculty_names.includes(a.faculty_name)) {
          existing.faculty_names.push(a.faculty_name);
        }
        if (a.faculty_email && !existing.faculty_emails.includes(a.faculty_email)) {
          existing.faculty_emails.push(a.faculty_email);
        }
      }
    }

    return Array.from(canonicalMap.values());
  }

  /**
   * Retrieves all students belonging to the cohort based on roll-number branch & dynamic studying year.
   */
  static async getCohortStudents({ branch, semester, academicYear, search = null }) {
    const branchCode = Object.keys(branchCodes).find(key => branchCodes[key] === branch);
    if (!branchCode) {
      return [];
    }

    const startYear = parseInt(academicYear.split('-')[0], 10);
    const studyingYear = Math.ceil(semester / 2);

    const conditions = [
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
    ];

    if (search && search.trim()) {
      const q = search.trim();
      conditions.push(or(
        like(studentsTable.roll_no, `%${q}%`),
        like(studentsTable.name, `%${q}%`)
      ));
    }

    const students = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      email: studentsTable.email,
      admission_no: studentsTable.admission_no,
      admission_date: studentsTable.admission_date,
      academic_offset_years: studentsTable.academic_offset_years,
      academic_status: studentsTable.academic_status,
      created_at: studentsTable.created_at
    })
    .from(studentsTable)
    .where(and(...conditions))
    .orderBy(asc(studentsTable.roll_no));

    return students;
  }

  /**
   * Generates cohort overview metrics, summary cards, and monthly attendance distributions.
   */
  static async getAcademicOverview({ user, branch, semester, academicYear }) {
    const scope = await this.resolveScope(user, { branch, semester, academicYear });
    const canonicalAssignments = await this.getCanonicalAssignments(scope);
    const students = await this.getCohortStudents(scope);

    const allAssignmentIds = canonicalAssignments.flatMap(a => a.assignment_ids);
    const totalStudents = students.length;

    if (totalStudents === 0 || canonicalAssignments.length === 0) {
      return {
        scope: {
          academic_year: scope.academicYear,
          branch: scope.branch,
          semester: scope.semester,
          allowed_branches: scope.allowedBranches,
          allowed_semesters: scope.allowedSemesters,
          is_locked: scope.isLocked,
          lock_reason: scope.lockReason
        },
        summary: {
          total_students: 0,
          total_subjects: canonicalAssignments.length,
          total_conducted_sessions: 0,
          average_attendance_percentage: 0,
          students_below_75: 0,
          students_excellent_85: 0,
          consecutive_absences_count: 0,
          published_marks_count: 0,
          draft_marks_count: 0,
          pending_marks_count: 0,
          average_cie_marks: null
        },
        subjects: canonicalAssignments.map(a => ({
          subject_code: a.subject_code,
          subject_name: a.subject_name,
          faculty_names: a.faculty_names,
          subject_type: a.subject_type,
          conducted_sessions: 0,
          average_attendance_pct: 0,
          marks_published: false
        })),
        monthly_trend: []
      };
    }

    // 1. Fetch all attendance records for these assignments
    let rawAttendance = [];
    if (allAssignmentIds.length > 0) {
      rawAttendance = await db.select({
        student_id: studentAttendance.student_id,
        assignment_id: studentAttendance.assignment_id,
        session_id: studentAttendance.session_id,
        date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`.mapWith(String),
        session: studentAttendance.session,
        status: studentAttendance.status
      })
      .from(studentAttendance)
      .where(inArray(studentAttendance.assignment_id, allAssignmentIds));
    }

    // 2. Fetch distinct conducted sessions metadata
    let sessionRows = [];
    if (allAssignmentIds.length > 0) {
      sessionRows = await db.select({
        id: attendanceSessions.id,
        assignment_id: attendanceSessions.assignment_id,
        date: sql`DATE_FORMAT(${attendanceSessions.attendance_date}, '%Y-%m-%d')`.mapWith(String),
        session: attendanceSessions.session_number,
        topic_covered: attendanceSessions.topic_covered
      })
      .from(attendanceSessions)
      .where(inArray(attendanceSessions.assignment_id, allAssignmentIds));
    }

    // 3. Fetch marks records
    let marksRows = [];
    if (allAssignmentIds.length > 0) {
      marksRows = await db.select({
        student_id: studentMarks.student_id,
        assignment_id: studentMarks.assignment_id,
        is_published: studentMarks.is_published,
        mid1_marks: studentMarks.mid1_marks,
        mid2_marks: studentMarks.mid2_marks,
        assignment_marks: studentMarks.assignment_marks,
        lab_theory_marks: studentMarks.lab_theory_marks,
        lab_execution_marks: studentMarks.lab_execution_marks,
        lab_record_marks: studentMarks.lab_record_marks
      })
      .from(studentMarks)
      .where(inArray(studentMarks.assignment_id, allAssignmentIds));
    }

    // Map assignment ID -> canonical subject code
    const assignmentToSubjectCode = new Map();
    canonicalAssignments.forEach(ca => {
      ca.assignment_ids.forEach(aid => {
        assignmentToSubjectCode.set(aid, ca.subject_code);
      });
    });

    // Map student ID -> Student record
    const studentMap = new Map();
    students.forEach(s => studentMap.set(s.id, s));

    // Map distinct sessions per subject
    const subjectSessionsMap = new Map();
    canonicalAssignments.forEach(ca => subjectSessionsMap.set(ca.subject_code, new Map()));

    sessionRows.forEach(sr => {
      const code = assignmentToSubjectCode.get(sr.assignment_id);
      if (code && subjectSessionsMap.has(code)) {
        const sessNum = sr.session ?? sr.session_number;
        const key = `${sr.date}_${sessNum}`;
        subjectSessionsMap.get(code).set(key, {
          ...sr,
          session: sessNum
        });
      }
    });

    // Also include sessions inferred from attendance table if session metadata is missing
    rawAttendance.forEach(ra => {
      const code = assignmentToSubjectCode.get(ra.assignment_id);
      if (code && subjectSessionsMap.has(code)) {
        const key = `${ra.date}_${ra.session}`;
        if (!subjectSessionsMap.get(code).has(key)) {
          subjectSessionsMap.get(code).set(key, {
            id: ra.session_id || 0,
            assignment_id: ra.assignment_id,
            date: ra.date,
            session: ra.session,
            topic_covered: null
          });
        }
      }
    });

    // Compute Student-Level Attendance Summaries
    let cohortTotalAttended = 0;
    let cohortTotalConducted = 0;
    let below75Count = 0;
    let above85Count = 0;

    // Student -> { [subject_code]: { attended, total } }
    const studentAttendanceStats = new Map();
    // Student -> { [subject_code]: Array of recorded sessions sorted by date }
    const studentSubjectSessionTimeline = new Map();

    students.forEach(st => {
      studentAttendanceStats.set(st.id, {
        total_conducted: 0,
        total_attended: 0,
        subjects: {}
      });
      studentSubjectSessionTimeline.set(st.id, new Map());
      canonicalAssignments.forEach(ca => {
        studentSubjectSessionTimeline.get(st.id).set(ca.subject_code, []);
      });
    });

    rawAttendance.forEach(ra => {
      const st = studentMap.get(ra.student_id);
      if (!st) return;

      const admissionDate = st.admission_date ? String(st.admission_date) : '1900-01-01';
      if (ra.date < admissionDate) return; // Spot admission protection

      const code = assignmentToSubjectCode.get(ra.assignment_id);
      if (!code) return;

      const timelineMap = studentSubjectSessionTimeline.get(st.id);
      if (timelineMap && timelineMap.has(code)) {
        timelineMap.get(code).push({
          date: ra.date,
          session: ra.session,
          status: ra.status
        });
      }
    });

    // Count distinct sessions conducted for each student based on admission date
    students.forEach(st => {
      const stats = studentAttendanceStats.get(st.id);
      const admissionDate = st.admission_date ? String(st.admission_date) : '1900-01-01';

      canonicalAssignments.forEach(ca => {
        const subjectSessions = Array.from(subjectSessionsMap.get(ca.subject_code).values());
        const validSessions = subjectSessions.filter(s => s.date >= admissionDate);
        const validSessionKeys = new Set(validSessions.map(s => `${s.date}_${s.session}`));

        // Filter student attendance for this subject
        const attendedInSubject = (studentSubjectSessionTimeline.get(st.id).get(ca.subject_code) || [])
          .filter(r => validSessionKeys.has(`${r.date}_${r.session}`) && ['PRESENT', 'NCC', 'MEDICAL'].includes(r.status));

        const subConducted = validSessions.length;
        const subAttended = attendedInSubject.length;

        stats.subjects[ca.subject_code] = {
          conducted: subConducted,
          attended: subAttended,
          percentage: subConducted > 0 ? Math.round((subAttended / subConducted) * 1000) / 10 : 0
        };

        stats.total_conducted += subConducted;
        stats.total_attended += subAttended;
      });

      const stPct = stats.total_conducted > 0
        ? Math.round((stats.total_attended / stats.total_conducted) * 1000) / 10
        : 0;

      cohortTotalAttended += stats.total_attended;
      cohortTotalConducted += stats.total_conducted;

      if (stats.total_conducted > 0) {
        if (stPct < 75) below75Count++;
        if (stPct >= 85) above85Count++;
      }
    });

    // Descriptive count of students with consecutive absences in any subject
    let consecutiveAbsenceStudentsCount = 0;
    students.forEach(st => {
      let hasConsecutive = false;
      const timelineMap = studentSubjectSessionTimeline.get(st.id);

      for (const ca of canonicalAssignments) {
        const records = (timelineMap.get(ca.subject_code) || [])
          .sort((a, b) => b.date.localeCompare(a.date) || b.session - a.session);

        let streak = 0;
        for (const r of records) {
          if (r.status === 'ABSENT') {
            streak++;
            if (streak >= 3) {
              hasConsecutive = true;
              break;
            }
          } else {
            // Broken by PRESENT, NCC, or MEDICAL
            break;
          }
        }
        if (hasConsecutive) break;
      }

      if (hasConsecutive) {
        consecutiveAbsenceStudentsCount++;
      }
    });

    // Marks Aggregations
    let publishedMarksCount = 0;
    let draftMarksCount = 0;
    let totalMarksSum = 0;
    let scoredMarksCount = 0;

    const studentMarksMap = new Map();
    students.forEach(s => studentMarksMap.set(s.id, {}));

    marksRows.forEach(mr => {
      const code = assignmentToSubjectCode.get(mr.assignment_id);
      if (!code) return;
      const sMarks = studentMarksMap.get(mr.student_id);
      if (sMarks) {
        sMarks[code] = mr;
      }
    });

    // Calculate Marks per Student
    students.forEach(st => {
      const sMarks = studentMarksMap.get(st.id) || {};

      canonicalAssignments.forEach(ca => {
        const m = sMarks[ca.subject_code];
        if (!m) return;

        if (m.is_published) {
          publishedMarksCount++;
        } else {
          draftMarksCount++;
        }

        const toNum = (v) => (v !== null && v !== undefined && v !== '' ? Number(v) : null);
        let total = null;

        if (ca.is_lab) {
          const ex = toNum(m.lab_execution_marks);
          const th = toNum(m.lab_theory_marks);
          const rec = toNum(m.lab_record_marks);
          if (ex !== null || th !== null || rec !== null) {
            total = (ex ?? 0) + (th ?? 0) + (rec ?? 0);
          }
        } else {
          const m1 = toNum(m.mid1_marks);
          const m2 = toNum(m.mid2_marks);
          const asg = toNum(m.assignment_marks);
          if (m1 !== null || m2 !== null || asg !== null) {
            const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
            total = (ca.pattern?.hasAssignment ?? true) ? bestMid + (asg ?? 0) : bestMid;
          }
        }

        if (total !== null) {
          totalMarksSum += total;
          scoredMarksCount++;
        }
      });
    });

    const averageAttendancePct = cohortTotalConducted > 0
      ? Math.round((cohortTotalAttended / cohortTotalConducted) * 1000) / 10
      : 0;

    const averageCieMarks = scoredMarksCount > 0
      ? Math.round((totalMarksSum / scoredMarksCount) * 100) / 100
      : null;

    // Subject-level stats
    const subjectsSummary = canonicalAssignments.map(ca => {
      const conducted = subjectSessionsMap.get(ca.subject_code).size;
      let subAttendedSum = 0;
      let subConductedSum = 0;

      students.forEach(st => {
        const subStats = studentAttendanceStats.get(st.id)?.subjects[ca.subject_code];
        if (subStats) {
          subAttendedSum += subStats.attended;
          subConductedSum += subStats.conducted;
        }
      });

      const subAvgPct = subConductedSum > 0 ? Math.round((subAttendedSum / subConductedSum) * 1000) / 10 : 0;

      return {
        subject_code: ca.subject_code,
        subject_name: ca.subject_name,
        faculty_names: ca.faculty_names,
        subject_type: ca.subject_type,
        mid_max: ca.mid_max,
        conducted_sessions: conducted,
        average_attendance_pct: subAvgPct
      };
    });

    // Monthly Trend Aggregation
    const monthlyMap = new Map();
    sessionRows.forEach(sr => {
      if (!sr.date) return;
      const monthKey = sr.date.substring(0, 7); // 'YYYY-MM'
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthKey, conducted: 0, attended: 0 });
      }
      monthlyMap.get(monthKey).conducted++;
    });

    rawAttendance.forEach(ra => {
      if (!ra.date) return;
      const monthKey = ra.date.substring(0, 7);
      if (monthlyMap.has(monthKey) && ['PRESENT', 'NCC', 'MEDICAL'].includes(ra.status)) {
        monthlyMap.get(monthKey).attended++;
      }
    });

    const monthlyTrend = Array.from(monthlyMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: m.month,
        conducted_sessions: m.conducted,
        attendance_percentage: m.conducted > 0 ? Math.round((m.attended / (m.conducted * totalStudents)) * 1000) / 10 : 0
      }));

    return {
      scope: {
        academic_year: scope.academicYear,
        branch: scope.branch,
        semester: scope.semester,
        allowed_branches: scope.allowedBranches,
        allowed_semesters: scope.allowedSemesters,
        is_locked: scope.isLocked,
        lock_reason: scope.lockReason
      },
      summary: {
        total_students: totalStudents,
        total_subjects: canonicalAssignments.length,
        total_conducted_sessions: Array.from(subjectSessionsMap.values()).reduce((acc, m) => acc + m.size, 0),
        average_attendance_percentage: averageAttendancePct,
        students_below_75: below75Count,
        students_excellent_85: above85Count,
        consecutive_absences_count: consecutiveAbsenceStudentsCount,
        published_marks_count: publishedMarksCount,
        draft_marks_count: draftMarksCount,
        pending_marks_count: (totalStudents * canonicalAssignments.length) - (publishedMarksCount + draftMarksCount),
        average_cie_marks: averageCieMarks
      },
      subjects: subjectsSummary,
      monthly_trend: monthlyTrend
    };
  }

  /**
   * Generates cohort attendance grid data with student-wise and subject-wise breakdowns.
   */
  static async getCohortAttendance({ user, branch, semester, academicYear, search = null, page = 1, limit = 50 }) {
    const scope = await this.resolveScope(user, { branch, semester, academicYear });
    const canonicalAssignments = await this.getCanonicalAssignments(scope);
    const allStudents = await this.getCohortStudents({ ...scope, search });

    const totalStudents = allStudents.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(limit, 10) || 50));
    const totalPages = Math.ceil(totalStudents / pageSize) || 1;

    const offset = (pageNum - 1) * pageSize;
    const paginatedStudents = allStudents.slice(offset, offset + pageSize);

    const allAssignmentIds = canonicalAssignments.flatMap(a => a.assignment_ids);
    const paginatedStudentIds = paginatedStudents.map(s => s.id);

    // Fetch attendance for paginated students
    let rawAttendance = [];
    if (allAssignmentIds.length > 0 && paginatedStudentIds.length > 0) {
      rawAttendance = await db.select({
        student_id: studentAttendance.student_id,
        assignment_id: studentAttendance.assignment_id,
        date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`.mapWith(String),
        session: studentAttendance.session,
        status: studentAttendance.status
      })
      .from(studentAttendance)
      .where(and(
        inArray(studentAttendance.assignment_id, allAssignmentIds),
        inArray(studentAttendance.student_id, paginatedStudentIds)
      ));
    }

    // Fetch distinct sessions per subject
    let sessionRows = [];
    if (allAssignmentIds.length > 0) {
      sessionRows = await db.select({
        id: attendanceSessions.id,
        assignment_id: attendanceSessions.assignment_id,
        date: sql`DATE_FORMAT(${attendanceSessions.attendance_date}, '%Y-%m-%d')`.mapWith(String),
        session: attendanceSessions.session_number
      })
      .from(attendanceSessions)
      .where(inArray(attendanceSessions.assignment_id, allAssignmentIds));
    }

    const assignmentToSubjectCode = new Map();
    canonicalAssignments.forEach(ca => {
      ca.assignment_ids.forEach(aid => {
        assignmentToSubjectCode.set(aid, ca.subject_code);
      });
    });

    const subjectSessionsMap = new Map();
    canonicalAssignments.forEach(ca => subjectSessionsMap.set(ca.subject_code, new Map()));

    sessionRows.forEach(sr => {
      const code = assignmentToSubjectCode.get(sr.assignment_id);
      if (code && subjectSessionsMap.has(code)) {
        const sessNum = sr.session ?? sr.session_number;
        subjectSessionsMap.get(code).set(`${sr.date}_${sessNum}`, {
          ...sr,
          session: sessNum
        });
      }
    });

    // Populate student timeline
    const studentTimeline = new Map();
    paginatedStudents.forEach(st => {
      studentTimeline.set(st.id, new Map());
      canonicalAssignments.forEach(ca => {
        studentTimeline.get(st.id).set(ca.subject_code, []);
      });
    });

    rawAttendance.forEach(ra => {
      const code = assignmentToSubjectCode.get(ra.assignment_id);
      const stMap = studentTimeline.get(ra.student_id);
      if (code && stMap && stMap.has(code)) {
        stMap.get(code).push(ra);
      }
    });

    const studentRows = paginatedStudents.map(st => {
      const admissionDate = st.admission_date ? String(st.admission_date) : '1900-01-01';
      let totalConducted = 0;
      let totalAttended = 0;
      let totalPresent = 0;
      let totalNcc = 0;
      let totalMedical = 0;
      let totalAbsent = 0;

      const subjectBreakdown = {};
      let maxConsecutiveAbsences = 0;

      canonicalAssignments.forEach(ca => {
        const subjectSessions = Array.from(subjectSessionsMap.get(ca.subject_code).values());
        const validSessions = subjectSessions.filter(s => s.date >= admissionDate);
        const validKeys = new Set(validSessions.map(s => `${s.date}_${s.session}`));

        const subRecords = (studentTimeline.get(st.id).get(ca.subject_code) || [])
          .filter(r => validKeys.has(`${r.date}_${r.session}`));

        let subPresent = 0;
        let subNcc = 0;
        let subMedical = 0;
        let subAbsent = 0;

        subRecords.forEach(r => {
          if (r.status === 'PRESENT') subPresent++;
          else if (r.status === 'NCC') subNcc++;
          else if (r.status === 'MEDICAL') subMedical++;
          else if (r.status === 'ABSENT') subAbsent++;
        });

        const subAttended = subPresent + subNcc + subMedical;
        const subConducted = validSessions.length;
        const subPct = subConducted > 0 ? Math.round((subAttended / subConducted) * 1000) / 10 : 0;

        // Check consecutive absences in this subject
        const sortedRecords = [...subRecords].sort((a, b) => b.date.localeCompare(a.date) || b.session - a.session);
        let streak = 0;
        for (const r of sortedRecords) {
          if (r.status === 'ABSENT') streak++;
          else break;
        }
        if (streak > maxConsecutiveAbsences) {
          maxConsecutiveAbsences = streak;
        }

        subjectBreakdown[ca.subject_code] = {
          subject_name: ca.subject_name,
          conducted: subConducted,
          attended: subAttended,
          present: subPresent,
          ncc: subNcc,
          medical: subMedical,
          absent: subAbsent,
          percentage: subPct
        };

        totalConducted += subConducted;
        totalAttended += subAttended;
        totalPresent += subPresent;
        totalNcc += subNcc;
        totalMedical += subMedical;
        totalAbsent += subAbsent;
      });

      const overallPct = totalConducted > 0
        ? Math.round((totalAttended / totalConducted) * 1000) / 10
        : 0;

      let status = 'GOOD_STANDING';
      let statusLabel = 'Good Standing';
      if (totalConducted === 0) {
        status = 'INSUFFICIENT_DATA';
        statusLabel = 'No Sessions Recorded';
      } else if (overallPct < 75) {
        status = 'ATTENDANCE_ATTENTION';
        statusLabel = 'Attendance Attention Required';
      }

      return {
        id: st.id,
        roll_no: st.roll_no,
        name: st.name,
        branch: scope.branch,
        semester: scope.semester,
        total_sessions: totalConducted,
        attended_sessions: totalAttended,
        present_count: totalPresent,
        ncc_count: totalNcc,
        medical_count: totalMedical,
        absent_count: totalAbsent,
        attendance_percentage: overallPct,
        consecutive_absent_count: maxConsecutiveAbsences,
        status,
        status_label: statusLabel,
        subject_breakdown: subjectBreakdown
      };
    });

    return {
      scope: {
        academic_year: scope.academicYear,
        branch: scope.branch,
        semester: scope.semester,
        allowed_branches: scope.allowedBranches,
        allowed_semesters: scope.allowedSemesters
      },
      pagination: {
        total_students: totalStudents,
        page: pageNum,
        limit: pageSize,
        total_pages: totalPages
      },
      subjects: canonicalAssignments.map(ca => ({
        subject_code: ca.subject_code,
        subject_name: ca.subject_name,
        faculty_names: ca.faculty_names,
        is_lab: ca.is_lab
      })),
      students: studentRows
    };
  }

  /**
   * Generates cohort CIE marks data with theory/lab breakdown and publication status.
   */
  static async getCohortMarks({ user, branch, semester, academicYear, search = null, page = 1, limit = 50 }) {
    const scope = await this.resolveScope(user, { branch, semester, academicYear });
    const canonicalAssignments = await this.getCanonicalAssignments(scope);
    const allStudents = await this.getCohortStudents({ ...scope, search });

    const totalStudents = allStudents.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(limit, 10) || 50));
    const totalPages = Math.ceil(totalStudents / pageSize) || 1;

    const offset = (pageNum - 1) * pageSize;
    const paginatedStudents = allStudents.slice(offset, offset + pageSize);

    const allAssignmentIds = canonicalAssignments.flatMap(a => a.assignment_ids);
    const paginatedStudentIds = paginatedStudents.map(s => s.id);

    let marksRows = [];
    if (allAssignmentIds.length > 0 && paginatedStudentIds.length > 0) {
      marksRows = await db.select({
        id: studentMarks.id,
        student_id: studentMarks.student_id,
        assignment_id: studentMarks.assignment_id,
        is_published: studentMarks.is_published,
        mid1_marks: studentMarks.mid1_marks,
        mid2_marks: studentMarks.mid2_marks,
        assignment_marks: studentMarks.assignment_marks,
        lab_theory_marks: studentMarks.lab_theory_marks,
        lab_execution_marks: studentMarks.lab_execution_marks,
        lab_record_marks: studentMarks.lab_record_marks,
        updated_at: studentMarks.updated_at
      })
      .from(studentMarks)
      .where(and(
        inArray(studentMarks.assignment_id, allAssignmentIds),
        inArray(studentMarks.student_id, paginatedStudentIds)
      ));
    }

    const assignmentToSubjectCode = new Map();
    canonicalAssignments.forEach(ca => {
      ca.assignment_ids.forEach(aid => {
        assignmentToSubjectCode.set(aid, ca.subject_code);
      });
    });

    const studentMarksMap = new Map();
    paginatedStudents.forEach(st => studentMarksMap.set(st.id, new Map()));

    marksRows.forEach(mr => {
      const code = assignmentToSubjectCode.get(mr.assignment_id);
      const stMap = studentMarksMap.get(mr.student_id);
      if (code && stMap) {
        stMap.set(code, mr);
      }
    });

    const toNum = (v) => (v !== null && v !== undefined && v !== '' ? Number(v) : null);

    const studentRows = paginatedStudents.map(st => {
      const stMarks = studentMarksMap.get(st.id);
      let studentTotalMarks = 0;
      let evaluatedSubjectsCount = 0;
      let publishedSubjectsCount = 0;
      let draftSubjectsCount = 0;

      const subjectBreakdown = {};

      canonicalAssignments.forEach(ca => {
        const mr = stMarks?.get(ca.subject_code);
        if (!mr) {
          subjectBreakdown[ca.subject_code] = {
            subject_name: ca.subject_name,
            is_lab: ca.is_lab,
            status: 'NOT_ENTERED',
            is_published: false,
            total_marks: null,
            max_marks: 30
          };
          return;
        }

        if (mr.is_published) {
          publishedSubjectsCount++;
        } else {
          draftSubjectsCount++;
        }

        let calculatedTotal = null;

        if (ca.is_lab) {
          const ex = toNum(mr.lab_execution_marks);
          const th = toNum(mr.lab_theory_marks);
          const rec = toNum(mr.lab_record_marks);
          if (ex !== null || th !== null || rec !== null) {
            calculatedTotal = (ex ?? 0) + (th ?? 0) + (rec ?? 0);
          }
          subjectBreakdown[ca.subject_code] = {
            subject_name: ca.subject_name,
            is_lab: true,
            status: mr.is_published ? 'PUBLISHED' : 'DRAFT',
            is_published: Boolean(mr.is_published),
            lab_execution: ex,
            lab_theory: th,
            lab_record: rec,
            total_marks: calculatedTotal !== null ? Math.round(calculatedTotal * 100) / 100 : null,
            max_marks: 30
          };
        } else {
          const m1 = toNum(mr.mid1_marks);
          const m2 = toNum(mr.mid2_marks);
          const asg = toNum(mr.assignment_marks);
          const hasAny = m1 !== null || m2 !== null || asg !== null;

          if (hasAny) {
            const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
            calculatedTotal = (ca.pattern?.hasAssignment ?? true) ? bestMid + (asg ?? 0) : bestMid;
          }

          subjectBreakdown[ca.subject_code] = {
            subject_name: ca.subject_name,
            is_lab: false,
            status: mr.is_published ? 'PUBLISHED' : 'DRAFT',
            is_published: Boolean(mr.is_published),
            mid1: m1,
            mid2: m2,
            assignment: asg,
            best_mid: (m1 !== null || m2 !== null) ? Math.max(m1 ?? 0, m2 ?? 0) : null,
            total_marks: calculatedTotal !== null ? Math.round(calculatedTotal * 100) / 100 : null,
            max_marks: 30,
            pattern_name: ca.pattern?.name || 'Standard'
          };
        }

        if (calculatedTotal !== null) {
          studentTotalMarks += calculatedTotal;
          evaluatedSubjectsCount++;
        }
      });

      const avgCie = evaluatedSubjectsCount > 0
        ? Math.round((studentTotalMarks / evaluatedSubjectsCount) * 100) / 100
        : null;

      let status = 'PUBLISHED';
      let statusLabel = 'Marks Published';
      if (evaluatedSubjectsCount === 0) {
        status = 'NOT_ENTERED';
        statusLabel = 'Pending Evaluations';
      } else if (draftSubjectsCount > 0) {
        status = 'DRAFT';
        statusLabel = 'Draft Marks';
      }

      return {
        id: st.id,
        roll_no: st.roll_no,
        name: st.name,
        branch: scope.branch,
        semester: scope.semester,
        evaluated_subjects_count: evaluatedSubjectsCount,
        published_subjects_count: publishedSubjectsCount,
        draft_subjects_count: draftSubjectsCount,
        average_cie_marks: avgCie,
        status,
        status_label: statusLabel,
        subject_breakdown: subjectBreakdown
      };
    });

    return {
      scope: {
        academic_year: scope.academicYear,
        branch: scope.branch,
        semester: scope.semester,
        allowed_branches: scope.allowedBranches,
        allowed_semesters: scope.allowedSemesters
      },
      pagination: {
        total_students: totalStudents,
        page: pageNum,
        limit: pageSize,
        total_pages: totalPages
      },
      subjects: canonicalAssignments.map(ca => ({
        subject_code: ca.subject_code,
        subject_name: ca.subject_name,
        faculty_names: ca.faculty_names,
        is_lab: ca.is_lab,
        pattern: ca.pattern?.name || null
      })),
      students: studentRows
    };
  }

  /**
   * Generates combined attendance and marks performance matrix.
   */
  static async getCombinedAcademicData({ user, branch, semester, academicYear, search = null, page = 1, limit = 50 }) {
    const attendanceResult = await this.getCohortAttendance({ user, branch, semester, academicYear, search, page, limit });
    const marksResult = await this.getCohortMarks({ user, branch, semester, academicYear, search, page, limit });

    const marksMap = new Map();
    marksResult.students.forEach(s => marksMap.set(s.id, s));

    const combinedStudents = attendanceResult.students.map(att => {
      const mrk = marksMap.get(att.id);

      const attPct = att.attendance_percentage;
      const cieAvg = mrk?.average_cie_marks ?? null;

      let combinedCategory = 'MARKS_AVAILABLE';
      let combinedLabel = 'Marks Available';

      if (att.total_sessions === 0 && cieAvg === null) {
        combinedCategory = 'INSUFFICIENT_DATA';
        combinedLabel = 'Insufficient Data';
      } else if (att.total_sessions > 0 && attPct < 75) {
        combinedCategory = 'ATTENDANCE_ATTENTION';
        combinedLabel = 'Attendance Attention Required';
      } else if (cieAvg === null) {
        combinedCategory = 'MARKS_NOT_PUBLISHED';
        combinedLabel = 'Marks Not Published';
      }

      return {
        id: att.id,
        roll_no: att.roll_no,
        name: att.name,
        branch: att.branch,
        semester: att.semester,
        total_sessions: att.total_sessions,
        attended_sessions: att.attended_sessions,
        attendance_percentage: attPct,
        consecutive_absent_count: att.consecutive_absent_count,
        attendance_status: att.status,
        attendance_status_label: att.status_label,
        average_cie_marks: cieAvg,
        marks_status: mrk?.status || 'NOT_ENTERED',
        marks_status_label: mrk?.status_label || 'Pending Evaluations',
        combined_category: combinedCategory,
        combined_label: combinedLabel,
        attendance_subjects: att.subject_breakdown,
        marks_subjects: mrk?.subject_breakdown || {}
      };
    });

    return {
      scope: attendanceResult.scope,
      pagination: attendanceResult.pagination,
      subjects: attendanceResult.subjects,
      students: combinedStudents
    };
  }

  /**
   * Retrieves full academic history for an individual student (attendance sessions with topics, marks, disputes).
   */
  static async getStudentAcademicDetails({ user, studentId, branch, semester, academicYear }) {
    const sid = parseInt(studentId, 10);
    if (!sid || isNaN(sid)) {
      const err = new Error('Invalid student ID');
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch student record
    const [student] = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      name: studentsTable.name,
      email: studentsTable.email,
      admission_no: studentsTable.admission_no,
      admission_date: studentsTable.admission_date,
      date_of_birth: studentsTable.date_of_birth,
      gender: studentsTable.gender,
      mobile: studentsTable.mobile,
      academic_offset_years: studentsTable.academic_offset_years,
      student_status: studentsTable.student_status,
      academic_status: studentsTable.academic_status
    })
    .from(studentsTable)
    .where(eq(studentsTable.id, sid))
    .limit(1);

    if (!student) {
      const err = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Validate scope for this student
    const branchCodeMatch = student.roll_no ? student.roll_no.match(/567T?(\d{2})/) : null;
    const derivedBranch = branchCodeMatch ? branchCodes[branchCodeMatch[1]] : branch;

    const targetBranch = branch || derivedBranch || 'CSE';
    const scope = await this.resolveScope(user, { branch: targetBranch, semester, academicYear });

    // Anti-IDOR: Check that the requested student's branch matches the caller's scope
    if (derivedBranch && scope.branch !== derivedBranch) {
      const err = new Error(`Forbidden: Student ${student.roll_no} belongs to branch ${derivedBranch}, outside your authorized scope.`);
      err.statusCode = 403;
      throw err;
    }

    const canonicalAssignments = await this.getCanonicalAssignments(scope);
    const allAssignmentIds = canonicalAssignments.flatMap(a => a.assignment_ids);

    const assignmentToSubject = new Map();
    canonicalAssignments.forEach(ca => {
      ca.assignment_ids.forEach(aid => {
        assignmentToSubject.set(aid, ca);
      });
    });

    const admissionDate = student.admission_date ? String(student.admission_date) : '1900-01-01';

    // 3. Fetch Student Attendance Records
    let attendanceRecords = [];
    if (allAssignmentIds.length > 0) {
      attendanceRecords = await db.select({
        id: studentAttendance.id,
        assignment_id: studentAttendance.assignment_id,
        session_id: studentAttendance.session_id,
        date: sql`DATE_FORMAT(${studentAttendance.date}, '%Y-%m-%d')`.mapWith(String),
        session: studentAttendance.session,
        status: studentAttendance.status,
        submitted_at: studentAttendance.submitted_at
      })
      .from(studentAttendance)
      .where(and(
        eq(studentAttendance.student_id, sid),
        inArray(studentAttendance.assignment_id, allAssignmentIds)
      ))
      .orderBy(desc(studentAttendance.date), desc(studentAttendance.session));
    }

    // 4. Fetch Attendance Sessions Metadata (Topics & Faculty)
    let sessionsMetadata = [];
    if (allAssignmentIds.length > 0) {
      sessionsMetadata = await db.select({
        id: attendanceSessions.id,
        assignment_id: attendanceSessions.assignment_id,
        date: sql`DATE_FORMAT(${attendanceSessions.attendance_date}, '%Y-%m-%d')`.mapWith(String),
        session_number: attendanceSessions.session_number,
        topic_covered: attendanceSessions.topic_covered,
        faculty_name: staffAccounts.name
      })
      .from(attendanceSessions)
      .leftJoin(staffAccounts, eq(attendanceSessions.faculty_id, staffAccounts.id))
      .where(inArray(attendanceSessions.assignment_id, allAssignmentIds));
    }

    // 5. Fetch Disputes if any
    let disputeRows = [];
    if (allAssignmentIds.length > 0) {
      disputeRows = await db.select({
        id: studentAttendanceDisputes.id,
        assignment_id: studentAttendanceDisputes.assignment_id,
        date: sql`DATE_FORMAT(${studentAttendanceDisputes.attendance_date}, '%Y-%m-%d')`.mapWith(String),
        session: studentAttendanceDisputes.session,
        status: studentAttendanceDisputes.status,
        category: studentAttendanceDisputes.category,
        reason: studentAttendanceDisputes.reason
      })
      .from(studentAttendanceDisputes)
      .where(and(
        eq(studentAttendanceDisputes.student_id, sid),
        inArray(studentAttendanceDisputes.assignment_id, allAssignmentIds)
      ));
    }

    const sessionMetaMap = new Map();
    sessionsMetadata.forEach(sm => {
      sessionMetaMap.set(`${sm.assignment_id}_${sm.date}_${sm.session_number}`, sm);
    });

    const disputeMap = new Map();
    disputeRows.forEach(dr => {
      disputeMap.set(`${dr.assignment_id}_${dr.date}_${dr.session}`, dr);
    });

    // Assemble Chronological Attendance History
    const sessionHistory = attendanceRecords.map(ar => {
      const ca = assignmentToSubject.get(ar.assignment_id);
      const meta = sessionMetaMap.get(`${ar.assignment_id}_${ar.date}_${ar.session}`);
      const disp = disputeMap.get(`${ar.assignment_id}_${ar.date}_${ar.session}`);

      const topicText = (meta?.topic_covered && meta.topic_covered.trim().length > 0)
        ? meta.topic_covered.trim()
        : 'Topic not recorded';

      return {
        id: ar.id,
        date: ar.date,
        session_number: ar.session,
        subject_code: ca?.subject_code || 'N/A',
        subject_name: ca?.subject_name || 'N/A',
        faculty_name: meta?.faculty_name || ca?.faculty_names?.join(', ') || 'Assigned Faculty',
        status: ar.status,
        topic_covered: topicText,
        submitted_at: ar.submitted_at,
        dispute_status: disp?.status || null,
        is_pre_admission: ar.date < admissionDate
      };
    });

    // 6. Fetch Student Marks
    let marksRows = [];
    if (allAssignmentIds.length > 0) {
      marksRows = await db.select({
        id: studentMarks.id,
        assignment_id: studentMarks.assignment_id,
        is_published: studentMarks.is_published,
        mid1_marks: studentMarks.mid1_marks,
        mid2_marks: studentMarks.mid2_marks,
        assignment_marks: studentMarks.assignment_marks,
        lab_theory_marks: studentMarks.lab_theory_marks,
        lab_execution_marks: studentMarks.lab_execution_marks,
        lab_record_marks: studentMarks.lab_record_marks,
        updated_at: studentMarks.updated_at
      })
      .from(studentMarks)
      .where(and(
        eq(studentMarks.student_id, sid),
        inArray(studentMarks.assignment_id, allAssignmentIds)
      ));
    }

    const marksBySubject = new Map();
    marksRows.forEach(mr => {
      const ca = assignmentToSubject.get(mr.assignment_id);
      if (ca) {
        marksBySubject.set(ca.subject_code, mr);
      }
    });

    const toNum = (v) => (v !== null && v !== undefined && v !== '' ? Number(v) : null);

    const subjectAcademicCards = canonicalAssignments.map(ca => {
      const subAtt = sessionHistory.filter(sh => sh.subject_code === ca.subject_code && !sh.is_pre_admission);
      const attended = subAtt.filter(sh => ['PRESENT', 'NCC', 'MEDICAL'].includes(sh.status)).length;
      const total = subAtt.length;
      const attPct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;

      const mr = marksBySubject.get(ca.subject_code);
      let cieTotal = null;
      let components = {};

      if (mr) {
        if (ca.is_lab) {
          const ex = toNum(mr.lab_execution_marks);
          const th = toNum(mr.lab_theory_marks);
          const rec = toNum(mr.lab_record_marks);
          if (ex !== null || th !== null || rec !== null) {
            cieTotal = (ex ?? 0) + (th ?? 0) + (rec ?? 0);
          }
          components = {
            execution: ex,
            theory: th,
            record: rec
          };
        } else {
          const m1 = toNum(mr.mid1_marks);
          const m2 = toNum(mr.mid2_marks);
          const asg = toNum(mr.assignment_marks);
          if (m1 !== null || m2 !== null || asg !== null) {
            const bestMid = Math.max(m1 ?? 0, m2 ?? 0);
            cieTotal = (ca.pattern?.hasAssignment ?? true) ? bestMid + (asg ?? 0) : bestMid;
          }
          components = {
            mid1: m1,
            mid2: m2,
            best_mid: (m1 !== null || m2 !== null) ? Math.max(m1 ?? 0, m2 ?? 0) : null,
            assignment: asg
          };
        }
      }

      return {
        subject_code: ca.subject_code,
        subject_name: ca.subject_name,
        faculty_names: ca.faculty_names,
        is_lab: ca.is_lab,
        pattern: ca.pattern?.name || null,
        attendance: {
          conducted: total,
          attended,
          percentage: attPct
        },
        marks: {
          is_entered: Boolean(mr),
          is_published: Boolean(mr?.is_published),
          status_label: !mr ? 'Not Entered' : (mr.is_published ? 'Published' : 'Draft / Not Published'),
          total_marks: cieTotal !== null ? Math.round(cieTotal * 100) / 100 : null,
          max_marks: 30,
          components
        }
      };
    });

    const validHistory = sessionHistory.filter(sh => !sh.is_pre_admission);
    const overallAttended = validHistory.filter(sh => ['PRESENT', 'NCC', 'MEDICAL'].includes(sh.status)).length;
    const overallTotal = validHistory.length;
    const overallAttPct = overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 1000) / 10 : 0;

    return {
      student: {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        email: student.email,
        admission_no: student.admission_no,
        admission_date: student.admission_date,
        branch: scope.branch,
        semester: scope.semester,
        academic_year: scope.academicYear,
        academic_status: student.academic_status
      },
      summary: {
        overall_attendance_pct: overallAttPct,
        total_conducted: overallTotal,
        total_attended: overallAttended,
        total_absent: validHistory.filter(sh => sh.status === 'ABSENT').length
      },
      subject_cards: subjectAcademicCards,
      attendance_history: sessionHistory
    };
  }

  /**
   * Generates sanitized, formula-injection safe CSV export content.
   */
  static async generateCsvExport({ user, type = 'combined', branch, semester, academicYear }) {
    const safeCell = (str) => {
      if (str === null || str === undefined) return '""';
      let clean = String(str).replace(/"/g, '""');
      // Escape CSV formula injection characters (=, +, -, @, \t, \r)
      if (/^[=+\-@\t\r]/.test(clean)) {
        clean = `'${clean}`;
      }
      return `"${clean}"`;
    };

    if (type === 'attendance') {
      const data = await this.getCohortAttendance({ user, branch, semester, academicYear, limit: 1000 });
      const rows = [];

      // Metadata Header
      rows.push(['# KU COLLEGE OF ENGINEERING & TECHNOLOGY - ATTENDANCE REPORT']);
      rows.push([`# Academic Year: ${data.scope.academic_year} | Branch: ${data.scope.branch} | Semester: ${data.scope.semester}`]);
      rows.push([`# Export Date: ${new Date().toISOString()}`]);
      rows.push([]);

      // Column Headers
      const headers = ['Roll Number', 'Student Name', 'Branch', 'Sem', 'Total Sessions', 'Attended', 'Present', 'NCC', 'Medical', 'Absent', 'Attendance %', 'Status'];
      data.subjects.forEach(s => {
        headers.push(`${s.subject_code} (Att/Tot)`);
        headers.push(`${s.subject_code} %`);
      });
      rows.push(headers);

      // Data Rows
      data.students.forEach(st => {
        const row = [
          st.roll_no,
          st.name,
          st.branch,
          st.semester,
          st.total_sessions,
          st.attended_sessions,
          st.present_count,
          st.ncc_count,
          st.medical_count,
          st.absent_count,
          `${st.attendance_percentage}%`,
          st.status_label
        ];
        data.subjects.forEach(s => {
          const sub = st.subject_breakdown[s.subject_code];
          if (sub) {
            row.push(`${sub.attended}/${sub.conducted}`);
            row.push(`${sub.percentage}%`);
          } else {
            row.push('0/0');
            row.push('0%');
          }
        });
        rows.push(row);
      });

      return rows.map(r => r.map(safeCell).join(',')).join('\r\n');
    }

    if (type === 'marks') {
      const data = await this.getCohortMarks({ user, branch, semester, academicYear, limit: 1000 });
      const rows = [];

      rows.push(['# KU COLLEGE OF ENGINEERING & TECHNOLOGY - CIE MARKS REPORT']);
      rows.push([`# Academic Year: ${data.scope.academic_year} | Branch: ${data.scope.branch} | Semester: ${data.scope.semester}`]);
      rows.push([`# Export Date: ${new Date().toISOString()}`]);
      rows.push([]);

      const headers = ['Roll Number', 'Student Name', 'Branch', 'Sem', 'Evaluated Subjects', 'Average CIE (Out of 30)', 'Status'];
      data.subjects.forEach(s => {
        headers.push(`${s.subject_code} Marks`);
        headers.push(`${s.subject_code} Status`);
      });
      rows.push(headers);

      data.students.forEach(st => {
        const row = [
          st.roll_no,
          st.name,
          st.branch,
          st.semester,
          st.evaluated_subjects_count,
          st.average_cie_marks !== null ? st.average_cie_marks : 'N/A',
          st.status_label
        ];
        data.subjects.forEach(s => {
          const sub = st.subject_breakdown[s.subject_code];
          if (sub && sub.total_marks !== null) {
            row.push(sub.total_marks);
            row.push(sub.is_published ? 'Published' : 'Draft');
          } else {
            row.push('N/A');
            row.push('Not Entered');
          }
        });
        rows.push(row);
      });

      return rows.map(r => r.map(safeCell).join(',')).join('\r\n');
    }

    // Default: Combined
    const data = await this.getCombinedAcademicData({ user, branch, semester, academicYear, limit: 1000 });
    const rows = [];

    rows.push(['# KU COLLEGE OF ENGINEERING & TECHNOLOGY - CONSOLIDATED ACADEMIC MONITORING REPORT']);
    rows.push([`# Academic Year: ${data.scope.academic_year} | Branch: ${data.scope.branch} | Semester: ${data.scope.semester}`]);
    rows.push([`# Export Date: ${new Date().toISOString()}`]);
    rows.push([]);

    const headers = [
      'Roll Number',
      'Student Name',
      'Branch',
      'Sem',
      'Attendance %',
      'Attendance Status',
      'Average CIE (30)',
      'Marks Status',
      'Combined Status'
    ];
    rows.push(headers);

    data.students.forEach(st => {
      rows.push([
        st.roll_no,
        st.name,
        st.branch,
        st.semester,
        `${st.attendance_percentage}%`,
        st.attendance_status_label,
        st.average_cie_marks !== null ? st.average_cie_marks : 'N/A',
        st.marks_status_label,
        st.combined_label
      ]);
    });

    return rows.map(r => r.map(safeCell).join(',')).join('\r\n');
  }
}
