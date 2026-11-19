import { NextResponse } from 'next/server';
import { getAuthUser, apiError } from '@/lib/api-utils';
import { generateAdmissionFormDocx } from '@/lib/admission-form-docx';
import { StudentService } from '@/services/StudentService';
import { db } from '@/db';
import { studentAdmissionDrafts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { formatDate } from '@/lib/date';
import logger from '@/lib/logger';

export async function GET(req) {
  try {
    const user = await getAuthUser('staff');
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const userRole = (user.role || '').toLowerCase();
    const isAllowed = ['admin', 'super_admin', 'admission', 'admission_clerk', 'staff', 'principal'].includes(userRole);
    if (!isAllowed) {
      return apiError('Access denied: Admission or Admin role required', 403);
    }

    const { searchParams } = new URL(req.url);
    const rollNo = searchParams.get('roll_no') || searchParams.get('rollno');
    const draftId = searchParams.get('draft_id');

    let formData = {};

    // 1. Pre-fill from Student Profile if roll_no provided
    if (rollNo) {
      const profile = await StudentService.getStudentProfile(rollNo);
      if (profile && profile.student) {
        const s = profile.student;
        const pd = s.personal_details || {};
        const ab = s.academic_background || {};
        formData = {
          admission_no: s.admission_no || '',
          branch: s.course || '',
          qualifying_exam: ab.qualifying_exam || '',
          name: s.name || '',
          father_name: pd.father_name || '',
          mother_name: pd.mother_name || '',
          guardian_name: pd.guardian_name || '',
          date_of_birth: s.date_of_birth ? formatDate(s.date_of_birth) : '',
          gender: s.gender || '',
          nationality: pd.nationality || 'Indian',
          religion: pd.religion || '',
          category: pd.category || '',
          sub_caste: pd.sub_caste || '',
          mother_tongue: pd.mother_tongue || '',
          place_of_birth: pd.place_of_birth || '',
          blood_group: pd.blood_group || '',
          father_occupation: pd.father_occupation || '',
          annual_income: pd.annual_income || '',
          aadhaar_no: pd.aadhaar_no || '',
          student_mobile: s.mobile || '',
          guardian_mobile: pd.guardian_mobile || '',
          email: s.email || '',
          identification_marks: pd.identification_marks || '',
          seat_allotted_category: pd.seat_allotted_category || '',
          exam_rank: ab.ranks || '',
          area_status: pd.area_status || 'Local',
          fee_reimbursement: s.fee_reimbursement || 'NO',
          present_address_line1: pd.contact_address || '',
          permanent_address_line1: pd.permanent_address || '',
        };
      }
    } else if (draftId) {
      const draftRows = await db.select()
        .from(studentAdmissionDrafts)
        .where(eq(studentAdmissionDrafts.id, parseInt(draftId, 10)))
        .limit(1);

      if (draftRows.length > 0) {
        const d = draftRows[0];
        formData = {
          academic_year: d.admission_year || '',
          branch: d.branch || '',
          qualifying_exam: d.entrance_exam || '',
          name: d.name || '',
          father_name: d.father_name || '',
          mother_name: d.mother_name || '',
          date_of_birth: d.dob ? formatDate(d.dob) : '',
          gender: d.gender || '',
          nationality: d.nationality || 'Indian',
          religion: d.religion || '',
          category: d.category || '',
          sub_caste: d.sub_caste || '',
          mother_tongue: d.mother_tongue || '',
          place_of_birth: d.place_of_birth || '',
          blood_group: d.blood_group || '',
          father_occupation: d.father_occupation || '',
          annual_income: d.annual_income || '',
          student_mobile: d.student_mobile || '',
          guardian_mobile: d.guardian_mobile || '',
          email: d.email || '',
          seat_allotted_category: d.seat_allotted_category || '',
          exam_rank: d.exam_rank || '',
          area_status: d.area_status || '',
        };
      }
    }

    const docxBuffer = generateAdmissionFormDocx(formData);
    const safeRoll = (rollNo || formData.admission_no || 'blank').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `kucet_admission_form_${safeRoll}.docx`;

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    const requestId = req.headers.get('x-request-id') || null;
    logger.error({ err, requestId, url: req.url }, 'Failed to generate admission form DOCX');
    return apiError('Failed to generate admission form DOCX', 500);
  }
}
