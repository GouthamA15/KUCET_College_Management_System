import logger from '@/lib/logger';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { StreakService } from '@/services/attendance/StreakService';
import { GoalAndNotificationService, GOAL_TYPES } from '@/services/attendance/GoalAndNotificationService';
import { z } from 'zod';

const createGoalSchema = z.object({
  goal_type: z.enum(GOAL_TYPES),
  title: z.string().trim().min(2).max(120),
  subject_code: z.string().trim().max(30).nullable().optional(),
  target_value: z.number().int().positive().max(1000),
  semester: z.number().int().positive().max(10).nullable().optional(),
  academic_year: z.string().trim().max(20).nullable().optional(),
});

const updateGoalSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(2).max(120).optional(),
  target_value: z.number().int().positive().max(1000).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export async function GET(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const querySemester = searchParams.get('semester');
    const queryAcademicYear = searchParams.get('academic_year');

    const streakData = await StreakService.calculateStudentStreak({
      studentId: user.student_id,
      rollNo: user.roll_no,
      semester: querySemester ? parseInt(querySemester, 10) : undefined,
      academicYear: queryAcademicYear || undefined,
    });

    await GoalAndNotificationService.syncGoalsWithStreakData(user.student_id, streakData);
    const goals = await GoalAndNotificationService.getStudentGoals(user.student_id, streakData);

    return apiResponse({ success: true, goals });
  } catch (error) {
    logger.error('Fetch Student Goals Error:', error);
    return apiError('Internal Server Error', 500);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const body = await request.json();
    const validated = createGoalSchema.parse(body);

    const streakData = await StreakService.calculateStudentStreak({
      studentId: user.student_id,
      rollNo: user.roll_no,
      semester: validated.semester || undefined,
      academicYear: validated.academic_year || undefined,
    });

    const result = await GoalAndNotificationService.createGoal(
      {
        studentId: user.student_id,
        goalType: validated.goal_type,
        title: validated.title,
        subjectCode: validated.subject_code || null,
        targetValue: validated.target_value,
        semester: validated.semester || null,
        academicYear: validated.academic_year || null,
      },
      streakData
    );

    return apiResponse(result, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid goal payload', 400);
    }
    return apiError(error.message || 'Failed to create personal goal', 400);
  }
}

export async function PUT(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const body = await request.json();
    const validated = updateGoalSchema.parse(body);

    const streakData = await StreakService.calculateStudentStreak({
      studentId: user.student_id,
      rollNo: user.roll_no,
    });

    const result = await GoalAndNotificationService.updateGoal(
      {
        studentId: user.student_id,
        goalId: validated.id,
        title: validated.title,
        targetValue: validated.target_value,
        status: validated.status,
      },
      streakData
    );

    return apiResponse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors?.[0]?.message || 'Invalid goal update', 400);
    }
    const status = error.message === 'Goal not found.' ? 404 : 400;
    return apiError(error.message || 'Failed to update goal', status);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthUser('student');
    if (!user) return apiError('Unauthorized', 401);

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '', 10);
    if (!Number.isInteger(id) || id <= 0) {
      return apiError('Valid goal id is required', 400);
    }

    const result = await GoalAndNotificationService.updateGoal({
      studentId: user.student_id,
      goalId: id,
      status: 'CANCELLED',
    });

    return apiResponse(result);
  } catch (error) {
    const status = error.message === 'Goal not found.' ? 404 : 400;
    return apiError(error.message || 'Failed to cancel goal', status);
  }
}
