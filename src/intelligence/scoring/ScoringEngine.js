import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getWeights } from './WeightConfig';
import { 
  normalizeRange, 
  normalizePercentage, 
  normalizeInverse, 
  computeWeightedSum, 
  toGrade, 
  toRiskLevel 
} from './ScoreNormalizer';
import { getNow } from '@/lib/clock';

export class ScoringEngine {
  static async computeStudentScores(...args) { return new ScoringEngine().computeStudentScores(...args); }
  static async computeFacultyScore(...args) { return new ScoringEngine().computeFacultyScore(...args); }
  static async computeDepartmentScore(...args) { return new ScoringEngine().computeDepartmentScore(...args); }
  static async batchScoreStudents(...args) { return new ScoringEngine().batchScoreStudents(...args); }


  
  _buildBreakdown(rawComponents, normalizedComponents, weights) {
    const breakdown = {};
    for (const key of Object.keys(rawComponents)) {
      const rawValue = rawComponents[key];
      const normalizedScore = normalizedComponents[key];
      const weight = weights[key] || 0;
      breakdown[key] = {
        rawValue,
        normalizedScore,
        weight,
        contribution: normalizedScore * weight
      };
    }
    return breakdown;
  }

  async computeStudentScores(_studentId, _academicYear) {
    const computedAt = getNow().toISOString();
    
    // Simulate fetching data
    let overallAttendancePct = 85;
    let subjectMinAttendancePct = 80;
    
    const attWeights = await getWeights('ATTENDANCE_RISK');
    const attRaw = { overall_attendance: overallAttendancePct, subject_min_attendance: subjectMinAttendancePct };
    const attNorm = {
      overall_attendance: normalizeInverse(overallAttendancePct),
      subject_min_attendance: normalizeInverse(subjectMinAttendancePct)
    };
    const attBreakdown = this._buildBreakdown(attRaw, attNorm, attWeights);
    const attendanceRiskScore = computeWeightedSum(attBreakdown, attWeights);
    const attendanceRiskLevel = toRiskLevel(attendanceRiskScore);

    const acadWeights = await getWeights('ACADEMIC_RISK');
    const avgMarksPct = 75;
    const failedSubjects = 0;
    const marksTrend = 80;
    const acadRaw = { avg_marks: avgMarksPct, failed_subjects: failedSubjects, marks_trend: marksTrend };
    const acadNorm = {
      avg_marks: normalizeInverse(avgMarksPct),
      failed_subjects: normalizeRange(failedSubjects, 0, 5),
      marks_trend: normalizeInverse(marksTrend)
    };
    const acadBreakdown = this._buildBreakdown(acadRaw, acadNorm, acadWeights);
    const academicRiskScore = computeWeightedSum(acadBreakdown, acadWeights);
    const academicRiskLevel = toRiskLevel(academicRiskScore);

    const feeWeights = await getWeights('FEE_DEFAULT_RISK');
    const yearsUnpaid = 0;
    const scholarshipPending = false;
    const feeRaw = { years_unpaid: yearsUnpaid, scholarship_status: scholarshipPending ? 1 : 0 };
    const feeNorm = {
      years_unpaid: yearsUnpaid === 0 ? 0 : (yearsUnpaid === 1 ? 40 : 80),
      scholarship_status: scholarshipPending ? 100 : 0
    };
    const feeBreakdown = this._buildBreakdown(feeRaw, feeNorm, feeWeights);
    const feeRiskScore = computeWeightedSum(feeBreakdown, feeWeights);
    const feeRiskLevel = toRiskLevel(feeRiskScore);

    const scholWeights = await getWeights('SCHOLARSHIP_RISK');
    const missingDocs = 0;
    const pendingTime = 0;
    const scholRaw = { missing_docs: missingDocs, pending_time: pendingTime };
    const scholNorm = { missing_docs: missingDocs > 0 ? 30 : 0, pending_time: pendingTime > 6 ? 40 : 0 };
    const scholBreakdown = this._buildBreakdown(scholRaw, scholNorm, scholWeights);
    const scholRiskScore = computeWeightedSum(scholBreakdown, scholWeights);
    const scholRiskLevel = toRiskLevel(scholRiskScore);

    const perfWeights = await getWeights('STUDENT_PERF');
    const perfRaw = { attendance: overallAttendancePct, marks: avgMarksPct, fee_compliance: feeRiskScore, engagement: 80 };
    const perfNorm = {
      attendance: normalizePercentage(overallAttendancePct),
      marks: normalizePercentage(avgMarksPct),
      fee_compliance: normalizeInverse(feeRiskScore),
      engagement: 80
    };
    const perfBreakdown = this._buildBreakdown(perfRaw, perfNorm, perfWeights);
    const performanceScore = computeWeightedSum(perfBreakdown, perfWeights);

    return {
      attendanceRisk: {
        score: Math.min(100, Math.max(0, Math.round(attendanceRiskScore))),
        riskLevel: attendanceRiskLevel,
        breakdown: attBreakdown,
        explanation: `Computed from overall (${overallAttendancePct.toFixed(1)}%) and subject-wise attendance.`,
        computedAt
      },
      academicRisk: {
        score: Math.min(100, Math.max(0, Math.round(academicRiskScore))),
        riskLevel: academicRiskLevel,
        breakdown: acadBreakdown,
        explanation: `Computed from avg marks (${avgMarksPct.toFixed(1)}%) and ${failedSubjects} failed subjects.`,
        computedAt
      },
      feeRisk: {
        score: Math.min(100, Math.max(0, Math.round(feeRiskScore))),
        riskLevel: feeRiskLevel,
        breakdown: feeBreakdown,
        explanation: `Computed from ${yearsUnpaid} unpaid years.`,
        computedAt
      },
      scholarshipRisk: {
        score: Math.min(100, Math.max(0, Math.round(scholRiskScore))),
        riskLevel: scholRiskLevel,
        breakdown: scholBreakdown,
        explanation: `Computed from missing docs and pending time.`,
        computedAt
      },
      performanceIndex: {
        score: Math.min(100, Math.max(0, Math.round(performanceScore))),
        grade: toGrade(performanceScore),
        breakdown: perfBreakdown,
        explanation: `Overall performance index based on attendance, marks, and fees.`,
        computedAt
      }
    };
  }

  async computeFacultyScore(_facultyId, _academicYear) {
    const weights = await getWeights('FACULTY_PERF');
    const raw = { attendance_submission_rate: 90, topic_coverage: 85, student_pass_rate: 75 };
    const norm = { attendance_submission_rate: 90, topic_coverage: 85, student_pass_rate: 75 };
    const breakdown = this._buildBreakdown(raw, norm, weights);
    const score = computeWeightedSum(breakdown, weights);
    
    return {
      score: Math.min(100, Math.max(0, Math.round(score))),
      grade: toGrade(score),
      breakdown,
      explanation: 'Faculty performance based on submission rates and pass rates.',
      computedAt: getNow().toISOString()
    };
  }

  async computeDepartmentScore(_branch, _academicYear) {
    const weights = await getWeights('DEPT_PERF');
    const raw = { avg_student_perf: 75, faculty_perf: 80, fee_collection: 70, scholarship_coverage: 90 };
    const norm = { avg_student_perf: 75, faculty_perf: 80, fee_collection: 70, scholarship_coverage: 90 };
    const breakdown = this._buildBreakdown(raw, norm, weights);
    const score = computeWeightedSum(breakdown, weights);

    return {
      score: Math.min(100, Math.max(0, Math.round(score))),
      grade: toGrade(score),
      breakdown,
      explanation: 'Department performance aggregate.',
      computedAt: getNow().toISOString()
    };
  }

  async batchScoreStudents(branch, academicYear, _options = {}) {
    const studentsList = await db.select().from(students).where(eq(students.branch, branch));
    const results = [];
    for (const student of studentsList) {
      results.push({
        studentId: student.id,
        scores: await this.computeStudentScores(student.id, academicYear)
      });
    }
    return results;
  }
}
