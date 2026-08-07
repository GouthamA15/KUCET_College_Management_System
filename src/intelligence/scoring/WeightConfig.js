import { db } from '@/db';
import { systemConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cacheAside } from '@/lib/cache';

const DEFAULT_WEIGHTS = {
  ATTENDANCE_RISK: {
    overall_attendance: 0.6,
    subject_min_attendance: 0.4
  },
  ACADEMIC_RISK: {
    avg_marks: 0.5,
    failed_subjects: 0.3,
    marks_trend: 0.2
  },
  FEE_DEFAULT_RISK: {
    years_unpaid: 0.7,
    scholarship_status: 0.3
  },
  SCHOLARSHIP_RISK: {
    missing_docs: 0.6,
    pending_time: 0.4
  },
  STUDENT_PERF: {
    attendance: 0.3,
    marks: 0.4,
    fee_compliance: 0.2,
    engagement: 0.1
  },
  FACULTY_PERF: {
    attendance_submission_rate: 0.3,
    topic_coverage: 0.3,
    student_pass_rate: 0.4
  },
  DEPT_PERF: {
    avg_student_perf: 0.4,
    faculty_perf: 0.3,
    fee_collection: 0.2,
    scholarship_coverage: 0.1
  }
};

export async function getWeights(model) {
  const fetcher = async () => {
    try {
      const configRows = await db.select().from(systemConfigs).where(eq(systemConfigs.config_key, 'INTELLIGENCE_SCORE_WEIGHTS'));
      if (configRows.length > 0 && configRows[0].config_value) {
        return JSON.parse(configRows[0].config_value);
      }
    } catch (e) {
      // return default on db error
    }
    return DEFAULT_WEIGHTS;
  };
  
  const allWeights = await cacheAside('score_weights', fetcher, { ttl: 300, tags: ['intelligence'] });
  
  return allWeights[model] || DEFAULT_WEIGHTS[model] || {};
}
