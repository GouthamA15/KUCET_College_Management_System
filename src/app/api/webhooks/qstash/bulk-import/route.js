import { db } from '@/db';
import { 
  students as studentsTable, 
  _studentPersonalDetails, 
  _studentAcademicBackground,
  studentImportLogs
} from '@/db/schema';
import { _eq, inArray } from 'drizzle-orm';
import { StudentService } from '@/services/StudentService';
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from 'next/server';

async function handler(req) {
  try {
    const body = await req.json();
    const { chunk, staffId, importFileName } = body;

    if (!chunk || !chunk.length) {
      return NextResponse.json({ success: true, message: 'Empty chunk' });
    }

    const incomingRolls = chunk.map(p => p.student.roll_no);
    const incomingEmails = chunk.map(p => p.student.email).filter(Boolean);

    // Fetch existing students by Roll No
    const existingByRoll = await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      email: studentsTable.email
    })
    .from(studentsTable)
    .where(inArray(studentsTable.roll_no, incomingRolls));

    // Fetch existing students by Email (to prevent cross-collisions)
    const existingByEmail = incomingEmails.length > 0 ? await db.select({
      id: studentsTable.id,
      roll_no: studentsTable.roll_no,
      email: studentsTable.email
    })
    .from(studentsTable)
    .where(inArray(studentsTable.email, incomingEmails)) : [];

    const rollMap = new Map(existingByRoll.map(s => [s.roll_no, s]));
    const emailMap = new Map(existingByEmail.map(s => [s.email, s]));

    let insertedCount = 0;
    let updatedCount = 0;
    const errors = [];
    const processedEmails = new Set();

    await db.transaction(async (tx) => {
      for (const rec of chunk) {
        const { student, personal, academic } = rec;
        
        // Collision Check: If email exists but belongs to a DIFFERENT roll number
        if (student.email) {
          const emailCollision = emailMap.get(student.email);
          if (emailCollision && emailCollision.roll_no !== student.roll_no) {
            errors.push({ 
              row: rec.rowNumber, 
              roll_no: student.roll_no, 
              reason: `Email (${student.email}) is already assigned to student ${emailCollision.roll_no}` 
            });
            continue; 
          }
          if (processedEmails.has(student.email)) {
            errors.push({ 
              row: rec.rowNumber, 
              roll_no: student.roll_no, 
              reason: `Email (${student.email}) is duplicated within the import file` 
            });
            continue;
          }
        }

        const isUpdate = rollMap.has(student.roll_no);

        // Perform Upsert via StudentService
        await StudentService.upsertStudent({
          ...student,
          ...personal,
          ...academic
        }, staffId, tx);

        if (student.email) processedEmails.add(student.email);

        if (isUpdate) updatedCount++;
        else insertedCount++;
      }

      if (insertedCount > 0 || updatedCount > 0) {
        await tx.insert(studentImportLogs).values({ 
          staff_id: staffId, 
          total_records: insertedCount + updatedCount, 
          file_name: importFileName 
        });
      }
    });

    return NextResponse.json({ success: true, insertedCount, updatedCount, errors });
  } catch (err) {
    console.error('Bulk Import Webhook Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Verify QStash Signature to ensure only Upstash can call this
export const POST = (process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY) ? verifySignatureAppRouter(handler) : handler;
