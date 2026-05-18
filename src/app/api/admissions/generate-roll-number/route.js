import logger from '@/lib/logger';
import { db } from '@/db';
import { students as studentsTable } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';
import { buildRollNumber, getAdmissionSymbol, getBranchCodeFromName, getNextSerialNumber, validateGeneratedRollNumber } from '@/lib/autoGenerateRollNumber';

function parseJoiningYear(joiningYear) {
  const y = Number(joiningYear);
  if (!Number.isInteger(y)) return null;
  return y;
}

export async function POST(req) {
  const user = await getAuthUser('clerk');
  if (!user || user.role !== 'admission') return apiError('Forbidden', 403);

  try {
    const body = await req.json();

    const branch = body.branch;
    const examType = body.examType || body.entrance_exam || body.entranceExam;
    const joiningYear = parseJoiningYear(body.joiningYear);
    const countRaw = body.count == null ? 1 : Number(body.count);
    const count = Number.isInteger(countRaw) ? countRaw : 1;

    if (!branch || !examType || !joiningYear) {
      return apiError('branch, examType, and joiningYear are required', 400);
    }
    if (count < 1 || count > 200) {
      return apiError('count must be between 1 and 200', 400);
    }

    const result = await db.transaction(async (tx) => {
      const admissionSymbol = getAdmissionSymbol(examType);
      const branchCode = getBranchCodeFromName(branch);
      if (!branchCode) throw new Error(`Unknown branch: ${branch}`);
      const startSerial = await getNextSerialNumber(tx, { branch });

      const rollNumbers = [];
      for (let i = 0; i < count; i++) {
        const serial = startSerial + i;
        const roll = buildRollNumber({
          joiningYear,
          branchCode,
          serial,
          admissionSymbol,
        });

        const check = validateGeneratedRollNumber(roll, { expectedBranch: branch, expectedExamType: examType });
        if (!check.isValid) {
          throw new Error(check.error || 'Generated roll number failed validation');
        }
        rollNumbers.push(roll);
      }

      // Sanity check: avoid returning duplicates that already exist in students.
      // (Unique constraint enforces this at finalization; this is a proactive guard.)
      const existing = await tx
        .select({ roll_no: studentsTable.roll_no })
        .from(studentsTable)
        .where(inArray(studentsTable.roll_no, rollNumbers))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('ROLL_CONFLICT');
      }

      return rollNumbers;
    });

    if (result.length === 1) {
      return apiResponse({ success: true, rollNumber: result[0] });
    }

    return apiResponse({ success: true, rollNumbers: result });
  } catch (error) {
    if (error instanceof SyntaxError) return apiError('Invalid JSON in request body', 400);
    if (error.message === 'ROLL_CONFLICT') return apiError('Roll number conflict detected. Try again.', 409);
    if (String(error.message || '').includes('Unknown branch')) return apiError(error.message, 400);
    if (String(error.message || '').includes('Unsupported examType')) return apiError(error.message, 400);
    if (String(error.message || '').includes('joiningYear')) return apiError(error.message, 400);
    if (String(error.message || '').includes('Serial')) return apiError(error.message, 400);

    logger.error(error, 'Error generating roll number(s)');
    return apiError('Failed to generate roll number(s).', 500);
  }
}
