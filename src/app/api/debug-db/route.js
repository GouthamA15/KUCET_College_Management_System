import { query } from '@/lib/db';
import { apiResponse } from '@/lib/api-utils';

export async function GET() {
  const tt = await query('SELECT * FROM branch_timetable LIMIT 10');
  const clerks = await query('SELECT id, name, is_hod, branch FROM clerks WHERE is_hod = 1');
  const sems = await query('SELECT * FROM semesters ORDER BY id DESC LIMIT 1');
  
  return apiResponse({ 
    timetable_sample: tt,
    hods: clerks,
    latest_semester: sems
  });
}
